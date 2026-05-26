# Brief 01 — Marketing & Payment Site

**Surface:** `missioncontrol.pro` (public web)
**Owner:** TBD
**Status:** Draft v0
**Last updated:** 2026-05-26

---

## Purpose

The public-facing site that turns a curious CTO or eng manager into a paying customer. Three jobs in priority order:

1. **Sell the idea** — communicate the org-orchestration wedge in under 30 seconds.
2. **Sign them up** — account creation, org provisioning, Stripe checkout.
3. **Onboard them just enough** — get them from signup to "first agent visible in dashboard" with no support intervention.

---

## Target users

| Persona | Goal on the site | Conversion event |
|---|---|---|
| **Eng manager / CTO** | Understand if this solves visibility + standards drift | Books a demo or starts Team trial |
| **Senior IC who'll champion it** | Believe their team will adopt it | Forwards link to manager |
| **Solo dev / curious dev** | See if free tier is worth installing | Creates account on Free tier |

The CTO is the buyer. The senior IC is the champion. The site has to earn both.

---

## Scope

### In scope (v1)

- Public marketing pages: hero, problem, how it works, features, pricing, security/trust.
- Self-serve signup flow: email + password (or Google), email verification, create org, invite teammates.
- Stripe checkout for Team tier: monthly + annual, per-seat.
- Customer Portal link (managed by Stripe) for plan/seat changes.
- Bridge download page with platform-detected primary CTA.
- Docs site at `missioncontrol.pro/docs` (could be the same Astro project, MDX-based).
- Status page link, security page, privacy + terms.

### Out of scope (v1)

- Blog / changelog (can ship as a v1.1 — add MDX folder).
- Customer logos wall (we won't have them).
- Live chat widget.
- Localization.
- Multi-currency.
- Enterprise "request a quote" flow beyond a contact form.

---

## Key features

### Landing page

Single-page narrative, scroll-based. Sections lifted from the pitch deck:

1. Hero — "Your org's standards. Every developer's agent. One pane of glass."
2. The problem — the four invisibility/inconsistency failures.
3. The insight — "We don't own the agents."
4. How it works — three-tier diagram.
5. Four surfaces — what you get.
6. Differentiation — vs. other tools.
7. Pricing.
8. FAQ.
9. CTA — "Start Team trial" / "Talk to sales."

### Pricing page

- Three tiers (Free, Team, Enterprise) per pitch deck.
- Annual toggle (saves 20% — confirm with finance).
- Per-seat calculator.
- Clear copy on what counts as a seat.

### Signup flow

1. Email + password (or Google OAuth).
2. Verify email (Resend transactional).
3. Create org name + slug.
4. Choose plan: Free or Team (Team → Stripe Checkout).
5. Invite teammates by email (optional, can skip).
6. Land on web app onboarding: "Install your bridge" page.

### Bridge download

- Detects OS, shows primary download button for that platform.
- All three platforms listed below the primary CTA.
- Install instructions per platform.
- "Verify install" flow that pings the cloud once the bridge connects.

### Trust & security page

A separate page that lives at `/security`. Covers:

- Where data lives (Supabase region).
- Encryption (in transit, at rest).
- What the bridge sends (and what it doesn't).
- Authentication & SSO posture.
- Subprocessors list.
- Contact for security questions.

A CTO will read this before they buy. Take it seriously.

---

## Tech stack

See `tech-stack.md` for full rationale. Short version:

- **Framework:** Astro (static-first, MDX content).
- **Styling:** Tailwind CSS.
- **Components shared with web app:** `@mcp/ui`.
- **Forms / signup:** Astro endpoints → Supabase Auth (server-side).
- **Payment:** Stripe Checkout (hosted page).
- **Webhooks:** Stripe → Supabase Edge Function → updates `subscriptions` table.
- **Hosting:** Vercel.
- **Analytics:** Plausible.

---

## Integration points

| Touchpoint | What happens |
|---|---|
| Supabase Auth | Signup creates user + invites email verification |
| Supabase `orgs`, `org_members` | Signup provisions the new org with the signer as Owner |
| Stripe Checkout | Team plan creates subscription, returns to web app `/welcome` |
| Stripe webhook | Updates `subscriptions` table — affects seat limits & feature gating in web app |
| Web app `/welcome` | Picks up the freshly signed-up user and starts the onboarding flow |
| Bridge download | Signed installer artifacts served from Supabase Storage or CDN |

---

## Success metrics (v1)

| Metric | Target |
|---|---|
| Landing → signup conversion | 5% (industry baseline for dev SaaS) |
| Signup → first bridge connect | 60% within 24h |
| Signup → first agent session reported to dashboard | 35% within 7 days |
| Free → Team upgrade (90-day) | 8% |

---

## Open questions

1. **Domain.** `missioncontrol.pro` or something else? Confirm availability.
2. **Free tier definition.** Single user with cloud sync? Or single user with *no* cloud sync (truly local)? Affects whether they show up in the cloud dashboard at all.
3. **Annual discount %.** 20% is a placeholder.
4. **Trial vs. always-Free.** Do we have a 14-day Team trial separate from the Free tier, or just the always-free tier? Lean: just the always-free tier — it's the lowest-friction path and Team conversion comes from team-size growth, not trial expiry.
5. **Where do docs live?** Same site (`/docs` subroute) or separate subdomain? Lean: same site for SEO.
