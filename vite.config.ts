import { defineConfig } from 'vite'

export default defineConfig({
  base: './',  // Use relative paths for assets - required for Logseq plugins
  build: {
    target: 'esnext',
    minify: 'esbuild',
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,  // Disable modulepreload - can cause issues in plugin iframe
    cssCodeSplit: false,   // Keep CSS in HTML
    rollupOptions: {
      output: {
        // Use IIFE format instead of ES module for better compatibility
        format: 'iife',
        entryFileNames: 'index.js',
        // Inline all chunks into single file
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
