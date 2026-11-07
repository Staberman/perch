---
name: tdd
description: Test-driven development for building features. Agrees the behaviors and test seams with the user, then implements one vertical slice at a time through red → green, and refactors with the suite green. Use when the user wants to build a feature or fix a bug test-first, mentions TDD or red-green-refactor, or wants tests to drive an implementation.
license: MIT
metadata:
  author: elrincondeldev
  version: "1.0.0"
  source: mattpocock/skills
---

# TDD

Build the feature as a series of **vertical slices**: one behavior, one failing test, the minimal code to pass it, repeat. Each test is a **tracer bullet** that informs the next one. A good result is a working feature whose tests read like its specification and survive any refactor that keeps the behavior.

## What a good test is

- **Behavior through public interfaces.** A test calls the code the way a caller would and asserts on what the caller observes. Its name states a capability ("user can check out with a valid cart"), not a mechanism.
- **Independent expected values.** Expected values come from a known-good literal, a worked example, or the spec, never from recomputing them the way the code does.
- **Mocks only at system boundaries**: external APIs, time, randomness, and sometimes the database or file system. Your own modules run for real.

Watch every test for these anti-patterns:

- **Implementation-coupled**: mocks internal collaborators, tests private methods, asserts on call counts, or verifies through a side channel (querying the database instead of the interface). It breaks on refactors that keep the behavior.
- **Tautological**: the assertion restates the implementation (`expect(add(a, b)).toBe(a + b)`), so it passes by construction.
- **Horizontal slicing**: all tests first, then all code. Those tests describe imagined behavior; write one test at a time instead.

Read [references/tests.md](references/tests.md) when you need side-by-side examples of good and bad tests, and [references/mocking.md](references/mocking.md) before adding a mock or designing a boundary to be mockable.

## 1. Understand the feature

Read the spec or issue, then the code the feature touches: the public interfaces nearby, existing tests in that area, and any domain glossary or architecture decision records, so test names use the project's vocabulary. Find the test framework, where tests live, how they are named, and the command that runs them. Run the relevant suite once for a baseline.

Done when you know the test command, the conventions new tests follow, and the baseline result (green, or the list of tests already failing before you started).

## 2. Agree the behaviors and seams

A **seam** is the public boundary a test exercises: a function, endpoint, component, or command whose observable behavior you assert on. Propose, in one message (the structured-question tool if your harness has one):

- **Behaviors**: the feature as an ordered list of one-line, spec-style statements, the core happy path first, then the edge cases and errors that matter.
- **Seams**: for each, the public interface it tests at, plus one line on what it catches and what it misses.

Tests go only at seams the user confirmed. Ask for that confirmation before writing the first test.

Done when the user has confirmed the behavior list and the seams.

## 3. Red → green, one slice at a time

For the next behavior on the list:

1. **Red**: write one test for it at a confirmed seam. Run it and watch it fail because the behavior is missing. A failure from a typo, a broken import, or bad setup does not count: fix the test and run it again.
2. **Green**: write the minimal code that makes it pass, with nothing for later behaviors. Run the relevant suite; every test that passed at baseline still passes.
3. **Steer**: tick the behavior off. When the slice taught you something (a missing case, a behavior that is wrong or redundant), update the remaining list and tell the user; a change that needs a new seam goes back to them for confirmation.

Done when every behavior on the confirmed list has a test you saw fail for the right reason and then pass.

## 4. Refactor

With the suite green, improve the structure of the new code and its tests: names, duplication, the shape of the interface. Run the suite after each change. Assertions stay as they are; a refactor that needs a different assertion has changed behavior and goes back to step 3 as a new slice. For a deeper review of the finished change, the `code-review` skill applies.

Done when the suite is green and every assertion still matches what it checked at the end of step 3.

## 5. Report

Tell the user:

- each behavior and the test that covers it (file and test name);
- the command that runs them and its final result;
- anything left uncovered, with the reason, and any tests that were already failing at baseline.

Done when the user has the list and the command, and every uncovered behavior is named.
