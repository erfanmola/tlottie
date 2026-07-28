import { svelte } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { copyWasmToOutDirPlugin } from "../vite.shared.ts";

// The demo imports the library straight from src/ (not the built dist/), so
// `bun run dev` never needs a prior `bun run build`. React and Solid both
// use .tsx — each plugin is scoped to only its own directories (both the
// demo page and the matching library adapter) so they don't fight over the
// same extension.
export default defineConfig({
	root: "demo",
	// demo/assets/{sample.json,sample.tgs,outline.svg} are served/copied at
	// the site root (not "/assets/") — see demo/asset-url.ts. outline.svg is
	// also separately `?raw`-imported by the demo pages; both work fine on
	// the same directory.
	publicDir: "assets",
	// GitHub Pages project sites serve from /<repo>/, not /. GITHUB_PAGES is
	// set by .github/workflows/pages.yml; plain `vite dev`/local builds stay
	// at root.
	base: process.env.GITHUB_PAGES ? "/tlottie/" : "/",
	plugins: [
		react({ include: [/\/demo\/react\/.*\.tsx?$/, /\/src\/react\/.*\.tsx?$/] }),
		solid({ include: [/\/demo\/solid\/.*\.tsx?$/, /\/src\/solid\/.*\.tsx?$/] }),
		vue(),
		svelte(),
		copyWasmToOutDirPlugin(),
	],
	server: {
		fs: { allow: [".."] },
	},
	build: {
		outDir: "../dist-demo",
		emptyOutDir: true,
		rollupOptions: {
			// Relative to `root` ("demo"), not the project root.
			input: {
				index: "index.html",
				vanilla: "vanilla/index.html",
				webcomponent: "webcomponent/index.html",
				react: "react/index.html",
				solid: "solid/index.html",
				vue: "vue/index.html",
				svelte: "svelte/index.html",
			},
		},
	},
});
