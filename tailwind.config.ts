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
        // Fixed colors that must not flip: overlays and shadows stay dark,
        // text on colored fills and uploaded logos sit on real white
        scrim: 'rgb(0 0 0 / <alpha-value>)',
        paper: 'rgb(255 255 255 / <alpha-value>)'
      },
      // Variables set in main.css, overridden by the admin appearance
      fontFamily: {
        sans: 'var(--font-sans)',
        heading: 'var(--font-heading)',
        mono: 'var(--font-mono)'
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      // Scaled from --radius (admin appearance); default values unchanged
      borderRadius: {
        sm: 'calc(var(--radius) * 0.4)',
        DEFAULT: 'var(--radius)',
        md: 'calc(var(--radius) * 1.2)',
        lg: 'calc(var(--radius) * 1.6)'
      }
    }
  },
  plugins: []
} satisfies Config
