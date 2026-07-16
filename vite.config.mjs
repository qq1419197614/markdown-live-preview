import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(rootDirectory, 'index.html'),
                mermaidViewer: resolve(rootDirectory, 'mermaid-viewer.html')
            }
        }
    }
});
