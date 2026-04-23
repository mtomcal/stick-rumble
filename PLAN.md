# Merge And Alignment Plan

## Goal

Merge `main` into `fix/wrong-weapon-bugs-finalize` while preserving the active `specs/` contract across two linked change sets:

- session-first bootstrap and display-ready match results
- authoritative weapon state, frozen match-end results, and melee/UI correctness

## Contract Source

The source of truth is the merged spec set in:

- `specs/messages.md`
- `specs/match.md`
- `specs/ui.md`
- `specs/graphics.md`
- `specs/weapons.md`
- `specs/melee.md`
- `specs/client-architecture.md`
- `specs/rooms.md`

## Acceptance Focus

- `session:status` remains the authoritative pre-match bootstrap message.
- `match:ended` winners and final scores are display-ready and safe for player-facing UI.
- Remote held-weapon presentation comes from authoritative player-state updates.
- Local equipped-weapon truth remains driven by authoritative weapon state, not pickup confirmation.
- Local HUD score and kill displays update only from authoritative local-player stats and freeze on `match:ended`.
- Match-end rankings share placement for kill ties and do not use deaths as a hidden tiebreaker.
- Raw player IDs do not appear in player-facing match-end UI.

## Resolution Order

1. Resolve spec and schema conflicts first so the contract is explicit.
2. Resolve server match-state conflicts so outgoing payloads satisfy the merged schema.
3. Resolve client event-handler and match-end UI conflicts against the merged contract.
4. Update tests to assert the merged behavior rather than either pre-merge variant in isolation.
5. Run targeted validation, then broader repo verification.

## Verification

- `make test-client`
- `make test-server`
- `make lint`
- `make typecheck`
- `make test`
