# Nova Camera

A Samsung OneUI-style camera app built with Expo (React Native).

## Features

- Full-screen camera viewfinder
- Flash toggle (off / on / auto)
- Zoom levels: .5× · 1× · 3× · 5×
- Mode selector: NIGHT · PHOTO · VIDEO · MORE
- Flip front/back camera
- Gallery thumbnail (saves to photo library)
- **Settings screen (OneUI-style):**
  - Intelligent features: Scene optimizer, Shot suggestions, Scan QR codes
  - Pictures: Aspect ratio, Resolution, High efficiency (HEIF)
  - Videos: Resolution, Stabilization, HEVC (H.265)
  - General: **Watermark toggle**, **Scan documents toggle**, Grid lines, Location tags, Shooting sounds, Storage location
  - Reset settings

## APK Toolchain

This repo ships with the `apk-toolchain/` directory:

```
apk-toolchain/
  apksig.jar          — Google's APK signing library v8.3.2
  SignApk.java        — Custom align + v1/v2/v3 signer
  classes/            — Compiled SignApk class
  nova_debug.jks      — Debug keystore (alias=androiddebugkey, pass=android)
  uber-apk-signer-1.3.0.jar — One-step zipalign + sign alternative
  download_apk.py     — Download APKs via APKPure CDN (Cloudflare-safe)
```

### Patch & Sign an APK

```bash
# Decompile
apktool d input.apk -o decompiled -f

# Edit smali / resources...

# Recompile
apktool b decompiled -o rebuilt.apk

# Sign (simple, one step)
java -jar apk-toolchain/uber-apk-signer-1.3.0.jar -a rebuilt.apk \
  --ks apk-toolchain/nova_debug.jks --ksAlias androiddebugkey \
  --ksKeyPass android --ksPass android --allowResign -o out/
```

### Download an APK (Cloudflare-safe)

```bash
python3 apk-toolchain/download_apk.py com.google.android.youtube
```

## Running the Expo App

```bash
pnpm install
pnpm --filter @workspace/camera-app run dev
```

Scan the QR code with **Expo Go** on your phone to preview.

## Building a Release APK

Use [Replit Expo Launch](https://docs.replit.com) (click **Publish** in the Replit UI) to build and submit to the App Store, or use EAS CLI for Android:

```bash
npx eas build --platform android --profile preview
```

## Stack

- Expo SDK 54 / React Native 0.81
- expo-camera · expo-media-library · expo-haptics
- expo-router (file-based navigation)
- @expo/vector-icons (Ionicons, MaterialIcons, MaterialCommunityIcons)
- react-native-reanimated
