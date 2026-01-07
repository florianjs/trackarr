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
  ],

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
