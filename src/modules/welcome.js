/** Portada, guía y términos: controla solo las vistas, nunca reinicia el motor de audio. */
export class Welcome {
  constructor({ onNavigate }) {
    this.onNavigate = onNavigate;
    this.home = document.getElementById('mw-welcome');
    this.app = document.getElementById('app');
    this.splash = document.getElementById('mw-splash');
    this.guide = document.getElementById('guide-dialog');
    this.terms = document.getElementById('terms-dialog');

    document.getElementById('welcome-start').addEventListener('click', () => this.openApp());
    document.getElementById('welcome-guide').addEventListener('click', () => this.openDialog(this.guide));
    document.getElementById('welcome-terms').addEventListener('click', () => this.openDialog(this.terms));
    document.getElementById('guide-close').addEventListener('click', () => this.guide.close());
    document.getElementById('terms-close').addEventListener('click', () => this.terms.close());
    document.getElementById('terms-done').addEventListener('click', () => this.terms.close());
    document.getElementById('guide-start').addEventListener('click', () => { this.guide.close(); this.openApp(); });
    document.getElementById('open-welcome').addEventListener('click', () => this.openHome());

    // La animación es corta y respeta la preferencia de reducir movimiento.
    // Si falla la inicialización principal, la portada sigue siendo accesible.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => {
      this.splash.classList.add('is-done');
      window.setTimeout(() => { this.splash.hidden = true; }, reduced ? 25 : 400);
    }, reduced ? 60 : 850);

  }
  openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }
  openApp() {
    this.guide.open && this.guide.close();
    this.terms.open && this.terms.close();
    this.home.hidden = true;
    this.app.hidden = false;
    document.getElementById('import-files').focus({ preventScroll: true });
  }
  openHome() {
    this.app.hidden = true;
    this.home.hidden = false;
    document.getElementById('welcome-start').focus({ preventScroll: true });
  }
}
