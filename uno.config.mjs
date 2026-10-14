import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify()
  ],
  theme: {
    colors: {
      appBg: 'var(--bg)',
      cardBg: 'var(--card-bg)',
      cardBorder: 'var(--card-border)',
      primary: 'var(--primary)',
      primaryHover: 'var(--primary-hover)',
      accent: 'var(--accent)',
      textMain: 'var(--text)',
      textMuted: 'var(--text-muted)',
      textBright: 'var(--text-bright)',
      danger: 'var(--danger)',
      warning: 'var(--warning)',
      codeBg: 'var(--code-bg)'
    }
  }
})
