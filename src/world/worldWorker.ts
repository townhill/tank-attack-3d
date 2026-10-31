/**
 * Web Worker entry for WorldLoader: generates the battlefield for each
 * request and replies with its packed data, the large arrays transferred
 * rather than copied, or with the reason it could not be generated.
 */
import { generateWorld, worldOptionsFor } from './WorldGenerator';
import type { WorldReply, WorldRequest } from './WorldLoader';
import { packWorld, transferablesOf } from './worldTransfer';

/** The parts of the worker's global scope used here (the DOM typings describe a window instead). */
interface WorkerScope {
  onmessage: ((event: { readonly data: WorldRequest }) => void) | null;
  postMessage(message: WorldReply, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, seed, mapSize, fords } = event.data;
  let reply: WorldReply;
  try {
    reply = { id, world: packWorld(generateWorld(seed, worldOptionsFor(mapSize, fords))) };
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) }, []);
    return;
  }
  scope.postMessage(reply, transferablesOf(reply.world));
};
