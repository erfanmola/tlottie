import { $ } from "bun";

// Keep native TypeScript 7 checks independent of the TypeScript 6 API used
// by Vue/Svelte declaration tooling (whose tsc binaries can shadow it).
for (const config of [
	"tsconfig.json",
	"tsconfig.react.json",
	"tsconfig.solid.json",
	"tsconfig.worker.json",
	"tsconfig.bin.json",
]) {
	await $`node node_modules/typescript7/bin/tsc --noEmit -p ${config}`;
}
