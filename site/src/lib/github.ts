/** "owner/name" */
export type RepoSlug = string;

/** 17, 1.2k, 12k: whole below a thousand, then thousands with at most one decimal. */
export function formatStars(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands < 10 ? thousands.toFixed(1).replace(/\.0$/, "") : Math.round(thousands)}k`;
}

/**
 * The repository's star count from GitHub's API, or null when GitHub can't be reached or refuses
 * (it allows 60 anonymous requests an hour per address). Sends `token` when given, for builds that
 * share an address with other projects.
 */
export async function fetchStars(repo: RepoSlug, token?: string): Promise<number | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json", ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) return null;
    const { stargazers_count: stars } = (await response.json()) as { stargazers_count?: unknown };
    return typeof stars === "number" ? stars : null;
  } catch {
    return null;
  }
}
