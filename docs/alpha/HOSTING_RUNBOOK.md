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
> only** (for example `373f31e2.<project>.pages.dev`). It does **not** protect the
> production `<project>.pages.dev` address or a custom domain. By default it also
> lets in your Cloudflare account, not a list of testers.

This follows Cloudflare's documented procedure, "Enable Access on your
`*.pages.dev` domain", in the Pages **Known issues** page (checked against the
docs source on 2026-10-23). Dashboard labels change; if a step doesn't match,
follow the current Known issues page and keep the end state described in 3c.

### 3a. One-time PIN sign-in

**Zero Trust → Settings → Authentication → Login methods:** make sure
**One-time PIN** is enabled (it's on by default). Testers type their email,
receive a code, and enter it. No password, no Google account.

### 3b. Cloudflare's procedure: production first, then previews again

1. Cloudflare dashboard → **Workers & Pages** → select the project.
2. **Settings → Enable access policy.** This creates an Access application for
   the previews (`*.<project>.pages.dev`).
3. Select **Manage** on that Access policy.
4. Under **Access → Applications**, select the project's application →
   **Configure**.
5. Under **Public hostname**, in the **Subdomain** field, **delete the wildcard
   (`*`)** and **Save**. (If saving fails, change the **Application name**, e.g.
   to `Ember alpha (production)`.) This application now protects the
   **production** `<project>.pages.dev` address.
6. Back in the Pages project → **Settings → General** → select **Enable access
   policy** again. This creates a **new** application for the previews.
7. In **Access → Applications**, confirm there are now **two** applications:
   one for `<project>.pages.dev` and one for `*.<project>.pages.dev`.

### 3c. Restrict both applications to the two testers

The applications created above start with Cloudflare's default rule (your
Cloudflare account). Edit **each** of the two applications:

- **Policies:** exactly one policy, `Alpha testers`, action **Allow**, with
  **Include → Emails:** Andrew's email and Dimitri's email. Remove any other
  include rules (account members, "Everyone", email domains), and add no
  "Bypass" or "Service Auth" policies and no service tokens.
- **Login methods:** One-time PIN.
- **Session duration:** **1 month** is recommended. Each sign-in needs an
  emailed code, which is awkward from a Home Screen app; a long session means
  testers rarely see it. Shorter is more private but adds friction.

End state to check before going on:

| Access application | Hostname it covers | Policy |
| --- | --- | --- |
| Production | `<project>.pages.dev` | Allow: the two tester emails only |
| Previews | `*.<project>.pages.dev` | Allow: the two tester emails only |

### 3d. Custom domains (avoid during the alpha)

Don't add a custom domain. If one is ever added, Cloudflare's procedure
continues: **Zero Trust → Access controls → Applications → Create new
application → Self-hosted and private → Add public hostname** (the custom
domain), with the same `Alpha testers` policy, **before** it serves the app.
Without it, the sign-in page appears but doesn't work for that domain. Note
Cloudflare's other known issues: a custom domain can't be added while an
Access policy is already on it, and certificate validation needs
`/.well-known/acme-challenge/*` reachable. Test every custom domain in step 6.

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
  creates a preview URL (covered by the preview Access application from step 3).
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

Run this from the clean build folder (it reads the asset names from
`dist/index.html`), with `curl`, which never has a sign-in cookie. List every
hostname that can reach the project: production, the deployment URL printed by
`wrangler pages deploy` (`https://<hash>.<project>.pages.dev`), the branch alias
(`https://main.<project>.pages.dev`), any other preview you've created, and any
custom domain.

```sh
HOSTS="https://<project>.pages.dev https://<hash>.<project>.pages.dev https://main.<project>.pages.dev"
JS=$(grep -o '/assets/index-[^"]*\.js' dist/index.html)
CSS=$(grep -o '/assets/index-[^"]*\.css' dist/index.html)
FONT=$(ls dist/assets/*.woff2 | head -1 | sed 's|^dist||')
for host in $HOSTS; do
  for path in / /index.html "$JS" "$CSS" "$FONT" /manifest.webmanifest /favicon.svg \
              /icons/icon-192.png /icons/icon-512.png /icons/apple-touch-icon.png /does-not-exist; do
    printf '%-60s ' "$host$path"
    curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$host$path"
  done
done
```

**Pass:** every line is a redirect to the Access sign-in (`302` to
`<team>.cloudflareaccess.com`) or refused (`401`/`403`). **Fail:** any `200`.
One `200` means a hostname or file is public: stop, fix the Access
applications (step 3), and run it again.

Then in a browser:

1. Private window → `https://<project>.pages.dev` → the Cloudflare sign-in
   appears, not Ember. Repeat for a preview URL.
2. Enter an email that **isn't** on the allowlist → no code arrives, and no way
   in.
3. Enter an allowlisted email → code arrives → Ember opens.
4. Settings → bottom line shows `Ember version <SHORT_SHA>` matching the
   approved commit.

Record the results (date, hostnames tested, status codes) in the alpha issue.
**Only after every check passes is the alpha "live and private."**

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
