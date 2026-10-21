# 2026 LCS transition checklist

Source: MLB official postseason schedule (https://www.mlb.com/news/2026-mlb-playoff-and-world-series-schedule).

## Matchups
- NLCS: LAD @ MIL, first game Oct 11 2026 20:00 ET (Oct 12 09:00 JST).
- ALCS: CLE @ TB, first game Oct 12 2026 20:00 ET (Oct 13 09:00 JST).
- Best of seven; games 5-7 are conditional.

## Application assessment
- app.js already recognizes round LCS and implements series predictions, scores and administrative series/game registration.
- Prediction and scoring state are served by a Supabase Edge Function, not embedded in GitHub. GitHub-only changes cannot register matches or reopen closed rounds.
- Preserve all old round records, predictions, point allocations and BOOST results.

## Data transition (not executed)
1. Back up current series, games, predictions, standings and round settings.
2. Verify actual DS settlements and LCS round state, lock rules and uniqueness conditions.
3. Upsert the two LCS series with official team codes and verified start timestamps.
4. Register games 1-7 for each series with official dates and home/away assignments. Confirm dates and times against MLB API before writing; games 5-7 are conditional.
5. Verify LCS prediction registration, cancellation, cutoff, point budgets, BOOST and ranking consistency with existing users.
6. Verify actual website and rollback strategy before public announcement.

No production database or public page is modified by this checklist.
