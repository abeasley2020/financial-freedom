# Proposed golden games (Stage D, awaiting Andre's approval)

Stage D tuning changed card numbers, the board mix, and Setback costs, so the four committed golden games in `packages/engine/src/test/golden/` no longer replay (`pnpm test` shows 4 golden failures; everything else is green). CLAUDE.md says goldens are never regenerated without Andre's approval, so the re-recordings wait here instead of overwriting the originals.

What is here:

- The four Stage C setups replayed with the same players and strategies. Three kept their seed and ending: `limit-two-players` (29 turns), `kids-three-players` (29), `last-standing-two-players` (28). `limit-four-players` moved from seed 0 to seed 1, because on the tuned content seed 0 ends in an escape; seed 1 reaches the round limit after 59 turns.
- A new `escape-three-players` (seed 1178, Police Officer as Big Spender, Real Estate Agent as Balanced, Restaurant Server as Wealth Builder). The Real Estate Agent borrows to buy a Foreclosed Bungalow, sells it to a rental buyer at 200 percent, pays off every loan, buys two big deals, and escapes in round 6 (16 turns). It is the first escape recording.
- `golden-test.patch`: adds the escape recording to `golden.test.ts` and updates the set check to all three endings and seat counts 2, 2, 3, 3, 4.

Every file was checked before saving: it replays from its seed to exactly its recorded final state, and the final state passes `assertInvariants`.

To approve (PowerShell, one command at a time, from the repo root):

```powershell
Copy-Item docs/sim/golden-proposed/*.json packages/engine/src/test/golden/
```

```powershell
git apply docs/sim/golden-proposed/golden-test.patch
```

```powershell
Remove-Item -Recurse docs/sim/golden-proposed
```

```powershell
pnpm check
```

Commit message: `test(engine): regenerate golden games after Stage D tuning changed card numbers, the board mix, and Setback costs; add an escape recording`.
