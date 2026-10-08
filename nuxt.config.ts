import pkg from './package.json';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    'nuxt-auth-utils',
    '@nuxtjs/i18n',
  ],

  // Translations live in i18n/locales/<code>/*.json, one file per area so
  // features can add strings without conflicting (issue #43)
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', files: ['en/app.json', 'en/shop.json', 'en/messages.json'] },
      { code: 'fr', language: 'fr-FR', name: 'Français', files: ['fr/app.json', 'fr/shop.json', 'fr/messages.json'] },
    ],
    // English unless the user picks another language (stored in a cookie by
    // app/plugins/locale-cookie.ts); the browser language is not used
    detectBrowserLanguage: false,
  },

  typescript: {
    strict: true,
    typeCheck: false, // Set to true in CI with vue-tsc installed
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config.ts',
  },

  runtimeConfig: {
    databaseUrl: (() => {
      const baseUrl =
        process.env.DATABASE_URL ||
        'postgres://tracker:tracker@localhost:5432/trackarr';
      // Force SSL in production
      if (
        process.env.NODE_ENV === 'production' &&
        !baseUrl.includes('sslmode=')
      ) {
        return (
          baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'sslmode=require'
        );
      }
      return baseUrl;
    })(),
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    // Sealed session cookies are stateless: bound their lifetime so a stolen
    // or stale cookie does not stay valid forever.
    session: {
      maxAge: 60 * 60 * 24 * 7,
      cookie: {
        sameSite: 'lax',
        // Override at runtime with NUXT_SESSION_COOKIE_SECURE=false only when
        // serving a production build over plain HTTP (local testing)
        secure: process.env.NODE_ENV === 'production',
      },
    },
    public: {
      appVersion: pkg.version,
      trackerHttpUrl:
        process.env.TRACKER_HTTP_URL || 'http://localhost:8080/announce',
      trackerUdpUrl:
        process.env.TRACKER_UDP_URL || 'udp://localhost:8081/announce',
      trackerWsUrl: process.env.TRACKER_WS_URL || 'ws://localhost:8082',
    },
  },

  // Exclude native modules from Nitro bundling
  nitro: {
    externals: {
      inline: [],
      external: [
        'node-datachannel',
        'webrtc-polyfill',
        '@thaunknown/simple-peer',
        'webtorrent',
      ],
    },
  },

  app: {
    head: {
      title: 'Trackarr',
      meta: [
        { name: 'description', content: 'High-performance BitTorrent tracker' },
      ],
    },
  },

  build: {
    transpile: ['chart.js', 'vue-chartjs'],
  },
});
