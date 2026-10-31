import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapSize } from '../src/config/settings';
import { createStaticHit } from '../src/world/World';
import type { World } from '../src/world/World';
import { generateWorld, worldOptionsFor } from '../src/world/WorldGenerator';
import type { WorldReply, WorldRequest, WorldWorker } from '../src/world/WorldLoader';
import { browserWorldWorker, WorldLoader } from '../src/world/WorldLoader';
import type { PackedWorld } from '../src/world/worldTransfer';
import { packWorld, transferablesOf, unpackWorld } from '../src/world/worldTransfer';
import { makeRiverWorld } from './waterFixtures';

/** Round-trips a packed world through structured cloning as postMessage would, transferring its arrays. */
function postAcross(packed: PackedWorld): PackedWorld {
  return structuredClone(packed, { transfer: transferablesOf(packed) });
}

/** Asserts two worlds answer every query alike at a spread of points. */
function expectSameWorld(a: World, b: World): void {
  expect(b.seed).toBe(a.seed);
  expect(b.playableHalfSize).toBe(a.playableHalfSize);
  expect(Array.from(b.terrain.heights)).toEqual(Array.from(a.terrain.heights));
  expect(Array.from(b.water.level)).toEqual(Array.from(a.water.level));
  expect(b.water.maxLevel).toBe(a.water.maxLevel);
  expect(b.obstacles).toEqual(a.obstacles);
  expect(b.rivers).toEqual(a.rivers);
  expect(b.lakes).toEqual(a.lakes);
  expect(b.bridges).toEqual(a.bridges);
  expect(b.fords).toEqual(a.fords);
  const hitA = createStaticHit();
  const hitB = createStaticHit();
  const half = a.playableHalfSize;
  for (let k = 0; k < 200; k++) {
    const x = ((k * 37) % 101) / 100 * 2 * half - half;
    const z = ((k * 61) % 103) / 102 * 2 * half - half;
    expect(b.heightAt(x, z)).toBe(a.heightAt(x, z));
    expect(b.surfaceHeightAt(x, z)).toBe(a.surfaceHeightAt(x, z));
    expect(b.water.blockedDistance(x, z)).toBe(a.water.blockedDistance(x, z));
    a.raycastStatic(x, 40, z, -z, -5, x, hitA);
    b.raycastStatic(x, 40, z, -z, -5, x, hitB);
    expect(hitB.t).toBe(hitA.t);
    expect(hitB.surface).toBe(hitA.surface);
  }
}

describe('packWorld / unpackWorld', () => {
  it('rebuilds a generated battlefield that matches the original in every query', () => {
    const original = generateWorld(2);
    const copy = unpackWorld(postAcross(packWorld(generateWorld(2))));
    expect(original.lakes.length + original.rivers.length).toBeGreaterThan(0);
    expectSameWorld(original, copy);
  });

  it('carries bridges and a hand-built river across', () => {
    const copy = unpackWorld(postAcross(packWorld(makeRiverWorld([-80, 80]))));
    expectSameWorld(makeRiverWorld([-80, 80]), copy);
    expect(copy.bridges).toHaveLength(2);
  });

  it('lists each large array once for transfer', () => {
    const packed = packWorld(generateWorld(5));
    const buffers = transferablesOf(packed);
    expect(buffers).toHaveLength(3);
    expect(new Set(buffers).size).toBe(3);
  });
});

/** A worker stand-in that answers requests when told to, as the real one would. */
class FakeWorker implements WorldWorker {
  readonly requests: WorldRequest[] = [];
  terminated = false;
  private onReply: ((reply: WorldReply) => void) | null = null;
  private onFail: (() => void) | null = null;

  post(request: WorldRequest): void {
    this.requests.push(request);
  }

  listen(onReply: (reply: WorldReply) => void, onFail: () => void): void {
    this.onReply = onReply;
    this.onFail = onFail;
  }

  terminate(): void {
    this.terminated = true;
  }

  answer(k: number): void {
    const r = this.requests[k]!;
    this.onReply?.({ id: r.id, world: postAcross(packWorld(generateWorld(r.seed, worldOptionsFor(r.mapSize, r.fords)))) });
  }

  reply(message: WorldReply): void {
    this.onReply?.(message);
  }

  refuse(k: number): void {
    this.onReply?.({ id: this.requests[k]!.id, error: 'out of memory' });
  }

  crash(): void {
    this.onFail?.();
  }
}

function local(seed: number, mapSize: MapSize = 'standard'): World {
  return generateWorld(seed, worldOptionsFor(mapSize));
}

