# AGENTS.md

## Role

You are an AI coding agent working on this repository. Follow a conservative debugging and release workflow.

## Core Rules

- Always audit before fixing bugs.
- Do not rewrite the whole app unless explicitly approved.
- Do not change data models or localStorage structure without approval.
- Do not install new packages without approval.
- Do not delete files unless explicitly approved.
- Do not commit, push, or deploy unless explicitly instructed.
- Keep manual and legacy user data intact unless a migration is explicitly approved.
- Move unrelated untracked files out of the repo before final release.

## Project Memory Workflow

Before working:

1. Read AGENTS.md.
2. Read PROJECT_MEMORY.md.
3. Run git status.
4. Confirm the last known state, current open issues, and next best step.
5. Do not assume the previous task is complete unless PROJECT_MEMORY.md says so.

After working:

1. Update PROJECT_MEMORY.md.
2. Record what changed.
3. Record what was tested.
4. Record what remains open.
5. Record the exact next best step for the next session.
6. If the app was deployed or tested by a customer, record the production/preview status and customer feedback.

## Debug Workflow

1. Inspect the project structure.
2. Identify the framework and build tools.
3. Run available checks:
   - npm run lint
   - npm run build
   - npm test, if available
4. Find the root cause before editing code.
5. Create DEBUG_REPORT.md before making changes.

## Bugfix Workflow

- Fix one bug or one logical group at a time.
- Keep the patch small and focused.
- Do not change unrelated functionality.
- After every code change, run:
  - npm run lint
  - npm run build
  - git diff --check
- If the project has automated tests, run them.
- Create BUGFIX_N_REPORT.md for each bugfix.

## E2E / Preview Workflow

- Use Antigravity or a browser-based workflow for UI and end-to-end testing.
- Create E2E_TEST_REPORT.md after UI or flow testing.
- Use Vercel Preview before production deployment.
- Never deploy production manually without explicit approval.

## Release Workflow

1. Confirm lint, build and diff checks pass.
2. Confirm Preview has been manually verified.
3. Commit only after approval.
4. Push only after approval.
5. Clean the repo after release.
6. Verify production after any auto-deploy from main.

## Forbidden Actions

- Do not deploy production without approval.
- Do not push without approval.
- Do not rewrite the app without approval.
- Do not change data models without approval.
- Do not install packages without approval.
- Do not commit unrelated files.
- Do not skip lint/build.
- Do not skip preview or manual verification for production changes.
