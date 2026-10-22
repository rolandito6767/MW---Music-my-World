/** Persistimos solo referencias y nombres; no rutas ni música del usuario. */
const STORAGE_KEY = 'mw.playlists.v2';
const cleanName = (value) => String(value ?? '').trim().slice(0, 60);
const descriptor = (track) => ({ key: track.key, title: track.title, artist: track.artist, album: track.album });

export class PlaylistStore {
  #data = [];
  constructor(storage) {
    this.persistent = true;
    if (storage === undefined) {
      try { storage = window.localStorage; storage.getItem(STORAGE_KEY); }
      catch { this.persistent = false; storage = null; }
    }
    this.storage = storage ?? { getItem: () => null, setItem: () => {} };
    try {
      const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
      if (Array.isArray(raw)) this.#data = raw.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.entries)).map(p => ({
        id: p.id, name: cleanName(p.name), entries: p.entries.filter(e => e && typeof e.key === 'string').map(e => ({ key: e.key, title: String(e.title ?? 'Sin título'), artist: String(e.artist ?? ''), album: String(e.album ?? '') }))
      }));
    } catch { this.#data = []; }
  }
  get all() { return this.#data; }
  byId(id) { return this.#data.find(p => p.id === id) ?? null; }
  #save() {
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.#data)); }
    catch { throw new Error('No se pudieron guardar playlists. Revisa el espacio o permisos del navegador.'); }
  }
  #commit(callback) {
    const old = structuredClone(this.#data);
    try { const result = callback(); this.#save(); return result; }
    catch (err) { this.#data = old; throw err; }
  }
  create(name) {
    const normalized = cleanName(name);
    if (!normalized) throw new Error('Escribe un nombre para la playlist.');
    return this.#commit(() => {
      const item = { id: globalThis.crypto?.randomUUID?.() ?? `mw-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: normalized, entries: [] };
      this.#data.push(item);
      return item;
    });
  }
  rename(id, name) {
    const normalized = cleanName(name);
    if (!normalized) throw new Error('El nombre no puede estar vacío.');
    return this.#commit(() => { const p = this.byId(id); if (!p) return false; p.name = normalized; return true; });
  }
  remove(id) { return this.#commit(() => { const old = this.#data.length; this.#data = this.#data.filter(p => p.id !== id); return this.#data.length !== old; }); }
  add(id, track) {
    return this.#commit(() => {
      const p = this.byId(id);
      if (!p) throw new Error('La playlist ya no existe.');
      if (p.entries.some(e => e.key === track.key)) return false;
      p.entries.push(descriptor(track));
      return true;
    });
  }
  removeTrack(id, key) {
    return this.#commit(() => {
      const p = this.byId(id); if (!p) return false;
      const count = p.entries.length;
      p.entries = p.entries.filter(e => e.key !== key);
      return p.entries.length < count;
    });
  }
  refreshTrack(track) {
    let updated = false;
    for (const p of this.#data) for (const entry of p.entries) {
      if (entry.key === track.key && (entry.title !== track.title || entry.artist !== track.artist || entry.album !== track.album)) {
        Object.assign(entry, descriptor(track)); updated = true;
      }
    }
    if (updated) {
      try { this.#save(); } catch { /* La sesión puede continuar aunque storage esté lleno. */ }
    }
  }
}
