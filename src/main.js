import './styles.css';
import { MusicLibrary } from './modules/library.js';
import { AudioEngine } from './modules/audioEngine.js';
import { PlaylistStore } from './modules/playlists.js';
import { PlaybackQueue } from './modules/playbackQueue.js';
import { Preferences } from './modules/preferences.js';
import { Visualizer } from './modules/visualizer.js';
import { CoverTheme } from './modules/coverTheme.js';
import { MusicUI } from './modules/ui.js';
import { normalizeQuery } from './modules/format.js';
import { OfflineStorage, bytesLabel } from './modules/offlineStorage.js';
import { Welcome } from './modules/welcome.js';
import { MediaSessionController } from './modules/mediaSession.js';

const library = new MusicLibrary();
const audio = new AudioEngine();
const store = new PlaylistStore();
let browserStorage = null;
try { browserStorage = window.localStorage; } catch { /* Modo privado o bloqueo de almacenamiento */ }
const offline = new OfflineStorage({ storage: browserStorage });
const preferences = new Preferences();
const coverTheme = new CoverTheme();
coverTheme.setEnabled(preferences.data.dynamicColors);
const queue = new PlaybackQueue();
queue.setShuffle(preferences.data.shuffle);
queue.setRepeat(preferences.data.repeat);
audio.setEqualizer(preferences.data.bands);

const state = { view: 'songs', playlistId: null, album: null, artist: null, query: '' };
let ui;
let visualizer;
let renderScheduled = false;
let storagePending = Promise.resolve();
const offlineView = { supported: offline.supported, busy: false, enabled: offline.enabled, count: null, usage: '—', quota: '—', message: 'Comprobando copias locales…' };

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { renderScheduled = false; render(); });
}
function storageRender(message) {
  if (message != null) offlineView.message = message;
  ui.renderOffline(offlineView);
}
async function updateStorageStats() {
  if (!offline.supported) { storageRender('IndexedDB no está disponible. Puedes seguir importando archivos manualmente.'); return; }
  try {
    offlineView.count = await offline.count();
    const estimate = await offline.estimate();
    offlineView.usage = estimate ? bytesLabel(estimate.usage) : 'No disponible';
    offlineView.quota = estimate ? bytesLabel(estimate.quota) : 'No disponible';
  } catch (error) {
    offlineView.message = `No se puede leer el almacenamiento: ${error.message}`;
  }
  storageRender();
}
/** Opera secuencialmente para impedir que Guardar y Borrar se crucen. */
function storageJob(job) {
  const execute = async () => {
    offlineView.busy = true; storageRender();
    try { await job(); }
    catch (error) {
      const quota = error?.name === 'QuotaExceededError';
      const message = quota ? 'Sin espacio suficiente en este navegador. Libera espacio o guarda menos canciones.' : `Almacenamiento: ${error.message}`;
      storageRender(message); ui.notify(message, 'error');
    } finally {
      offlineView.busy = false;
      await updateStorageStats();
    }
  };
  storagePending = storagePending.then(execute, execute);
  return storagePending;
}
async function saveSelected(tracks, automatic = false) {
  if (!offline.supported || !tracks.length) return;
  await storageJob(async () => {
    let saved = 0;
    for (const track of tracks) {
      const file = library.getFile(track.key);
      if (!file) continue;
      // Cada transacción se finaliza antes de iniciar la siguiente: no retiene
      // un lote masivo de música en la cola de escritura de IndexedDB.
      try { await offline.save(track.key, file); saved++; }
      catch (error) {
        storageRender(`Se guardaron ${saved} de ${tracks.length}. ${error.name === 'QuotaExceededError' ? 'El navegador se quedó sin espacio.' : error.message}`);
        ui.notify('No se pudieron guardar todas las canciones. Comprueba el espacio disponible.', 'error');
        return;
      }
      if (saved % 5 === 0) storageRender(`Guardando copias… ${saved} / ${tracks.length}`);
    }
    const message = `${saved} ${saved === 1 ? 'canción guardada' : 'canciones guardadas'} localmente${automatic ? ' (automático)' : ''}.`;
    storageRender(message);
    if (!automatic) ui.notify(message);
  });
}
function restoreSaved() {
  if (!offline.supported) return;
  return storageJob(async () => {
    storageRender('Recuperando archivos guardados…');
    const result = await offline.restore(files => library.importFiles(files), (recovered, total) => {
      storageRender(`Recuperando… ${recovered} / ${total}`);
      scheduleRender();
    });
    const message = result.total === 0 ? 'No hay canciones guardadas. Importa música y pulsa «Guardar biblioteca actual».'
      : `${result.recovered} recuperadas de ${result.total} guardadas${result.failed ? ` · ${result.failed} ilegibles` : ''}.`;
    storageRender(message);
    if (result.recovered) ui.notify(message);
    scheduleRender();
  });
}


