import { creatureLook, states, type SessionState } from "../domain/appearance.ts";
import { characterNamed } from "../domain/characters.ts";
import { SPRITE_SIZE } from "../domain/sprite.ts";
import { currentFrame, onFrame } from "../lib/clock.ts";
import { putPixels } from "../lib/paint.ts";

const isState = (value: string | null): value is SessionState => value != null && value in states;

/**
 * <tomari-creature character="robot" color="#3ccfe6" state="working" focused offset="3" outline="#3b3238">
 * Animates the creature its server-rendered SVG shows, while it's on screen. Change it through its attributes.
 */
export class TomariCreature extends HTMLElement {
  static observedAttributes = ["character", "color", "state", "focused", "outline"];

  private canvas = document.createElement("canvas");
  private stop: (() => void) | undefined;
  private visibility = new IntersectionObserver(([entry]) => {
    this.stop?.();
    this.stop = entry?.isIntersecting ? onFrame((frame) => this.draw(frame)) : undefined;
  });

  connectedCallback() {
    this.canvas.width = this.canvas.height = SPRITE_SIZE;
    this.canvas.setAttribute("aria-hidden", "true");
    this.querySelector("svg")?.replaceWith(this.canvas);
    this.draw();
    this.visibility.observe(this);
  }

  disconnectedCallback() {
    this.visibility.disconnect();
    this.stop?.();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.draw();
  }

  private draw(frame = currentFrame()) {
    const state = this.getAttribute("state");
    const look = creatureLook({
      character: characterNamed(this.getAttribute("character") ?? "default"),
      color: this.getAttribute("color") ?? "#d97757",
      state: isState(state) ? state : "idle",
      frame: frame + Number(this.getAttribute("offset") ?? 0),
      focused: this.hasAttribute("focused"),
      ...(this.hasAttribute("outline") && { outline: this.getAttribute("outline")! }),
    });
    putPixels(this.canvas, look.pixels);
    this.canvas.style.opacity = String(look.opacity);
    this.style.setProperty("--tile-fill", look.tile.fill ?? "transparent");
    this.style.setProperty("--tile-border", look.tile.border ?? "transparent");
    this.style.setProperty("--tile-border-width", String(look.tile.borderWidth));
  }
}

customElements.define("tomari-creature", TomariCreature);
