import { defineConfig } from "tsup";

export default defineConfig([
  // CLI: published to npm, used via `npx set-docsync`.
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    outExtension: () => ({ js: ".mjs" }),
    banner: { js: "#!/usr/bin/env node" },
    target: "node20",
    clean: true,
    splitting: false,
  },
  // Action bundle: committed to the repo and referenced from action.yml.
  // noExternal bundles all deps into a single CJS file (required by runs.main).
  {
    entry: { index: "src/action/index.ts" },
    outDir: "dist/action",
    format: ["cjs"],
    target: "node20",
    noExternal: [/.*/],
    splitting: false,
    clean: false,
  },
]);
