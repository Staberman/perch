/**
 * Marks [data-reveal] elements with .is-revealed the first time they scroll into view, and fires a
 * "revealed" event on them. Siblings reveal one after another, by their --stagger index.
 */
export function revealOnScroll(root: ParentNode = document) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        entry.target.dispatchEvent(new Event("revealed"));
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );

  const seen = new Map<Element | null, number>();
  for (const node of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
    const index = seen.get(node.parentElement) ?? 0;
    seen.set(node.parentElement, index + 1);
    node.style.setProperty("--stagger", String(Math.min(index, 6)));
    observer.observe(node);
  }
}
