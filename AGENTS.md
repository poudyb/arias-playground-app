# Aria's Playroom

This is a static child-facing web app. It works directly from `file://`; use a
local server only when a browser automation tool requires one. There is no build
step.

Before extending a game, read the closest existing mode from start to finish and
match its round, difficulty, feedback, and cleanup patterns. Difficulty changes
at a round or board boundary. Never show a numeric level to the child; progress
belongs in a parent-facing summary.

Keep feedback warm and small. A correct answer may use sound and confetti;
errors use a small shake and sound, not a full-screen failure mark. Reuse the
ARASAAC image pool in `assets/spelling/` when it fits, and verify the image
rather than trusting its filename.

Type comes from `styles/fonts.css`, which every page links before its own
stylesheet: `var(--font-letters)` for anything the child reads as letters, and
`var(--font-ui)` for small parent-facing chrome. Don't hard-code a family. The
letter face has to keep I, l and 1 as three different shapes, since capitals and
lowercase are shown side by side.

Speech never sets `utterance.voice`. Pages are `<html lang="en">`, so the device
answers with the voice it is set up to use; naming one instead means naming one
out of `getVoices()`, which on iOS lists only the cheap compact voices. Three
separate attempts to choose a voice each made the app sound worse — see the note
in `shared/speech.js` before making a fourth.

Run `node --test "test/*.test.js"` for the shared logic.
