# Closed alpha hosting runbook (Cloudflare Pages + Cloudflare Access)

**Status: prepared, not performed.** Nothing here has been set up. Creating the
Cloudflare account, the Access allowlist, and every deployment is **BLOCKED —
FOUNDER ACTION**. Follow each step yourself, in order, and don't skip the
verification in step 6: **the alpha is not private until every reachable URL has
been tested without signing in.**

Testers: Andrew and Dimitri only. Hosting: a static site (no server, no database).
Saves stay on each phone; the host only serves the app's files.

## 0. What you need, and what it costs

| Need | Notes |
| --- | --- |
| A Cloudflare account | Free. Owned by Andrew (or DFS). |
| Cloudflare Pages | Free plan is enough for a static site this size. |
| Cloudflare Zero Trust (for Access) | Free plan covers up to 50 users. **Verify during sign-up whether a payment method is requested**; if it is, that's a founder decision (no charge is expected at 2 users, but confirm on the plan page). |
| A team name for Zero Trust | Becomes `<team>.cloudflareaccess.com`, the sign-in page testers see. |
| The two testers' email addresses | They receive one-time sign-in codes. Never commit them to the repo. |
| Node.js 22 and npm on the computer you deploy from | Same as CI. |
| A custom domain | **Not needed.** Use the free `pages.dev` address (fewer hostnames to protect). |

Pricing and plan limits change: check Cloudflare's current plan pages before
signing up.

## 1. The build (reproducible)

Build only from a clean checkout of the exact commit approved for the alpha:

```sh
git clone https://github.com/DragonFhangStudios/Ember.git ember-alpha-build
cd ember-alpha-build
git checkout <APPROVED_SHA>      # e.g. the merge commit of the release PR
git status --porcelain           # must print nothing
npm ci                           # exact versions from package-lock.json
npm run build                    # output: dist/
```

- **Build command:** `npm run build` (after `npm ci`). **Output directory:** `dist`.
- The build writes the short commit hash into the app. A clean checkout shows it
  as plain `abc1234`; uncommitted changes would show `abc1234+local`, which must
  never be deployed.
- Two builds of the same commit are identical except the main script (and the
  `index.html` that names it), which carry the build time. Every image, font,
  icon and the manifest are byte-identical.
- No secrets or environment variables are used. Don't add any to the Pages
  project.

## 2. Create the Pages project (Direct Upload, no Git connection)

Use **Direct Upload** so nothing deploys unless you run the command yourself.
`main` has no branch protection, so connecting Git would let any push to `main`
deploy automatically.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets** (Direct Upload). Don't choose "Connect to Git".
2. Project name: pick a stable, unguessable-ish name, e.g. `ember-alpha-dfs`.
   The alpha URL becomes `https://<project>.pages.dev`. **Keep this URL for the
   whole alpha:** saves live in the browser per web address, so a new URL starts
   with an empty save (testers would need export and import).
3. Production branch: `main`.
4. **Don't upload the first build yet.** Set up Access (step 3) first, so the
   site is never reachable without sign-in. If the dashboard insists on an
   upload to create the project, upload a placeholder `index.html` that says
   "Ember alpha: not yet available" instead of the app, then protect it.

If you ever do connect Git instead: in **Settings → Builds & deployments**,
turn off **automatic production branch deployments** and set **preview branch
deployments** to **None**, then save. A Direct Upload project avoids the issue
entirely.

## 3. Protect every hostname with Cloudflare Access

> **Critical:** the Pages setting "Enable access policy" protects **preview URLs
> only**. It does **not** protect the production `<project>.pages.dev` address
> or a custom domain. You need an Access application that covers both.
> See Cloudflare's Pages "Known issues" and "Preview deployments" docs.

