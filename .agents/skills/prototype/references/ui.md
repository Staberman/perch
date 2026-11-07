# UI prototype

**Several radically different UI variants** on one route, switchable from a floating bottom bar. The user flips between them in the browser, picks one or combines parts of several, and the rest is thrown away.

## 1. Choose the host page and the number of variants

Variants are judged best **inside the real app**, with the real header, sidebar, data, and density around them. Choose the host:

- **Existing page (preferred).** The variants render on the same route, selected by a `?variant=` search param. Data fetching, params, and auth stay as they are; only the rendered subtree changes. This also covers something new that would naturally live inside an existing page, such as a new dashboard section or a new step in a flow.
- **New throwaway route (last resort).** Only when nothing existing could host it, such as an entirely new top-level surface. Follow the project's routing convention, put `prototype` in the path, and use the same `?variant=` param.

Build **3 variants** by default and at most 5; beyond that they stop being radically different. Write the plan as one line in a comment at the top of the switcher, for example: "Three variants of the settings page, switchable via `?variant=`, on the existing `/settings` route."

Done when the host route and the number of variants are written in that comment.

## 2. Draft radically different variants

Each variant serves the page's purpose with the data it has, uses the project's own component library and styling, and is exported under a clear name (`VariantA`, `VariantB`, `VariantC`). Variants disagree about **structure**: layout, information hierarchy, and the primary affordance. A shared small piece such as a header is fine; each variant owns its layout. When two drafts come out alike, redraft one with an explicit constraint ("no card grid"). Variants are read-only; any mutation they need goes to a stub.

Done when every pair of variants differs in layout or hierarchy, not just in colour or copy.

## 3. Wire the switcher

Render the chosen variant from the search param, keeping existing data fetching above the switch:

```tsx
// pseudo-code: adapt to the project's framework
const variant = searchParams.get('variant') ?? 'A';
return (
  <>
    {variant === 'A' && <VariantA {...data} />}
    {variant === 'B' && <VariantB {...data} />}
    {variant === 'C' && <VariantC {...data} />}
    <PrototypeSwitcher variants={['A', 'B', 'C']} current={variant} />
  </>
);
```

Done when changing `?variant=` by hand switches the variant and keeps the page's data.

## 4. Build the floating switcher

One shared component, placed wherever shared UI lives in the project: a small fixed bar at the bottom centre of the screen with a **previous arrow**, a **label** showing the current key and the variant's name (`B (Sidebar layout)`), and a **next arrow**. Arrows wrap around.

- Arrows update the search param through the framework's router (`router.replace`, `navigate`), so a variant is shareable and survives reload.
- The `←` and `→` keys cycle too, except while an `<input>`, `<textarea>`, or `[contenteditable]` has focus.
- It looks clearly separate from the design under review: a high-contrast pill with a light shadow.
- It renders only outside production (`process.env.NODE_ENV !== 'production'` or the project's equivalent), so a stray merge cannot ship it.

Done when the arrows and keys cycle through every variant, reload keeps the current one, and a production build renders no bar.

## What carries over

The winning variant is rebuilt properly in the real page, or promoted to a real route when it came from a throwaway one. The losing variants, the switcher, and any throwaway route go to the prototype branch.
