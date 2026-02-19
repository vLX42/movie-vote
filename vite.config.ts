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
      // noExternals: false enables Nitro's file tracer (nf3/@vercel/nft) to copy
      // external packages (including native binaries) into .output/server/node_modules/.
      // Without this, Nitro forces noExternal:true at build time which bundles
      // EVERYTHING — including @libsql/client whose native .node binary cannot be
      // handled by Rollup's commonjs shim.
      noExternals: false,
      externals: {
        // Ensure @libsql/client and libsql (native binary loader) are traced and
        // copied to .output/server/node_modules/ rather than inlined.
        external: ["@libsql/client", "libsql"],
      },
    }),
    viteReact(),
  ],
});