1. **Zero Trust** dashboard → **Settings → Authentication → Login methods**:
   make sure **One-time PIN** is enabled (it's on by default). Testers type their
   email, receive a code, and enter it. No password, no Google account.
2. **Access → Applications → Add an application → Self-hosted.**
   - Name: `Ember alpha`.
   - Application domains (add both):
     - `<project>.pages.dev` (production)
     - `*.<project>.pages.dev` (every preview and branch alias, such as
       `abc123.<project>.pages.dev`)
   - Session duration: **1 month** (720h) is recommended. Each sign-in needs the
     email code, which is awkward from a Home Screen app; a long session means
     testers rarely see it. Shorter is more private but more friction.
   - Identity providers: One-time PIN only.
3. Add a policy:
   - Name: `Alpha testers`. Action: **Allow**.
   - Include → **Emails**: Andrew's email, Dimitri's email. Nothing else (no
     "Everyone", no email domains, no "Bypass" rules, no service tokens).
4. Save. Then in the Pages project → **Settings → General → Access policy**,
   also enable it, and check that it hasn't created a second, broader policy.
   In **Access → Applications** you should now see the application(s) covering
   both the production hostname and the wildcard, each with only the
   `Alpha testers` allow policy.
5. **Don't add a custom domain** during the alpha. If one is ever added, it needs
   its own Access application (same policy) **before** it serves the app, and it
   must be tested like the others in step 6.

Testers should be invited by you, personally, after step 6 passes. Access sends
codes only to allowlisted emails; nobody is invited automatically.

## 4. Deploy (manual, from your computer)

```sh
# In the clean build folder from step 1:
npx wrangler@4 login                                  # once; opens a browser
npx wrangler@4 pages deploy dist \
  --project-name=<project> \
  --branch=main \
  --commit-hash=<APPROVED_SHA> \
  --commit-message="Ember alpha <SHORT_SHA>"
```

- `--branch=main` makes it the production deployment. Any other branch name
  creates a preview URL (still covered by the wildcard in step 3).
- `--commit-hash` records the SHA in the Pages dashboard. It's only a label; the
  build hash inside the app (step 7) is the real check.
- Wrangler's version changes; `wrangler@4` was current when this was written.
  Check `npx wrangler@4 pages deploy --help` before the first deploy.

## 5. Optional: response headers

Not needed for the alpha (Access already keeps search engines and strangers
out). If wanted later, a `public/_headers` file can add headers such as
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. That would
be a separate, reviewed change.

## 6. Verify there's no public way in (required before inviting anyone)

Run these from a computer **not** signed in to Access (or a private window with
`curl`, which never has the cookie). Every request must be **redirected to the
Access sign-in** (HTTP 302 to `<team>.cloudflareaccess.com`) or refused (401/403).
**Not one may return 200 with Ember's content.**

```sh
BASE=https://<project>.pages.dev
JS=$(grep -o '/assets/index-[^"]*\.js' dist/index.html)
CSS=$(grep -o '/assets/index-[^"]*\.css' dist/index.html)
for path in / /index.html "$JS" "$CSS" /manifest.webmanifest /favicon.svg \
            /icons/icon-192.png /icons/apple-touch-icon.png /does-not-exist; do
  printf '%-45s ' "$path"
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$BASE$path"
done
```

Repeat with:

- the deployment's own URL shown after `wrangler pages deploy` (it looks like
  `https://<hash>.<project>.pages.dev`);
- the branch alias, e.g. `https://main.<project>.pages.dev`;
- any custom domain, if one exists.

Then in a browser:

1. Private window → `https://<project>.pages.dev` → the Cloudflare sign-in
   appears, not Ember.
2. Enter an email that **isn't** on the allowlist → no code arrives, and no way
   in.
3. Enter an allowlisted email → code arrives → Ember opens.
4. Settings → bottom line shows `Ember version <SHORT_SHA>` matching the
   approved commit.

Record the results (date, URLs tested, status codes) in the alpha issue. **Only
after every check passes is the alpha "live and private."**

## 7. Verify the deployed commit

- In the app: **Settings → "Ember version abc1234, built …"**. It must equal
  the approved commit's short hash, with no `+local`.
- In Cloudflare: **Workers & Pages → <project> → Deployments** shows the
  production deployment with the commit hash you passed.
- Exported save files also record the app version, so a tester's file can be
  matched to a build.

## 8. Roll back to the previous known-good build

Two ways, both manual:

1. **Dashboard:** Workers & Pages → <project> → **Deployments** → find the
   previous production deployment → **⋯ → Rollback to this deployment**. Instant,
   no rebuild.
2. **Redeploy:** repeat steps 1 and 4 with the previous approved SHA.

After rolling back, repeat step 7 (version check). Saves are unaffected: they
live on the phones, and every build reads save version 9. A rollback to a build
**older than save version 9** isn't possible for current testers' saves (Ember
refuses saves from a newer version rather than damaging them), so don't roll
back past the release that introduced the save version the testers are on.

## 9. Stopping the alpha

- Remove a tester: delete their email from the `Alpha testers` policy (and
  revoke their session under **Access → Users**, if needed).
- Take the site offline: delete the Pages project, or replace the deployment with
  the placeholder page. Testers' saves remain on their phones until they clear
  site data; ask them to export first if they want to keep them.

## Never do during the alpha

- Connect Git with automatic deploys, or enable preview builds.
- Add "Bypass" or "Everyone" rules, service tokens, or email-domain allow rules.
- Add a custom domain without its own Access application.
- Add secrets or API keys to the build.
- Touch the Google Cloud project or the existing Cloud Build trigger.
