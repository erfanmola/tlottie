import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { fixDtsExtensionsPlugin } from "./vite.shared.ts";

export default defineConfig({
	base: "./",
	build: {
		outDir: "dist/vue",
		emptyOutDir: true,
		lib: {
			entry: "src/vue/index.ts",
			formats: ["es"],
			fileName: () => "index.js",
		},
		rollupOptions: {
			external: ["vue"],
		},
	},
	plugins: [
		vue(),
		dts({
			processor: "vue",
			tsconfigPath: "tsconfig.vue.json",
			include: ["src/vue/index.ts", "src/vue/**/*.vue", "src/core/**/*.ts", "src/main/**/*.ts", "src/worker/pool.ts", "src/worker/protocol.ts"],
			insertTypesEntry: false,
		}),
		fixDtsExtensionsPlugin("dist/vue"),
	],
});
