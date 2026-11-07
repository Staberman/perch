---
name: prototype
description: Builds a throwaway prototype that answers one design question, either a clickable HTML demo of a state model or several switchable UI variants on a real page. Use when the user wants to check whether some logic or state model holds up, explore what a screen should look like, or compare UI options before committing to one.
license: MIT
metadata:
  author: elrincondeldev
  version: "1.0.0"
  source: mattpocock/skills
---

# Prototype

A prototype is **throwaway code that answers one question**. The question decides its shape. The work is done when the user has the answer, the validated decision lives in the real code, and the prototype itself is kept on a side branch as a record.

## Rules for every prototype

1. **Throwaway, and marked as such.** Put it next to the code it serves, include `prototype` in its file or route name, and follow the project's existing routing and folder conventions.
2. **Trivial to run.** A logic demo is one HTML file opened by double-click; a UI prototype starts with one command from the project's task runner.
3. **State in memory.** When persistence is the question itself, use a scratch database or local file named so it is obviously disposable (`prototype-wipe-me.db`).
4. **Speed over polish.** Write only the error handling the prototype needs to run, no tests, and no abstractions. Answer this one question and nothing for later.
5. **Surface the state.** After every action or variant switch, show the full relevant state so the user sees what changed.

## 1. State the question

Write the question in one sentence and pick the branch it belongs to:

- **"Does this logic or state model hold up?"** → logic branch: read [references/logic.md](references/logic.md).
- **"What should this look like?"** → UI branch: read [references/ui.md](references/ui.md).

The branches produce very different artifacts, so ask the user when the question could be either. When they are not around, choose from the surrounding code (a backend module → logic, a page or component → UI) and state the assumption at the top of the prototype.

Done when the question is written down and one branch is chosen.

## 2. Build it

Follow the chosen branch's reference from start to finish.

Done when the branch's last step passes and the prototype shows its question where the user will see it first.

## 3. Hand it over

Give the user the file path, or the URL with its variant keys, and the one action that runs it. The valuable feedback is surprise: "wait, that shouldn't be possible", "I want the header from B with the sidebar from C". Those are the flaws in the idea, which is what the prototype exists to find. Add the actions, scenarios, or variants they ask for and hand it over again.

Done when the user has given a verdict on the question.

## 4. Capture the answer

1. Record the verdict and the question it settled in the implementation issue, or in a commit message when there is no issue.
2. Fold the validated decision into the real code, rewritten to production standard with tests and error handling. The branch reference says what carries over.
3. With the user's go-ahead, commit the complete prototype to a throwaway branch (`prototype/<slug>`) as a primary source, and link that branch from the issue.
4. Remove every prototype file, route, and switcher from the main line of work, which keeps only the decision.

Done when the verdict is recorded, the main line holds no prototype code, and the prototype branch exists and is linked.
