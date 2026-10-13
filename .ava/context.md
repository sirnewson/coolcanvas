# CoolCanvas

_Maintained by Ava Code. Edit instructions.md for standing instructions; this file is regenerated._

## What this project is
**Think in space. Explain it visually.**

## Stack
Node.js, Vite

## Scripts
- `npm run dev`: vite --host 127.0.0.1 --port 5190
- `npm run build`: tsc -b editor && vite build
- `npm run preview`: vite preview --host 127.0.0.1 --port 5191
- `npm run engines:native`: node scripts/build-engines.mjs
- `npm run engines:web`: node scripts/build-engines.mjs --web
- `npm run engines:check`: node scripts/build-engines.mjs --check
- `npm run icons`: node scripts/make-icons.mjs
- `npm run desktop`: node desktop/scripts/build.mjs && cd desktop && npx electron app
- `npm run desktop:build`: node desktop/scripts/build.mjs
- `npm run desktop:dir`: node desktop/scripts/build.mjs --dir
- `npm run desktop:dist`: node desktop/scripts/build.mjs --dist

## Key files
- README.md
- package.json

## Folders
desktop/ dist/ docs/ editor/ engines/ integrations/ out/ scripts/ third-party/

## Recent work
- 2026-10-13 codex (completed): I’ll pick up from the packaging failure first, then finish the themed Photo Studio build and do a quick visual/build verification so we know the work is actuall

## Decisions
(none recorded)

## Known issues
(none recorded)
