# Ember's Design Philosophy

> **"If you can take care of Ember, you can learn to take care of yourself."**

Ember is a wellness companion. Caring for Ember (feeding, warmth, affection, rest) should gently help players recognize their own needs. The dragon is a mirror for self-care, not a chore and not a guilt machine.

**Missed activities must never cause suffering, punishment, or guilt.** Ember encourages progress, not perfection, and celebrates effort, consistency, and returning after difficult days.

## Principles

1. **Progress is permanent.** Lifetime progress (growth, evolution stages, badges, cosmetics, and best streak) is never taken away for inactivity or missed days.
   - **Earned currency is never confiscated.** Players may *voluntarily* spend it (for example, in the shop), but inactivity never removes it.
   - **Only the current streak can reset** after a missed day. Lifetime achievements, such as best streak and streak badges, always remain.
2. **Showing up counts.** One meaningful activity (a quest, a focus session, a check-in) is enough to count a day. Perfection is never required.
3. **Absence is rest, not neglect.** When a player is away, Ember naps peacefully. Ember is never shown sick, sad, starving, or suffering because of the player.
4. **Returning is celebrated.** Coming back after a break is met with a warm welcome, never a reminder of what was missed.
5. **Requests are invitations.** If Ember asks for food, warmth, or affection, ignoring it costs nothing. Unanswered requests quietly expire.
6. **Limits protect balance, not punish.** Daily reward caps keep the game fair and paced. They never remove anything, and the activity itself (and its streak credit) still counts.
7. **No pressure mechanics.** No "streak at risk" alarms, guilt-tripping notifications, or loss-framed copy.
8. **Self-care, gently.** Ember's needs can echo the player's own (water, rest, warmth, connection) without lecturing.
9. **Every device stands alone.** Mobile-only and desktop-only players get the complete experience; syncing across devices is a bonus, never a requirement.

## Checklist for new features

Before shipping a feature or copy change, ask:

- [ ] Can a player lose anything they earned because of this? (The answer must be no.)
- [ ] Could a player feel guilty, anxious, or punished for not doing it?
- [ ] Is a missed or ignored action treated as neutral or restful?
- [ ] Does it celebrate effort and returning, rather than only perfection?
- [ ] Does any limit keep the activity's value (energy, streak credit), capping only what's needed for balance?
- [ ] Is the copy warm and free of loss-framing ("you'll lose…", "Ember is sad because…")?
- [ ] Does it work fully for a player on a single device?

## Where this shows up in the code

- `src/lib/progression.ts`: growth only increases, missed days reset only the current streak, napping after time away, daily limits that never take rewards back, and migrations that preserve progress.
- Streaks: one meaningful activity per day (#3). Custom-quest growth cap keeps energy and streak credit (#4).
- Future: Desktop Companion idea (#8) applies these principles to companion requests.
