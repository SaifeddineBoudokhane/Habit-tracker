import { coalesce } from '../coalesce';

const tick = () => new Promise<void>((r) => setTimeout(r, 5));

test('overlapping requests never run at the same time and fold into one follow-up', async () => {
  let active = 0;
  let maxActive = 0;
  let runs = 0;
  const request = coalesce(async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    runs++;
    await tick();
    active--;
  });
  await Promise.all([request(), request(), request(), request(), request()]);
  expect(maxActive).toBe(1);
  // First run starts at once; the four that arrived meanwhile share one more.
  expect(runs).toBe(2);
});

test('a request made during a run is covered by a run that starts after it', async () => {
  let state = 0;
  const seen: number[] = [];
  const request = coalesce(async () => {
    const snapshot = state;
    await tick();
    seen.push(snapshot);
  });
  const first = request();
  state = 1;
  await Promise.all([first, request()]);
  expect(seen).toEqual([0, 1]);
});

test('a failed run does not block later requests', async () => {
  let runs = 0;
  const request = coalesce(async () => {
    runs++;
    if (runs === 1) throw new Error('boom');
  });
  await request();
  await request();
  expect(runs).toBe(2);
});
