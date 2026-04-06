# Capacitor Setup — ScentFolio iOS + Android

Everything below runs on your local machine (not Cowork).

## Prerequisites

- **iOS:** Mac with Xcode 15+ and CocoaPods (`sudo gem install cocoapods`)
- **Android:** Android Studio with SDK 33+
- Node 18+

## Step 1: Install Capacitor dependencies

```bash
cd scentfolio-v2
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard
```

## Step 2: Initialise native projects

```bash
npm run build           # Build the web app to dist/
npx cap add ios         # Creates ios/ folder
npx cap add android     # Creates android/ folder
npx cap sync            # Copies dist/ into native projects
```

## Step 3: Open in Xcode / Android Studio

```bash
npx cap open ios        # Opens Xcode
npx cap open android    # Opens Android Studio
```

## Step 4: Xcode config (iOS)

1. Open `ios/App/App.xcworkspace` in Xcode
2. Set your **Team** under Signing & Capabilities
3. Set **Bundle Identifier** to `com.scentfolio.app`
4. Set **Deployment Target** to iOS 16.0
5. Add **App Icons** — use a 1024x1024 source icon (we can generate these)
6. Build to simulator or device

## Step 5: App Store prep

1. Create an **App Store Connect** record for `com.scentfolio.app`
2. Add screenshots (6.7" iPhone 15 Pro Max + 6.1" iPhone 15)
3. Fill out the privacy policy URL (required)
4. Set the age rating (4+, no objectionable content)
5. Archive and upload via Xcode → Product → Archive → Distribute

## Dev workflow

After code changes:
```bash
npm run cap:build:ios     # Build + sync to iOS
npm run cap:build:android # Build + sync to Android
```

For faster iteration (live reload):
```bash
# 1. Start Vite dev server
npm run dev

# 2. In capacitor.config.ts, uncomment the server.url line
#    and set it to your local IP (e.g. http://192.168.1.100:5173)

# 3. Sync and open
npx cap sync ios && npx cap open ios
```

## Notes

- `capacitor.config.ts` is already configured with splash screen, status bar, and keyboard settings
- Safe area insets are handled in TopAppBar and BottomNav via `env(safe-area-inset-*)`
- `viewport-fit=cover` is set in index.html for edge-to-edge display
- The app already uses HTTPS for Supabase calls, so no additional transport security config needed
