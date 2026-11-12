import { fetchStars } from "../lib/github.ts";
import { site } from "./site.ts";

/** The star count when the site was built, asked once per build; null if GitHub didn't answer. */
export const starsAtBuild: Promise<number | null> = fetchStars(site.repo, process.env["GITHUB_TOKEN"]);
