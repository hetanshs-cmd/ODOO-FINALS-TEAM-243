# Project Instructions

## Documentation
- Always check the `docs/` folder for existing context, architecture notes, and conventions before starting work.
- Keep `docs/` up to date whenever changes affect what's documented there.
- If a change would alter the API contract, stop and confirm with the user before implementing it.

## Tech Stack
- Stick to the tech stack(s) specified in `docs/`. Do not introduce new frameworks, libraries, or languages outside of what's documented without confirming with the user first.

## Git Workflow
- Never commit directly to `main`. Always create/use a feature branch and commit there.
- Open a pull request for review instead of merging directly.
- Never merge to `origin/main` on your own — only when explicitly instructed by the user.
- Commit messages must not mention Claude, AI assistance, or Claude Code (no "Co-Authored-By: Claude" trailer, no mentions in the message body).
- After running `git fetch` and `git pull`, review the updated code (e.g. `git log`/`git diff` for what changed) before continuing work, so changes build on the current state rather than stale assumptions.
