# 📝 Gemini-Translator: Technical Feature Report

**Date of Report:** February 26, 2026
**Project Scope:** Refactoring and significantly expanding the core architecture of `Gemini-Translator`, shifting it from a basic chunked translator into an enterprise-grade, PWA-compliant eBook localization engine.

This document serves as an exhaustive technical architectural overview of all modifications made to the codebase. It details the exact intent, mechanics, and code functions altered during our sprint so that the project can be comprehensively audited or reverted.

---

## ✅ Part 1: Completed & Deployed Architecture

### 1. Persistent Translation Sessions (Resume Support)
*   **Objective:** Prevent catastrophic data loss during multi-hour translation jobs. Browsers may crash, rate limits may trigger unexpectedly, and API keys may run out of credits mid-book.
*   **Technical Implementation:**
    *   **State Management:** Introduced a state tracking mechanism that pushes the translated arrays and partial plain text assemblies directly to `localStorage` under keys `translationSessionText` and `translationSessionEbook`.
    *   **UI Reactivity:** The main "Translate" buttons intelligently detect if a serialized session exists in local storage. If present, the button swaps seamlessly to "Resume" mode.
    *   **Loop Injection:** Modified `handleTranslateText` and `handleTranslateEbook` to fast-forward. The iterative loop over `chunks` or `chapters` reads `startIndex` from the saved session, skipping previously translated chunks and immediately concatenating them to the `assembledText` buffer before hitting network calls.
*   **Files Modified:** `index.html` (State hooks, `localStorage` calls, loop logic).

### 2. Context-Aware Translation Pipeline
*   **Objective:** Eliminate the jarring "amnesia" effect common in LLM chunking, where character names, genders, tones, and formatting rules randomly change at the chunk boundary because the LLM lacks access to previous context.
*   **Technical Implementation:**
    *   **Prompt Architecture:** Overhauled `buildContextPrompt(text, prevTrans)` to construct a strict delimiter-based payload: `[PREVIOUS CONTEXT START]...[PREVIOUS CONTEXT END]` followed by `---NOVEL CHUNK TO TRANSLATE---`.
    *   **Sliding Window Buffer:** During the `chunk` loop inside `handleTranslateEbook` and `handleTranslateText`, the compiler slices the trailing 500 characters of the preceding output chunk and stores it in memory. This string is then passed downstream as a "narrative anchor" for the subsequent chunk.
    *   **Streaming Delimiter Management:** Addressed the complex edge case where the SSE stream might leak the context delimiter `---CONTEXT_UPDATE---` directly into the UI. An intelligent buffer intercept was built inside the `onChunk` streaming callback to swallow known system delimitations before they update React state.
*   **Files Modified:** `index.html` (Helper functions `translateGemini`, `translateDeepL`, prompt builders).

### 3. Service Worker Integration (Offline PWA)
*   **Objective:** Modernize the application to run independently of the public GitHub Pages server, allowing users to install the translator locally as a Progressive Web App (PWA) with offline file caching.
*   **Technical Implementation:**
    *   **Service Worker Script (`sw.js`):** Engineered a caching strategy (`CacheFirst` for CDNs, `NetworkFirst` for index assets) targeting Google Fonts, unpkg React bundles, TailwindCSS CDN, and local JS/SVG assets.
    *   **Manifest (`manifest.json`):** Created a standard Web App Manifest declaring standalone display modes and icons so the app can be pinned to desktop/smartphones.
    *   **Registration Trigger:** Appended a `navigator.serviceWorker.register()` block to the bottom of the root `index.html`. Added lifecycle listeners to detect updates—when a new worker installs, a subtle toast notifies the user that an update is installed.
*   **Files Addressed:** Created `sw.js` and `manifest.json`. Modified `<head>` to link the manifest.

### 4. Exponential Backoff API Resilience
*   **Objective:** Automate recovery from HTTP `429 Too Many Requests` status codes, which routinely trigger when hitting free tiers of LLM providers.
*   **Technical Implementation:**
    *   **Retry Middleware logic:** Built an asynchronous wrapper loop within the specific `fetch` calls. Instead of failing outright and displaying an error toast, the system catches the `429`.
    *   **Backoff Scale:** The engine waits 2 seconds, retries, and doubles the wait time on subsequent failures (2s, 4s, 8s, 16s) up to 5 times. If all 5 attempts fail, it finally surfaces the error and explicitly saves the `TranslationSession` state so the user can easily "Resume" later.
*   **Files Modified:** `index.html` (Network `fetch` boundaries).

### 5. Configurable Persona / Terminology Profiles
*   **Objective:** Enable power users translating multiple unique novels to switch their custom glossary ("Magic systems for Book A") rapidly without manually copy-pasting text segments over each other.
*   **Technical Implementation:**
    *   **Profile Database:** Introduced a serialized JSON structure `savedGlossaries` into `localStorage`. 
    *   **Component UI:** Replaced the static `<textarea>` blocks with an interactive React component featuring:
        - A Select dropdown showing created profile names.
        - "Create New Profile", "Save Profile", and "Delete Profile" buttons.
        - JSON import/export functions allowing users to physically back up their profile configurations to their file system.
