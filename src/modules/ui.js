import { formatTime, normalizeQuery } from './format.js';
import { icon, mountIcons } from './icons.js';

const get = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el;
};
const node = (tag, className = '', text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
const rangeFill = (el, n) => el.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, n || 0))}%`);
const matches = (track, query) => [track.title, track.artist, track.album].some(value => normalizeQuery(value).includes(query));
const nameFor = (album) => `${album.album} · ${album.artist}`;

function coverInto(el, url, iconName = 'music-2') {
  el.replaceChildren();
  if (url) {
    const img = node('img', 'cover-image');
    img.src = url;
    img.alt = '';
    img.loading = 'lazy';
    el.append(img);
  } else el.innerHTML = icon(iconName);
}

function uniqueGroups(tracks, type) {
  const found = new Map();
  for (const track of tracks) {
    const key = type === 'albums' ? JSON.stringify([track.album, track.artist]) : track.artist;
    if (!found.has(key)) found.set(key, { key, album: track.album, artist: track.artist, coverUrl: null, count: 0 });
    const item = found.get(key);
    item.count++;
    item.coverUrl ||= track.coverUrl;
  }
  return [...found.values()].sort((a, b) => (type === 'albums' ? a.album : a.artist).localeCompare(type === 'albums' ? b.album : b.artist, 'es'));
}

export class MusicUI {
  constructor(handlers) {
    this.handlers = handlers;
    this.list = get('track-list');
    this.seek = get('seek');
    this.volume = get('volume');
    this.playButton = get('play-btn');
    this.toast = get('toast');
    get('offline-origin').textContent = window.location.origin === 'null' ? 'la misma dirección de MW' : window.location.origin;
    this.toastTimer = null;
    this.pageSize = 150;
    mountIcons();
    this.#events();
    rangeFill(this.seek, 0);
    rangeFill(this.volume, 75);
  }

  #events() {
    const openImport = () => get('file-input').click();
    get('import-files').addEventListener('click', openImport);
    get('empty-import').addEventListener('click', openImport);
    get('import-folder').addEventListener('click', () => get('folder-input').click());
    for (const id of ['file-input', 'folder-input']) {
      get(id).addEventListener('change', (event) => {
        if (event.target.files?.length) this.handlers.onImport(event.target.files);
        event.target.value = '';
      });
    }
    for (const id of ['nav-songs', 'nav-albums', 'nav-artists', 'nav-playlists', 'nav-sound', 'nav-offline']) {
      get(id).addEventListener('click', () => this.handlers.onNavigate(get(id).dataset.view));
    }
    get('topbar-sound').addEventListener('click', this.handlers.onToggleSoundView);
    get('topbar-offline').addEventListener('click', () => this.handlers.onNavigate('offline'));
    get('offline-auto').addEventListener('change', e => this.handlers.onOfflineAuto(e.target.checked));
    get('offline-save').addEventListener('click', this.handlers.onOfflineSave);
    get('offline-restore').addEventListener('click', this.handlers.onOfflineRestore);
    get('offline-clear').addEventListener('click', this.handlers.onOfflineClear);
    get('load-more').addEventListener('click', () => { this.pageSize += 150; this.handlers.onLoadMore(); });
    get('shuffle-btn').addEventListener('click', this.handlers.onShuffle);
    get('repeat-btn').addEventListener('click', this.handlers.onRepeat);
    get('eq-preset').addEventListener('change', (event) => this.handlers.onPreset(event.target.value));
    get('eq-reset').addEventListener('click', this.handlers.onResetEQ);
    get('eq-bands').querySelectorAll('input[data-eq-index]').forEach(input => {
      input.addEventListener('input', () => this.handlers.onEqBand(Number(input.dataset.eqIndex), Number(input.value)));
    });
    get('viz-bars').addEventListener('click', () => this.handlers.onVisualization('bars'));
    get('viz-wave').addEventListener('click', () => this.handlers.onVisualization('wave'));
    get('dynamic-colors').addEventListener('change', (e) => this.handlers.onDynamicColors(e.target.checked));
    for (const id of ['create-playlist', 'sidebar-create']) get(id).addEventListener('click', () => this.openNameDialog('create'));
    get('rename-playlist').addEventListener('click', () => this.openNameDialog('rename'));
    get('delete-playlist').addEventListener('click', this.handlers.onDeletePlaylist);
    get('play-all').addEventListener('click', this.handlers.onPlayAll);
    get('play-btn').addEventListener('click', this.handlers.onToggle);
    get('next-btn').addEventListener('click', this.handlers.onNext);
    get('prev-btn').addEventListener('click', this.handlers.onPrevious);
    get('search').addEventListener('input', (event) => this.handlers.onSearch(event.target.value));
    this.volume.addEventListener('input', () => this.handlers.onVolume(Number(this.volume.value) / 100));
    this.seek.addEventListener('input', () => {
      const duration = this.handlers.getDuration();
      if (Number.isFinite(duration) && duration > 0) this.handlers.onSeek(duration * Number(this.seek.value) / 1000);
    });
    get('name-cancel').addEventListener('click', () => get('name-dialog').close());
    get('name-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = get('playlist-name').value.trim();
      if (!name) return;
      const succeeded = this.handlers.onSavePlaylistName(this.dialogMode, name);
      if (succeeded) get('name-dialog').close();
    });
    get('add-close').addEventListener('click', () => get('add-dialog').close());
    const overlay = get('drag-overlay');
    let depth = 0;
    document.addEventListener('dragenter', (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault(); depth++; overlay.hidden = false;
    });
    document.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
    });
    document.addEventListener('dragleave', (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      depth = Math.max(0, depth - 1);
      if (!depth) overlay.hidden = true;
    });
    document.addEventListener('drop', (event) => {
      event.preventDefault(); depth = 0; overlay.hidden = true;
      if (event.dataTransfer?.files?.length) this.handlers.onImport(event.dataTransfer.files);
    });
    window.addEventListener('blur', () => { depth = 0; overlay.hidden = true; });
    if (!('webkitdirectory' in document.createElement('input'))) {
      get('import-folder').disabled = true;
      get('import-folder').title = 'Tu navegador no permite seleccionar una carpeta';
    }
  }

  resetPage() { this.pageSize = 150; }

  renderOffline({ supported, busy, enabled, count, usage, quota, message }) {
    get('offline-auto').checked = enabled;
    get('offline-auto').disabled = !supported || busy;
    for (const id of ['offline-save', 'offline-restore', 'offline-clear']) get(id).disabled = !supported || busy;
    get('offline-count').textContent = supported ? String(count ?? '—') : 'No disponible';
    get('offline-usage').textContent = supported ? usage : '—';
    get('offline-summary').textContent = !supported ? 'Tu navegador bloquea IndexedDB.' : busy ? 'Procesando biblioteca…' : 'Las canciones se guardan en este navegador, no en tu disco de origen.';
    get('offline-status').textContent = message ?? (quota ? `Uso del sitio: ${usage} de un límite estimado de ${quota}.` : 'Puedes guardar, recuperar o borrar copias de audio desde aquí.');
  }

  openNameDialog(mode, name = '') {
    this.dialogMode = mode;
    get('name-dialog-title').textContent = mode === 'rename' ? 'Renombrar playlist' : 'Nueva playlist';
    get('playlist-name').value = mode === 'rename' ? this.activePlaylistName : name;
    get('name-dialog').showModal();
    get('playlist-name').focus();
  }

  openAddDialog(track, playlists) {
    get('add-song-title').textContent = track.title;
    const parent = get('add-targets');
    parent.replaceChildren();
    if (!playlists.length) {
      parent.append(node('p', 'dialog-subtitle', 'Primero crea una playlist.'));
      const create = node('button', 'btn btn-gold', 'Crear playlist');
      create.type = 'button';
      create.addEventListener('click', () => { get('add-dialog').close(); this.openNameDialog('create'); });
      parent.append(create);
    } else {
      for (const playlist of playlists) {
        const exists = playlist.entries.some(entry => entry.key === track.key);
        const button = node('button', 'add-target', playlist.name);
        button.type = 'button';
        button.disabled = exists;
        button.append(node('span', 'add-target-count', exists ? 'Ya añadida' : `${playlist.entries.length} canciones`));
        button.addEventListener('click', () => {
          if (this.handlers.onAddToPlaylist(playlist.id, track.id)) get('add-dialog').close();
        });
        parent.append(button);
      }
    }
    get('add-dialog').showModal();
  }

  render(state) {
    const { tracks, playlists, view, playlist, album, artist, query, currentTrack, playing } = state;
    const albumGroups = uniqueGroups(tracks, 'albums');
    const artistGroups = uniqueGroups(tracks, 'artists');
    get('hero-song-count').textContent = tracks.length;
    get('hero-album-count').textContent = albumGroups.length;
    get('hero-artist-count').textContent = artistGroups.length;
    get('hero').hidden = view !== 'songs' || Boolean(query);
    const inSound = view === 'sound';
    const inOffline = view === 'offline';
    get('offline-section').hidden = !inOffline;
    get('sound-studio').hidden = !inSound;
    get('collection').hidden = inSound || inOffline;
    get('content-footer').hidden = inSound || inOffline;
    get('nav-sound').classList.toggle('is-active', inSound);
    get('nav-offline').classList.toggle('is-active', inOffline);
    get('topbar-sound').classList.toggle('is-active', inSound);
    get('topbar-offline').classList.toggle('is-active', inOffline);
    const selectedMain = (view === 'album' || view === 'artist') ? `${view}s` : view === 'playlist' ? 'playlists' : view;
    for (const id of ['songs', 'albums', 'artists', 'playlists']) {
      get(`nav-${id}`).classList.toggle('is-active', selectedMain === id);
    }
    const sidebar = get('sidebar-playlists');
    sidebar.replaceChildren();
    for (const item of playlists) {
      const button = node('button', `nav-playlist-item${view === 'playlist' && playlist?.id === item.id ? ' is-current' : ''}`);
      button.type = 'button';
      button.innerHTML = icon('list-music');
      button.append(node('span', '', item.name));
      button.addEventListener('click', () => this.handlers.onOpenPlaylist(item.id));
      sidebar.append(button);
    }
    this.activePlaylistName = playlist?.name ?? '';
    if (inSound || inOffline) {
      get('breadcrumb-current').textContent = inSound ? 'Estudio de sonido' : 'Biblioteca sin conexión';
      this.renderPlayer(currentTrack, playing);
      return;
    }
    const titles = { songs: 'Mi biblioteca', albums: 'Tus álbumes', artists: 'Tus artistas', playlists: 'Tus playlists', album: album?.album ?? 'Álbum', artist: artist ?? 'Artista', playlist: playlist?.name ?? 'Playlist' };
    const subtitles = { songs: 'Tu música, en un solo lugar.', albums: 'Tus discos agrupados por etiquetas.', artists: 'Explora tu música por artista.', playlists: 'Crea tus propias colecciones.', album: album?.artist ?? '', artist: 'Canciones de este artista.', playlist: 'Tu selección personal. Las canciones no disponibles se restauran al reimportarlas.' };
    get('breadcrumb-current').textContent = titles[view];
    get('collection-heading').firstChild.textContent = `${titles[view]} `;
    get('section-subtitle').textContent = subtitles[view];
    get('section-overline').textContent = ({ songs: '01 / TU COLECCIÓN', albums: '02 / DISCOGRAFÍA', artists: '03 / ARTISTAS', playlists: '04 / PLAYLISTS', album: '02 / ÁLBUM', artist: '03 / ARTISTA', playlist: '04 / TU PLAYLIST' })[view];
    const showCards = ['albums', 'artists', 'playlists'].includes(view);
    get('create-playlist').hidden = view !== 'playlists';
    get('rename-playlist').hidden = view !== 'playlist';
    get('delete-playlist').hidden = view !== 'playlist';
    const queryText = normalizeQuery(query);
    let visible = [];
    if (view === 'songs') visible = tracks;
    if (view === 'album') visible = tracks.filter(t => t.album === album?.album && t.artist === album?.artist);
    if (view === 'artist') visible = tracks.filter(t => t.artist === artist);
    if (view === 'playlist') visible = (playlist?.entries ?? []).map(entry => tracks.find(t => t.key === entry.key) ?? { ...entry, id: null, unavailable: true, duration: null, coverUrl: null });
    visible = visible.filter(t => matches(t, queryText));
    const playables = visible.filter(t => !t.unavailable);
    get('play-all').hidden = showCards;
    get('play-all').disabled = playables.length === 0;
    get('collection-count').textContent = showCards ? '' : `${visible.length} ${visible.length === 1 ? 'canción' : 'canciones'}`;
    get('collection-count').hidden = showCards;
    get('play-btn').disabled = !tracks.length;
    get('prev-btn').disabled = !tracks.length;
    get('next-btn').disabled = !tracks.length;
    get('collection-grid').hidden = !showCards;
    get('load-more').hidden = true;
    get('library-content').hidden = showCards || !visible.length;
    if (showCards || !visible.length) this.list.replaceChildren();
    get('empty-state').hidden = true;
    get('no-results').hidden = true;
    if (showCards) {
      let cards;
      if (view === 'albums') cards = albumGroups.filter(g => normalizeQuery(nameFor(g)).includes(queryText));
      else if (view === 'artists') cards = artistGroups.filter(g => normalizeQuery(g.artist).includes(queryText));
      else cards = playlists.filter(p => normalizeQuery(p.name).includes(queryText));
      this.#renderCards(cards, view, tracks);
      if (!cards.length) {
        if (view === 'playlists' && !query) get('no-results').textContent = 'Todavía no tienes playlists. Pulsa «Nueva playlist» para crear una.';
        else if (!tracks.length && view !== 'playlists' && !query) get('no-results').textContent = 'Importa tus canciones para verlas aquí.';
        else get('no-results').textContent = 'No se encontraron resultados.';
        get('no-results').hidden = false;
      }
    } else if (visible.length) {
      this.#renderRows(visible.slice(0, this.pageSize), view, playlist, currentTrack?.id, playing);
      get('load-more').hidden = visible.length <= this.pageSize;
      get('load-more').textContent = `Mostrar más canciones (${Math.min(150, visible.length - this.pageSize)} de ${visible.length - this.pageSize} restantes)`;
    } else if (view === 'songs' && !tracks.length && !query) {
      get('empty-state').hidden = false;
    } else {
      get('no-results').textContent = view === 'playlist' && playlist?.entries.length === 0 && !query
        ? 'Esta playlist está vacía. Agrega canciones desde tu biblioteca con el botón +.'
        : 'No se encontraron canciones.';
      get('no-results').hidden = false;
    }
    this.renderPlayer(currentTrack, playing);
  }

  #renderCards(cards, type, tracks) {
    const target = get('collection-grid');
    const frag = document.createDocumentFragment();
    for (const card of cards) {
      const btn = node('button', 'collection-card');
      btn.type = 'button';
      const cover = node('span', `grid-cover ${type === 'artists' ? 'artist-cover' : ''}`);
      let url = card.coverUrl;
      if (type === 'playlists') {
        url = card.entries.map(e => tracks.find(t => t.key === e.key)?.coverUrl).find(Boolean);
      }
      coverInto(cover, url, type === 'playlists' ? 'list-music' : type === 'artists' ? 'users' : 'disc-3');
      btn.append(cover);
      const details = node('span', 'grid-card-details');
      details.append(node('strong', '', type === 'albums' ? card.album : type === 'artists' ? card.artist : card.name));
      const detailText = type === 'albums' ? `${card.artist} · ${card.count} pistas` : type === 'artists' ? `${card.count} pistas` : `${card.entries.length} canciones`;
      details.append(node('small', '', detailText));
      btn.append(details);
      btn.addEventListener('click', () => {
        if (type === 'albums') this.handlers.onOpenAlbum({ album: card.album, artist: card.artist });
        if (type === 'artists') this.handlers.onOpenArtist(card.artist);
        if (type === 'playlists') this.handlers.onOpenPlaylist(card.id);
      });
      frag.append(btn);
    }
    target.replaceChildren(frag);
  }

  #renderRows(tracks, view, playlist, currentId, playing) {
    const frag = document.createDocumentFragment();
    tracks.forEach((track, index) => {
      const missing = Boolean(track.unavailable);
      const current = track.id && track.id === currentId;
      const row = node('div', `track-row${current ? ' is-current' : ''}${missing ? ' is-unavailable' : ''}`);
      if (track.id) row.dataset.trackId = track.id;
      const position = node('span', 'track-index', String(index + 1).padStart(2, '0'));
      const button = node('button', 'track-song track-song-button');
      button.type = 'button';
      button.disabled = missing;
      button.title = missing ? 'Reimporta el archivo para poder reproducirlo' : `Reproducir ${track.title}`;
      button.setAttribute('aria-label', button.title);
      const cover = node('span', 'track-cover');
      coverInto(cover, track.coverUrl);
      const texts = node('span', 'track-texts');
      texts.append(node('span', 'track-title', track.title), node('span', 'track-subtitle', missing ? 'ARCHIVO NO IMPORTADO' : track.album));
      button.append(cover, texts);
      if (!missing) button.addEventListener('click', () => this.handlers.onSelect(track.id));
      const artist = node('span', 'track-artist', track.artist);
      const duration = node('span', 'track-duration', missing ? '—' : track.duration == null ? '—:—' : formatTime(track.duration));
      const actions = node('span', 'track-actions');
      if (view === 'playlist') {
        const remove = node('button', 'row-action', '×');
        remove.type = 'button'; remove.title = 'Quitar de playlist'; remove.setAttribute('aria-label', `Quitar ${track.title} de la playlist`);
        remove.addEventListener('click', () => this.handlers.onRemoveFromPlaylist(playlist.id, track.key));
        actions.append(remove);
      } else {
        const add = node('button', 'row-action', '+');
        add.type = 'button'; add.title = 'Agregar a una playlist'; add.setAttribute('aria-label', `Agregar ${track.title} a playlist`);
        add.addEventListener('click', () => this.handlers.onAskAdd(track.id));
        actions.append(add);
      }
      row.append(position, button, artist, duration, actions);
      frag.append(row);
    });
    this.list.replaceChildren(frag);
  }

  renderPlayer(track, playing) {
    const has = Boolean(track);
    get('current-title').textContent = track?.title ?? 'Nada sonando todavía';
    get('current-title').title = track?.title ?? '';
    get('current-artist').textContent = track ? `${track.artist} · ${track.album}` : 'Importa música para empezar';
    const cover = get('current-cover');
    cover.classList.toggle('has-track', has);
    if (cover.dataset.url !== (track?.coverUrl || '')) {
      coverInto(cover, track?.coverUrl);
      cover.dataset.url = track?.coverUrl || '';
    }
    get('current-status').classList.toggle('is-playing', has && playing);
    get('current-status').setAttribute('aria-label', has && playing ? 'Reproduciendo' : 'En pausa');
    this.playButton.querySelector('.icon-slot').innerHTML = icon(playing ? 'pause-fill' : 'play-fill');
    this.playButton.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    this.playButton.title = playing ? 'Pausar' : 'Reproducir';
    document.title = track ? `${playing ? '▶ ' : ''}${track.title} — MW` : 'MW — Music my World';
    for (const [indexRow, row] of [...this.list.querySelectorAll('.track-row')].entries()) {
      const active = row.dataset.trackId === track?.id;
      row.classList.toggle('is-current', active);
      const index = row.querySelector('.track-index');
      if (index && active && playing) index.innerHTML = '<span class="now-eq"><i></i><i></i><i></i></span>';
      else if (index) index.textContent = String(indexRow + 1).padStart(2, '0');
    }
  }

  renderModes(preferences) {
    const shuffle = get('shuffle-btn');
    shuffle.classList.toggle('is-on', preferences.shuffle);
    shuffle.setAttribute('aria-pressed', String(preferences.shuffle));
    shuffle.setAttribute('aria-label', preferences.shuffle ? 'Desactivar aleatorio' : 'Activar aleatorio');
    shuffle.title = preferences.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado';
    const repeat = get('repeat-btn');
    repeat.classList.toggle('is-on', preferences.repeat !== 'off');
    const modes = { off: 'Sin repetición', all: 'Repetir lista', one: 'Repetir canción' };
    repeat.setAttribute('aria-label', `${modes[preferences.repeat]}. Pulsar para cambiar`);
    repeat.title = modes[preferences.repeat];
    get('repeat-one-label').hidden = preferences.repeat !== 'one';
  }

  renderSound(preferences, enabled, ready, playing) {
    get('eq-preset').value = preferences.preset;
    get('dynamic-colors').checked = preferences.dynamicColors;
    get('eq-bands').querySelectorAll('input[data-eq-index]').forEach(input => {
      const index = Number(input.dataset.eqIndex);
      const value = preferences.bands[index];
      input.value = String(value);
      get(`eq-value-${index}`).textContent = `${value > 0 ? '+' : ''}${value} dB`;
      input.style.setProperty('--band-progress', `${(value + 12) / 24 * 100}%`);
      input.disabled = !enabled;
    });
    get('eq-preset').disabled = !enabled;
    get('eq-reset').disabled = !enabled;
    get('eq-state').textContent = !enabled ? 'Web Audio no está disponible en este navegador.'
      : ready ? 'Ecualizador activo · Las bandas modifican el sonido real.'
      : 'Listo · Se activará cuando reproduzcas una canción.';
    for (const mode of ['bars', 'wave']) {
      const button = get(`viz-${mode}`);
      button.classList.toggle('is-selected', preferences.visualization === mode);
      button.setAttribute('aria-pressed', String(preferences.visualization === mode));
    }
    get('viz-note').textContent = !enabled ? 'Este navegador no permite visualización Web Audio.'
      : playing && ready ? 'Analizando el audio en tiempo real.'
      : 'Reproduce una canción para ver su sonido.';
  }

  renderTime(position, duration) {
    const known = Number.isFinite(duration) && duration > 0;
    get('current-time').textContent = formatTime(position);
    get('total-time').textContent = known ? formatTime(duration) : '0:00';
    this.seek.disabled = !known;
    const percentage = known ? 100 * Math.max(0, Math.min(1, position / duration)) : 0;
    this.seek.value = String(Math.round(percentage * 10));
    rangeFill(this.seek, percentage);
  }
  renderVolume(volume) {
    const number = Math.round(volume * 100);
    this.volume.value = String(number);
    get('volume-value').textContent = `${number}%`;
    rangeFill(this.volume, number);
  }
  notify(message, type = 'info') {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.dataset.type = type;
    this.toast.hidden = false;
    this.toastTimer = window.setTimeout(() => { this.toast.hidden = true; }, 4500);
  }
}
