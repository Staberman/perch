/**
 * <copy-command command="npx tomari setup"><button>…<span data-hint>copy</span></button></copy-command>
 * Copies its command when its button is pressed and says so in its hint for a moment.
 */
export class CopyCommand extends HTMLElement {
  private timer: ReturnType<typeof setTimeout> | undefined;

  connectedCallback() {
    this.querySelector("button")?.addEventListener("click", () => this.copy());
  }

  private async copy() {
    const command = this.getAttribute("command");
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return;
    }
    const hint = this.querySelector<HTMLElement>("[data-hint]");
    const original = hint?.dataset["hint"] || hint?.textContent || "";
    if (hint) {
      hint.dataset["hint"] = original;
      hint.textContent = "copied";
    }
    this.toggleAttribute("copied", true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.removeAttribute("copied");
      if (hint) hint.textContent = original;
    }, 1800);
  }
}

customElements.define("copy-command", CopyCommand);
