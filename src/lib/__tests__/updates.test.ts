import { RELEASES_PAGE, buildFromTag, checkForUpdate, parseRelease } from '../updates';

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'build-18',
  html_url: 'https://github.com/x/y/releases/tag/build-18',
  published_at: '2026-11-08T10:00:00Z',
  assets: [{ name: 'habit-tracker.apk', browser_download_url: 'https://github.com/x/y/releases/download/build-18/habit-tracker.apk' }],
  ...over,
});

const respond = (status: number, body: unknown = {}) =>
  (async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })) as unknown as typeof fetch;

test('buildFromTag', () => {
  expect(buildFromTag('build-17')).toBe(17);
  expect(buildFromTag(' build-3 ')).toBe(3);
  expect(buildFromTag('v1.0.0')).toBeNull();
  expect(buildFromTag(undefined)).toBeNull();
});

test('parseRelease prefers the APK asset', () => {
  const r = parseRelease(release())!;
  expect(r.build).toBe(18);
  expect(r.downloadUrl).toMatch(/habit-tracker\.apk$/);
});

test('parseRelease falls back to the release page without an APK', () => {
  expect(parseRelease(release({ assets: [] }))!.downloadUrl).toBe('https://github.com/x/y/releases/tag/build-18');
  expect(parseRelease(release({ assets: [], html_url: undefined }))!.downloadUrl).toBe(RELEASES_PAGE);
});

test('parseRelease rejects releases that are not builds', () => {
  expect(parseRelease(release({ tag_name: 'v2' }))).toBeNull();
  expect(parseRelease(null)).toBeNull();
});

test('newer build is available, same or older is current', async () => {
  expect((await checkForUpdate(17, respond(200, release()))).status).toBe('available');
  expect((await checkForUpdate(18, respond(200, release()))).status).toBe('current');
  expect((await checkForUpdate(25, respond(200, release()))).status).toBe('current');
});

test('errors are explained, never thrown', async () => {
  expect(await checkForUpdate(1, respond(404))).toEqual({ status: 'error', message: 'No releases have been published yet.' });
  expect((await checkForUpdate(1, respond(403))).status).toBe('error');
  expect((await checkForUpdate(1, respond(500))).status).toBe('error');
  expect((await checkForUpdate(1, respond(200, { tag_name: 'v2' }))).status).toBe('error');
  const offline = (async () => {
    throw new TypeError('Network request failed');
  }) as unknown as typeof fetch;
  expect(await checkForUpdate(1, offline)).toEqual({
    status: 'error',
    message: 'Couldn’t reach GitHub. Check your internet connection and try again.',
  });
});
