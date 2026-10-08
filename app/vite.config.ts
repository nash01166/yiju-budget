import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 用相對路徑，GitHub Pages 的 repo 名稱改了也不用動這裡
// 版本 = 建置時間（台北時間），例如 2026.10.09 14:30
const version = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date()).replace(/-/g, '.')

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 在 main.tsx 自己註冊，才能在回到 App 時主動檢查更新
      injectRegister: false,
      includeAssets: ['apple-touch-icon.png'],
      workbox: {
        // 字型快取起來，離線時也維持布丁風格的字型
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: '一句記帳',
        short_name: '一句記帳',
        lang: 'zh-Hant-TW',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#fbf3d9',
        theme_color: '#fbf3d9',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
