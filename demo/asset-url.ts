// demo/vite.config.ts sets `publicDir: "assets"`, so these files are served
// (dev) / copied verbatim (build) at the site root, not under "/assets/".
// Prefixing with BASE_URL keeps this correct under a non-root deploy base
// (e.g. GitHub Pages project sites at /tlottie/) as well as plain "/" dev.
export function assetUrl(name: string): string {
	return `${import.meta.env.BASE_URL}${name}`;
}
