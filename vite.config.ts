import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import path from 'path';
import {defineConfig} from 'vite';

/**
 * The commit this build came from, so a bug report can be matched to a build.
 * A commit hash is public (not a secret). "+local" marks uncommitted changes.
 */
function buildVersion(): string {
  const git = (args: string) => execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  try {
    return git('rev-parse --short HEAD') + (git('status --porcelain') ? '+local' : '');
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev';
  }
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion()),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    },
    // Never inline secrets (e.g. GEMINI_API_KEY) via `define`: anything defined
    // here is embedded in the public JS bundle. Call Gemini from a server instead.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
