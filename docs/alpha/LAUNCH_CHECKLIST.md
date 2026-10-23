# Operation First Hatch: closed alpha launch checklist

Release candidate for Ember's first private alpha (#32). Testers: **Andrew and
Dimitri only**, on Android Chrome and iPhone Safari / Home Screen.

- Branch: `release/first-hatch-alpha`, from main `2e076fc`.
- Companion docs: [Hosting runbook](HOSTING_RUNBOOK.md) ·
  [Tester guide](TESTER_GUIDE.md) · [Alpha readiness](../ALPHA_READINESS.md)

**The alpha is not live.** Nothing has been deployed, and no account,
allowlist or hosting has been created.

## 1. Scope freeze

### Included in the alpha

- The egg and the current evolution and progression mechanics
- Daily quests and custom quests
- Check-ins with optional private notes
- Focus sessions
- Bond and milestones
- Shop and wardrobe, with **temporary local placeholder pictures**
- Settings, privacy information, local save export and import, and backups
- Browser and Home Screen install, where the browser supports it

### Explicitly deferred (not in this alpha)

- Original H1 character artwork (#20)
- Opening the app offline (service worker / offline app shell)
- Cloud saves and cross-device sync
- A permanent-data-deletion button in the app
- Steam / desktop companion
- Multiplayer and playdates
- Payments, AI chat and voice
- Public app-store submissions

### Known limitations

- **Needs a connection to open.** There's no offline shell; once open, Ember
  keeps working offline.
- **Saves are per browser, per device, per web address.** No sync. iPhone
  Safari and the Home Screen app have separate saves. A new alpha URL starts
  empty (move saves with export and import).
- **Browser storage can be cleared** (low space, long breaks on iPhone, or
  clearing site data), and the 3 automatic backups go with it. Only an exported
  file is a separate copy. The app says so in Settings and the save dialogs.
- **Minimum browsers:** iOS / iPadOS Safari 15.4 or later (for `<dialog>`), and a
  current Chrome on Android. Exports and imports need HTTPS (they use the
  browser's secure hashing), which the alpha host provides.
- Placeholder pictures for Ember's stages and the shop.
- First load downloads about 2 MB (about 420 KB of script after compression,
  plus fonts and icons).
- No in-app "delete my data": testers clear site data (see the tester guide).

## 2. Gates

PASS = verified here. BLOCKED = needs a founder action. FAIL = unresolved.

### Gate 0: baseline

| Check | Status | Evidence |
| --- | --- | --- |
| Main is `2e076fc`, clean tree | PASS | Verified before branching |
| Both required CI checks green on main | PASS | "Lint, build, test" and "Browser tests (Playwright)" on `2e076fc` |
| Save version 9; 3 backups; atomic import/restore/reset | PASS | `SAVE_VERSION = 9`, `BACKUPS_KEPT = 3`; save-integrity suites below |
| Design philosophy respected | PASS | No product changes; no loss-framed copy added |
| CCGuard | PASS (n/a) | Not present in this cloud container; nothing changed |
| Branch protection on main | BLOCKED — FOUNDER ACTION | Not readable from this session (403); assumed none. Keep deploys manual (runbook) |

### Launch-blocking audit

| Area | Status | Finding |
| --- | --- | --- |
| Reproducible static build | PASS | `npm ci && npm run build` → `dist/` (2.4 MB). Two clean builds: every file byte-identical except the main script and `index.html`, which carry the build time. Commit hash embedded (`+local` if dirty) |
| Secrets / environment variables | PASS | `src` reads no env vars; `.env*` git-ignored; built output scanned (no keys, tokens, `GEMINI`, `API_KEY`); no source maps; dev-only test override compiled out |
| Third-party runtime requests | PASS | Fonts and images bundled. Browser suite blocks every outside host on every screen. External URLs in the bundle are only fact-source links (opened by the player, `noopener noreferrer`), SVG namespaces and library error text |
| IndexedDB errors and recovery | PASS | Suites: failed save with retry, transient error → recovery (creates nothing), no IndexedDB → read-only preview, unreadable legacy save → recovery |
| Save export / import / version compatibility | PASS | Checksummed v1 file; newer file or save versions refused; interrupted, stale and malformed imports change nothing; exact round trip |
| Storage-loss warnings | PASS | Settings "Your save" and "This device", import confirmation and backups list |
| Medical disclaimer, privacy information | PASS (fixed) | Disclaimer on Home. **Fixed:** privacy sheet now says a hosted sign-in sees the tester's email, Ember never does |
| Home Screen install behind sign-in | PASS (fixed), real device pending | **Fixed:** manifest fetched with credentials, so a sign-in gate can't replace it. Needs a real-device check after hosting |
| Mobile navigation, controls, dialogs | PASS | 360px, 390px and Pixel 7 layout suites; dialog focus suites |
| Accessibility (keyboard, screen reader) | PASS (fixed) | **New audit** of the accessibility tree on every screen and main dialog; Tab order. **Fixed:** decorative Focus ring was announced as an unnamed image |
| Browser compatibility, user-facing errors | PASS | `randomUUID` and BroadcastChannel guarded; exports fail with a message (never silently) without HTTPS; minimum iOS 15.4 documented |
| Production dependencies | PASS (documented risk) | `npm audit --omit=dev` lists 14 advisories, but **none ships to phones**: they're in unused server packages (`express`, `@google/genai`, `dotenv`, never imported or bundled) and build tools (`vite`, `postcss`, `esbuild`, `browserslist`) that only process our own code. Not upgraded blindly. Follow-up: remove the unused packages, move build tools to devDependencies, update Vite |

### Release-candidate QA

| Check | Status | Result |
| --- | --- | --- |
| Type-check | PASS | `tsc --noEmit` clean |
| Unit tests | PASS | 377/377 (18 files) |
| Production build | PASS | Built from the committed head; version embedded |
| Full browser suite (dev server) | PASS | 279/279 on `384e49d` (chromium 390px, chromium-360 layout, emulated Pixel 7). One earlier run had a single theme-test failure while a file was being edited mid-run; it didn't reproduce in 20 isolated runs, 192 runs under load, or the final run |
| Full browser suite against the **production build** | PASS | 265 of 279 passed; the other 14 are the 7 keyboard Easter-egg tests × 2 projects, which force the 1-in-N chance with a test-only switch that production builds remove by design (confirmed absent from the bundle). No other failures |
| Save integrity (invalid import, interrupted import, reset, restore, backups, cross-tab) | PASS | Included in both runs |
| 360px, 390px, emulated Pixel 7 | PASS | Included |
| Dark mode, reduced motion, contrast (WCAG AA) | PASS | Included |
| Broken assets, unexpected network requests | PASS | Local-only suite: every image and both fonts load with outside hosts blocked |
| Screenshots of main flows (production build, Pixel 7, light and dark) | PASS | Attached to the PR report |
| Real iPhone and Android | BLOCKED — FOUNDER ACTION | Chromium emulation is not Safari or a real phone. Run the physical-device checklist in [Alpha readiness](../ALPHA_READINESS.md) after hosting |

### Hosting, access and launch

| Check | Status | Notes |
| --- | --- | --- |
| Hosting plan and runbook | PASS | Cloudflare Pages (Direct Upload) + Cloudflare Access, [runbook](HOSTING_RUNBOOK.md) |
| Cloudflare account, Zero Trust team, plan / payment-method decision | BLOCKED — FOUNDER ACTION | Free tiers expected to cover 2 testers; confirm during sign-up whether a payment method is requested |
| Allowlist of the two tester emails | BLOCKED — FOUNDER ACTION | Never committed to the repo |
| Production `pages.dev`, previews and any custom domain all behind Access | BLOCKED — FOUNDER ACTION | Pages' own access setting covers previews only; runbook step 3 covers all hostnames |
| Unauthenticated access test of HTML and static assets | BLOCKED — FOUNDER ACTION | Runbook step 6 (must pass before inviting anyone) |
| Merge of the release PR, then a deploy of that exact commit | BLOCKED — FOUNDER ACTION | Manual deploy only; verify the version in Settings |
| Inviting testers | BLOCKED — FOUNDER ACTION | After step 6 passes |

## 3. Genuine launch blockers

**No technical, privacy, security or test blockers remain in the code.** What's
left before two people can use it is founder action only:

1. Approve and merge the release PR.
2. Create the Cloudflare account and Zero Trust team (decide on any payment
   method request).
3. Create the Pages project and the Access application covering every hostname,
   with the two emails only.
4. Deploy the merged commit manually; pass every unauthenticated-access check.
5. Invite Andrew and Dimitri; run the physical-device checklist on a real iPhone
   and Android phone.

## 4. Known CI risk

The browser job's "Install Chromium" step has taken about 13 minutes on recent
`main` runs (instead of under a minute), leaving little room under the
25-minute limit. If CI is cancelled by that, it's reported as cancelled, not
passed. A browser cache for CI is a proposed follow-up, not part of this release.
