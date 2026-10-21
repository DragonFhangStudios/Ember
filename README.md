<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ember 🐉

Ember is a gentle wellness companion: a little dragon you care for while learning to care for yourself. Small acts of self-care (a glass of water, a focus session, a moment to check in with how you feel) help Ember grow, and Ember is always happy to see you, especially after a hard day.

> **"If you can take care of Ember, you can learn to take care of yourself."**
>
> Missed activities never cause suffering, punishment, or guilt. Read [Ember's Design Philosophy](docs/DESIGN_PHILOSOPHY.md) before adding features.

## Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/32e375a7-8f2c-4692-93f5-365cc6e28898

### Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
3. Run the unit tests:
   `npm test`
4. Run the browser tests (Playwright, real Chromium at phone width):
   `npx playwright install chromium` (first time only), then `npm run test:e2e`

   The browser tests live in `e2e/` and start the dev server automatically. They cover save migration and recovery, focus-session persistence, multiple tabs, storage failures, preview mode, and progression UI. On failure, `npx playwright show-trace test-results/<test>/trace.zip` replays what happened. CI runs both suites on every pull request.

No API key is needed: the app doesn't call Gemini yet. If Gemini features are added, call the API from a server; never ship the key in client code, since everything Vite bundles is public.
