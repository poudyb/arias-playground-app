# arias-playground-app

**Aria's Playroom** — a simple static web app with letter/number, animal sounds, and shapes & colors activities for young learners.

## Run locally

From this directory:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) and use `index.html` as the home screen.

## Tests

The pure logic (stats normalization, clock wording / digit segments, the
spelling word helpers, session index validation, and the streak progression
that steps a game's difficulty up and down) is unit-tested with
**Node's built-in test runner** — no dependencies to install.

```bash
node --test "test/*.test.js"   # or: npm test
```

These functions live in `shared/*.js` and end with a small
`if (typeof module !== 'undefined') module.exports = …` guard so they can be
`require`d under Node while remaining plain globals in the browser.

## Repository

This project was originally created as `abc-app`. The repository / folder name is **`arias-playground-app`**; the product name shown in the app is **Aria's Playroom**.
