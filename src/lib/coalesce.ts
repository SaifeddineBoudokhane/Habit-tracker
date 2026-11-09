/**
 * Wraps a slow job so overlapping requests share runs instead of piling up or crossing each other.
 * Only one run is in flight at a time; requests made meanwhile are folded into a single follow-up run.
 * The returned promise settles once a run that started after the request has finished, so the caller
 * always sees its own change reflected. Failures are swallowed: the next request simply runs again.
 */
export function coalesce(job: () => Promise<unknown>): () => Promise<void> {
  let dirty = false;
  let running: Promise<void> | null = null;
  return () => {
    dirty = true;
    running ??= (async () => {
      try {
        while (dirty) {
          dirty = false;
          try {
            await job();
          } catch {
            // Keep going: a later request must not be stuck behind a failed run.
          }
        }
      } finally {
        running = null;
      }
    })();
    return running;
  };
}
