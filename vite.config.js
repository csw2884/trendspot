import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/seoul-citydata': {
        target: 'http://openAPI.seoul.go.kr:8088',
        changeOrigin: true,
        rewrite: (path) => {
          // /api/seoul-citydata/광화문·덕수궁 → /46575a435764616e3639496a4d7377/json/citydata_ppltn/1/5/광화문·덕수궁
          const locationName = path.replace('/api/seoul-citydata/', '');
          return `/46575a435764616e3639496a4d7377/json/citydata_ppltn/1/5/${locationName}`;
        }
      }
    }
  }
})