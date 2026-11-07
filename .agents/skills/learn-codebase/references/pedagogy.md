# Pedagogy

How the tutor teaches. The teach loop in `SKILL.md` says *when* to do each thing; this file says *how*.

## Principles

- **Retrieval over re-reading.** Understanding is built when the learner pulls an idea out of their own head, not when you put it in again. Prefer asking to telling.
- **Prediction first.** Ask the learner to guess before you reveal. Being wrong and then corrected is one of the strongest ways to make something stick.
- **Concrete, then abstract.** Show a real request, a real function, a real row in the database; name the pattern only after they've seen it work.
- **Worked, then faded.** In the first trace you lead every step. In the next, you lead half and the learner fills in the rest. Eventually the learner leads and you only check.
- **Desirable difficulty.** Aim each question just past what the learner can already do. Too easy teaches nothing; too hard and they guess. Adjust after every answer.
- **Spacing and interleaving.** Revisit earlier lessons at the start of sessions and between lessons. Mixing old and new forces the learner to tell concepts apart.
- **Elaboration.** Ask *why* and *how does this connect*: "Why does this live in the service layer and not the controller?" Connections are what turn facts into a model.

## Question bank

Ordered roughly from recall to transfer. Each check should reach at least the **trace** level, and later lessons should reach **change** and **transfer**.

| Type | Template |
| --- | --- |
| Recall | "Which file defines X?" / "What does `Y` return when Z?" |
| Explain-back | "Explain what happens when a user does X, in your own words, as if to a teammate." |
| Trace | "Walk me from the HTTP request for X to the database write. Name each file." |
| Predict | "If I change line N to M, what breaks? What does the user see?" |
| Locate | "We need to add field F to entity E. Which files do you touch, in what order?" |
| Debug | "A user reports symptom S. Where do you look first, and why?" |
| Compare | "How is X different from Y? When would you use each?" |
| Justify | "Why do you think the authors chose this approach over the obvious alternative?" |
| Transfer | "Feature G works like the one we just studied. Predict where its pieces are, then let's check." |

Write questions against this repo's real names and files, never in the abstract.

## Grading answers

- **Pass**: correct, in the learner's own words, and they can apply it to a case you didn't show them.
- **Partial**: the right shape with a gap or an error. Name what was right, then probe the gap with a narrower question.
- **Miss**: wrong or "I don't know". Treat it as information: find out *what* they believe, since the misconception is what you'll re-teach.

Signals of **illusory understanding**, each a cue for a check question rather than a pass: "yes", "makes sense", "got it"; answers that repeat your exact wording; correct answers about the example that fall apart on a new case; no questions at all after a dense walkthrough.

## Hint ladder

Climb one rung at a time, and stop as soon as the learner gets it:

1. Restate the question more concretely.
2. Point to the area: "Look at the `middleware/` directory."
3. Point to the file, then the function.
4. Ask a smaller sub-question that leads to the answer.
5. Show the answer, then ask them to explain it back, and re-check the next lesson with a new question on the same idea.

## Re-teaching

When the gate fails, change the angle rather than repeating the explanation louder:

- **Run it**: execute the code, add a log, step through with a debugger. Seeing real values beats a description of them.
- **Smaller step**: split the concept into pieces and gate each one.
- **Diagram**: sequence diagrams for flows, boxes and arrows for structure, a table for state transitions.
- **Analogy**: map the concept onto something from their background found during calibration.
- **Contrast**: show a similar piece of code that behaves differently, and ask what the difference is.
- **Break it**: on the scratch branch, have them break the code on purpose and read the failure.

## Pacing

- If the learner answers everything instantly, compress: merge lessons, move to transfer questions, offer `deeper`.
- If they struggle repeatedly, slow down: smaller excerpts, more worked examples, more frequent checks, and say plainly that this part is hard. Normalize not knowing.
- Encourage with specifics ("You spotted the race condition before I mentioned it") rather than generic praise.
