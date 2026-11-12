import type { Pixels } from "../domain/sprite.ts";

/** SVG rects for the painted pixels, one per horizontal run of a color, for a viewBox of the sprite's size. */
export function pixelRects(pixels: Pixels): string {
  const rects: string[] = [];
  pixels.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === color) end++;
      if (color) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`);
      x = end;
    }
  });
  return rects.join("");
}
