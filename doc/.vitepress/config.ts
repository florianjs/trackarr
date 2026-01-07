import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OpenTracker',
  description: 'A modern, high-performance private BitTorrent tracker',
  
  base: '/opentracker/',
  
  ignoreDeadLinks: [
    /^http:\/\/localhost/,
  ],
  
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', rel: 'stylesheet' }],
  ],

  vite: {
    plugins: [
      // @ts-ignore
      (await import('@tailwindcss/vite')).default(),
    ],
  },

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/api' },
      { text: 'Support', link: '/support/professional' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Backup & Restore', link: '/guide/backup-restore' },
            { text: 'Roadmap', link: '/guide/roadmap' },
          ]
        },
        {
          text: 'Security',
          items: [
            { text: 'Overview', link: '/guide/security' },
            { text: 'Zero-Knowledge Auth', link: '/guide/zero-knowledge-auth' },
            { text: 'Panic Mode', link: '/guide/panic-mode' },
          ]
        },
        {
          text: 'Help',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'Load Testing', link: '/guide/load-testing' },
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'API', link: '/reference/api' },
            { text: 'Environment Variables', link: '/reference/env' },
          ]
        }
      ],
      '/support/': [
        {
          text: 'Support',
          items: [
            { text: 'Professional Services', link: '/support/professional' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/florianjs/opentracker' },
      { icon: 'discord', link: 'https://discord.gg/GRFu35djvz' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: '2025-present OpenTracker'
    },

    search: {
      provider: 'local'
    },
    
    outline: {
      level: [2, 3],
      label: 'On this page'
    }
  }
})
