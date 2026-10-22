// Iconos vectoriales propios basados en geometrías SVG simples, sin bibliotecas externas.
const paths = {
  'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  'music-2': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'disc-3': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 1 5-2"/>',
  'list-music': '<path d="M5 7h11M5 11h11M5 15h7M19 10v9a2 2 0 1 1-2-2c.73 0 1.32.25 2 .5"/>',
  'lock-keyhole': '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  'sliders-horizontal': '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  'shield-check': '<path d="m12 22 0 0C7 20 4 16 4 11V5l8-3 8 3v6c0 5-3 9-8 11Z"/><path d="m9 12 2 2 4-4"/>',
  'folder-open': '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v3"/><path d="M3 20 6 11h16l-3 9H3Z"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'upload': '<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  'upload-cloud': '<path d="M7 18H6a4 4 0 0 1-.7-7.94 7 7 0 0 1 13.4-1.5A4.5 4.5 0 0 1 18 18h-1"/><path d="M12 21V11m-4 4 4-4 4 4"/>',
  'play-fill': '<path d="M8 5.7c0-.8.9-1.2 1.6-.8l10 6.3a1 1 0 0 1 0 1.6l-10 6.3c-.7.4-1.6 0-1.6-.8V5.7Z" fill="currentColor" stroke="none"/>',
  'pause-fill': '<rect x="6" y="5" width="4.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  'skip-back': '<path d="M5 5v14"/><path d="m19 5-12 7 12 7V5Z"/>',
  'skip-forward': '<path d="M19 5v14"/><path d="M5 5v14l12-7L5 5Z"/>',
  'volume-2': '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'search': '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  'pencil': '<path d="m4 20 4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/><path d="m14 7 3 3"/>',
  'trash-2': '<path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  'x': '<path d="M18 6 6 18M6 6l12 12"/>',
  'shuffle': '<path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h2c6 0 8-12 14-12h4M2 6h2c2.3 0 4 1.8 5.5 4M14.5 14c1 2.3 2.1 4 3.5 4h4"/>',
  'repeat': '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  'hard-drive': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h18M7 16h.01M11 16h.01"/>',
  'save': '<path d="M4 3h13l3 3v15H4V3Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/>',
  'refresh-cw': '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a8 8 0 0 1 14-2l1 5M4 12l1 5a8 8 0 0 0 14-2"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',
};

export function icon(name) {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none">${paths[name] ?? paths['music-2']}</svg>`;
}

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
}
