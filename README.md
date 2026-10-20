<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ember 🐉

A wellness companion dragon for habit tracking.

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
3. Run the tests:
   `npm test`

No API key is needed: the app doesn't call Gemini yet. If Gemini features are added, call the API from a server; never ship the key in client code, since everything Vite bundles is public.
