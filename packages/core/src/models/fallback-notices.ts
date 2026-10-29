/**
 * Where a model fallback is heard about.
 *
 * The call that falls back is many layers below the op that needed it — a recall's expansion, a
 * write's derivation — and threading a warnings array through every one of them would touch every
 * signature on the way. So an op runs inside a scope, and a fallback reports into whichever scope
 * the call happened in. Work outside any op (a watcher-triggered index pass, the nightly cycle)
 * has no scope, and is heard by the process-level listeners the service logs with.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ModelFallbackWarning } from '@tenphi/akno-protocol';

const scope = new AsyncLocalStorage<ModelFallbackWarning[]>();
const listeners = new Set<(warning: ModelFallbackWarning) => void>();

/** Report one fallback to the enclosing scope, if any, and to every listener. Never throws. */
export function reportModelFallback(warning: ModelFallbackWarning): void {
  scope.getStore()?.push(warning);
  for (const listener of listeners) {
    try {
      listener(warning);
    } catch {
      // A logging failure must not fail the model call that already succeeded on the fallback.
    }
  }
}

/** Hear every fallback in this process, inside a scope or not. Returns the unsubscribe. */
export function onModelFallback(listener: (warning: ModelFallbackWarning) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Run `work` and return the fallbacks it caused, one per role, provider and reason. A nested
 * scope also passes its warnings up, so an op that runs an index pass hears what the pass did.
 */
export async function collectModelFallbacks<T>(
  work: () => Promise<T>,
): Promise<{ value: T; warnings: ModelFallbackWarning[] }> {
  const parent = scope.getStore();
  const collected: ModelFallbackWarning[] = [];
  const value = await scope.run(collected, work);
  const warnings = [
    ...new Map(
      collected.map((warning) => [
        `${warning.role}\0${warning.provider}\0${warning.fallback_provider}\0${warning.reason}`,
        warning,
      ]),
    ).values(),
  ];
  parent?.push(...warnings);
  return { value, warnings };
}
