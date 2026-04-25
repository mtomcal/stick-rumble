# Legacy Documentation

This directory contains historical design docs, early research, archived epics, and planning material from earlier phases of Stick Rumble.

For current implementation intent, use [`../specs/`](../specs/) first. The active specs supersede these documents when they disagree.

## Context Management History

Stick Rumble went through a few context-management modes as the project grew:

1. **Prototype context** — [`archive/single-player-prototype-2025-11-25/`](archive/single-player-prototype-2025-11-25/) contains the original client-only prototype from Google AI Studio. It was used to explore game feel, controls, AI bots, Gemini-generated bot taunts, and visual direction before the multiplayer rewrite.
2. **BMad/task-plan context** — BMad-generated GDD, architecture, and epic docs were useful for early game planning and helped turn a loose idea into a structured multiplayer rewrite. They were much less useful as implementation context: the docs were large, token-heavy, and inefficient to keep in an agent's working context.
3. **Spec-first context** — the current workflow lives in [`../specs/`](../specs/), where focused specs act as the central brain for product intent, engineering constraints, acceptance criteria, validation, and agent context.

## Directory Notes

| Path | Purpose |
|------|---------|
| [`archive/`](archive/) | Historical prototype snapshots and archived material |
| [`epics/`](epics/) | Early BMad-era implementation story breakdowns |
| [`research/`](research/) | Older research notes kept for context |
| [`GDD.md`](GDD.md) | Early game design document, superseded by active specs |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`game-architecture.md`](game-architecture.md) | Early architecture notes, superseded by active architecture specs |
| [`TESTING-STRATEGY.md`](TESTING-STRATEGY.md) | Earlier testing strategy notes, superseded by active specs and current Makefile workflows |
