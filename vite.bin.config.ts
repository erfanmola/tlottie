import { chmodSync } from "node:fs";
import { defineConfig } from "vite";
import { copyWasmPlugin } from "./vite.shared.ts";

/** Marks the built CLI script executable — npm sets this from the tarball's mode bit for `bin` entries. */
function chmodExecutablePlugin() {
	return {
		name: "tlottie-chmod-executable",
		apply: "build" as const,
		writeBundle(options: { dir?: string }) {
			chmodSync(`${options.dir ?? "dist/bin"}/lottie-to-outline.js`, 0o755);
		},
	};
}

export default defineConfig({
	build: {
		outDir: "dist/bin",
		emptyOutDir: true,
		target: "node18",
		lib: {
			entry: "src/bin/lottie-to-outline.ts",
			formats: ["es"],
			fileName: () => "lottie-to-outline.js",
		},
		rollupOptions: {
			// Node builtins and the vectorizer's native (napi-rs) binding stay
			// external — only this package's own TS gets bundled. No banner
			// needed for the shebang: Rollup auto-detects and preserves the
			// one already on the entry file's first line — adding one here
			// too produces a duplicate that corrupts the whole bundle.
			external: (id) => id.startsWith("node:") || id === "@neplex/vectorizer",
		},
	},
	plugins: [copyWasmPlugin(), chmodExecutablePlugin()],
});