function selectedPlaylist() { return store.byId(state.playlistId); }
function filteredTracks() {
  let candidates = library.tracks;
  if (state.view === 'album') candidates = candidates.filter(t => t.album === state.album?.album && t.artist === state.album?.artist);
  if (state.view === 'artist') candidates = candidates.filter(t => t.artist === state.artist);
  if (state.view === 'playlist') candidates = (selectedPlaylist()?.entries ?? []).map(e => library.getByKey(e.key)).filter(Boolean);
  const query = normalizeQuery(state.query);
  if (query) candidates = candidates.filter(t => [t.title, t.album, t.artist].some(x => normalizeQuery(x).includes(query)));
  return candidates;
}
function snapshot() {
  return { tracks: library.tracks, playlists: store.all, view: state.view, playlist: selectedPlaylist(), album: state.album, artist: state.artist, query: state.query, currentTrack: audio.currentTrack, playing: !audio.paused };
}
function refreshSound() {
  ui.renderModes(preferences.data);
  ui.renderSound(preferences.data, audio.equalizerAvailable, audio.effectsReady, !audio.paused);
  visualizer?.setMode(preferences.data.visualization);
  visualizer?.setVisible(state.view === 'sound');
}
function render() { ui.render(snapshot()); refreshSound(); ui.renderOffline(offlineView); syncMobileNav(); }
function navigate(view) {
  state.view = view; state.playlistId = null; state.album = null; state.artist = null;
  ui.resetPage();
  render(); document.getElementById('main-scroll').scrollTop = 0;
}
function setPlayQueue(tracks, currentId) { queue.set(tracks.map(t => t.id), currentId); }
async function playTrack(id) {
  const track = library.getById(id);
  if (!track) return;
  if (audio.currentTrack?.id === id) { await audio.toggle(); return; }
  const visible = filteredTracks();
  const selection = visible.some(t => t.id === id) ? visible : library.tracks;
  setPlayQueue(selection, id);
  await audio.load(track);
}
async function moveQueue(direction, automatic = false) {
  if (!library.size) return;
  if (!queue.size) setPlayQueue(library.tracks, audio.currentTrack?.id || library.tracks[0]?.id);
  const nextId = direction === 1 ? queue.next({ automatic }) : queue.previous();
  if (!nextId) { ui.renderPlayer(audio.currentTrack, false); return; }
  const track = library.getById(nextId);
  if (!track) return;
  if (track.id === audio.currentTrack?.id) { audio.seek(0); await audio.play(); }
  else await audio.load(track);
}
function nextTrack() { void moveQueue(1); }
function previousTrack() {
  if (audio.currentTrack && audio.currentTime > 3) { audio.seek(0); return; }
  void moveQueue(-1);
}
function saveName(mode, name) {
  try {
    if (mode === 'create') {
      const playlist = store.create(name);
      state.view = 'playlist'; state.playlistId = playlist.id; state.album = null; state.artist = null;
      ui.notify(`Playlist «${playlist.name}» creada.`);
    } else {
      store.rename(state.playlistId, name); ui.notify('Nombre actualizado.');
    }
    render();
    return true;
  } catch (error) { ui.notify(error.message, 'error'); return false; }
}

