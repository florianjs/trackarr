import type { Config } from 'tailwindcss'

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
        // Monochrome palette
        bg: {
          primary: '#0a0a0a',
          secondary: '#141414',
          tertiary: '#1a1a1a',
          hover: '#252525'
        },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1a1',
          muted: '#666666'
        },
        border: {
          DEFAULT: '#2a2a2a',
          hover: '#3a3a3a'
        },
        accent: {
          DEFAULT: '#ffffff',
          muted: '#888888'
        },
        success: '#22c55e',
        warning: '#eab308',
        error: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.85rem' }]
      }
    }
  },
  plugins: []
} satisfies Config
