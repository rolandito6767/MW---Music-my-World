/** Dibuja datos reales del AnalyserNode; no anima un ecualizador falso. */
export class Visualizer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.mode = 'bars';
    this.active = false;
    this.rafId = 0;
    this.freq = null;
    this.wave = null;
    this.paintIdle();
    this.onVisibility = () => this.update();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setMode(mode) { this.mode = mode === 'wave' ? 'wave' : 'bars'; if (!this.active) this.paintIdle(); }
  setVisible(visible) { this.visible = Boolean(visible); this.update(); }

  update() {
    const run = this.visible && !document.hidden && !this.audio.paused && !!this.audio.analyser;
    if (run && !this.active) { this.active = true; this.#frame(); }
    if (!run && this.active) { this.active = false; cancelAnimationFrame(this.rafId); this.rafId = 0; this.paintIdle(); }
    if (!run && !this.active) this.paintIdle();
  }

  #resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    return { width, height };
  }

  paintIdle() {
    const rect = this.#resize();
    if (!rect) return;
    const { width: w, height: h } = rect;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.strokeStyle = '#6e591b';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(w * .05, h * .5);
    this.ctx.lineTo(w * .95, h * .5);
    this.ctx.stroke();
  }

  #frame() {
    if (!this.active) return;
    const analyser = this.audio.analyser;
    if (!analyser) { this.active = false; return; }
    const rect = this.#resize();
    if (!rect) { this.rafId = requestAnimationFrame(() => this.#frame()); return; }
    const { width: w, height: h } = rect;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    if (this.mode === 'wave') {
      if (!this.wave || this.wave.length !== analyser.fftSize) this.wave = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(this.wave);
      ctx.beginPath();
      ctx.strokeStyle = '#ffda27';
      ctx.lineWidth = Math.max(1.5, w / 500);
      for (let i = 0; i < this.wave.length; i++) {
        const x = i / (this.wave.length - 1) * w;
        const y = this.wave[i] / 255 * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      if (!this.freq || this.freq.length !== analyser.frequencyBinCount) this.freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(this.freq);
      const count = Math.max(18, Math.min(74, Math.floor(w / 9)));
      const gap = Math.max(2, w * .004);
      const barWidth = Math.max(1, (w - gap * (count - 1)) / count);
      for (let i = 0; i < count; i++) {
        // Mapeo logarítmico: resalta graves y frecuencias audibles.
        const index = Math.min(this.freq.length - 1, Math.floor(2 * Math.pow((this.freq.length - 1) / 2, i / count)));
        const level = this.freq[index] / 255;
        const barHeight = Math.max(2, level * h * .84);
        const x = i * (barWidth + gap);
        ctx.fillStyle = i % 6 === 0 ? '#fff19d' : '#ffd700';
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);
      }
    }
    this.rafId = requestAnimationFrame(() => this.#frame());
  }

  destroy() { this.active = false; cancelAnimationFrame(this.rafId); document.removeEventListener('visibilitychange', this.onVisibility); }
}
