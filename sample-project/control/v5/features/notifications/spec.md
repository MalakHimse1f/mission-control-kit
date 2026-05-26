# Notifications — Spec

## Overview
Unified in-app + email notification system. Every notable event in the product can be routed to a user via in-app feed, email, or both, based on per-event-type preferences.

## Goals
- Single notification feed accessible from anywhere in the app.
- Per-event-type channel preferences (in-app, email, both, none).
- Daily and weekly email digest options.
- p95 in-app delivery latency under 5 seconds from event emission.

## Non-goals
- Push notifications (mobile follow-up).
- Slack / external channel integrations.
- Notification analytics dashboard for admins.

## UX decisions (locked)
- Feed entry point: **bell icon in top navigation** with unread count badge.
- Preferences: reachable from **both** account settings AND an inline "manage" link in the feed.

## UI decisions (locked)
- Feed row density: **comfortable** — avatar + two-line body.
- Unread indicator: **tinted background row** (no separate dot or bar).

## Architecture decisions (locked)
- Event source: **domain event bus** with a dedicated notification subscriber.
- Email provider: **Postmark**.

## Build status
- ✅ Data model + migrations
- ✅ Event bus integration
- ✅ In-app feed UI
- 🔄 Email channel adapter (in progress)
- ⏳ User preferences UI
- ⏳ Digest scheduling
- ⏳ Delivery tracking + retries

## Success metrics
- p95 in-app latency < 5s.
- Email delivery rate > 99%.
- < 0.1% notification loss on event-bus replay.
