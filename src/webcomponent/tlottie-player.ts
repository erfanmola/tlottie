import type { FitzModifier, LoopConfig, PlayDirection } from "../core/types.ts";
import {
	createTLottiePlayer,
	type TLottiePlayerHandle,
} from "../vanilla/index.ts";

const OBSERVED_ATTRIBUTES = [
	"src",
	"data",
	"speed",
	"loop",
	"autoplay",
	"direction",
	"outline",
	"worker-count",
	"fitz",
	"play-on-click",
] as const;
const LIVE_TWEAK_ATTRIBUTES = new Set(["speed", "loop", "direction"]);

/**
 * `<tlottie-player src="..." loop autoplay></tlottie-player>`
 *
 * Attribute changes to `src`/`data`/`outline`/`worker-count`/`fitz` remount
 * the player (they change the underlying source or worker pool); `speed`,
 * `loop`, and `direction` are applied live to the running instance instead.
 */
export class TLottiePlayerElement extends HTMLElement {
	static get observedAttributes(): readonly string[] {
		return OBSERVED_ATTRIBUTES;
	}

	private handle: TLottiePlayerHandle | null = null;
	private connected = false;
	private explicitData: string | Uint8Array | undefined;

	get data(): string | Uint8Array | undefined {
		return this.explicitData ?? this.getAttribute("data") ?? undefined;
	}

	set data(value: string | Uint8Array | undefined) {
		this.explicitData = value;
		if (this.connected) this.mount();
	}

	get tlottie() {
		return this.handle?.tlottie ?? null;
	}

	connectedCallback(): void {
		this.connected = true;
		this.mount();
	}

	disconnectedCallback(): void {
		this.connected = false;
		this.unmount();
	}

	attributeChangedCallback(name: string): void {
		if (!this.connected) return;
		if (LIVE_TWEAK_ATTRIBUTES.has(name)) {
			this.applyLiveTweak(name);
			return;
		}
		this.mount();
	}

	private applyLiveTweak(name: string): void {
		const tlottie = this.handle?.tlottie;
		if (!tlottie) return;
		if (name === "speed") {
			const speed = Number(this.getAttribute("speed"));
			if (Number.isFinite(speed)) tlottie.setSpeed(speed);
		} else if (name === "loop") {
			tlottie.setLoop(this.readLoop());
		} else if (name === "direction") {
			tlottie.setDirection(this.readDirection());
		}
	}

	private readLoop(): LoopConfig {
		const raw = this.getAttribute("loop");
		if (raw === null) return false;
		if (raw === "" || raw === "true") return true;
		if (raw === "false") return false;
		const n = Number(raw);
		return Number.isFinite(n) ? n : true;
	}

	private readDirection(): PlayDirection {
		return this.getAttribute("direction") === "-1" ? -1 : 1;
	}

	private mount(): void {
		this.unmount();
		const workerCountAttr = this.getAttribute("worker-count");
		const fitzAttr = this.getAttribute("fitz");
		const speedAttr = this.getAttribute("speed");

		this.handle = createTLottiePlayer(this, {
			src: this.getAttribute("src") ?? undefined,
			data: this.data,
			outline: this.getAttribute("outline") ?? undefined,
			speed:
				speedAttr !== null && Number.isFinite(Number(speedAttr))
					? Number(speedAttr)
					: undefined,
			loop: this.readLoop(),
			direction: this.readDirection(),
			autoplay: this.hasAttribute("autoplay")
				? this.getAttribute("autoplay") !== "false"
				: true,
			workerCount:
				workerCountAttr !== null ? Number(workerCountAttr) : undefined,
			fitzModifier:
				fitzAttr !== null ? (Number(fitzAttr) as FitzModifier) : undefined,
			playOnClick: this.hasAttribute("play-on-click"),
		});
	}

	private unmount(): void {
		this.handle?.destroy();
		this.handle = null;
		this.replaceChildren();
	}
}

export function registerTLottiePlayerElement(tagName = "tlottie-player"): void {
	if (!customElements.get(tagName))
		customElements.define(tagName, TLottiePlayerElement);
}
