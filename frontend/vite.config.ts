import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const ASSET_DIRS = 'units|abilities|skills|attrs|flags|armory|bundles|daplan|mech|stats|unitcat';

/** En la web estática las imágenes cuelgan de la base (/WH3-Planner/): "/units/x.png" -> "/WH3-Planner/units/x.png" */
function baseAssets(base: string): Plugin {
  const re = new RegExp(`([\`'"])/(${ASSET_DIRS})/`, 'g');
  return {
    name: 'wh3-base-assets',
    transform(code, id) {
      if (!/\/frontend\/src\/.*\.(tsx?|jsx?)$/.test(id)) return null;
      return re.test(code) ? code.replace(re, `$1${base}$2/`) : null;
    },
  };
}

// npm run dev: /api va al backend (puerto 3001).
// npm run build:static: web sin servidor para el celular (GitHub Pages): el backend corre en el navegador.
export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static';
  const base = isStatic ? process.env.BASE_PATH ?? '/WH3-Planner/' : '/';
  return {
    base,
    plugins: [react(), ...(isStatic ? [baseAssets(base)] : [])],
    define: { 'import.meta.env.VITE_STATIC': JSON.stringify(isStatic ? '1' : '0') },
    resolve: {
      alias: {
        '@local': here(isStatic ? './src/static/local.ts' : './src/static/none.ts'),
        ...(isStatic ? {
          'node:fs': here('./src/static/fs.ts'),
          'node:path': here('./src/static/path.ts'),
          'node:url': here('./src/static/url.ts'),
          'node:crypto': here('./src/static/crypto.ts'),
        } : {}),
      },
    },
    build: { chunkSizeWarningLimit: 2000 },
    server: {
      port: 5173,
      proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3001}` },
    },
  };
});
