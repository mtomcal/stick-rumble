# Repository Presentation

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-04-25
> **Depends On**: [overview.md](overview.md), [deployment-runbook.md](deployment-runbook.md)
> **Depended By**: root README, repository metadata, documentation navigation

---

## Overview

The repository presentation must describe Stick Rumble as a playable MVP public alpha and as a portfolio-quality engineering project. The public-facing material should lead with the shipped game and its architecture, then explain the AI engineering and context-management workflow as a secondary but prominent part of the project story.

The presentation must avoid implying that the project is a finished commercial product or that AI agents replaced engineering judgment. It should instead show a shipped real-time multiplayer system, the engineering constraints behind it, and the context-management practices used to sustain development over many sessions.

---

## Behavior

### Public Positioning

- The root README describes Stick Rumble as a playable MVP public alpha.
- The live site `https://stickrumble.com` is visible near the top of the README.
- The first description explains what the game is: a browser-based multiplayer stick-figure arena shooter for desktop and phone.
- The engineering-method story is prominent but secondary to the game itself.

### Specs Framing

- `specs/` is described as the central brain of the project.
- Specs are framed as an intention and taste engine: focused documents for product intent, engineering constraints, tradeoffs, acceptance criteria, validation obligations, and agent context.
- Public wording must avoid presenting specs as a monolithic prompt framework or deterministic code-generation mechanism.

### Documentation Navigation

- `specs/` is the active source of truth for current implementation intent.
- `docs/` is historical context: early planning, legacy architecture notes, BMad-generated planning docs, and archived prototype material.
- When `docs/` and `specs/` disagree, `specs/` wins.
- The original client-only prototype is archived under a human-readable name that describes it as a single-player prototype.

### Project Scale

The README may use rounded ballpark numbers to communicate engineering scale. Counts should be rounded enough that they remain true as the repository changes, for example:

- 2,100+ tests
- 120+ test files
- 25+ active specs
- 70+ visual reference frames

### Root Cleanliness

The repository root should contain stable project entry points only. Generated agent-loop scaffolding, stale plans, accidental empty files, coverage reports, and one-off local artifacts should not live in the root or active source package roots.

---

## Test Scenarios

### TS-REPO-001: README presents the shipped game first

**Given** a portfolio reviewer opens the repository
**When** they read the first screen of the README
**Then** they see the live URL, game description, platform target, and core stack before process history.

### TS-REPO-002: specs are described without framework overclaiming

**Given** a reader encounters the specs section
**When** they read the description of `specs/`
**Then** they understand specs as project memory and intent management, not as a monolithic AI framework.

### TS-REPO-003: historical docs are clearly marked

**Given** a reader opens `docs/`
**When** they read the docs index
**Then** they know to use `specs/` for current implementation intent and treat `docs/` as historical context.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-25 | Initial repository presentation contract for README, docs navigation, root cleanup, and GitHub metadata polish. |
