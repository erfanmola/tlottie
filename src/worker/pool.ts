// Each worker owns its own wasm module instance (~1MB+ of memory once
// loaded), so sizing this off navigator.hardwareConcurrency ends up
// spinning up several megabytes of workers on typical 8-16 core machines
// for zero benefit on most pages. A single shared worker already
// multiplexes any number of animations fine; callers who actually profile
// a worker-bound workload can raise this with
// configureTLottie({ workerCount }) or a per-pool setSize().
const DEFAULT_POOL_SIZE = 1;

/** Round-robin pool of tlottie render workers, grown lazily up to `size`. */
export class TLottieWorkerPool {
	private workers: Worker[] = [];
	private nextIndex = -1;
	private size: number;

	constructor(size: number = DEFAULT_POOL_SIZE) {
		this.size = Math.max(1, size);
	}

	setSize(size: number): void {
		if (size < 1)
			throw new Error("tlottie: worker pool size must be at least 1");
		this.size = size;
		while (this.workers.length > size) {
			this.workers.pop()?.terminate();
		}
	}

	getWorker(): Worker {
		if (this.workers.length < this.size) {
			const worker = new Worker(
				new URL("./tlottie.worker.ts", import.meta.url),
				{ type: "module" },
			);
			this.workers.push(worker);
			this.nextIndex = this.workers.length - 1;
			return worker;
		}
		this.nextIndex = (this.nextIndex + 1) % this.workers.length;
		return this.workers[this.nextIndex];
	}

	/** Eagerly grows the pool to its full configured `size` (if not already there) and returns every worker in it — each worker owns its own wasm module instance, so warming up "the pool" means warming up every slot, not just the one `getWorker()` would hand back next. */
	getAllWorkers(): Worker[] {
		while (this.workers.length < this.size) this.getWorker();
		return [...this.workers];
	}

	terminateAll(): void {
		for (const worker of this.workers) worker.terminate();
		this.workers = [];
		this.nextIndex = -1;
	}
}

export const defaultWorkerPool = new TLottieWorkerPool();
