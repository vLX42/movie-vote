import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    nitro({
      externals: {
        // @libsql/client loads its native binary (e.g. @libsql/linux-x64-gnu)
        // via a dynamic require() that Rollup/commonjs cannot bundle.
        // Mark it external so Node.js resolves it at runtime from node_modules.
        external: ["@libsql/client", "libsql"],
      },
    }),
    viteReact(),
  ],
});
