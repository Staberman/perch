const repo = "elrincondeldev/tomari";

export const site = {
  name: "Tomari",
  repo,
  title: "Tomari · Your Claude Code sessions, perched on your screen",
  description:
    "Tomari puts one animated pixel-art creature per Claude Code session on the edge of your Mac's screen. See which ones work, which need you and which are done, and click one to jump back in.",
  installCommand: "npx tomari setup",
  links: {
    repo: `https://github.com/${repo}`,
    npm: "https://www.npmjs.com/package/tomari",
    license: `https://github.com/${repo}/blob/main/LICENSE`,
    claudePanel: "https://github.com/elrincondeldev/claude-panel",
  },
  disclaimer:
    "Tomari is not an official Anthropic project and is not affiliated with or endorsed by Anthropic. “Claude” is a trademark of Anthropic, PBC.",
} as const;

/** Each section's number and its name in Japanese, written in brush calligraphy. */
export const sections = {
  moods: { numeral: "一", kanji: "気分", label: "Moods" },
  yours: { numeral: "二", kanji: "自分らしく", label: "Make it yours" },
  features: { numeral: "三", kanji: "特徴", label: "Features" },
  how: { numeral: "四", kanji: "仕組み", label: "How it works" },
  install: { numeral: "五", kanji: "導入", label: "Install" },
} as const;

export const perch = {
  kanji: "止まり木",
  reading: "tomarigi",
  meaning: "a perch; a place for a bird to rest",
} as const;
