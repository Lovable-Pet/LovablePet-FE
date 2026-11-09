/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

// https://vite.dev/config/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig(({ mode }) => {
  // VITE_ 가 아닌 값도 읽는다 (API_PROXY_TARGET 은 개발 서버 설정이라 화면 코드에는 넣지 않는다)
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.API_PROXY_TARGET || 'https://api.lovablepet.tech';
  let outDir = path.resolve(dirname, 'dist');

  // 개발 서버(localhost:5173)에서 /api 와 /models(GLB) 를 백엔드로 넘긴다.
  // 브라우저 입장에서는 같은 주소라 CORS가 필요 없고, 백엔드 CORS 허용 목록에 localhost 가 없어도
  // 막히지 않도록 Origin 헤더는 빼고 보낸다
  const proxy: ProxyOptions = {
    target: apiTarget,
    changeOrigin: true,
    configure: (proxyServer) => {
      proxyServer.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // public/mock(AR 목업 모델·사진, 약 165MB)은 개발용이다. 받아 둔 PC 에서 빌드해도 배포 파일에 섞이지 않게 지운다
        name: 'drop-mock-assets',
        apply: 'build',
        configResolved(config) {
          outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
          fs.rmSync(path.join(outDir, 'mock'), { recursive: true, force: true });
        },
      },
    ],
    server: {
      proxy: {
        '/api': proxy,
        '/models': proxy,
      },
    },
    test: {
      projects: [{
        extends: true,
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          }
        }
      }]
    }
  };
});
