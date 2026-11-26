/**
 * Generates battlefields off the main thread. A Huge map takes around half a
 * second to generate, long enough to freeze the menu, so a Web Worker builds
 * the world and sends back its packed data (see worldTransfer). Where no
 * worker can be started, or one fails or stops answering, the world is
 * generated on the main thread instead; either way the same seed gives the
 * same battlefield.
 */
import type { MapSize, TerrainType } from '../config/settings';
import type { World } from './World';
import { generateWorld, worldOptionsFor } from './WorldGenerator';
import type { PackedWorld } from './worldTransfer';
import { unpackWorld } from './worldTransfer';

export interface WorldRequest {
  readonly id: number;
  readonly seed: number;
  readonly mapSize: MapSize;
  /** Whether each river gets a shallow ford. */
  readonly fords: boolean;
  /** Shape of the ground. */
  readonly terrain: TerrainType;
}

/** The worker's answer to request `id`: the packed battlefield, or why it could not be generated. */
export type WorldReply = { readonly id: number; readonly world: PackedWorld } | { readonly id: number; readonly error: string };

/** The few things the loader needs from a worker, so tests can stand in for one. */
export interface WorldWorker {
  post(request: WorldRequest): void;
  /** Registers the handlers for replies and for the worker itself failing. */
  listen(onReply: (reply: WorldReply) => void, onFail: () => void): void;
  terminate(): void;
}

/**
 * How long a request may go unanswered before the worker is given up on. A
 * browser can kill a worker (out of memory, say) without reporting an error,
 * which would otherwise leave the menu generating for ever. Far longer than
 * the half second a Huge map takes, to allow for slow devices and queued requests.
 */
export const WORLD_TIMEOUT_MS = 20000;

interface Job {
  /** Gives up on the worker if it has not answered in time. */
  readonly timer: ReturnType<typeof setTimeout>;
  readonly seed: number;
  readonly mapSize: MapSize;
  readonly fords: boolean;
  readonly terrain: TerrainType;
  resolve(world: World): void;
  reject(error: unknown): void;
}

/** Starts the generation worker in a browser; null where workers are not supported. */
export function browserWorldWorker(): WorldWorker | null {
  if (typeof Worker === 'undefined') return null;
  const worker = new Worker(new URL('./worldWorker.ts', import.meta.url), { type: 'module', name: 'world-generator' });
  return {
    post: (request) => {
      worker.postMessage(request);
    },
    listen: (onReply, onFail) => {
      worker.onmessage = (event: MessageEvent<WorldReply>) => {
        onReply(event.data);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        onFail();
      };
      worker.onmessageerror = () => {
        onFail();
      };
    },
    terminate: () => {
      worker.terminate();
    },
  };
}

export class WorldLoader {
  /** The worker once started; null when there is none to use; undefined before the first load. */
  private worker: WorldWorker | null | undefined = undefined;
  private nextId = 1;
  private readonly jobs = new Map<number, Job>();

  constructor(
    private readonly createWorker: () => WorldWorker | null = browserWorldWorker,
    private readonly timeoutMs = WORLD_TIMEOUT_MS,
  ) {}

  /**
   * The battlefield for `seed` at `mapSize` with `terrain` ground, with fords
   * when `fords`, generated off the main thread where possible.
   */
  load(seed: number, mapSize: MapSize, fords = false, terrain: TerrainType = 'gentle'): Promise<World> {
    const worker = this.ensureWorker();
    // Generating here inside the executor turns a failure into a rejection rather than a throw.
    if (!worker) return new Promise<World>((resolve) => { resolve(generateHere(seed, mapSize, fords, terrain)); });
    const id = this.nextId++;
    return new Promise<World>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail('did not answer in time');
      }, this.timeoutMs);
      this.jobs.set(id, { timer, seed, mapSize, fords, terrain, resolve, reject });
      try {
        worker.post({ id, seed, mapSize, fords, terrain });
      } catch (error) {
        // The request never left, so nothing will answer it: without this its timer would later condemn a healthy worker.
        this.jobs.delete(id);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Stops the worker; requests still outstanding are rejected. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.takeJobs()) job.reject(new Error('World loader disposed'));
  }

  private ensureWorker(): WorldWorker | null {
    if (this.worker !== undefined) return this.worker;
    try {
      this.worker = this.createWorker();
    } catch (error) {
      console.warn('World worker unavailable; generating on the main thread:', error);
      this.worker = null;
    }
    this.worker?.listen(
      (reply) => {
        this.receive(reply);
      },
      () => {
        this.fail('stopped');
      },
    );
    return this.worker;
  }

  private receive(reply: WorldReply): void {
    const job = this.jobs.get(reply.id);
    if (!job) return;
    this.jobs.delete(reply.id);
    clearTimeout(job.timer);
    if ('world' in reply) {
      try {
        job.resolve(unpackWorld(reply.world));
        return;
      } catch (error) {
        console.warn('World worker sent a battlefield that could not be rebuilt; generating on the main thread:', error);
      }
    } else {
      console.warn('World worker failed; generating on the main thread:', reply.error);
    }
    finishHere(job);
  }

  /** The worker died or hung, as `reason` says: finishes every outstanding request here and stops using it. */
  private fail(reason: string): void {
    console.warn(`World worker ${reason}; generating on the main thread`);
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.takeJobs()) finishHere(job);
  }

  /** Empties the outstanding requests, stopping their timers, and returns them. */
  private takeJobs(): Job[] {
    const jobs = [...this.jobs.values()];
    this.jobs.clear();
    for (const job of jobs) clearTimeout(job.timer);
    return jobs;
  }
}

function generateHere(seed: number, mapSize: MapSize, fords: boolean, terrain: TerrainType): World {
  return generateWorld(seed, worldOptionsFor(mapSize, fords, terrain));
}

function finishHere(job: Job): void {
  try {
    job.resolve(generateHere(job.seed, job.mapSize, job.fords, job.terrain));
  } catch (error) {
    job.reject(error);
  }
}