ui = new MusicUI({
  onImport(files) {
    const { added, ignored, duplicates } = library.importFiles(files);
    if (added.length) ui.notify(`${added.length} ${added.length === 1 ? 'canción importada' : 'canciones importadas'}${duplicates || ignored ? ` · ${duplicates} duplicadas · ${ignored} ignoradas` : ''}. Leyendo etiquetas…`);
    else if (duplicates) ui.notify('Estas canciones ya están en la biblioteca.');
    else if (ignored) ui.notify('No se encontraron archivos MP3 o WAV.', 'error');
    render();
    if (offline.enabled && added.length) void saveSelected(added, true);
  },
  onOfflineAuto(enabled) {
    offline.setEnabled(enabled);
    offlineView.enabled = offline.enabled;
    storageRender(enabled ? 'Guardado automático activado. Puedes desactivarlo cuando quieras.' : 'Guardado automático desactivado. Las copias existentes se conservan.');
    if (enabled && library.size) void saveSelected([...library.tracks]);
  },
  onOfflineSave() {
    if (!library.size) { ui.notify('Primero importa una o más canciones para guardarlas.', 'error'); return; }
    void saveSelected([...library.tracks]);
  },
  onOfflineRestore() { void restoreSaved(); },
  onOfflineClear() {
    if (!window.confirm('¿Borrar las COPIAS de audio que MW guardó en este navegador? Tus archivos originales y playlists NO se eliminarán.')) return;
    void storageJob(async () => { await offline.clear(); storageRender('Copias borradas del navegador. Tus originales siguen intactos.'); ui.notify('Copias guardadas eliminadas.'); });
  },
  onLoadMore: render,
  onNavigate: navigate,
  onToggleSoundView: () => navigate(state.view === 'sound' ? 'songs' : 'sound'),
  onOpenAlbum(album) { ui.resetPage(); state.view = 'album'; state.album = album; render(); document.getElementById('main-scroll').scrollTop = 0; },
  onOpenArtist(artist) { ui.resetPage(); state.view = 'artist'; state.artist = artist; render(); document.getElementById('main-scroll').scrollTop = 0; },
  onOpenPlaylist(id) { ui.resetPage(); state.view = 'playlist'; state.playlistId = id; render(); document.getElementById('main-scroll').scrollTop = 0; },
  onSearch(query) { ui.resetPage(); state.query = query; render(); },
  onSelect: playTrack,
  onPlayAll() {
    const tracks = filteredTracks();
    if (!tracks.length) return;
    setPlayQueue(tracks, tracks[0].id);
    void audio.load(tracks[0]);
  },
  onToggle() {
    if (!audio.currentTrack && library.size) {
      const tracks = filteredTracks();
      const playable = tracks.length ? tracks : library.tracks;
      setPlayQueue(playable, playable[0].id);
      void audio.load(playable[0]);
    } else void audio.toggle();
  },
  onNext: nextTrack, onPrevious: previousTrack,
  onVolume: value => audio.setVolume(value),
  onSeek: seconds => audio.seek(seconds),
  getDuration: () => audio.duration,
  onShuffle() {
    preferences.setShuffle(!preferences.data.shuffle);
    queue.setShuffle(preferences.data.shuffle);
    refreshSound();
    ui.notify(preferences.data.shuffle ? 'Modo aleatorio activado.' : 'Modo aleatorio desactivado.');
  },
  onRepeat() {
    const mode = preferences.cycleRepeat();
    queue.setRepeat(mode);
    refreshSound();
    ui.notify(({ off: 'Repetición desactivada.', all: 'Repetir lista activado.', one: 'Repetir canción activado.' })[mode]);
  },
  onPreset(id) {
    if (id === 'custom') { refreshSound(); return; }
    try { preferences.setPreset(id); audio.setEqualizer(preferences.data.bands); refreshSound(); }
    catch (error) { ui.notify(error.message, 'error'); }
  },
  onEqBand(index, gain) { preferences.setBand(index, gain); audio.setEqualizer(preferences.data.bands); refreshSound(); },
  onResetEQ() { preferences.setPreset('flat'); audio.setEqualizer(preferences.data.bands); refreshSound(); ui.notify('Ecualizador restablecido.'); },
  onVisualization(mode) { preferences.setVisualization(mode); refreshSound(); },
  onDynamicColors(checked) { preferences.setDynamicColors(checked); coverTheme.setEnabled(checked); refreshSound(); },
  onSavePlaylistName: saveName,
  onDeletePlaylist() {
    const item = selectedPlaylist();
    if (!item || !window.confirm(`¿Eliminar la playlist «${item.name}»? Tus archivos de música no se eliminarán.`)) return;
    try { store.remove(item.id); navigate('playlists'); ui.notify('Playlist eliminada.'); }
    catch (error) { ui.notify(error.message, 'error'); }
  },
  onAskAdd(id) { const track = library.getById(id); if (track) ui.openAddDialog(track, store.all); },
  onAddToPlaylist(id, trackId) {
    const track = library.getById(trackId);
    if (!track) return false;
    try {
      const added = store.add(id, track);
      ui.notify(added ? 'Canción agregada a la playlist.' : 'La canción ya está en esa playlist.');
      render(); return true;
    } catch (error) { ui.notify(error.message, 'error'); return false; }
  },
  onRemoveFromPlaylist(id, key) {
    try { store.removeTrack(id, key); render(); ui.notify('Canción quitada de la playlist.'); }
    catch (error) { ui.notify(error.message, 'error'); }
  },
});
visualizer = new Visualizer(document.getElementById('audio-visualizer'), audio);

