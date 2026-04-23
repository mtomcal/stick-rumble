# Merge And Alignment Plan

## Goal

Merge `origin/main` into `fix/wall-bugs` while preserving the active `specs/` contract across three linked change sets:

- first-contact barrier resolution across ranged combat, melee, knockback, and projectile cleanup
- live-player footprint and blocker-contact readability for the top-down player silhouette
- session-first bootstrap, authoritative weapon state, and frozen match-end UI behavior from `main`

## Contract Source

The merged source of truth is:

- `specs/arena.md`
- `specs/client-architecture.md`
- `specs/graphics.md`
- `specs/hit-detection.md`
- `specs/maps.md`
- `specs/match.md`
- `specs/melee.md`
- `specs/messages.md`
- `specs/rooms.md`
- `specs/shooting.md`
- `specs/ui.md`
- `specs/weapons.md`

## Acceptance Focus

- Shared barrier geometry resolves combat interactions against the first blocking contact.
- Melee damage and bat knockback remain blocked by authoritative wall occlusion.
- The live player silhouette stays readable as the canonical top-down body against blocker edges.
- `session:status` remains the authoritative pre-match bootstrap message.
- Authoritative weapon state continues to drive local and remote held-weapon presentation.
- Match-end winners, scores, and placements remain display-ready and frozen once `match:ended` is emitted.

## Resolution Order

1. Resolve spec conflicts first so the merged contract is explicit.
2. Resolve test conflicts in favor of the current runtime architecture, then restore missing assertions only if validation exposes gaps.
3. Run repo validation and patch any breakages caused by the merge.
4. Push the branch and verify GitHub checks on the PR.

## Verification

- `make test-client`
- `make test-server`
- `make lint`
- `make typecheck`
- `make test`
