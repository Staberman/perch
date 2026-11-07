# Logic prototype

A single self-contained HTML file, a **shareable demo**, that lets anyone drive a state model by clicking buttons. It is for questions about business logic, state transitions, or data shape: the kind that look fine on paper and only feel wrong once real cases go through them. Since it is one file with nothing to install, a designer, product manager, or domain expert can open it and judge the model themselves, so it speaks their language rather than the code's.

## 1. Write the question into the page

Open the page with a visible intro paragraph: the state model being explored and the question it should answer. A user returning to it later checks the answer against this paragraph.

Done when the intro states the model and the question in plain words.

## 2. Isolate the logic in a portable module

Put the logic that answers the question in one `<script>` block, written as a small pure module that could be lifted into the real codebase unchanged. Choose the shape the question calls for:

- **Pure reducer** `(state, action) => state`: discrete events acting on a single state value.
- **State machine** with explicit states and transitions: when "which actions are legal right now" is part of the question.
- **Pure functions over a plain data type**: transformations with no implicit current state.
- **A class or module with a clear method surface**: when the logic truly owns ongoing internal state.

The page calls into the module, and nothing flows back: the module stays free of the DOM, `document`, and button handlers.

Done when the module mentions no DOM API and could be pasted into the real codebase as is.

## 3. Build the page

One file of inline HTML, CSS, and JavaScript, with no framework, bundler, or server, so it opens by double-click and survives being emailed. Every label uses **domain language**: buttons and fields read like the business, not like the reducer. Lay it out top to bottom:

1. **Title and one-line explanation** of what the demo lets you explore.
2. **Current state** as a readable panel of labelled fields, re-rendered after every click, with the fields that just changed highlighted.
3. **Free-play buttons**: one per action, always available, so anyone can poke at the model in any order.
4. **Guided walkthroughs**: one tab per **scenario**, each with a plain-language description of the situation and what to watch for, followed by the ordered buttons to press. Each step is a real button that performs its action and advances to the next step. Starting a walkthrough resets to the same initial state every time.

Pick scenarios that are hard to reason about on paper: the happy path, a tricky edge case, and an attempt at something that should be illegal.

Keep the look clean and restrained: clear typography, generous spacing, one accent colour, and no animation, so nothing competes with the state and the buttons.

Done when the file opens from disk with no network access, every action has a free-play button, and each walkthrough runs from reset to its last step.

## What carries over

The validated module lifts into the real codebase. The HTML page around it goes to the prototype branch, where, being one file, it stays runnable.
