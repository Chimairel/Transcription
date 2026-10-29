# Transcription listening desk

A frontend-only editor for local audio/video and TXT files. No backend, database service, account, upload or subscription is required by the app.

## Use it

1. Open a recording from your laptop. There is no two-hour duration cutoff; playback depends on the browser's codec support.
2. For the two included Affogato sessions, use **Load matching draft** after opening the corresponding recording. You can also **Download TXT** or use **Open TXT** for another file. Review the replacement prompt first. Initial drafts still require listening and speaker review.
3. Listen and edit. Text saves to IndexedDB in this browser. Audio stays in the selected local file and is not uploaded or copied into browser storage.
4. Export TXT to share the result. The export uses the recording's original basename.

After reloading, the text is restored; re-open the same recording to listen. Keep TXT backups. Clearing browser data removes browser-only drafts. Another computer/browser does not share these saves. Each helper needs their assigned recording and draft TXT sent separately. This app does not automatically transcribe recordings.

**Playback:** Alt+J / Delete rewinds five seconds; Alt+K / End toggles play/pause; Alt+L / Page Down advances five seconds. These work while typing. Search dialogs and native form controls retain their normal behavior.

**Writing:** Shift+Enter starts a speaker label. Type 1–10, o, or o1–o10 and press Space/Tab to complete it. Ctrl+F opens Find and replace. Spelling checks include conservative English hints and reviewed local spelling/affix autocorrection with undo. Suggestions need human judgment.

Common reusable spelling rules are bundled with the editor. The user explicitly authorized publishing the Day 1 and Day 2 morning initial TXT drafts in `public/drafts` as guides. These drafts are public, unchanged starting versions; later browser edits are not uploaded. Other actual transcripts, recordings, private word-library personal-name references, previous recording evidence and project coordination history are excluded. The public rule bundle is a snapshot, not a live connection to a private workspace.

## Develop

```sh
npm ci
npm run dev
npm run build
```

## Deploy manually to Vercel

Import this repository in Vercel. Select **Vite**, build command **npm run build**, output directory **dist**, and repository root **./**. No environment variables or server functions are needed. The Vercel account owner chooses a plan appropriate for their use.

Publish application source and the two explicitly authorized starter drafts only. Never commit recordings, other transcript TXT, browser data, tokens or local environment files. Vercel serves the editor and starter files, not synchronized user edits.

The Vercel install command is `npm ci --include=dev`. The lockfile must contain registry packages, never links to another checkout's node_modules. Validate deployment changes in a clean source copy with a fresh install; an existing local dependency directory can hide an invalid lockfile.

## Verification

`scripts/verify.mjs` is a local development browser test using synthetic files only. It requires a running dev server at port 4176 and Playwright installed in the development environment. It covers import/export, browser restoration, audio navigation, speaker shortcuts, autocorrection, stale-tab protection and responsive layout. Generated screenshots/reports stay in ignored `outputs/`.
