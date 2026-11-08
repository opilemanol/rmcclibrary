# RMCC Church Library

RMCC Church Library is an offline-first web application packaged by the existing Android application. The Android app loads its bundled static assets through AndroidX `WebViewAssetLoader`; library reading, search, notes, bookmarks, progress, form drafts and report history do not require a network connection. The native Android layer retains Google Mobile Ads and supplies the share sheet for generated PDFs and text.

## Project layout

- `web/` — Next.js 15 static-export frontend, local JSON libraries, IndexedDB repositories, search and PDF services.
- `source/app/` — Android WebView host, native AdMob banner and native share integration.
- `web/public/data/` — nine bundled, replaceable content JSON files.

## Content status

The bundled libraries include available, substantive entries and 17 weekly, monthly, event-based and as-needed form templates. Demonstration and placeholder records are excluded; day- and week-based libraries are intentionally sparse, and the app reports when a selected date has no entry. Review all teaching material for church approval before production. Official donation details were not supplied, and no church banking details have been invented.

To update content, edit the corresponding JSON in `web/public/data/`. Keep each library's `libraryId`, `libraryName`, collection name, record IDs and required fields valid. The app validates library metadata and records at load time; run the tests after making updates.

## Build and run

Requirements: Node.js/npm and the Android SDK/JDK required by the Gradle wrapper.

```sh
cd web
npm ci
npm test
npm run lint
npm run build
```

For Android, install the web dependencies once, set `JAVA_HOME` to JDK 17 or 21, install Android SDK platform 36 and build-tools 35, then build from `source/`:

```sh
cd source
./gradlew :app:assembleDebug
```

The Android `preBuild` task runs the Next.js static export and copies its output into the app's bundled assets. The debug APK is written to `source/app/build/outputs/apk/debug/app-debug.apk`. Signing keys and release credentials are not required for a debug APK; configure signing outside source control for production distribution.

The debug APK uses Google's official AdMob test app, banner and interstitial IDs. Text/PDF sharing of library resources and reports first requests a native interstitial; if it is unavailable (including offline), sharing continues and the app informs the user. Release builds require the church's interstitial unit ID through `-PadmobReleaseInterstitialAdUnitId=...`; no production interstitial ID is assumed. Release signing must be configured with private credentials outside source control.

For browser development, run `cd web && npm run dev`. Other web checks are `npm run lint`, `npx tsc --noEmit`, and `npm test`. The installed service worker caches the app shell, static JavaScript/CSS, fonts and all nine JSON files for later offline browser use. The Android app loads from `appassets.androidplatform.net` through `WebViewAssetLoader`; it does not open a remote website.

This workspace's existing Android host is a native AndroidX WebView application rather than a Capacitor-generated project. Its existing AdMob SDK and native share integration were preserved and updated for bundled local assets. No remote Next.js server or API route is needed.

## Local data and privacy

User data is stored in the IndexedDB database `rmcc_church_library_db` on the device. It includes bookmarks, Jotter notes, reading history, course progress, form drafts, saved report history and programme-calendar settings. Forms and reports can be edited, deleted and shared as text or PDF; submitted data remains on the device and is never uploaded. The Privacy screen explains that the native Google Mobile Ads SDK may process information when ads load. Users can clear local app data from that screen.

## Native configuration

The Android app preserves the existing package identity so installed releases are not silently treated as a different app. The Java bridge accepts text sharing and bounded PDF data, writes generated PDFs to app cache and shares them through a `FileProvider`. Old temporary PDF files are cleaned up when they are over 24 hours old. Production ad units should be reviewed against current AdMob policies.

## JSON examples

A weekly record includes a stable ID and week number:

```json
{
  "id": "ss-001",
  "week": 1,
  "title": "Church-approved lesson title",
  "scripture": "Reference supplied by the church",
  "lessonContent": "Replace this text with approved lesson material.",
  "contentStatus": "placeholder"
}
```

Courses are dynamically listed from their `modules` arrays; add or remove a module in the appropriate course JSON without changing the app UI. Reports and forms are rendered from the form `fields` arrays and include a `cadence` such as `Weekly`, `Monthly` or `As needed`. Supported field types include text, textarea, number, telephone, email, date, month, select, radio, checkbox and signature. Keep field IDs stable to preserve saved draft values.

## Limitations before production

- The bundled content is capacity-complete and includes original samples for testing, but is not church-approved until RMCC source materials are provided.
- Official church logos and donation/banking details must be supplied by an authorized administrator.
- The Android APK was built and its bundled assets verified. A connected Android emulator/device was not available in this environment, so airplane-mode interaction and share-sheet behavior still require on-device QA.
