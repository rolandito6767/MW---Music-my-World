/** Motor único: HTMLAudioElement + filtros Web Audio (creados una sola vez). */
export class AudioEngine extends EventTarget {
  #audio = new Audio();
  #track = null;
  #context = null;
  #bands = [];
  #analyser = null;
  #equalizerValues = [0, 0, 0, 0, 0, 0];
  #attemptedGraph = false;

  constructor() {
    super();
    this.#audio.preload = 'metadata';
    this.#audio.volume = 0.75;
    for (const name of ['play', 'pause', 'timeupdate', 'durationchange', 'loadedmetadata', 'ended', 'waiting', 'canplay', 'volumechange']) {
      this.#audio.addEventListener(name, () => this.dispatchEvent(new Event(name)));
    }
    this.#audio.addEventListener('error', () => {
      const code = this.#audio.error?.code;
      const description = code === 4 ? 'El navegador no reconoce este archivo de audio.' : 'No se pudo cargar o reproducir este archivo.';
      this.dispatchEvent(new CustomEvent('playbackerror', { detail: { message: description } }));
    });
  }

  get currentTrack() { return this.#track; }
  get paused() { return this.#audio.paused; }
  get currentTime() { return this.#audio.currentTime; }
  get duration() { return this.#audio.duration; }
  get volume() { return this.#audio.volume; }
  get readyState() { return this.#audio.readyState; }
  get analyser() { return this.#analyser; }
  get equalizerAvailable() { return Boolean(window.AudioContext || window.webkitAudioContext); }
  get effectsReady() { return Boolean(this.#analyser); }

  #setupGraph() {
    if (this.#attemptedGraph) return;
    this.#attemptedGraph = true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(this.#audio);
      let tail = source;
      const bands = [];
      const frequencies = [60, 170, 350, 1000, 3500, 10000];
      for (let i = 0; i < frequencies.length; i++) {
        const node = context.createBiquadFilter();
        node.type = i === 0 ? 'lowshelf' : i === frequencies.length - 1 ? 'highshelf' : 'peaking';
        node.frequency.value = frequencies[i];
        if (node.type === 'peaking') node.Q.value = 1.0;
        node.gain.value = this.#equalizerValues[i];
        tail.connect(node);
        tail = node;
        bands.push(node);
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = .78;
      tail.connect(analyser);
      analyser.connect(context.destination);
      this.#context = context;
      this.#bands = bands;
      this.#analyser = analyser;
      this.dispatchEvent(new Event('effectsready'));
    } catch (error) {
      console.warn('MW: no se pudo iniciar Web Audio.', error);
      this.dispatchEvent(new CustomEvent('effectserror', { detail: { message: 'Tu navegador no pudo activar el ecualizador. El audio básico puede seguir funcionando.' } }));
    }
  }

  setEqualizer(gains) {
    if (!Array.isArray(gains) || gains.length !== 6) return;
    this.#equalizerValues = gains.map(value => Math.max(-12, Math.min(12, Number(value) || 0)));
    this.#bands.forEach((band, i) => { band.gain.value = this.#equalizerValues[i]; });
  }

  async load(track, playImmediately = true) {
    if (!track) return;
    this.#audio.pause();
    this.#track = track;
    this.#audio.src = track.url;
    this.#audio.load();
    this.dispatchEvent(new Event('trackchange'));
    if (playImmediately) await this.play();
  }

  async play() {
    if (!this.#track) return;
    this.#setupGraph();
    // Iniciar ambos sin perder el gesto de usuario exigido por los navegadores.
    const resume = this.#context?.state === 'suspended' ? this.#context.resume().catch(() => {}) : Promise.resolve();
    try {
      const playback = this.#audio.play();
      await Promise.all([resume, playback]);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this.dispatchEvent(new CustomEvent('playbackerror', { detail: {
        message: error?.name === 'NotAllowedError'
          ? 'El navegador bloqueó el audio. Pulsa reproducir para continuar.'
          : 'No se pudo iniciar la reproducción.',
      } }));
    }
  }

  pause() { this.#audio.pause(); }
  async toggle() { if (this.paused) await this.play(); else this.pause(); }
  seek(seconds) {
    if (!Number.isFinite(this.duration) || this.duration <= 0) return;
    this.#audio.currentTime = Math.max(0, Math.min(seconds, this.duration));
  }
  setVolume(value) { this.#audio.volume = Math.max(0, Math.min(1, value)); }
  destroy() {
    this.pause();
    this.#audio.removeAttribute('src');
    this.#audio.load();
    void this.#context?.close().catch(() => {});
  }
}