library.addEventListener('change', scheduleRender);
library.addEventListener('metadata', event => {
  store.refreshTrack(event.detail.track);
  if (audio.currentTrack?.id === event.detail.track.id) { mediaSession.updateMetadata(); coverTheme.setCover(event.detail.track.coverUrl); }
  scheduleRender();
});
audio.addEventListener('trackchange', () => { ui.renderPlayer(audio.currentTrack, !audio.paused); ui.renderTime(0, NaN); mediaSession.updateMetadata(); coverTheme.setCover(audio.currentTrack?.coverUrl); });
audio.addEventListener('play', () => { ui.renderPlayer(audio.currentTrack, true); refreshSound(); });
audio.addEventListener('pause', () => { ui.renderPlayer(audio.currentTrack, false); refreshSound(); });
audio.addEventListener('timeupdate', () => ui.renderTime(audio.currentTime, audio.duration));
audio.addEventListener('durationchange', () => {
  const track = audio.currentTrack;
  if (track && Number.isFinite(audio.duration) && audio.duration > 0) { track.duration = audio.duration; scheduleRender(); }
  ui.renderTime(audio.currentTime, audio.duration);
});
audio.addEventListener('loadedmetadata', () => ui.renderTime(audio.currentTime, audio.duration));
audio.addEventListener('ended', () => { void moveQueue(1, true); refreshSound(); });
audio.addEventListener('volumechange', () => { ui.renderVolume(audio.volume); preferences.setVolume(audio.volume); });
audio.addEventListener('playbackerror', event => ui.notify(event.detail.message, 'error'));
audio.addEventListener('effectsready', refreshSound);
audio.addEventListener('effectserror', event => ui.notify(event.detail.message, 'error'));

const mediaSession = new MediaSessionController({ audio, onNext: nextTrack, onPrevious: previousTrack });
const welcome = new Welcome({ onNavigate: navigate });

// Navegación de seis destinos accesible cuando desaparece la barra lateral en móvil.
for (const button of document.querySelectorAll('[data-mobile-view]')) {
  button.addEventListener('click', () => navigate(button.dataset.mobileView));
}
function syncMobileNav() {
  document.querySelectorAll('[data-mobile-view]').forEach(button => {
    const active = button.dataset.mobileView === state.view;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}
render();
audio.setVolume(preferences.data.volume);
if (offline.supported) void restoreSaved();
else storageRender('Este navegador no dispone de IndexedDB. Reimporta tu música en cada sesión.');
ui.renderVolume(audio.volume);
if (!store.persistent) ui.notify('Almacenamiento local bloqueado: las playlists no persistirán al recargar.', 'error');
if (!preferences.persistent) ui.notify('No se pudieron guardar preferencias: comprueba los permisos del navegador.', 'error');
// No destruir el audio al ocultar la pestaña: hacerlo interrumpiría móviles y bfcache.
window.addEventListener('pagehide', (event) => { if (!event.persisted) { visualizer.destroy(); audio.destroy(); library.release(); } });
