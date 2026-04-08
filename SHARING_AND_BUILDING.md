# Building and Sharing Ember

This guide explains how to share the Ember prototype with your friends. You have two options, depending on how you want them to experience the app.

---

## 🌎 Option A: The Progressive Web App (Easiest)

This option turns Ember into a website that acts exactly like a native app. Your friends open a link, tap "Add to Home Screen", and it gets its own icon and runs without the browser UI.

### Step 1: Create the Build
1. Open your terminal or command prompt.
2. Run this command:
   ```bash
   npm run build
   ```
3. This creates a folder called `dist`. This folder contains your entire optimized application. Think of this like the final exported folder from a Unity Build.

### Step 2: Put it Online
You need to host the `dist` folder online so your friends can access it. Netlify is the easiest way to do this for free.

1. Go to [Netlify Drop](https://app.netlify.com/drop).
2. Drag and drop the entire `dist` folder into the upload circle on the webpage.
3. Netlify will instantly give you a live URL.

### Step 3: Share
Send that link to your friends! Tell them to open it in Safari (iOS) or Chrome (Android) and choose **"Add to Home Screen"**.

---

## 📱 Option B: The Native App (Advanced)

If you want an actual `.apk` file (for Android) or want to run it via Xcode (for iOS), we use Capacitor.

### Step 1: Create the Web Build
Every native build starts with the web build.
```bash
npm run build
```

### Step 2: Sync to Native Projects
This copies your web code into the native Android and iOS folders.
```bash
npx cap sync
```

### Step 3: Open the Native Editor

#### For Android (Requires Android Studio)
1. Run:
   ```bash
   npx cap open android
   ```
2. Android Studio will open. From there, you can build the APK by going to `Build -> Build Bundle(s) / APK(s) -> Build APK(s)`.
3. You can send the generated `.apk` file directly to your Android friends.

#### For iOS (Requires a Mac & Xcode)
1. Run:
   ```bash
   npx cap open ios
   ```
2. Xcode will open. *Note: Sharing an iOS app directly is very difficult due to Apple's restrictions. You will likely need an Apple Developer Account to use TestFlight.*

---

**Tip:** Whenever you update your code, always run `npm run build` first to update the `dist` folder before syncing to native or re-uploading to Netlify!