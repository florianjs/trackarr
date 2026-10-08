import type { Config } from 'tailwindcss'

// Colors are CSS variables (RGB channels) defined in app/assets/css/main.css,
// so the light and dark themes swap them without touching components.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: [
    './app/**/*.{vue,ts}',
    './components/**/*.{vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: token('bg'),
          secondary: token('surface'),
          tertiary: token('raised'),
          hover: token('hover')
        },
        text: {
          primary: token('ink'),
          secondary: token('ink-2'),
          muted: token('ink-3')
        },
        border: {
          DEFAULT: token('line'),
          hover: token('line-strong')
        },
        // Meaningful colors: upload/seed, download/leech, freeleech (the one accent)
        seed: token('seed'),
        leech: token('leech'),
        free: token('free'),
        accent: {
          DEFAULT: token('free'),
          muted: token('ink-3')
        },
        success: token('seed'),
        warning: token('leech'),
        error: token('danger'),
        danger: token('danger'),
        // "white"/"black" are contrast inks: they flip with the theme, so the
        // existing white-on-black controls stay legible in light mode too
        white: token('contrast'),
        black: token('contrast-inv'),
        // Overlays behind dialogs stay dark in both themes
        scrim: 'rgb(0 0 0 / <alpha-value>)'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      borderRadius: {
        DEFAULT: '0.3125rem'
      }
    }
  },
  plugins: []
} satisfies Config
