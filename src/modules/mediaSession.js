/** Integra controles del sistema sin prometer reproducción en segundo plano universal. */
export class MediaSessionController {
  constructor({ audio, onNext, onPrevious }) {
    this.audio = audio;
    this.session = 'mediaSession' in navigator ? navigator.mediaSession : null;
    this.lastSecond = -1;
    if (!this.session) return;
    const actions = {
      play: () => { void this.audio.play(); },
      pause: () => this.audio.pause(),
      stop: () => { this.audio.pause(); this.audio.seek(0); },
      nexttrack: onNext,
      previoustrack: onPrevious,
      seekto: e => { if (Number.isFinite(e.seekTime)) this.audio.seek(e.seekTime); },
      seekbackward: e => this.audio.seek(this.audio.currentTime - (Number(e.seekOffset) || 10)),
      seekforward: e => this.audio.seek(this.audio.currentTime + (Number(e.seekOffset) || 10)),
    };
    for (const [action, callback] of Object.entries(actions)) {
      try { this.session.setActionHandler(action, callback); }
      catch { /* Algunos navegadores no implementan todas las acciones. */ }
    }
    audio.addEventListener('trackchange', () => this.updateMetadata());
    audio.addEventListener('play', () => this.updateState());
    audio.addEventListener('pause', () => this.updateState());
    audio.addEventListener('loadedmetadata', () => this.updatePosition());
    audio.addEventListener('durationchange', () => this.updatePosition());
    audio.addEventListener('timeupdate', () => this.updatePosition());
    document.addEventListener('visibilitychange', () => {
      // Evita destruir la sesión cuando la pestaña pasa a segundo plano.
      this.updateState();
      if (!document.hidden) this.updatePosition();
    });
  }
  updateMetadata() {
    const track = this.audio.currentTrack;
    if (!this.session) return;
    if (!track) { this.session.metadata = null; return; }
    if (!('MediaMetadata' in window)) return;
    const info = { title: track.title, artist: track.artist, album: track.album };
    // Las URL blob de portadas pueden no ser admitidas en algunas pantallas de bloqueo.
    if (track.coverUrl) info.artwork = [{ src: track.coverUrl }];
    else {
      try { info.artwork = [{ src: new URL('mw-icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }]; }
      catch { /* Sin URL válida (p. ej., previsualización en memoria). */ }
    }
    try { this.session.metadata = new window.MediaMetadata(info); }
    catch { /* El navegador puede rechazar ciertas carátulas. */ }
    this.lastSecond = -1;
    this.updateState();
    this.updatePosition();
  }
  updateState() {
    if (!this.session) return;
    try { this.session.playbackState = this.audio.currentTrack ? (this.audio.paused ? 'paused' : 'playing') : 'none'; }
    catch { /* No disponible. */ }
  }
  updatePosition() {
    if (!this.session || typeof this.session.setPositionState !== 'function') return;
    const duration = this.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const position = Math.max(0, Math.min(duration, this.audio.currentTime || 0));
    const second = Math.floor(position);
    if (this.lastSecond === second) return;
    this.lastSecond = second;
    try { this.session.setPositionState({ duration, playbackRate: 1, position }); }
    catch { /* Navegadores parciales. */ }
  }
}
