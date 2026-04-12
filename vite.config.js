import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/tokyo-bill/', // 務必改成這個，對應你的 GitHub 儲存庫名稱
})
