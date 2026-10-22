import { titleFromFileName } from './format.js';
import { readMetadata } from './metadata.js';

const SUPPORTED = /\.(mp3|wav)$/i;
export const fingerprintOf = (file) => JSON.stringify([file.name.toLowerCase(), file.size, file.lastModified]);

export class MusicLibrary extends EventTarget {
  #tracks = [];
  #fingerprints = new Set();
  #files = new Map();
  #pending = [];
  #enriching = 0;
  #counter = 0;
  get tracks() { return this.#tracks; }
  get size() { return this.#tracks.length; }
  getById(id) { return this.#tracks.find(t => t.id === id) ?? null; }
  getByKey(key) { return this.#tracks.find(t => t.key === key) ?? null; }
  getIndex(id) { return this.#tracks.findIndex(t => t.id === id); }
  getFile(key) { return this.#files.get(key) ?? null; }

  importFiles(files) {
    let ignored = 0;
    let duplicates = 0;
    const added = [];
    const pendingMetadata = [];
    for (const file of Array.from(files ?? [])) {
      if (!(file instanceof File) || !SUPPORTED.test(file.name)) { ignored++; continue; }
      const key = fingerprintOf(file);
      if (this.#fingerprints.has(key)) { duplicates++; continue; }
      this.#fingerprints.add(key);
      this.#files.set(key, file);
      const track = {
        id: `mw-${++this.#counter}`,
        key,
        title: titleFromFileName(file.name),
        artist: 'Artista desconocido',
        album: 'Álbum desconocido',
        fileName: file.name,
        url: URL.createObjectURL(file),
        coverUrl: null,
        duration: null,
      };
      this.#tracks.push(track);
      added.push(track);
      pendingMetadata.push({ track, file });
    }
    if (added.length) this.dispatchEvent(new Event('change'));
    // Etiquetas se procesan en background local sin bloquear la interfaz.
    this.#pending.push(...pendingMetadata);
    this.#pumpMetadata();
    return { added, ignored, duplicates };
  }

  #pumpMetadata() {
    while (this.#enriching < 3 && this.#pending.length) {
      const { track, file } = this.#pending.shift();
      this.#enriching++;
      void this.#enrich(track, file).finally(() => { this.#enriching--; this.#pumpMetadata(); });
    }
  }

  async #enrich(track, file) {
    const tags = await readMetadata(file);
    if (!this.#fingerprints.has(track.key)) return;
    if (tags.title) track.title = tags.title;
    if (tags.artist) track.artist = tags.artist;
    if (tags.album) track.album = tags.album;
    if (tags.cover) track.coverUrl = URL.createObjectURL(tags.cover);
    this.dispatchEvent(new CustomEvent('metadata', { detail: { track } }));
  }

  release() {
    for (const track of this.#tracks) {
      URL.revokeObjectURL(track.url);
      if (track.coverUrl) URL.revokeObjectURL(track.coverUrl);
    }
    this.#tracks = [];
    this.#fingerprints.clear();
    this.#files.clear();
    this.#pending = [];
  }
}
