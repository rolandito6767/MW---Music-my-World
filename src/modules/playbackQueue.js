/** Orden reproducible dentro de una sesión, sin alterar la biblioteca. */
export class PlaybackQueue {
  constructor(random = Math.random) {
    this.random = random;
    this.shuffle = false;
    this.repeat = 'off'; // off | all | one
    this.order = [];
    this.position = -1;
  }

  get currentId() { return this.order[this.position] ?? null; }
  get size() { return this.order.length; }

  set(ids, currentId = ids[0] ?? null) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) { this.order = []; this.position = -1; return; }
    const first = unique.includes(currentId) ? currentId : unique[0];
    const rest = unique.filter(id => id !== first);
    if (this.shuffle) this.#shuffle(rest);
    this.order = [first, ...rest];
    this.position = 0;
  }

  setShuffle(enabled) {
    const next = Boolean(enabled);
    if (next === this.shuffle) return;
    const current = this.currentId;
    const remaining = this.order.filter(id => id !== current);
    this.shuffle = next;
    if (next) this.#shuffle(remaining);
    this.order = current ? [current, ...remaining] : remaining;
    this.position = this.order.length ? 0 : -1;
  }

  setRepeat(mode) {
    if (!['off', 'all', 'one'].includes(mode)) throw new Error('Modo de repetición inválido.');
    this.repeat = mode;
  }

  next({ automatic = false } = {}) {
    if (!this.size) return null;
    if (automatic && this.repeat === 'one') return this.currentId;
    if (this.position < this.size - 1) {
      this.position += 1;
      return this.currentId;
    }
    if (automatic && this.repeat !== 'all') return null;
    // En aleatorio, al terminar el ciclo, creamos otra mezcla para no dejar un orden fijo.
    if (this.shuffle && this.size > 2) {
      const last = this.currentId;
      this.#shuffle(this.order);
      if (this.order[0] === last) [this.order[0], this.order[1]] = [this.order[1], this.order[0]];
    }
    this.position = 0;
    return this.currentId;
  }

  previous() {
    if (!this.size) return null;
    this.position = (this.position - 1 + this.size) % this.size;
    return this.currentId;
  }

  #shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}
