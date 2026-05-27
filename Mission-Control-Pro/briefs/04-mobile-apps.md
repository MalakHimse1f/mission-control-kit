# Brief 04 — Mobile Apps (iOS / Android)

**Surface:** Mission Control Pro mobile app — iOS + Android
**Owner:** TBD
**Status:** Draft v0
**Last updated:** 2026-05-26

---

## Purpose

A focused, personal-only mobile companion. Two jobs:

1. **Get notified** when a user's running agent needs a structured decision.
2. **Answer the decision** from anywhere, in seconds, without opening a laptop.

The mobile app is explicitly **not** an admin tool. No workflow editing. No permissions management. No org-wide dashboard. If a CTO wants to see their org, they open the web app.

This narrow scope is a feature: a tight app ships in a quarter; a kitchen-sink app ships in a year.

---

## Target user

The developer (or PM, designer) whose agent has paused for a decision while they're away from their desk. Or the manager who wants to glance at their own assigned features over coffee.

The benchmark for shipping: "I have 30 seconds at a stoplight to approve the next stage of my agent's work." That's the experience.

---

## Scope

### In scope (v1)

- Sign in with Supabase Auth (email or Google).
- Permission to receive push notifications.
- Decision inbox: list of decisions waiting on me.
- Decision detail: render the structured prompt, present the response UI.
- Submit a response.
- "My agents" list: my own running sessions across my devices.
- Session detail (read-only): current stage, recent journal lines, decisions history.
- App settings: notification preferences, sign out.

### Out of scope (v1)

- Org admin (workflows, standards, permissions).
- Editing workflows on phone.
- Viewing other people's agents (lean — only mine, mirroring the personal-only positioning).
- Chat with the agent.
- Long-form artifact review (PRD, mocks, diffs) — these link to web.
- Starting a session from mobile (deferred — see open questions).

### Decision response types we render

Per the requirements analysis, mobile renders only mobile-friendly response types. Anything else surfaces as "Open in web app."

| Type | v1 mobile |
|---|---|
| Approve / reject | ✅ |
| Choose one | ✅ |
| Choose many | ✅ |
| Short text (< 200 chars) | ✅ |
| Long-form review | ❌ link to web |
| Code/diff review | ❌ link to web |
| File picker | ❌ link to web |

---

## Key flows

### 1. First run

1. Download from App Store / Play Store.
2. Sign in with Supabase Auth.
3. Grant push permission (with clear prompt explaining why).
4. App registers its device token with the cloud.
5. Land on Decision inbox (empty state explaining what'll show up here).

### 2. Receiving a decision

1. Agent on a desktop machine hits a `decide` step.
2. Bridge emits `decision-required` to cloud.
3. Cloud writes `decisions` row, fires push via Expo Push.
4. APNs / FCM delivers to the user's phone.
5. Phone shows notification: "feature-name needs a decision: ‹question›".
6. Tap → app opens directly to that decision (deep link).

### 3. Answering

1. Decision detail shows: feature name, workflow step, the question, the response UI.
2. User picks an option (or types short text).
3. Submit → cloud writes the answer, marks decision closed, fires Realtime update.
4. App shows confirmation + next decision (if any).
5. Bridge picks up the answered decision, agent resumes.

### 4. Glanceable session view

- Tab "My agents" lists my own running/recent sessions.
- Tap → session detail with last N journal lines, current stage, blockers.
- "Open in web" link for anything richer.

---

## Tech stack

See `tech-stack.md`. Short:

- **Framework:** React Native via **Expo**.
- **Language:** TypeScript.
- **Push:** **Expo Push** (wraps APNs + FCM v1).
- **State:** Zustand + React Query.
- **Auth:** Supabase Auth via `expo-auth-session`.
- **Realtime:** Supabase Realtime client for in-app updates while open.
- **Deep links:** Universal Links (iOS) + App Links (Android).
- **Build/release:** EAS Build + EAS Update for OTA fixes.

---

## Notification pipeline (overview)

The detailed pipeline lives in `tech-stack.md` (newly added section). For this brief, the contract is:

- The cloud knows every (user, device, push-token) triple.
- When a `decisions` row is created, cloud queues a push to all of that user's registered mobile devices.
- The push payload contains the decision ID and just enough text for the lock-screen prompt — never the full agent context.
- When the user opens the app, the app pulls the full decision via authenticated API call.

The push is a **wake-up signal**, not a data channel. Privacy and reliability both favor this split.

---

## UX principles

1. **No empty marketing screens.** First launch is sign-in → enable push → inbox. No carousel, no walkthrough.
2. **Decisions look like real choices, not forms.** Big tappable cards. No tiny radio buttons.
3. **One-thumb operation.** Primary actions at thumb-reach. No top-right "Submit."
4. **No surprise.** Submitting a decision shows a confirmation and the decision moves to "history" — irreversible actions require a hold-to-confirm.
5. **Web-first for anything complex.** A clear "Open in web app" out is shown for any decision type the mobile can't render fully.

---

## Failure modes

| Failure | Behavior |
|---|---|
| Push token expires | Cloud retries via APNs/FCM; if rejected, marks device stale, prompts re-register on next open |
| Notification delivered but user doesn't open | Stays in inbox; decision lives in cloud until answered or expired |
| User offline when answering | Submission queues locally; sync on reconnect (with optimistic UI) |
| Decision already answered (by web user) | App pulls latest state on open, shows "Already answered" |
| Decision expired | Shown in history with "Expired" status |

---

## Success metrics (v1)

| Metric | Target |
|---|---|
| Web users who install the mobile app | 30% within 30 days |
| Push opt-in rate at first launch | 80% |
| Median time-to-answer (push → submit) | < 90 seconds |
| 7-day app retention | 50% |

---

## Open questions

1. **Start-from-mobile.** Allow tapping "Start" on a feature from mobile? Tradeoff: it requires bridge online status visibility and adds UI complexity. Lean: **out of v1** — mobile is for answering decisions on running sessions, not initiating new ones. Reconsider after design partners weigh in.
2. **Notifications for non-decision events.** "Agent completed feature X." "Build gate failed." Lean: ship decision-only in v1, add an opt-in digest for completions in v1.1.
3. **Web push for the web app.** If we already have Expo Push for mobile, do we also send web push to browsers? Lean: out of v1 — web app has live realtime when open, that's enough.
4. **App Store visibility.** Required: the app needs to be useful enough at first launch to pass App Store review (which dislikes "this app does nothing without an account elsewhere"). Mitigate with a clear, useful empty state + demo mode.
5. **Tablet layout.** iPad / large-Android layout — better grid view, side-by-side history. Lean: defer; phone-first.