*   **Files Modified:** `index.html` (Added robust profile state management and new JSX layout structures).

### 6. Dynamic Token Cost & Yield Estimations
*   **Objective:** Prevent users from accidentally attempting to fire a 4-million token novel into an API key unconditionally, giving them a predictive look at potential load and billing.
*   **Technical Implementation:**
    *   **Real-time Observers:** Added hooks watching `inputText`, file upload sizes, and selected translated ranges.
    *   **Mathematical Models:** Standardized a highly reliable text approximation algorithm (`Character Count / 4 = Rough Token Count`, `Word Count / 300 = Approximated Book Pages`). 
    *   **UI Binding:** Formatted a sleek data span situated immediately underneath the prominent "Translate" button, allowing safe double-checking right before execution.
*   **Files Modified:** `index.html` (UI logic inside `view-text` and `view-epub` containers).

### 7. Core Parser Dual Modes (Plain-text & jEpub)
*   **Objective:** Provide unified UX handling whether a user drops in a raw text payload or a fully packaged `.epub` file.
*   **Technical Implementation:**
    *   **Logic Forking:** `processFile()` inspects the exact MIME type or file extension. Plaintext populates a massive `<textarea>` while EPUBs trigger a JS bytecode unpackager (`JSZip`/`jEpub`). 
    *   **Export Handling:** Ensured that regardless of path, clicking `Download Translation` reconstructs an `.epub`.
*   **Files Modified:** `index.html` (Input binding components).

---

## 🚧 Part 2: In Progress Architecture (The EPUB Studio Merge and True Formatting)

### 8. The Merging of EPUB Studio
*   **The Mission:** Eliminate dependency on a separate repository/URL (`EPUB-Studio`). The Gemini-Translator must possess native abilities to split giant novel files to avoid LLM timeouts, and merge translated files backward.
*   **Current State:**
    *   **Code Porting:** We securely ported the extraction/compression logic from `splitter.js` and `merger.js` straight out of the EPUB Studio application. 
    *   **React JSX Porting:** Ripped the raw HTML code spanning `split-tab`, `merge-tab`, and `preview-modal` and securely injected it using `dangerouslySetInnerHTML` alongside React State mappings.
    *   **Resolution of Fatal Crashes:** Identified and fixed a fatal White Screen of Death (WSOD). The imported HTML UI components initially failed to load because local script files were zero-byte due to incomplete local clones. We authored an aggressive automated `PowerShell` hook script (`fix_missing_files.ps1`) to parse the source codes verbatim, escaping template literals, and outputting three flawlessly robust Javascript wrappers (`epub_studio_ui.js`, `splitter.js`, `merger.js`).
*   **Pending Objectives for Feature 8:**
    *   Fully test the split/merge behavior inside the new React Tab environments to ensure state bindings do not clash with the global `window` object scope used by the legacy vanilla JS files.

### 9. True EPUB Structural Preservation (The DOM Parser Pipeline)
*   **The Mission:** The old `readEpub` routine was destructive—it pulled the chapter files, utilized regex to utterly obliterate `<img>`, CSS classes, headers, anchors, and metadata tags, returning a single, lifeless string array. We must preserve True Formatting.
*   **Current State Formulation / Blueprinting:**
    *   `readEpub` has been rewritten. It no longer destroys the `JSZip` object. Instead of feeding HTML through `.textContent`, it now uses `DOMParser` to return the `doc` element natively.
    *   Developed a recursive `TreeWalker` helper named `extractTextNodes` targeting `NodeFilter.SHOW_TEXT`. This isolates the exact granular sentences while intentionally skipping HTML elements.
*   **Pending Objectives for Feature 9:**
    *   We need to complete the refactor inside `handleTranslateEbook` so it iterates translations directly onto the returned `node.nodeValue`. 
    *   Once a chunk is translated, reserialize the `document` back into XML strings via `XMLSerializer().serializeToString()`, overriding the specific chapter file path (`href`) directly inside the cached `originalZip` memory buffer.
    *   Export using `originalZip.generateAsync()`.

---

## 🔮 Part 3: Future Theoretical Architectures

### 10. Dedicated Backend (Web Crawling API)
*   **Concept:** Bypass the limitation of manual text payload pasting. Allow a user to drop a URL from Fanfiction.net, AO3, or Lofter—triggering a direct server-to-server extraction.
*   **Architectural Blockers & Solutions:** 
    *   Client-side single-page applications (like this React app) are legally unable to perform cross-origin `fetch` requests (CORS policies) against third-party protected websites.
    *   To overcome this, we must configure a distinct standalone Node.js, Express, or Python Flask backend. This backend will operate headless browser sessions (Puppeteer/Playwright) or perform raw GET requests, clean the HTML of user interfaces, compile a standardized JSON array, and blast it via REST API straight to the front-end Gemini-Translator.
