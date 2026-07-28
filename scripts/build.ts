#!/usr/bin/env bun
// Runs every per-target Vite build sequentially. Each target has
// incompatible JSX/SFC compiler plugins (React vs Solid vs Vue vs Svelte),
// so they can't share a single Vite config.
import { $ } from "bun";

const configs = ["vite.core.config.ts", "vite.vanilla.config.ts", "vite.webcomponent.config.ts", "vite.react.config.ts", "vite.solid.config.ts", "vite.vue.config.ts", "vite.svelte.config.ts"];

for (const config of configs) {
	console.log(`\n> vite build --config ${config}`);
	await $`bunx vite build --config ${config}`;
}
