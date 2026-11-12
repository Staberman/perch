import { rgbOf, type Hex, type Pixels } from "../domain/sprite.ts";

const rgbCache = new Map<Hex, [number, number, number]>();

function rgb(hex: Hex) {
  let value = rgbCache.get(hex);
  if (!value) {
    value = rgbOf(hex);
    rgbCache.set(hex, value);
  }
  return value;
}

/** Draws pixels at (left, top) of the canvas, one canvas pixel each, over what is already there. */
export function paintPixels(ctx: CanvasRenderingContext2D, pixels: Pixels, left = 0, top = 0) {
  pixels.forEach((row, y) =>
    row.forEach((c, x) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(left + x, top + y, 1, 1);
    }),
  );
}

/** Replaces the whole canvas with the pixels, which must match its size. */
export function putPixels(canvas: HTMLCanvasElement, pixels: Pixels) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(canvas.width, canvas.height);
  pixels.forEach((row, y) =>
    row.forEach((c, x) => {
      if (!c) return;
      const i = (y * canvas.width + x) * 4;
      const [r, g, b] = rgb(c);
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }),
  );
  ctx.putImageData(image, 0, 0);
}
