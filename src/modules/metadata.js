/** Lector local y sin dependencias de etiquetas ID3v1/ID3v2 y WAV INFO.
 *  Evita servicios externos; devuelve solo texto y un Blob de portada opcional.
 *  No cubre etiquetas exóticas ni todos los codificadores. */
const MAX_TAG_BYTES = 16 * 1024 * 1024;
const MAX_ART_BYTES = 6 * 1024 * 1024;
const decoder = (encoding) => new TextDecoder(encoding, { fatal: false });
const u32 = (d, p) => (d[p] * 0x1000000 + (d[p + 1] << 16) + (d[p + 2] << 8) + d[p + 3]) >>> 0;
const syncSafe = (d, p) => ((d[p] & 127) << 21) | ((d[p + 1] & 127) << 14) | ((d[p + 2] & 127) << 7) | (d[p + 3] & 127);
const ascii = (data, offset, length) => String.fromCharCode(...data.subarray(offset, offset + length));

function clean(value) { return (value || '').replace(/\0/g, '').trim(); }

function decodeText(data, encoding) {
  if (!data.length) return '';
  if (encoding === 0) return clean(decoder('windows-1252').decode(data));
  if (encoding === 3) return clean(decoder('utf-8').decode(data));
  if (encoding === 2) return clean(decoder('utf-16be').decode(data));
  if (encoding === 1) {
    if (data[0] === 0xfe && data[1] === 0xff) return clean(decoder('utf-16be').decode(data.subarray(2)));
    if (data[0] === 0xff && data[1] === 0xfe) return clean(decoder('utf-16le').decode(data.subarray(2)));
    return clean(decoder('utf-16le').decode(data));
  }
  return clean(decoder('utf-8').decode(data));
}

function terminatePosition(data, start, encoding) {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < data.length; i += 2) if (data[i] === 0 && data[i + 1] === 0) return i + 2;
    return data.length;
  }
  const ix = data.indexOf(0, start);
  return ix < 0 ? data.length : ix + 1;
}

function parsePicture(data, v2 = false) {
  if (!data.length) return null;
  const encoding = data[0];
  let pos = 1;
  let mime = '';
  if (v2) {
    mime = ascii(data, pos, 3).toUpperCase() === 'PNG' ? 'image/png' : 'image/jpeg';
    pos += 3;
  } else {
    const end = data.indexOf(0, pos);
    if (end === -1 || end > 128) return null;
    mime = ascii(data, pos, end - pos).toLowerCase();
    pos = end + 1;
  }
  pos++; // Picture type
  pos = terminatePosition(data, pos, encoding); // Description
  const raw = data.subarray(pos);
  if (!['image/jpeg', 'image/png'].includes(mime) || !raw.length || raw.length > MAX_ART_BYTES) return null;
  // Copiar evita retener en memoria todo el archivo de etiquetas.
  return new Blob([raw.slice()], { type: mime });
}

function parseID3(data, major, flags) {
  const found = {};
  const v2 = major === 2;
  let offset = 10;
  if (!v2 && (flags & 0x40)) {
    if (offset + 4 > data.length) return found;
    const count = major === 4 ? syncSafe(data, offset) : u32(data, offset) + 4;
    if (count < 4 || offset + count > data.length) return found;
    offset += count;
  }
  while (offset + (v2 ? 6 : 10) <= data.length) {
    const headSize = v2 ? 6 : 10;
    const id = ascii(data, offset, v2 ? 3 : 4);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const size = v2
      ? ((data[offset + 3] << 16) | (data[offset + 4] << 8) | data[offset + 5])
      : major === 4 ? syncSafe(data, offset + 4) : u32(data, offset + 4);
    if (!size || offset + headSize + size > data.length) break;
    const frameFlags = v2 ? 0 : data[offset + 9];
    let frame = data.subarray(offset + headSize, offset + headSize + size);
    offset += headSize + size;
    // Skip compressed/encrypted/grouped frames; parser reads ordinary frames.
    if ((!v2 && major === 3 && (frameFlags & 0xe0)) || (!v2 && major === 4 && (frameFlags & 0x4d))) continue;
    const map = { TT2: 'title', TIT2: 'title', TP1: 'artist', TPE1: 'artist', TAL: 'album', TALB: 'album', TP2: 'albumArtist', TPE2: 'albumArtist' };
    if (map[id] && !found[map[id]] && frame.length) {
      found[map[id]] = decodeText(frame.subarray(1), frame[0]).split(' / ')[0];
    } else if ((id === 'APIC' || id === 'PIC') && !found.cover) {
      try { found.cover = parsePicture(frame, v2); } catch { /* Cover malformada. */ }
    }
  }
  return found;
}

async function readMP3(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  const found = {};
  if (head.length === 10 && ascii(head, 0, 3) === 'ID3' && head[3] >= 2 && head[3] <= 4) {
    const n = syncSafe(head, 6);
    if (n > 0 && n + 10 <= MAX_TAG_BYTES && n + 10 <= file.size) {
      const bytes = new Uint8Array(await file.slice(0, n + 10).arrayBuffer());
      Object.assign(found, parseID3(bytes, head[3], head[5]));
    }
  }
  if ((!found.title || !found.artist || !found.album) && file.size >= 128) {
    const foot = new Uint8Array(await file.slice(-128).arrayBuffer());
    if (ascii(foot, 0, 3) === 'TAG') {
      found.title ||= clean(decoder('windows-1252').decode(foot.subarray(3, 33)));
      found.artist ||= clean(decoder('windows-1252').decode(foot.subarray(33, 63)));
      found.album ||= clean(decoder('windows-1252').decode(foot.subarray(63, 93)));
    }
  }
  return found;
}

async function readWAV(file) {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, MAX_TAG_BYTES)).arrayBuffer());
  const found = {};
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') return found;
  const view = new DataView(bytes.buffer);
  for (let i = 12; i + 8 <= bytes.length;) {
    const id = ascii(bytes, i, 4);
    const length = view.getUint32(i + 4, true);
    const end = i + 8 + length;
    if (end > bytes.length) break;
    if (id === 'LIST' && ascii(bytes, i + 8, 4) === 'INFO') {
      for (let j = i + 12; j + 8 <= end;) {
        const key = ascii(bytes, j, 4);
        const len = view.getUint32(j + 4, true);
        if (j + 8 + len > end) break;
        const val = clean(decoder('windows-1252').decode(bytes.subarray(j + 8, j + 8 + len)));
        if (key === 'INAM') found.title = val;
        if (key === 'IART') found.artist = val;
        if (key === 'IPRD') found.album = val;
        j += 8 + len + (len % 2);
      }
    }
    i = end + (length % 2);
  }
  return found;
}

export async function readMetadata(file) {
  try { return file.name.toLowerCase().endsWith('.wav') ? await readWAV(file) : await readMP3(file); }
  catch (error) { console.warn('MW: etiqueta ilegible', file.name, error); return {}; }
}
