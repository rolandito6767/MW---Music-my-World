/** Sutil luz ambiental desde la carátula local; mantiene siempre el dorado de MW. */
export class CoverTheme {
  #enabled = true;
  #generation = 0;
  #currentUrl = null;
  #lastColor = null;

  setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    this.#refresh();
  }

  setCover(url) {
    if (this.#currentUrl === url) return;
    this.#currentUrl = url || null;
    this.#lastColor = null;
    this.#refresh();
  }

  async #refresh() {
    const generation = ++this.#generation;
    if (!this.#enabled || !this.#currentUrl) {
      document.documentElement.style.setProperty('--cover-ambient', 'rgba(255,215,0,.065)');
      return;
    }
    if (this.#lastColor) {
      document.documentElement.style.setProperty('--cover-ambient', this.#lastColor);
      return;
    }
    try {
      const image = new Image();
      image.src = this.#currentUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 20;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, 20, 20);
      const { data } = context.getImageData(0, 0, 20, 20);
      let r = 0, g = 0, b = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [red, green, blue, alpha] = data.slice(i, i + 4);
        if (alpha < 180) continue;
        const light = (red + green + blue) / 3;
        if (light < 30 || light > 236) continue;
        const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
        const weight = 1 + saturation / 110;
        r += red * weight; g += green * weight; b += blue * weight; total += weight;
      }
      if (generation !== this.#generation) return;
      if (!total) return;
      const rgb = [r / total, g / total, b / total].map(x => Math.round(x));
      const color = `rgba(${rgb.join(',')},.16)`;
      this.#lastColor = color;
      document.documentElement.style.setProperty('--cover-ambient', color);
    } catch { /* Portadas con formato inválido: se mantiene el ambiente anterior. */ }
  }
}
