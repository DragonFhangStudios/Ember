# Alpha readiness: what's done in the app, and what needs real devices

Private phone testing (#32) needs more than this repository can provide. This page
lists what the app now does, what still needs **hosting** (not authorized yet), and
what can only be checked on a **physical iPhone and Android phone**.

## In the app (Alpha Foundations)

- **Save export, import and backups** (Settings → Your save). Imports are checked,
  compared with the current save, confirmed, and atomic. The replaced save is kept
  as a backup (the last 3). There's no sync between devices.
- **No third-party requests.** Images are local placeholders, and the fonts are
  bundled.
- **Installable metadata.** There's a web app manifest (standalone) and
  temporary, non-final icons, including a maskable icon and an Apple touch icon.
  The status-bar color follows the app theme.
- **Best-effort storage protection.** Settings shows whether the browser has agreed
  to keep Ember's data, and offers to ask (some browsers show a prompt). This is
  never a guarantee.
- **The build version** appears in Settings and in exported save files.

## Prerequisites that need hosting (not authorized yet)

| Needs | Why |
| --- | --- |
| **HTTPS** | Installing to the home screen, `navigator.storage.persist()` and clipboard copy require a secure origin. `localhost` counts as secure for development only. |
| **Private access** (e.g. Cloudflare Access; see #32) | An unlisted URL isn't private. |
| **Same origin for every alpha build** | The save lives in that origin's IndexedDB. A new domain or subdomain starts with an empty save, so use export and import to move. |

## Offline app shell (not built)

There is **no service worker** (it needs separate approval). Until there is one:

- The app needs a network connection to **open**. Once open, it keeps working
  offline (saves, the focus timer, the Daily Dragon Fact), because all of its code,
  fonts and images are already loaded.
- Opening the app in airplane mode, especially from the home screen, shows the
  browser's offline page.
- A service worker would cache the app shell. It needs careful update handling (old
  and new versions open in two tabs, and migrations), so it's a separate piece of work.

## iPhone (Safari) specifics to verify on a real device

- **Storage eviction:** Safari may delete a site's storage (including IndexedDB)
  after a period without visits, unless the site is added to the home screen.
  Verify the current WebKit policy and test with a real alpha build.
- **Home Screen apps have their own storage**, separate from Safari's. A save made
  in Safari doesn't appear in the home-screen app, and vice versa. Move it with
  export and import.
- **`persist()`** support and behavior differ between Safari and home-screen apps.
  Check what Settings reports in both.
- **File import and export:** export uses a download, which iOS may offer through the
  Files app or the share sheet. Check both directions with the Files app.

## Physical-device checklist

Run each release on a real iPhone (Safari and Home Screen) and a real Android phone
(Chrome and installed). Emulators and Playwright's Pixel 7 emulation don't cover
these.

- [ ] Add to Home Screen / Install: the icon and name look right, and it opens full
      screen with correct notch and home-indicator spacing.
- [ ] The status-bar color matches light, dark and custom backgrounds.
- [ ] Close the app, kill it from the app switcher, reboot the phone: the save is intact.
- [ ] Export a save, reset, then import that file: everything is back. Restore the
      reset save from backups.
- [ ] Move a save between two devices with export and import (and between Safari and
      the home-screen app on iPhone).
- [ ] Settings → This device: the storage status and the "Ask the browser…" result
      (note any prompt).
- [ ] Settings → Privacy: copy diagnostics and paste them into a note, checking they
      contain no check-ins, notes or save data.
- [ ] The focus timer survives locking the phone mid-session.
- [ ] Airplane mode after the app has loaded: it keeps working. Opening it fresh
      in airplane mode needs the network (no offline shell yet).
- [ ] Dark mode, system theme switching, reduced motion, and a large text size.
- [ ] VoiceOver (iPhone) and TalkBack (Android): a quick pass on Home, Settings, the
      import confirmation and dialogs.
- [ ] Two tabs open (where the browser allows it): no double rewards, and an import
      in one tab shows in the other.

Browser storage rules change between releases, so verify the current platform
policies before each alpha round.
