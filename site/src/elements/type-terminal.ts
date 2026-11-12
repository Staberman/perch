import { prefersReducedMotion, wait } from "../lib/clock.ts";

/**
 * <type-terminal command="npx tomari setup"><code data-screen></code><template data-output>…</template></type-terminal>
 * Types its command and prints its output the first time it scrolls into view (its "revealed" event),
 * or shows it all at once for people who prefer reduced motion.
 */
export class TypeTerminal extends HTMLElement {
  connectedCallback() {
    if (prefersReducedMotion()) {
      this.render(this.getAttribute("command") ?? "", true);
      return;
    }
    this.addEventListener("revealed", () => void this.play(), { once: true });
  }

  private screen() {
    return this.querySelector<HTMLElement>("[data-screen]");
  }

  private output() {
    const template = this.querySelector<HTMLTemplateElement>("template[data-output]");
    return template ? [...(template.content.cloneNode(true) as DocumentFragment).children] : [];
  }

  private prompt() {
    const span = document.createElement("span");
    span.className = "prompt";
    span.textContent = "$ ";
    return span;
  }

  private caret() {
    const span = document.createElement("span");
    span.className = "caret";
    return span;
  }

  private render(command: string, withOutput: boolean) {
    const screen = this.screen();
    if (!screen) return;
    screen.replaceChildren(this.prompt(), command, "\n", ...(withOutput ? this.output().flatMap((line) => [line, "\n"]) : []));
  }

  private async play() {
    const screen = this.screen();
    if (!screen) return;
    const command = this.getAttribute("command") ?? "";
    const typed = document.createElement("span");
    const caret = this.caret();
    screen.replaceChildren(this.prompt(), typed, caret);
    await wait(500);
    for (const ch of command) {
      typed.textContent += ch;
      await wait(50 + Math.random() * 70);
    }
    await wait(450);
    caret.remove();
    screen.append("\n");
    await wait(900);
    for (const line of this.output()) {
      screen.append(line, "\n");
      await wait(160);
    }
    screen.append("\n", this.prompt(), this.caret());
  }
}

customElements.define("type-terminal", TypeTerminal);