describe('WorldLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands back the battlefield the worker generated', async () => {
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const pending = loader.load(7, 'standard');
    expect(worker.requests).toEqual([{ id: 1, seed: 7, mapSize: 'standard', fords: false }]);
    worker.answer(0);
    expectSameWorld(local(7), await pending);
  });

  it('asks the worker for fords when the battlefield wants them', async () => {
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const pending = loader.load(3, 'standard', true);
    expect(worker.requests[0]!.fords).toBe(true);
    worker.answer(0);
    expect((await pending).fords.length).toBeGreaterThan(0);
  });

  it('matches replies to requests when they come back out of order', async () => {
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const first = loader.load(3, 'standard');
    const second = loader.load(4, 'large');
    worker.answer(1);
    worker.answer(0);
    expect((await first).seed).toBe(3);
    const big = await second;
    expect(big.seed).toBe(4);
    expect(big.playableHalfSize).toBe(worldOptionsFor('large').playableHalfSize);
  });

  it('starts the worker once and keeps using it', async () => {
    const worker = new FakeWorker();
    const create = vi.fn(() => worker);
    const loader = new WorldLoader(create);
    const a = loader.load(1, 'standard');
    const b = loader.load(2, 'standard');
    worker.answer(0);
    worker.answer(1);
    await Promise.all([a, b]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('generates on the main thread where no worker can be started', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expectSameWorld(local(9), await new WorldLoader(() => null).load(9, 'standard'));
    const throwing = new WorldLoader(() => {
      throw new Error('workers blocked');
    });
    expectSameWorld(local(9), await throwing.load(9, 'standard'));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('generates a request here when the worker reports it failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const pending = loader.load(6, 'standard');
    worker.refuse(0);
    expectSameWorld(local(6), await pending);
    expect(warn).toHaveBeenCalledWith('World worker failed; generating on the main thread:', 'out of memory');
    expect(worker.terminated).toBe(false);
  });

  it('finishes every outstanding request here when the worker dies, and stops using it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const worker = new FakeWorker();
    const create = vi.fn(() => worker);
    const loader = new WorldLoader(create);
    const a = loader.load(1, 'standard');
    const b = loader.load(2, 'standard');
    worker.crash();
    expect((await a).seed).toBe(1);
    expect((await b).seed).toBe(2);
    expect(worker.terminated).toBe(true);
    expect((await loader.load(3, 'standard')).seed).toBe(3);
    expect(create).toHaveBeenCalledTimes(1);
    expect(worker.requests).toHaveLength(2);
    expect(warn).toHaveBeenCalled();
  });

  it('rejects, rather than throws, when generating here fails', async () => {
    const loader = new WorldLoader(() => null);
    const pending = loader.load(1, 'enormous' as MapSize);
    await expect(pending).rejects.toThrow();
  });

  it('generates here when the battlefield the worker sent cannot be rebuilt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const pending = loader.load(4, 'standard');
    const broken = packWorld(generateWorld(4));
    worker.reply({ id: worker.requests[0]!.id, world: { ...broken, heights: new Float32Array(3) } });
    expectSameWorld(local(4), await pending);
    expect(warn).toHaveBeenCalled();
  });

  it('ignores replies it is not waiting for', async () => {
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const pending = loader.load(5, 'standard');
    worker.answer(0);
    worker.answer(0);
    expect((await pending).seed).toBe(5);
  });

  it('stops the worker and rejects what is outstanding when disposed', async () => {
    const worker = new FakeWorker();
    const loader = new WorldLoader(() => worker);
    const pending = loader.load(5, 'standard');
    loader.dispose();
    expect(worker.terminated).toBe(true);
    await expect(pending).rejects.toThrow('World loader disposed');
  });
});

describe('world worker entry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('replies to each request with the packed battlefield, its arrays transferred', async () => {
    const posted: { message: WorldReply; transfer: Transferable[] }[] = [];
    const scope: { onmessage: ((event: { data: WorldRequest }) => void) | null; postMessage(message: WorldReply, transfer: Transferable[]): void } = {
      onmessage: null,
      postMessage(message, transfer) {
        posted.push({ message, transfer });
      },
    };
    vi.stubGlobal('self', scope);
    await import('../src/world/worldWorker');
    scope.onmessage?.({ data: { id: 4, seed: 2, mapSize: 'standard', fords: false } });
    expect(posted).toHaveLength(1);
    const reply = posted[0]!;
    expect(reply.message.id).toBe(4);
    expect('world' in reply.message).toBe(true);
    if (!('world' in reply.message)) return;
    expect(reply.transfer).toHaveLength(3);
    expectSameWorld(local(2), unpackWorld(reply.message.world));

    // A request that cannot be generated is answered with the reason.
    scope.onmessage?.({ data: { id: 5, seed: 2, mapSize: 'enormous' as MapSize, fords: false } });
    expect(posted[1]!.message).toEqual({ id: 5, error: expect.any(String) as string });
  });
});

describe('browserWorldWorker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Stands in for the browser's Worker, recording how it is created and used. */
  class StubWorker {
    static last: StubWorker | null = null;
    readonly posted: unknown[] = [];
    terminated = false;
    onmessage: ((event: { data: WorldReply }) => void) | null = null;
    onerror: ((event: { preventDefault(): void }) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    constructor(readonly url: URL, readonly options: { type: string; name: string }) {
      StubWorker.last = this;
    }
    postMessage(message: unknown): void {
      this.posted.push(message);
    }
    terminate(): void {
      this.terminated = true;
    }
  }

  it('is unavailable where the browser has no workers', () => {
    vi.stubGlobal('Worker', undefined);
    expect(browserWorldWorker()).toBeNull();
  });

  it('starts the generation script as a module worker and passes messages both ways', () => {
    vi.stubGlobal('Worker', StubWorker);
    const worker = browserWorldWorker()!;
    const stub = StubWorker.last!;
    expect(stub.url.pathname.endsWith('/worldWorker.ts')).toBe(true);
    expect(stub.options.type).toBe('module');

    const replies: WorldReply[] = [];
    let failures = 0;
    worker.listen((reply) => replies.push(reply), () => failures++);
    worker.post({ id: 1, seed: 2, mapSize: 'standard', fords: false });
    expect(stub.posted).toEqual([{ id: 1, seed: 2, mapSize: 'standard', fords: false }]);
    stub.onmessage?.({ data: { id: 1, error: 'nope' } });
    expect(replies).toEqual([{ id: 1, error: 'nope' }]);

    // A script error is reported as a failure and kept out of the console.
    const preventDefault = vi.fn();
    stub.onerror?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    stub.onmessageerror?.();
    expect(failures).toBe(2);
    worker.terminate();
    expect(stub.terminated).toBe(true);
  });
});
