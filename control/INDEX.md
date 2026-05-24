# Mission Control v4 — Index

| Doc | Purpose |
|-----|---------|
| [workflow.md](workflow.md) | User-facing overview |
| [ROUTER.md](ROUTER.md) | Classify Project START vs Add Feature |
| [ORCHESTRATOR.md](ORCHESTRATOR.md) | Orchestrator rules |
| [PIPELINE.md](PIPELINE.md) | Both pipelines summary |
| [PROJECT-START-PIPELINE.md](PROJECT-START-PIPELINE.md) | New product workflow |
| [ADD-FEATURE-PIPELINE.md](ADD-FEATURE-PIPELINE.md) | New feature workflow |
| [SKILL-DEPENDENCIES.md](SKILL-DEPENDENCIES.md) | startup-skill + designer-skills |
| [CONTEXT-PACKETS.md](CONTEXT-PACKETS.md) | Scoped subagent context |
| [BUILD-GATES.md](BUILD-GATES.md) | Lint, compile, test, build |
| [JOURNAL-RULES.md](JOURNAL-RULES.md) | Subagent journals |
| [AGENT-DATA-RULES.md](AGENT-DATA-RULES.md) | Portfolio integrity |
| [dashboard.html](dashboard.html) | Live status (regenerate only) |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/generate-dashboard.mjs` | Regenerate dashboard |
| `scripts/check-vendor-skills.mjs` | Verify vendor bundles |
| `scripts/check-setup.mjs` | Setup validation |

Kit vendor installer: `{project}/mission-control-kit/scripts/bundle-vendor-skills.sh`
