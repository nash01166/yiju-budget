import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 用相對路徑，GitHub Pages 的 repo 名稱改了也不用動這裡
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '一句記帳',
        short_name: '一句記帳',
        lang: 'zh-Hant-TW',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f4f5f7',
        theme_color: '#0f9d8a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
