window.initAppJs = function () {
    const container = document.getElementById('export-history-panel')?.parentElement;
    if (!container || container.getAttribute('data-app-init') === 'true') return;
    container.setAttribute('data-app-init', 'true');
    // --- Dark Mode Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const iconSun = document.getElementById('icon-sun');
    const iconMoon = document.getElementById('icon-moon');

    /* Theme logic is now handled by React in index.html to avoid conflicts
    function applyTheme(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark');
            iconMoon?.classList.add('hidden');
            iconSun?.classList.remove('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            iconSun?.classList.add('hidden');
            iconMoon?.classList.remove('hidden');
        }
    }

    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        applyTheme(true);
    } else {
        applyTheme(false);
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!('theme' in localStorage)) {
            applyTheme(e.matches);
        }
    });

    themeToggleBtn?.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        if (document.documentElement.classList.contains('dark')) {
            localStorage.theme = 'dark';
            iconMoon?.classList.add('hidden');
            iconSun?.classList.remove('hidden');
        } else {
            localStorage.theme = 'light';
            iconSun?.classList.add('hidden');
            iconMoon?.classList.remove('hidden');
        }
    });
    */

    // --- Tab Logic ---
    const tabSplit = document.getElementById('tab-split');
    const tabMerge = document.getElementById('tab-merge');
    const viewSplit = document.getElementById('view-split');
    const viewMerge = document.getElementById('view-merge');

    tabSplit?.addEventListener('click', () => {
        if (tabSplit && tabMerge && viewSplit && viewMerge) {
            tabSplit.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400";
            tabMerge.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white";
            viewSplit.classList.remove('hidden');
            viewMerge.classList.add('hidden');
        }
    });

    tabMerge?.addEventListener('click', () => {
        if (tabSplit && tabMerge && viewSplit && viewMerge) {
            tabMerge.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400";
            tabSplit.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white";
            viewMerge.classList.remove('hidden');
            viewSplit.classList.add('hidden');
        }
    });

    // --- Shared Helpers ---
    function sanitizeFilename(str) {
        if (!str) return "Book";
        return str
            .replace(/[\/\\:*?"<>|]/g, "-")
            .replace(/[\s\u00A0]+/g, " ")
            .trim()
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .substring(0, 200);
    }

    function forceNewIdentifier(opfDoc) {
        const newUuid = "urn:uuid:" + crypto.randomUUID();
        const packageEl = opfDoc.querySelector("package");
        let uniqueIdRef = packageEl ? packageEl.getAttribute("unique-identifier") : null;
        let idNode = null;
        if (uniqueIdRef) idNode = opfDoc.querySelector(`dc\\:identifier[id="${uniqueIdRef}"]`);
        if (!idNode) idNode = opfDoc.querySelector("dc\\:identifier");
        if (idNode) {
            idNode.textContent = newUuid;
        } else {
            let metadata = opfDoc.querySelector("metadata");
            if (!metadata) {
                metadata = opfDoc.createElement("metadata");
                opfDoc.documentElement.prepend(metadata);
            }
            const newId = opfDoc.createElementNS("http://purl.org/dc/elements/1.1/", "dc:identifier");
            newId.setAttribute("id", "BookID");
            newId.textContent = newUuid;
            metadata.appendChild(newId);
            if (packageEl) packageEl.setAttribute("unique-identifier", "BookID");
        }
    }

    function setSmartTitle(opfDoc, fullTitle) {
        const titleNode = opfDoc.getElementsByTagName("dc:title")[0];
        if (titleNode) titleNode.textContent = fullTitle;
    }

    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        const colors = { info: 'bg-slate-800', success: 'bg-emerald-600', error: 'bg-red-600', warn: 'bg-amber-600' };
        toast.className = `px-6 py-4 rounded-xl text-white text-sm shadow-xl flex items-center gap-3 max-w-sm border border-white/10 ${colors[type]} transform translate-y-10 opacity-0 transition-all duration-300`;
        toast.innerHTML = `<span>${msg}</span>`;
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-4 right-4 z-50 space-y-2 flex flex-col items-end';
            document.body.appendChild(container);
        }
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function logMsg(msg) {
        const log = document.getElementById('status-log');
        const div = document.createElement('div');
        div.textContent = `> ${msg}`;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
    }

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', (e) => {
        // Ignore shortcuts when user is typing in an input/textarea
        const tag = document.activeElement.tagName.toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

        if (e.key === '?' && !isTyping) {
            e.preventDefault();
            document.getElementById('kbd-tooltip').classList.toggle('hidden');
            return;
        }

        if (!e.ctrlKey && !e.metaKey) return;

        if (e.key === '1') {
            e.preventDefault();
            document.getElementById('tab-split')?.click();
        } else if (e.key === '2') {
            e.preventDefault();
            document.getElementById('tab-merge')?.click();
        } else if (e.key === 'a' && !isTyping) {
            e.preventDefault();
            document.getElementById('btn-select-all')?.click();
        } else if (e.key === 'd' && !isTyping) {
            e.preventDefault();
            document.getElementById('btn-deselect-all')?.click();
        } else if (e.key === 's') {
            e.preventDefault();
            // Trigger the primary export action for the current visible view
            const viewSplit = document.getElementById('view-split');
            const splitVisible = viewSplit && !viewSplit.classList.contains('hidden');
            if (splitVisible) {
                document.getElementById('btn-export-custom')?.click();
            } else {
                document.getElementById('btn-execute-merge')?.click();
            }
        }
    });

    // --- Export History ---
    function getExportHistory() {
        try {
            return JSON.parse(localStorage.getItem('epub-studio-history') || '[]');
        } catch { return []; }
    }

    function saveExportHistory(history) {
        localStorage.setItem('epub-studio-history', JSON.stringify(history.slice(0, 50)));
    }

    function addExportEntry(title, type, chapterInfo) {
        const history = getExportHistory();
        history.unshift({
            title,
            type,
            chapterInfo,
            timestamp: new Date().toISOString()
        });
        saveExportHistory(history);
        renderExportHistory();
    }

    function renderExportHistory() {
        const container = document.getElementById('export-history-list');
        if (!container) return;
        const history = getExportHistory();
        if (history.length === 0) {
            container.innerHTML = '<p class="text-slate-400 py-2">No exports yet.</p>';
            return;
        }
        container.innerHTML = history.map(entry => {
            const date = new Date(entry.timestamp);
            const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const badge = entry.type === 'merge'
                ? '<span class="px-1.5 py-0.5 bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300 text-[10px] font-bold rounded">MERGE</span>'
                : '<span class="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold rounded">SPLIT</span>';
            return `<div class="flex items-center justify-between py-2 gap-3">
            <div class="flex items-center gap-2 min-w-0">
                ${badge}
                <span class="font-medium text-slate-700 dark:text-slate-300 truncate">${entry.title}</span>
            </div>
            <span class="text-slate-400 text-xs whitespace-nowrap">${dateStr}</span>
        </div>`;
        }).join('');
    }

    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
        localStorage.removeItem('epub-studio-history');
        renderExportHistory();
        // Use the global showToast from React if available, or the local one
        if (window.showToast) window.showToast('History cleared', 'info');
        else showToast('History cleared', 'info');
    });

    // Render history on page load
    renderExportHistory();

    // Expose shared helpers on window for splitter.js / merger.js
    window.sanitizeFilename = sanitizeFilename;
    window.forceNewIdentifier = forceNewIdentifier;
    window.setSmartTitle = setSmartTitle;
    window.showToast = showToast;
    window.logMsg = logMsg;
    window.addExportEntry = addExportEntry;

    window.appJsLoaded = true;
}; // End initAppJs
