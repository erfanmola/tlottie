import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist/svelte",
		emptyOutDir: true,
		lib: {
			entry: "src/svelte/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
		rollupOptions: {
			// Svelte 5 splits its runtime across many `svelte/internal/*`
			// submodules — a regex catches all of them, not just the two
			// most common entry points.
			external: [/^svelte(\/.*)?$/],
		},
	},
	plugins: [
		svelte(),
		// Component declarations are emitted by svelte2tsx in the final
		// declaration fixup hook; this pass emits the shared TypeScript API.
		dts({
			tsconfigPath: "tsconfig.svelte.json",
			include: ["src/svelte/index.ts", "src/svelte/shims.d.ts", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
			exclude: ["**/*.svelte"],
			insertTypesEntry: false,
		}),
		fixDtsExtensionsPlugin("dist/svelte"),
	],
});
