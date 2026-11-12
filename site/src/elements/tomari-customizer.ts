import { statusLine, type SessionState } from "../domain/appearance.ts";

type Choice = "character" | "color" | "state";

/** What the stage's hover label says in each mood. */
const lines: Partial<Record<SessionState, string>> = {
  working: "Bash: npm run build",
  needsInput: "Which color for the button?",
  error: "API overloaded",
};

/**
 * <tomari-customizer> wires its buttons, each with data-choice="character|color|state" and data-value,
 * to the <tomari-creature data-stage> it holds, and keeps aria-pressed on the chosen ones.
 */
export class TomariCustomizer extends HTMLElement {
  connectedCallback() {
    this.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button[data-choice]");
      if (!button) return;
      this.choose(button.dataset["choice"] as Choice, button.dataset["value"] ?? "");
    });
  }

  private choose(choice: Choice, value: string) {
    const stage = this.querySelector<HTMLElement>("[data-stage]");
    if (!stage) return;
    stage.setAttribute(choice, value);
    for (const button of this.querySelectorAll<HTMLButtonElement>(`button[data-choice="${choice}"]`)) {
      button.setAttribute("aria-pressed", String(button.dataset["value"] === value));
    }
    if (choice === "color") this.style.setProperty("--chosen", value);
    if (choice === "state") {
      const state = value as SessionState;
      const status = this.querySelector("[data-status]");
      if (status) status.textContent = statusLine({ state, ago: state === "done" ? "now" : "12m", ...(lines[state] && { activity: lines[state] }) });
    }
    stage.animate([{ scale: 0.86 }, { scale: 1.04 }, { scale: 1 }], { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  }
}

customElements.define("tomari-customizer", TomariCustomizer);
