/**
 * "Check for updates": new APKs are published as GitHub releases tagged `build-<n>` by CI, and each
 * APK's Android versionCode is that same <n>. The app's only network request, made when you tap the button.
 */

export const RELEASES_REPO = 'SaifeddineBoudokhane/Habit-tracker';
const LATEST_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;

export interface Release {
  build: number;
  /** Direct APK download when the release has one, else the release page. */
  downloadUrl: string;
  pageUrl: string;
  publishedAt: string;
}

export type UpdateCheck =
  | { status: 'available'; release: Release }
  | { status: 'current'; release: Release }
  | { status: 'error'; message: string };

/** Build number from a tag like "build-42", or null. */
export function buildFromTag(tag: unknown): number | null {
  const m = typeof tag === 'string' ? /^build-(\d+)$/.exec(tag.trim()) : null;
  return m ? Number(m[1]) : null;
}

/** Reads the GitHub "latest release" response. Returns null if it isn't one of our build releases. */
export function parseRelease(json: unknown): Release | null {
  const r = json as { tag_name?: unknown; html_url?: unknown; published_at?: unknown; assets?: unknown } | null;
  const build = buildFromTag(r?.tag_name);
  if (!r || build === null) return null;
  const pageUrl = typeof r.html_url === 'string' ? r.html_url : RELEASES_PAGE;
  const assets = Array.isArray(r.assets) ? (r.assets as { name?: unknown; browser_download_url?: unknown }[]) : [];
  const apk = assets.find((a) => typeof a?.name === 'string' && a.name.endsWith('.apk') && typeof a.browser_download_url === 'string');
  return {
    build,
    downloadUrl: (apk?.browser_download_url as string | undefined) ?? pageUrl,
    pageUrl,
    publishedAt: typeof r.published_at === 'string' ? r.published_at : '',
  };
}

export function compare(release: Release, currentBuild: number): UpdateCheck {
  return { status: release.build > currentBuild ? 'available' : 'current', release };
}

export async function checkForUpdate(currentBuild: number, fetchImpl: typeof fetch = fetch, timeoutMs = 10_000): Promise<UpdateCheck> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal });
    if (res.status === 404) return { status: 'error', message: 'No releases have been published yet.' };
    if (res.status === 403 || res.status === 429)
      return { status: 'error', message: 'GitHub is limiting requests right now. Try again in a few minutes.' };
    if (!res.ok) return { status: 'error', message: `GitHub answered with an error (${res.status}). Try again later.` };
    const release = parseRelease(await res.json());
    if (!release) return { status: 'error', message: 'The latest release isn’t an app build.' };
    return compare(release, currentBuild);
  } catch {
    return { status: 'error', message: 'Couldn’t reach GitHub. Check your internet connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}
