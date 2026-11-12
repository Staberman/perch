import { fetchStars, formatStars } from "../lib/github.ts";

/** How long a count fetched in this tab is reused, so moving around the site doesn't spend GitHub's rate limit. */
const FRESH_MS = 30 * 60 * 1000;

function remembered(key: string): number | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null") as { stars: number; at: number } | null;
    return saved && Date.now() - saved.at < FRESH_MS ? saved.stars : null;
  } catch {
    return null;
  }
}

function remember(key: string, stars: number) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ stars, at: Date.now() }));
  } catch {
    // Storage can be off; the count just gets fetched again next time.
  }
}

/**
 * <github-stars repo="owner/name" hidden?><span data-count>17</span></github-stars>
 * Brings the star count rendered at build time up to date, and shows itself once it has one.
 */
export class GitHubStars extends HTMLElement {
  async connectedCallback() {
    const repo = this.getAttribute("repo");
    if (!repo) return;
    const key = `tomari:stars:${repo}`;
    const stars = remembered(key) ?? (await fetchStars(repo));
    if (stars == null) return;
    remember(key, stars);
    const count = this.querySelector("[data-count]");
    const text = formatStars(stars);
    if (count && count.textContent !== text) {
      count.textContent = text;
      if (!this.hidden) this.animate([{ opacity: 0.3, translate: "0 3px" }, { opacity: 1, translate: "0 0" }], { duration: 500, easing: "ease-out" });
    }
    this.hidden = false;
  }
}

customElements.define("github-stars", GitHubStars);
