/**
 * Almacenamiento opcional de COPIAS de archivos MP3/WAV en IndexedDB.
 * No solicita permisos al disco ni modifica originales. Las copias pueden
 * ser eliminadas por el navegador bajo presión de espacio o modo privado.
 */
export const DATABASE_NAME = 'mw.offlineAudio.v4';
const OBJECT_STORE = 'tracks';
const DB_VERSION = 1;
const AUTO_KEY = 'mw.saveImports.v4';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Error de IndexedDB.'));
  });
}

export function bytesLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export class OfflineStorage {
  #databasePromise = null;
  #storage;
  #indexedDB;
  constructor({ indexedDB = globalThis.indexedDB, storage = null } = {}) {
    this.#indexedDB = indexedDB;
    this.#storage = storage;
    this.enabled = false;
    try { this.enabled = this.#storage?.getItem(AUTO_KEY) === 'true'; } catch { /* bloqueado */ }
  }
  get supported() { return Boolean(this.#indexedDB); }
  setEnabled(value) {
    this.enabled = Boolean(value);
    try { this.#storage?.setItem(AUTO_KEY, String(this.enabled)); }
    catch { /* Preferencia no persistente: almacenamiento restringido */ }
  }
  async #open() {
    if (!this.supported) throw new Error('IndexedDB no está disponible. Puedes reimportar tus canciones normalmente.');
    if (this.#databasePromise) return this.#databasePromise;
    this.#databasePromise = new Promise((resolve, reject) => {
      let request;
      try { request = this.#indexedDB.open(DATABASE_NAME, DB_VERSION); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(OBJECT_STORE)) request.result.createObjectStore(OBJECT_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); this.#databasePromise = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la biblioteca guardada.'));
      request.onblocked = () => reject(new Error('Cierra otras pestañas de MW y vuelve a intentarlo.'));
    }).catch(error => { this.#databasePromise = null; throw error; });
    return this.#databasePromise;
  }
  async #transaction(mode, work) {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      let transaction;
      try { transaction = db.transaction(OBJECT_STORE, mode); }
      catch (error) { reject(error); return; }
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error('Fallo de IndexedDB.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Operación de almacenamiento cancelada.'));
      try { result = work(transaction.objectStore(OBJECT_STORE)); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }
  async save(key, file) {
    if (!(file instanceof Blob)) throw new Error('El archivo no se puede guardar.');
    if (!key || !/\.(mp3|wav)$/i.test(file.name ?? '')) throw new Error('Formato no admitido para almacenamiento.');
    const value = { key, file, name: file.name, type: file.type, lastModified: file.lastModified, size: file.size };
    await this.#transaction('readwrite', store => store.put(value));
  }
  async getKeys() {
    const db = await this.#open();
    return requestResult(db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).getAllKeys());
  }
  async get(key) {
    const db = await this.#open();
    return requestResult(db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).get(key));
  }
  async clear() { await this.#transaction('readwrite', store => store.clear()); }
  async count() {
    const db = await this.#open();
    return requestResult(db.transaction(OBJECT_STORE, 'readonly').objectStore(OBJECT_STORE).count());
  }
  async estimate() {
    try { return await navigator.storage?.estimate?.() ?? null; } catch { return null; }
  }
  /** Restitución en lotes: evita cargar todas las canciones en memoria simultáneamente. */
  async restore(consumeBatch, onProgress = () => {}) {
    const keys = await this.getKeys();
    let recovered = 0;
    let failed = 0;
    let files = [];
    for (const key of keys) {
      try {
        const entry = await this.get(key);
        if (!entry || !(entry.file instanceof Blob) || !entry.name) { failed++; continue; }
        files.push(new File([entry.file], entry.name, { type: entry.type || '', lastModified: Number.isFinite(entry.lastModified) ? entry.lastModified : Date.now() }));
        if (files.length >= 10) { recovered += consumeBatch(files).added.length; files = []; onProgress(recovered, keys.length); }
      } catch { failed++; }
    }
    if (files.length) recovered += consumeBatch(files).added.length;
    onProgress(recovered, keys.length);
    return { recovered, failed, total: keys.length };
  }
}
