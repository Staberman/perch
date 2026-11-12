import { needsAttention, statusLine, statusTone } from "../domain/appearance.ts";
import { demoScript, demoSessions, demoStill, permissionChoices, type CursorTarget, type DemoSession, type DemoStep } from "../data/demo.ts";
import { prefersReducedMotion, wait } from "../lib/clock.ts";

/**
 * <tomari-demo> plays the hero's replay of a day with Tomari: it runs demoScript over the desktop
 * DemoDesktop.astro renders, in a loop, while it's on screen.
 */
export class TomariDemo extends HTMLElement {
  private sessions = new Map<string, DemoSession>();
  private front = demoSessions[0]!.id;
  private visible = false;
  private running = false;

  private get desk() {
    return this.find("[data-desk]");
  }

  connectedCallback() {
    this.reset();
    if (prefersReducedMotion()) {
      for (const step of demoStill) this.run(step);
      return;
    }
    new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? false;
    }).observe(this);
    if (!this.running) void this.loop();
  }

  private async loop() {
    this.running = true;
    for (;;) {
      this.reset();
      for (const step of demoScript) {
        while (!this.visible || document.hidden) await wait(300);
        await this.run(step);
      }
    }
  }

  private reset() {
    this.sessions = new Map(demoSessions.map((s) => [s.id, { ...s }]));
    this.front = demoSessions[0]!.id;
    for (const s of this.sessions.values()) this.showState(s);
    this.hideLabel();
    this.renderPane(false);
  }

  private async run(step: DemoStep) {
    switch (step.do) {
      case "pause":
        return wait(step.ms);
      case "state": {
        const s = this.session(step.session);
        s.state = step.state;
        if (step.activity) s.activity = step.activity;
        this.showState(s);
        if (s.id === this.front) this.renderPane(false);
        if (this.find("[data-label]").dataset["for"] === s.id) this.showLabel(s);
        return;
      }
      case "point":
        return this.point(step.at);
      case "hover":
        return this.showLabel(this.session(step.session));
      case "unhover":
        return this.hideLabel();
      case "click":
        return this.clickOn(step.at);
      case "open":
        this.front = step.session;
        for (const s of this.sessions.values()) this.showState(s);
        return this.renderPane(true);
    }
  }

  private session(id: string): DemoSession {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`The demo script names an unknown session: ${id}`);
    return s;
  }

  private find<T extends HTMLElement = HTMLElement>(selector: string): T {
    const node = this.querySelector<T>(selector);
    if (!node) throw new Error(`DemoDesktop.astro lost ${selector}`);
    return node;
  }

  private showState(s: DemoSession) {
    const creature = this.find(`[data-cell="${s.id}"] tomari-creature`);
    creature.setAttribute("state", s.state);
    creature.toggleAttribute("focused", s.id === this.front);
    creature.setAttribute("aria-label", `${s.name}: ${statusLine(s)}`);

    const row = this.find(`[data-session="${s.id}"]`);
    row.classList.toggle("current", s.id === this.front);
    row.querySelector(".dot")?.setAttribute("class", `dot ${s.state}`);

    const waiting = [...this.sessions.values()].filter((d) => needsAttention(d.state)).length;
    this.find("[data-waiting]").textContent = waiting ? String(waiting) : "";
    this.find("[data-menu-item]").classList.toggle("needy", waiting > 0);
  }

  private renderPane(switching: boolean) {
    const s = this.session(this.front);
    this.find("[data-title]").textContent = s.name;
    const pane = this.find("[data-pane]");
    const prompt = this.view("prompt", { prompt: s.prompt });
    if (s.state === "needsPermission") {
      const [decline, accept] = permissionChoices;
      pane.replaceChildren(prompt, this.view("ask", { question: `Allow ${s.activity}?`, decline, accept }));
    } else if (s.state === "needsInput") {
      const [decline, accept] = s.choices ?? permissionChoices;
      pane.replaceChildren(prompt, this.view("ask", { question: s.activity ?? "", decline, accept }));
    } else if (s.state === "done" || s.state === "sleeping") {
      pane.replaceChildren(prompt, this.view("done", {}));
    } else {
      pane.replaceChildren(prompt, this.view("working", { activity: s.activity ?? "" }));
    }
    if (switching) {
      pane.classList.remove("switching");
      void pane.offsetWidth;
      pane.classList.add("switching");
    }
  }

  /** A copy of one of the desktop's templates, with its [data-slot]s filled in. */
  private view(name: string, slots: Record<string, string>): DocumentFragment {
    const template = this.find<HTMLTemplateElement>(`template[data-view="${name}"]`);
    const fragment = template.content.cloneNode(true) as DocumentFragment;
    for (const [slot, text] of Object.entries(slots)) {
      const node = fragment.querySelector(`[data-slot="${slot}"]`);
      if (node) node.textContent = text;
    }
    return fragment;
  }

  private target(at: CursorTarget): HTMLElement | null {
    if (at === "rest") return null;
    if (at === "answer") return this.querySelector("[data-answer]");
    return this.querySelector(`[data-cell="${at.session}"] tomari-creature`);
  }

  /** The box of a node, in the desk's coordinates. */
  private box(node: Element) {
    const a = node.getBoundingClientRect();
    const b = this.desk.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height };
  }

  private point(at: CursorTarget) {
    const cursor = this.find("[data-cursor]");
    const node = this.target(at);
    if (!node) {
      cursor.style.setProperty("--x", `${this.desk.clientWidth * 0.62}px`);
      cursor.style.setProperty("--y", `${this.desk.clientHeight * 0.78}px`);
      return;
    }
    const box = this.box(node);
    cursor.style.setProperty("--x", `${box.x + box.width * 0.5}px`);
    cursor.style.setProperty("--y", `${box.y + box.height * 0.55}px`);
  }

  private async clickOn(at: CursorTarget) {
    const node = this.target(at);
    if (!node) return;
    const box = this.box(node);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${box.x + box.width / 2}px`;
    ripple.style.top = `${box.y + box.height / 2}px`;
    this.desk.append(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
    node.classList.add("pressed");
    await wait(200);
    node.classList.remove("pressed");
  }

  private showLabel(s: DemoSession) {
    const label = this.find("[data-label]");
    this.find("[data-label-name]").textContent = s.name;
    this.find("[data-label-status]").textContent = statusLine(s);
    label.dataset["tone"] = statusTone(s.state);
    label.dataset["for"] = s.id;
    const creature = this.box(this.find(`[data-cell="${s.id}"] tomari-creature`));
    const strip = this.box(this.find(".strip"));
    label.style.right = `${this.desk.clientWidth - strip.x + 12}px`;
    label.style.top = `${creature.y + creature.height / 2 - label.offsetHeight / 2}px`;
    label.classList.add("shown");
  }

  private hideLabel() {
    const label = this.find("[data-label]");
    label.classList.remove("shown");
    delete label.dataset["for"];
  }
}

customElements.define("tomari-demo", TomariDemo);
