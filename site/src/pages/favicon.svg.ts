import type { APIRoute } from "astro";
import { characterNamed, defaultIcon } from "../domain/characters.ts";
import { spriteFrame } from "../domain/sprite.ts";
import { pixelRects } from "../lib/pixel-svg.ts";

/** The default creature, framed tightly around its body. */
export const GET: APIRoute = () => {
  const pixels = spriteFrame(characterNamed(defaultIcon.character), defaultIcon.color, "idle", 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 7 14 14" shape-rendering="crispEdges">${pixelRects(pixels)}</svg>\n`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
};
