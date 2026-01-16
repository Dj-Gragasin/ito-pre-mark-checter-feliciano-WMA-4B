# ActiveCore Android APK (Capacitor + Gradle)

This project is an Ionic React (CRA) web app wrapped as a native Android app using Capacitor.

## Prereqs (Windows)

- Android Studio installed
- Android SDK installed (via Android Studio)
- JDK 17+ (Android Studio usually bundles one)

### Android SDK path (required for Gradle builds)

If you build from the command line, Gradle must know where your Android SDK is.

If you see this error:

```
SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable
or by setting the sdk.dir path in your project's local properties file at android/local.properties.
```

Do one of the following:

**Option A: Create `android/local.properties` (recommended)**

1. In Android Studio, find your SDK path:
  - Settings → Appearance & Behavior → System Settings → Android SDK
2. Create `android/local.properties` with:

```properties
sdk.dir=C:\\Users\\YOUR_USER\\AppData\\Local\\Android\\Sdk
```

Note: in `local.properties`, backslashes must be escaped (`\\`) or use forward slashes.

**Option B: Set an environment variable**

PowerShell (current terminal session):

```powershell
$env:ANDROID_SDK_ROOT = "C:\\Users\\YOUR_USER\\AppData\\Local\\Android\\Sdk"
```

## 1) Configure the backend URL

The app reads the backend base URL from `REACT_APP_API_URL` at build time.

- Render backend base URL should look like:
  - `https://YOUR-RENDER-SERVICE.onrender.com/api`

### Option A (recommended): create a local `.env.production.local`

Create a file named `.env.production.local` in the project root:

```dotenv
REACT_APP_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

### Option B: set an environment variable just for the build

PowerShell:

```powershell
$env:REACT_APP_API_URL = "https://YOUR-RENDER-SERVICE.onrender.com/api"
npm run build
```

## 2) Build web assets and sync to Android

```bash
npm run build
npx cap sync android
```

## 3) Build an APK

### Option A: Android Studio (easiest)

```bash
npx cap open android
```

Then in Android Studio:
- Build → Build Bundle(s) / APK(s) → Build APK(s)

### Option B: Command line (Gradle)

```bash
cd android
./gradlew assembleDebug
```

On Windows you can also run:

```powershell
cd android
./gradlew.bat assembleDebug
```

APK output:
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Notes

- Your Vercel admin website doesn’t need changes for APK support; rate limiting and proxy IP handling are configured on the backend (Render).
- If you test against a non-HTTPS backend, Android may block cleartext HTTP by default. Prefer HTTPS (Render provides this).
