import { creatureLook, type SessionState } from "../domain/appearance.ts";
import { characterNamed } from "../domain/characters.ts";
import { feetRow, SPRITE_SIZE } from "../domain/sprite.ts";
import { perched } from "../data/perch.ts";
import { currentFrame, onFrame } from "../lib/clock.ts";
import { paintPixels } from "../lib/paint.ts";
import { seeded } from "../lib/seeded.ts";

const HEIGHT = 64;
/** Frames each perched creature keeps one mood: six seconds. */
const MOOD_FRAMES = 24;
const WOOD = { top: "#8a6a52", mid: "#6b4f3c", shade: "#4a3529" };
const BLOSSOMS = ["#f6b8c8", "#fbd6df", "#ee93ab"];
const LEAVES = ["#93ad74", "#7e9a62"];
const INK = "#4a3a36";

interface Seat {
  character: string;
  color: string;
  states: readonly SessionState[];
  x: number;
  y: number;
}

/**
 * <tomari-branch><canvas></canvas></tomari-branch>
 * A blossoming branch drawn in sprite pixels, with Tomari's creatures perched along it taking turns at
 * their moods. It fills its canvas's width and redraws its wood whenever that changes.
 */
export class TomariBranch extends HTMLElement {
  private canvas!: HTMLCanvasElement;
  private wood: HTMLCanvasElement | undefined;
  private seats: Seat[] = [];
  private stop: (() => void) | undefined;
  private resize = new ResizeObserver(() => this.layout());
  private visibility = new IntersectionObserver(([entry]) => {
    this.stop?.();
    this.stop = entry?.isIntersecting ? onFrame((frame) => this.draw(frame)) : undefined;
  });

  connectedCallback() {
    const canvas = this.querySelector("canvas");
    if (!canvas) return;
    this.canvas = canvas;
    this.resize.observe(canvas);
    this.visibility.observe(this);
  }

  disconnectedCallback() {
    this.resize.disconnect();
    this.visibility.disconnect();
    this.stop?.();
  }

  private layout() {
    const scale = innerWidth < 720 ? 3 : 5;
    const width = Math.ceil(this.canvas.clientWidth / scale);
    if (width === 0 || width === this.wood?.width) return;
    this.canvas.width = width;
    this.canvas.height = HEIGHT;
    this.canvas.style.height = `${HEIGHT * scale}px`;

    const top = (x: number) => Math.round(38 + Math.sin(x / 37) * 3 + Math.sin(x / 13 + 1) * 1.2 - (x / width) * 7);
    this.wood = drawWood(width, top);

    const count = Math.max(3, Math.min(perched.length, Math.floor(width / 34)));
    const spacing = width / count;
    this.seats = perched.slice(0, count).map((p, i) => {
      const x = Math.round(spacing * (i + 0.5) - SPRITE_SIZE / 2 + (i % 2 ? 3 : -3));
      return { ...p, x, y: top(x + SPRITE_SIZE / 2) - feetRow(characterNamed(p.character)) };
    });
    this.draw(currentFrame());
  }

  private draw(frame: number) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx || !this.wood) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.wood, 0, 0);
    const turn = Math.floor(frame / MOOD_FRAMES);
    this.seats.forEach((seat, i) => {
      const state = seat.states[(turn + i) % seat.states.length] ?? "idle";
      const look = creatureLook({ character: characterNamed(seat.character), color: seat.color, state, frame: frame + i * 5, outline: INK });
      paintPixels(ctx, look.pixels, seat.x, seat.y);
    });
  }
}

function drawWood(width: number, top: (x: number) => number): HTMLCanvasElement {
  const wood = document.createElement("canvas");
  wood.width = width;
  wood.height = HEIGHT;
  const ctx = wood.getContext("2d")!;
  const dot = (x: number, y: number, color: string, w = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 1);
  };

  for (let x = 0; x < width; x++) {
    const y = top(x);
    const thick = 5 + Math.round(Math.sin(x / 23));
    dot(x, y, WOOD.top);
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(x, y + 1, 1, thick - 2);
    ctx.fillStyle = WOOD.shade;
    ctx.fillRect(x, y + thick - 1, 1, 2);
  }

  const random = seeded(7);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
  for (let x = 6; x < width - 6; x += 9 + Math.floor(random() * 14)) {
    const up = random() < 0.5;
    let y = top(x) + (up ? 0 : 5);
    let bx = x;
    const length = 4 + Math.floor(random() * 5);
    for (let i = 0; i < length; i++) {
      dot(bx, y, WOOD.mid);
      y += up ? -1 : 1;
      if (random() < 0.6) bx++;
    }
    const blossom = random() < 0.72;
    for (let i = 0; i < 7; i++) {
      dot(bx - 1 + Math.floor(random() * 3), y - 1 + Math.floor(random() * 3), blossom ? pick(BLOSSOMS) : pick(LEAVES), i === 0 ? 2 : 1);
    }
    if (blossom) dot(bx, y, "#f3c96b");
  }
  return wood;
}

customElements.define("tomari-branch", TomariBranch);
