# Routing Manifest

Defines the mapping of task types to required documents for v5 subagent dispatch.

## Route Table

| Task Type | Routes To |
|-----------|-----------|
| UI implementation | UI-REQUIREMENTS.md, layout primitives, wireframes |
| UX decisions | UX-PATTERNS.md, interaction.html, flow diagrams |
| Architecture | ARCHITECTURE.md, stack.json, tech decisions |
| Research | relevant skill + user specs + research template |
| Build | phase plan + BUILD-GATES.md + single task spec |
| Brainstorm | product context + market research + user goals |

## Purpose

This manifest ensures that subagents receive only the documents relevant to their task scope. It is resolved by `lib/mc-router.mjs` before dispatch and prevents context bloat.

## TODO

- [ ] Define extensibility rules for adding new task types
- [ ] Add routing resolution algorithm and pseudocode
- [ ] Include example dispatch payloads showing resolved routes
- [ ] Add validation rules for route completeness
