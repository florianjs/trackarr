import { requireAdminSession } from '../../../utils/adminAuth';
import pkg from '../../../../package.json';

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const currentVersion = pkg.version;
  let latestRelease: GitHubRelease | null = null;
  let updateAvailable = false;

  try {
    // Check GitHub releases
    const response = await fetch(
      'https://api.github.com/repos/flormusic/opentracker/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenTracker-Admin',
        },
      }
    );

    if (response.ok) {
      latestRelease = await response.json();
      if (latestRelease) {
        const latestVersion = latestRelease.tag_name.replace(/^v/, '');
        updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
      }
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }

  return {
    currentVersion,
    latestRelease: latestRelease
      ? {
          version: latestRelease.tag_name,
          name: latestRelease.name,
          publishedAt: latestRelease.published_at,
          url: latestRelease.html_url,
          notes: latestRelease.body,
        }
      : null,
    updateAvailable,
  };
});

/**
 * Compare two semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}
