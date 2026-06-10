# PROJECT_MEMORY.md

## 1. Project Identity

**Project name:** Restaurant Staff Scheduling  
**Repository / Folder:** restaurant-staff-scheduling / quản-lý-nhân-sự-nhà-hàng-cháu-anh-vũ  
**Main purpose:** App quản lý nhân sự và xếp lịch làm việc cho nhà hàng.  
**Current product stage:** Production / Customer Trial  
**Primary user / customer:** Chủ nhà hàng / quản lý nhà hàng  

---

## 2. Current Status

**Last working session date:** 2026-06-10  
**Last operator:** User + Codex + ChatGPT  
**Current branch:** main  
**Latest commit:** cc0ab82735dee16d6b65a3280b2dcb25a93762fa  
**Deployment status:** Production  
**Production URL:** https://restaurant-staff-scheduling.vercel.app  
**Preview URL:** Already tested through Vercel Preview before production  

---

## 3. What Was Done Last Time

Summary of the last completed work:

- Fixed scheduling bug where Sunday/Saturday shifts could start before opening hours.
- Fixed minimum automatic shift duration rule to enforce 120 minutes gross shift span.
- Added warning logic for manual or legacy shifts under 2 hours.
- Added AGENTS.md with conservative AI agent workflow rules.
- Pushed AGENTS.md to GitHub.
- Verified Vercel production deployment is Ready.

Files changed in recent work:

- src/lib/utils.ts
- src/i18n.tsx
- AGENTS.md
- DEBUG_REPORT.md
- BUGFIX_1_OPENING_HOURS_REPORT.md
- MIN_SHIFT_RULE_PLAN.md
- BUGFIX_2_MIN_SHIFT_REPORT.md
- E2E_BUGFIX_1_2_TEST_REPORT.md
- VERCEL_PREVIEW_REPORT.md

Reports created:

- DEBUG_REPORT.md
- BUGFIX_1_OPENING_HOURS_REPORT.md
- MIN_SHIFT_RULE_PLAN.md
- BUGFIX_2_MIN_SHIFT_REPORT.md
- E2E_BUGFIX_1_2_TEST_REPORT.md
- VERCEL_PREVIEW_REPORT.md
- RELEASE_CANDIDATE_REPORT.md

---

## 4. Current Known Problems

Open bugs / issues:

- Production displayed old Sunday 12:00 shifts on the user's browser because localStorage still contained legacy schedule data.
- Need customer trial feedback to confirm whether fresh browser/customer environment still shows correct scheduling behavior.
- If customer also sees Sunday shifts before opening hours after generating a new schedule, bugfix must be reopened.

Business logic risks:

- Enforcing 120-minute minimum automatic shifts may reduce coverage near closing time or in short opening windows.
- Optimizer may distribute monthly hours differently after short shifts are blocked.
- Legacy/manual shifts under 2 hours are not auto-fixed; they are only warned.

Technical risks:

- Project currently has no npm test script.
- Regression tests are not integrated into package.json.
- App uses localStorage, so browser-specific old data can affect test results.
- Vite bundle size warning still exists.

---

## 5. Last Verified Working State

The following checks were last confirmed:

- [x] npm run lint PASS
- [x] npm run build PASS
- [ ] npm test PASS / not available
- [x] git diff --check PASS
- [x] Preview tested
- [x] Production deployed
- [ ] Production fully tested with fresh customer-like data
- [ ] Customer trial feedback received

Notes:

- Production deployment is Ready on Vercel.
- Production URL is live.
- User found old localStorage data showing Sunday 12:00 shifts; this must not be confused with fresh generated schedule behavior.
- Before declaring the app fully customer-ready, test with fresh browser/private window or reset localStorage.

---

## 6. Next Best Step

The next session should start with:

1. Test production in a fresh browser/private window or after clearing localStorage.
2. Verify Sunday opening hours and newly generated schedule behavior.
3. Confirm no automatically generated shift starts before opening hours.
4. Confirm no automatically generated shift is under 120 minutes gross duration.
5. Send production link to customer for controlled trial.
6. Collect screenshots and feedback from customer.

Do not start with:

- Writing more SOPs before production/customer trial is verified.
- Refactoring unrelated code.
- Adding new features before confirming the current scheduling logic.
- Changing data model without approval.

---

## 7. Decisions Made

Important decisions already made:

- Codex is used first for code audit and bugfix.
- Antigravity is used for UI/browser/E2E and preview validation.
- Production/customer trial is the real definition of done.
- Manual and legacy data must not be auto-modified without explicit approval.
- Agent must not commit, push, or deploy without approval.

Rejected options:

- Do not auto-rewrite legacy localStorage schedules without preview and backup.
- Do not deploy production manually without approval.
- Do not continue SOP work while the app still has unresolved production/customer issues.

---

## 8. Customer / Business Context

Customer goal:

- Use the app to manage restaurant employees, schedules, shifts, PDF/Excel export, and practical staff planning.

Business priority:

- The app must be stable enough for a real restaurant customer to test.
- Scheduling logic must be trusted before broader rollout.

Definition of done:

- Production app opens successfully.
- Fresh production test passes core scheduling cases.
- Customer can use the app without seeing obvious wrong shifts.
- Customer trial feedback is collected.
- Critical bugs found during customer trial are fixed and redeployed.

---

## 9. AI Agent Instructions For This Project

Before working:

1. Read AGENTS.md.
2. Read this PROJECT_MEMORY.md.
3. Check git status.
4. Confirm the last known production/customer trial state.
5. Do not assume the previous task is complete unless this file says so.

After working:

1. Update this file.
2. Record what changed.
3. Record what was tested.
4. Record what remains open.
5. Write the exact next step for the next session.

---

## 10. Session Log

### Session 2026-06-10

**Goal:** Fix restaurant scheduling bugs and prepare app for customer trial.  

**Actions completed:**

- Audited scheduling bug.
- Fixed opening-hours bug.
- Fixed minimum shift duration rule.
- Added warning for old/manual shifts under 2 hours.
- Built and verified preview.
- Pushed code and AGENTS.md.
- Verified Vercel production deployment is Ready.
- Created Obsidian SOP and quick prompts.

**Files changed:**

- src/lib/utils.ts
- src/i18n.tsx
- AGENTS.md
- project reports

**Checks run:**

- npm run lint: PASS
- npm run build: PASS
- git diff --check: PASS
- Vercel Preview: tested
- Production deployment: Ready

**Result:**

- App is deployed to production.
- Customer trial can begin only after fresh production test confirms old localStorage data is not causing false bug reports.

**Next step:**

- Test production in private/fresh browser.
- Send production link to customer for controlled trial.
- Collect feedback and fix any customer-visible issue before declaring the app complete.
