const KEY = 'mw.preferences.v3';
export const FREQUENCIES = [60, 170, 350, 1000, 3500, 10000];
export const PRESETS = Object.freeze({
  flat:       [0, 0, 0, 0, 0, 0],
  bass:       [6, 4, 2, 0, -1, -2],
  vocal:      [-2, -1, 1, 4, 3, 1],
  rock:       [4, 2, -2, 1, 3, 4],
  bright:     [-2, -1, 0, 1, 4, 6],
  warm:       [3, 2, 1, 0, -1, -2],
});
const clamp = (number, low, high, fallback = low) => Number.isFinite(Number(number)) ? Math.max(low, Math.min(high, Number(number))) : fallback;
export const defaults = () => ({
  volume: 0.75, shuffle: false, repeat: 'off',
  preset: 'flat', bands: [...PRESETS.flat], visualization: 'bars', dynamicColors: true,
});

/** Preferencias independientes de las playlists F2: una versión nueva nunca las borra. */
export class Preferences {
  constructor(storage = undefined) {
    this.persistent = true;
    if (storage === undefined) {
      try { storage = window.localStorage; storage.getItem(KEY); }
      catch { storage = null; this.persistent = false; }
    }
    this.storage = storage;
    this.data = defaults();
    try {
      const saved = JSON.parse(this.storage?.getItem(KEY) || 'null');
      if (saved && typeof saved === 'object') {
        this.data.volume = clamp(saved.volume, 0, 1, .75);
        this.data.shuffle = saved.shuffle === true;
        this.data.repeat = ['off', 'all', 'one'].includes(saved.repeat) ? saved.repeat : 'off';
        this.data.preset = Object.hasOwn(PRESETS, saved.preset) || saved.preset === 'custom' ? saved.preset : 'flat';
        this.data.bands = Array.isArray(saved.bands) && saved.bands.length === FREQUENCIES.length
          ? saved.bands.map(n => clamp(n, -12, 12, 0)) : [...PRESETS.flat];
        this.data.visualization = ['bars', 'wave'].includes(saved.visualization) ? saved.visualization : 'bars';
        this.data.dynamicColors = saved.dynamicColors !== false;
      }
    } catch { /* Preferencias corruptas: usar defaults, sin afectar playlists. */ }
  }
  #commit() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.data)); }
    catch { this.persistent = false; }
  }
  setVolume(n) { this.data.volume = clamp(n, 0, 1, .75); this.#commit(); }
  setShuffle(value) { this.data.shuffle = Boolean(value); this.#commit(); }
  cycleRepeat() {
    this.data.repeat = ({ off: 'all', all: 'one', one: 'off' })[this.data.repeat];
    this.#commit(); return this.data.repeat;
  }
  setPreset(id) {
    if (!Object.hasOwn(PRESETS, id)) throw new Error('Preset desconocido.');
    this.data.preset = id;
    this.data.bands = [...PRESETS[id]];
    this.#commit();
  }
  setBand(index, gain) {
    if (!Number.isInteger(index) || index < 0 || index >= FREQUENCIES.length) return;
    this.data.bands[index] = clamp(gain, -12, 12, 0);
    this.data.preset = 'custom';
    this.#commit();
  }
  setDynamicColors(value) { this.data.dynamicColors = Boolean(value); this.#commit(); }
  setVisualization(mode) {
    if (!['bars', 'wave'].includes(mode)) return;
    this.data.visualization = mode;
    this.#commit();
  }
}
