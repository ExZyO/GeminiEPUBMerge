window.initSplitterJs = function () {
    const container = document.getElementById('view-split');
    if (!container || container.dataset.init === 'true') return;
    container.dataset.init = 'true';
    let splitMasterZip = null;
    let splitOpfPath = "";
    let splitOpfDir = "";
    let splitOpfDoc = null;
    let allItems = [];
    let spineItems = [];
    let storyChapters = [];
    let frontMatter = [];
    let baseBookTitle = "Unknown Title";

    let splitCustomCoverFile = null;
    const splitCoverInput = document.getElementById('split-cover-input');
    const btnSplitCover = document.getElementById('btn-split-cover');
    const btnRemoveSplitCover = document.getElementById('btn-remove-split-cover');
    const splitCoverPreview = document.getElementById('split-cover-preview');
    const splitTitleInput = document.getElementById('split-title-input');

    btnSplitCover?.addEventListener('click', () => splitCoverInput?.click());
    splitCoverPreview?.addEventListener('click', () => splitCoverInput?.click());

    splitCoverInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            splitCustomCoverFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                splitCoverPreview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
                btnRemoveSplitCover.classList.remove('hidden');
            };
            reader.readAsDataURL(splitCustomCoverFile);
        }
    });

    btnRemoveSplitCover?.addEventListener('click', () => {
        splitCustomCoverFile = null;
        splitCoverInput.value = '';
        splitCoverPreview.innerHTML = `<span class="text-xs text-slate-400 text-center px-2">Current<br>Cover</span>`;
        btnRemoveSplitCover.classList.add('hidden');
    });

    // Added target checks to prevent click bubbling




    window.processSplitFile = async function processSplitFile(file) {
        // Show loading progress for large files
        const loadingWrapper = document.getElementById('loading-progress-wrapper');
        const loadingBar = document.getElementById('loading-progress-bar');
        const loadingPercent = document.getElementById('loading-progress-percent');
        const loadingStatus = document.getElementById('loading-progress-status');

        // Memory pressure warning for very large files
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (file.size > 500 * 1024 * 1024) {
            showToast(`⚠️ Large file detected (${fileSizeMB}MB). Processing may use significant RAM.`, 'warn');
        }

        if (loadingWrapper) {
            loadingWrapper.classList.remove('hidden');
            loadingStatus.textContent = `Loading ${fileSizeMB}MB EPUB...`;
        }

        document.getElementById('editor-section').classList.add('hidden');

        const logEl = document.getElementById('status-log');
        logEl.innerHTML = '<div class="text-indigo-400">> System ready. Unpacking EPUB...</div>';

        try {
            splitMasterZip = await new JSZip().loadAsync(file, {
                // JSZip doesn't natively support loadAsync progress, so we use a wrapper
            });

            const containerXml = await splitMasterZip.file("META-INF/container.xml").async("text");
            const parser = new DOMParser();
            splitOpfPath = parser.parseFromString(containerXml, "text/xml").querySelector("rootfile").getAttribute("full-path");
            splitOpfDir = splitOpfPath.includes("/") ? splitOpfPath.substring(0, splitOpfPath.lastIndexOf('/') + 1) : "";

            const opfText = await splitMasterZip.file(splitOpfPath).async("text");
            splitOpfDoc = parser.parseFromString(opfText, "text/xml");

            // Set dynamic title input
            const titleNode = splitOpfDoc.getElementsByTagName("dc:title")[0];
            if (titleNode) baseBookTitle = titleNode.textContent;
            splitTitleInput.value = baseBookTitle;

            try {
                let coverItem = splitOpfDoc.querySelector('item[properties~="cover-image"]');
                if (!coverItem) {
                    const metaCover = splitOpfDoc.querySelector('meta[name="cover"]');
                    if (metaCover) {
                        const coverId = metaCover.getAttribute("content");
                        coverItem = splitOpfDoc.querySelector(`item[id="${coverId}"]`);
                    }
                }
                if (!coverItem) {
                    coverItem = Array.from(splitOpfDoc.querySelectorAll('item[media-type^="image"]')).find(item => {
                        const h = (item.getAttribute('href') || '').toLowerCase();
                        const id = (item.getAttribute('id') || '').toLowerCase();
                        return h.includes('cover') || id.includes('cover');
                    });
                }

                if (coverItem) {
                    let coverHref = coverItem.getAttribute("href");
                    if (coverHref.startsWith('../')) coverHref = coverHref.replace('../', '');
                    const fullCoverPath = splitOpfDir + coverHref;
                    const coverFile = splitMasterZip.file(fullCoverPath);
                    if (coverFile) {
                        const coverBlob = await coverFile.async("blob"); // Use blob instead of base64
                        const blobUrl = URL.createObjectURL(coverBlob);
                        splitCoverPreview.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover">`;

                    }
                }
            } catch (e) {
                console.log("Cover preview fallback used or no cover found.");
            }

            allItems = Array.from(splitOpfDoc.querySelectorAll("manifest > item")).map(el => ({
                id: el.getAttribute("id"),
                href: el.getAttribute("href"),
                mediaType: el.getAttribute("media-type")
            }));

            const spineNodes = Array.from(splitOpfDoc.querySelectorAll("spine > itemref"));
            spineItems = spineNodes.map(el => el.getAttribute("idref"));

            storyChapters = [];
            frontMatter = [];

            spineItems.forEach((idref, index) => {
                const item = allItems.find(i => i.id === idref);
                if (!item) return;

                const textCheck = (item.href + idref).toLowerCase();
                // Narrower front matter detection: only duplicate the bare essentials (cover/title-page)
                // AND only if they appear in the first 10 items of the book (to prevent duplicating late-book "titles")
                const isFrontMatter = index < 10 && /cover|title[-_]?page/.test(textCheck);

                if (isFrontMatter) {
                    frontMatter.push({ idref, item, index, originalName: item.href });
                } else {
                    storyChapters.push({ idref, item, index, originalName: item.href, displayIndex: storyChapters.length + 1 });
                }
            });

            if (frontMatter.length > 0) {
                logMsg(`Detected ${frontMatter.length} frontmatter items: [${frontMatter.map(f => f.originalName).join(', ')}]`);
            }

            document.getElementById('chapter-count').textContent = `${storyChapters.length} story chapters detected`;

            // Compute word count + file size for each chapter
            for (let chap of storyChapters) {
                const fullPath = splitOpfDir + chap.originalName;
                const f = splitMasterZip.files[fullPath];
                chap.fileSize = 0;
                chap.wordCount = 0;
                if (f) {
                    if (f._data && f._data.uncompressedSize) chap.fileSize = f._data.uncompressedSize;
                    try {
                        const txt = await f.async('text');
                        const stripped = txt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                        chap.wordCount = stripped.split(' ').filter(w => w.length > 0).length;
                    } catch (e) { /* skip */ }
                }
            }

            const listEl = document.getElementById('chapter-list');
            listEl.innerHTML = '';
            storyChapters.forEach(chap => {
                const sizeStr = chap.fileSize > 1024 ? `${(chap.fileSize / 1024).toFixed(0)}KB` : `${chap.fileSize}B`;
                const wcStr = chap.wordCount > 0 ? `${(chap.wordCount / 1000).toFixed(1)}k words` : '';
                const div = document.createElement('div');
                div.className = "flex items-start gap-3 py-2 chap-row";
                div.setAttribute('data-idref', chap.idref);
                div.innerHTML = `
                <input type="checkbox" id="chk-${chap.idref}" value="${chap.idref}" class="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer chap-checkbox" checked>
                <label for="chk-${chap.idref}" class="flex-1 cursor-pointer">
                    <span class="font-bold text-slate-700 dark:text-slate-300">#${chap.displayIndex}</span>
                    <span class="chap-name text-slate-500 dark:text-slate-400 ml-1 break-all whitespace-normal" data-idref="${chap.idref}" title="Double-click to rename, click to preview">${chap.customName || chap.originalName}</span>
                    <span class="text-[10px] text-slate-400 ml-1">${sizeStr}${wcStr ? ' · ' + wcStr : ''}</span>
                </label>
            `;
                // Click chapter name to preview
                const nameSpan = div.querySelector('.chap-name');
                nameSpan.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const fullPath = splitOpfDir + chap.originalName;
                    const f = splitMasterZip.files[fullPath];
                    if (!f) return;
                    try {
                        const html = await f.async('text');
                        const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                        const preview = stripped.substring(0, 2000) + (stripped.length > 2000 ? '...' : '');
                        document.getElementById('preview-modal-title').textContent = `#${chap.displayIndex} — ${chap.customName || chap.originalName}`;
                        document.getElementById('preview-modal-body').textContent = preview;
                        document.getElementById('chapter-preview-modal').classList.remove('hidden');
                    } catch (err) { showToast('Cannot preview', 'error'); }
                });
                // Double-click to rename chapter
                nameSpan.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = chap.customName || chap.originalName;
                    input.className = 'w-full bg-white dark:bg-slate-800 border border-indigo-400 rounded px-2 py-0.5 text-sm font-medium text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500';
                    nameSpan.replaceWith(input);
                    input.focus();
                    input.select();
                    const finishRename = () => {
                        const newName = input.value.trim();
                        if (newName) chap.customName = newName;
                        const newSpan = document.createElement('span');
                        newSpan.className = 'chap-name text-slate-500 dark:text-slate-400 ml-1 break-all whitespace-normal';
                        newSpan.setAttribute('data-idref', chap.idref);
                        newSpan.setAttribute('title', 'Double-click to rename, click to preview');
                        newSpan.textContent = chap.customName || chap.originalName;
                        input.replaceWith(newSpan);
                    };
                    input.addEventListener('blur', finishRename);
                    input.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') input.blur();
                        if (ev.key === 'Escape') { input.value = chap.customName || chap.originalName; input.blur(); }
                    });
                });
                listEl.appendChild(div);
            });

            const updateCount = () => {
                document.getElementById('preview-count').textContent = `${document.querySelectorAll('.chap-checkbox:checked').length} selected`;
            };
            document.querySelectorAll('.chap-checkbox').forEach(cb => cb.addEventListener('change', updateCount));
            updateCount();

            // Populate metadata viewer
            try {
                const mc = document.getElementById('metadata-content');
                const mv = document.getElementById('metadata-viewer');
                if (mc && mv) {
                    const getTag = (tag) => { const el = splitOpfDoc.getElementsByTagName(tag)[0]; return el ? el.textContent : '—'; };
                    const descEl = splitOpfDoc.getElementsByTagName('dc:description')[0];
                    const desc = descEl ? descEl.textContent.substring(0, 200) : '—';
                    mc.innerHTML = `
                    <div><span class="text-slate-500">Author:</span> <span class="font-medium text-white">${getTag('dc:creator')}</span></div>
                    <div><span class="text-slate-500">Publisher:</span> <span class="font-medium text-white">${getTag('dc:publisher')}</span></div>
                    <div><span class="text-slate-500">Language:</span> <span class="font-medium text-white">${getTag('dc:language')}</span></div>
                    <div><span class="text-slate-500">Date:</span> <span class="font-medium text-white">${getTag('dc:date')}</span></div>
                    <div class="col-span-2 sm:col-span-4"><span class="text-slate-500">Description:</span> <span class="font-medium text-white">${desc}</span></div>
                `;
                    mv.classList.remove('hidden');
                }
            } catch (e) { /* no metadata */ }

            document.getElementById('btn-toggle-metadata')?.addEventListener('click', () => {
                document.getElementById('metadata-viewer').classList.add('hidden');
            });
            document.getElementById('btn-show-metadata')?.addEventListener('click', () => {
                document.getElementById('metadata-viewer').classList.toggle('hidden');
            });

            logMsg("EPUB Loaded and parsed successfully.");
            logMsg(`File size: ${fileSizeMB}MB | ${storyChapters.length} chapters`);

            // Hide loading, show editor
            if (loadingWrapper) loadingWrapper.classList.add('hidden');
            document.getElementById('upload-section').classList.add('hidden');
            document.getElementById('editor-section').classList.remove('hidden');

            // Calculate and display estimated output size
            updateEstimatedSize();

        } catch (err) {
            console.error(err);
            if (loadingWrapper) loadingWrapper.classList.add('hidden');
            showToast("Failed to parse EPUB.", "error");
        }
    }

    document.getElementById('btn-reset')?.addEventListener('click', () => {
        splitMasterZip = null;
        splitOpfPath = "";
        splitOpfDir = "";
        splitOpfDoc = null;
        allItems = [];
        spineItems = [];
        storyChapters = [];
        frontMatter = [];
        document.getElementById('editor-section').classList.add('hidden');
        document.getElementById('upload-section').classList.remove('hidden');
        document.getElementById('metadata-viewer').classList.add('hidden');
        const epubInput = document.getElementById('epub-input');
        if (epubInput) epubInput.value = '';
    });

    async function executeSplit(selectedIdrefs, rangeSuffix) {
        logMsg(`Starting export...`);
        const btnCustom = document.getElementById('btn-export-custom');
        btnCustom.disabled = true;

        try {
            const newZip = new JSZip();
            newZip.file("mimetype", "application/epub+zip", { compression: "STORE" });

            const allowedIdrefs = new Set([...frontMatter.map(f => f.idref), ...selectedIdrefs]);
            const allowedHrefs = new Set();

            allItems.forEach(item => {
                if (allowedIdrefs.has(item.id)) allowedHrefs.add(item.href);
                else if (!item.mediaType.includes('html')) allowedHrefs.add(item.href);
            });

            // If "Keep Only Text" is checked, strip non-HTML assets
            const keepOnlyText = document.getElementById('keep-only-text')?.checked;

            for (let path in splitMasterZip.files) {
                if (path === "mimetype" || splitMasterZip.files[path].dir) continue;
                let shouldInclude = true;
                if (path.endsWith('.html') || path.endsWith('.xhtml')) {
                    shouldInclude = false;
                    for (let href of allowedHrefs) {
                        if (path.endsWith(href)) { shouldInclude = true; break; }
                    }
                }
                // Strip images, fonts, CSS if keepOnlyText
                if (keepOnlyText && shouldInclude) {
                    const lp = path.toLowerCase();
                    if (lp.endsWith('.jpg') || lp.endsWith('.jpeg') || lp.endsWith('.png') || lp.endsWith('.gif') || lp.endsWith('.webp') || lp.endsWith('.svg')) shouldInclude = false;
                    if (lp.endsWith('.ttf') || lp.endsWith('.otf') || lp.endsWith('.woff') || lp.endsWith('.woff2')) shouldInclude = false;
                    if (lp.endsWith('.css')) shouldInclude = false;
                }
                if (shouldInclude || path.includes("META-INF") || path.endsWith(".opf") || path.endsWith(".ncx")) {
                    newZip.file(path, await splitMasterZip.files[path].async("arraybuffer"));
                }
            }

            const newOpfDoc = splitOpfDoc.cloneNode(true);
            const spine = newOpfDoc.querySelector("spine");
            const manifest = newOpfDoc.querySelector("manifest");

            Array.from(spine.querySelectorAll("itemref")).forEach(ref => {
                if (!allowedIdrefs.has(ref.getAttribute("idref"))) spine.removeChild(ref);
            });

            Array.from(manifest.querySelectorAll("item")).forEach(item => {
                if (item.getAttribute("media-type").includes("html") && !allowedIdrefs.has(item.getAttribute("id"))) {
                    manifest.removeChild(item);
                }
            });

            let currentTitle = splitTitleInput.value.trim() || baseBookTitle;
            let finalTitle, finalDisplayName;

            if (rangeSuffix === "Custom Extract") {
                finalTitle = currentTitle;
                finalDisplayName = finalTitle;
            } else {
                finalTitle = `${currentTitle} (${rangeSuffix})`;
                finalDisplayName = finalTitle;
            }

            setSmartTitle(newOpfDoc, finalTitle);
            forceNewIdentifier(newOpfDoc);

            if (splitCustomCoverFile) {
                try {
                    logMsg("Applying custom cover...");
                    const coverExt = splitCustomCoverFile.name.split('.').pop().toLowerCase();
                    const coverMime = coverExt === 'png' ? 'image/png' : 'image/jpeg';
                    const coverData = await splitCustomCoverFile.arrayBuffer();

                    let coverItem = newOpfDoc.querySelector('item[properties~="cover-image"]');
                    if (!coverItem) {
                        const metaCover = newOpfDoc.querySelector('meta[name="cover"]');
                        if (metaCover) {
                            const coverId = metaCover.getAttribute("content");
                            coverItem = newOpfDoc.querySelector(`item[id="${coverId}"]`);
                        }
                    }
                    if (coverItem) {
                        const existingHref = coverItem.getAttribute("href");
                        newZip.file(splitOpfDir + existingHref, coverData);
                        coverItem.setAttribute("media-type", coverMime);
                    } else {
                        const newCoverHref = `custom_cover_${Date.now()}.${coverExt}`;
                        const newCoverId = `custom_cover_id`;
                        newZip.file(splitOpfDir + newCoverHref, coverData);
                        const newItem = newOpfDoc.createElement("item");
                        newItem.setAttribute("id", newCoverId);
                        newItem.setAttribute("href", newCoverHref);
                        newItem.setAttribute("media-type", coverMime);
                        newItem.setAttribute("properties", "cover-image");
                        manifest.appendChild(newItem);
                        let metadata = newOpfDoc.querySelector("metadata");
                        if (metadata) {
                            const meta = newOpfDoc.createElement("meta");
                            meta.setAttribute("name", "cover");
                            meta.setAttribute("content", newCoverId);
                            metadata.appendChild(meta);
                        }
                    }
                } catch (e) { console.error("Failed to apply cover:", e); }
            }

            newZip.file(splitOpfPath, new XMLSerializer().serializeToString(newOpfDoc));

            // CSS Theme Injection
            const cssTheme = document.getElementById('css-theme-inject')?.value;
            if (cssTheme && cssTheme !== 'none') {
                const themeCSS = {
                    dark: 'body{background:#1a1a2e!important;color:#e0e0e0!important}a{color:#8ab4f8!important}img{opacity:0.85}',
                    sepia: 'body{background:#f4ecd8!important;color:#5b4636!important;font-family:Georgia,serif!important}a{color:#8b4513!important}',
                    large: 'body{font-size:1.4em!important;line-height:1.8!important}'
                }[cssTheme];
                if (themeCSS) {
                    const themeFileName = splitOpfDir + 'epub_studio_theme.css';
                    newZip.file(themeFileName, themeCSS);
                    // Inject link into every XHTML file
                    for (let path in newZip.files) {
                        if (path.endsWith('.xhtml') || path.endsWith('.html')) {
                            try {
                                let content = await newZip.file(path).async('text');
                                const relPath = 'epub_studio_theme.css';
                                if (!content.includes('epub_studio_theme.css')) {
                                    content = content.replace('</head>', `<link rel="stylesheet" type="text/css" href="${relPath}"/></head>`);
                                    newZip.file(path, content);
                                }
                            } catch (e) { /* skip */ }
                        }
                    }
                    // Add to manifest
                    const themeItem = newOpfDoc.createElement('item');
                    themeItem.setAttribute('id', 'epub-studio-theme-css');
                    themeItem.setAttribute('href', 'epub_studio_theme.css');
                    themeItem.setAttribute('media-type', 'text/css');
                    manifest.appendChild(themeItem);
                    newZip.file(splitOpfPath, new XMLSerializer().serializeToString(newOpfDoc));
                    logMsg(`Applied ${cssTheme} reading theme.`);
                }
            }

            logMsg(`Compressing & Zipping...`);

            let blob = await newZip.generateAsync(
                { type: "blob", compression: "DEFLATE", mimeType: "application/epub+zip" },
                function updateCallback(metadata) {
                    const pWrapper = document.getElementById('split-progress-wrapper');
                    const pBar = document.getElementById('split-progress-bar');
                    const pPercent = document.getElementById('split-progress-percent');
                    if (pWrapper) pWrapper.classList.remove('hidden');
                    if (pBar) pBar.style.width = metadata.percent.toFixed(0) + '%';
                    if (pPercent) pPercent.textContent = metadata.percent.toFixed(0) + '%';
                }
            );

            // Store for share button
            lastExportBlob = blob;

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sanitizeFilename(finalDisplayName)}.epub`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            logMsg(`Success.`);
            showToast(`Exported`, "success");
            addExportEntry(finalDisplayName, 'split', rangeSuffix);

            // Quick EPUB Validation
            try {
                logMsg('Running validation...');
                const valZip = await new JSZip().loadAsync(blob);
                const valIssues = [];
                if (!valZip.file('mimetype')) valIssues.push('Missing mimetype file');
                if (!valZip.file('META-INF/container.xml')) valIssues.push('Missing container.xml');
                const valContainer = valZip.file('META-INF/container.xml');
                if (valContainer) {
                    const vcXml = await valContainer.async('text');
                    const vcDoc = new DOMParser().parseFromString(vcXml, 'text/xml');
                    const opfRef = vcDoc.querySelector('rootfile');
                    if (opfRef) {
                        const opfP = opfRef.getAttribute('full-path');
                        if (!valZip.file(opfP)) valIssues.push(`Missing OPF: ${opfP}`);
                        else {
                            const opfXml = await valZip.file(opfP).async('text');
                            const opfD = new DOMParser().parseFromString(opfXml, 'text/xml');
                            const spineRefs = Array.from(opfD.querySelectorAll('spine > itemref')).map(r => r.getAttribute('idref'));
                            const manifestIds = new Set(Array.from(opfD.querySelectorAll('manifest > item')).map(i => i.getAttribute('id')));
                            spineRefs.forEach(id => { if (!manifestIds.has(id)) valIssues.push(`Spine ref '${id}' missing from manifest`); });
                        }
                    }
                }
                if (valIssues.length === 0) {
                    logMsg('\u2705 Validation passed. EPUB looks healthy!');
                } else {
                    valIssues.forEach(issue => logMsg(`\u26a0\ufe0f ${issue}`));
                    showToast(`${valIssues.length} validation warning(s)`, 'warn');
                }
            } catch (valErr) {
                logMsg('Validation skipped: ' + valErr.message);
            }
        } catch (err) {
            console.error(err);
            showToast("Export failed!", "error");
        } finally {
            btnCustom.disabled = false;
            const pWrapper = document.getElementById('split-progress-wrapper');
            const pBar = document.getElementById('split-progress-bar');
            if (pWrapper) pWrapper.classList.add('hidden');
            if (pBar) pBar.style.width = '0%';
        }
    }

    document.getElementById('btn-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.chap-checkbox').forEach(cb => cb.checked = true);
        document.getElementById('preview-count').textContent = `${storyChapters.length} selected`;
    });

    document.getElementById('btn-deselect-all')?.addEventListener('click', () => {
        document.querySelectorAll('.chap-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('preview-count').textContent = `0 selected`;
    });

    document.getElementById('btn-export-custom')?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.chap-checkbox:checked')).map(cb => cb.value);
        if (selected.length === 0) return showToast("No chapters selected!", "warn");
        executeSplit(selected, "Custom Extract");
    });

    document.getElementById('btn-export-range')?.addEventListener('click', () => {
        const start = parseInt(document.getElementById('range-start').value);
        const end = parseInt(document.getElementById('range-end').value);
        if (!start || !end || start > end || start < 1 || end > storyChapters.length) return showToast("Invalid range.", "warn");
        const selected = storyChapters.slice(start - 1, end).map(c => c.idref);
        executeSplit(selected, `${start}-${end}`);
    });

    document.getElementById('btn-export-chunks')?.addEventListener('click', async () => {
        const mode = document.querySelector('input[name="split-mode"]:checked').value;

        if (mode === 'chapters') {
            const size = parseInt(document.getElementById('chunk-size').value);
            if (!size || size < 1) return showToast("Invalid chunk size.", "warn");

            for (let i = 0; i < storyChapters.length; i += size) {
                const chunk = storyChapters.slice(i, i + size);
                const start = chunk[0].displayIndex;
                const end = chunk[chunk.length - 1].displayIndex;
                const selected = chunk.map(c => c.idref);
                await executeSplit(selected, `${start}-${end}`);
            }
        } else {
            const targetMb = parseFloat(document.getElementById('chunk-size-mb').value);
            if (!targetMb || targetMb <= 0) return showToast("Invalid target size.", "warn");
            const targetBytes = targetMb * 1024 * 1024;

            showToast("Estimating split sizes...", "info");

            let baselineSize = 0;
            // Estimate baseline size (frontmatter + assets)
            for (let path in splitMasterZip.files) {
                if (path === "mimetype" || splitMasterZip.files[path].dir) continue;
                if (!path.endsWith('.html') && !path.endsWith('.xhtml')) {
                    const rawStats = splitMasterZip.files[path]._data; // uncompressed stats
                    // Assuming assets (images/fonts) compress less than text, apply a conservative factor
                    if (rawStats && rawStats.uncompressedSize) baselineSize += (rawStats.uncompressedSize / 1.5);
                }
            }
            baselineSize = Math.max(baselineSize, 100 * 1024); // Minimum floor for metadata/structure

            let chunks = [];
            let currentChunk = [];
            let currentSize = baselineSize;

            for (let i = 0; i < storyChapters.length; i++) {
                const chap = storyChapters[i];
                let chapSize = 0;
                const fullPath = splitOpfDir + chap.originalName;
                const fileObj = splitMasterZip.files[fullPath];
                if (fileObj && fileObj._data && fileObj._data.uncompressedSize) {
                    // Apply compression factor (text usually compresses ~2.5x to 4x)
                    chapSize = fileObj._data.uncompressedSize / 2.5;
                } else {
                    chapSize = 20 * 1024; // fallback 20kb
                }

                if (currentChunk.length > 0 && (currentSize + chapSize) > targetBytes) {
                    chunks.push(currentChunk);
                    currentChunk = [chap];
                    currentSize = baselineSize + chapSize;
                } else {
                    currentChunk.push(chap);
                    currentSize += chapSize;
                }
            }
            if (currentChunk.length > 0) chunks.push(currentChunk);

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const start = chunk[0].displayIndex;
                const end = chunk[chunk.length - 1].displayIndex;
                const selected = chunk.map(c => c.idref);
                await executeSplit(selected, `Part ${i + 1}`);
            }
        }
    });

    document.querySelectorAll('input[name="split-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'chapters') {
                document.getElementById('split-mode-chapters-wrapper').classList.remove('hidden');
                document.getElementById('split-mode-size-wrapper').classList.add('hidden');
            } else {
                document.getElementById('split-mode-chapters-wrapper').classList.add('hidden');
                document.getElementById('split-mode-size-wrapper').classList.remove('hidden');
            }
        });
    });



    // --- Chapter Search / Filter ---
    document.getElementById('chapter-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = document.querySelectorAll('#chapter-list > div');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? '' : 'none';
        });
    });

    // --- Batch Rename ---
    document.getElementById('btn-batch-rename')?.addEventListener('click', () => {
        const pattern = prompt(
            'Enter rename pattern.\n\nUse {n} for chapter number and {original} for original filename.\n\nExamples:\n  Chapter {n}\n  Ch. {n} - {original}',
            'Chapter {n}'
        );
        if (!pattern) return;

        storyChapters.forEach(chap => {
            chap.customName = pattern
                .replace('{n}', chap.displayIndex)
                .replace('{original}', chap.originalName);
        });

        document.querySelectorAll('#chapter-list .chap-name').forEach(span => {
            const idref = span.getAttribute('data-idref');
            const chap = storyChapters.find(c => c.idref === idref);
            if (chap) span.textContent = chap.customName || chap.originalName;
        });

        showToast(`Renamed ${storyChapters.length} chapters`, 'success');
    });

    // --- Estimated Output Size ---
    function updateEstimatedSize() {
        const sizeEl = document.getElementById('estimated-size');
        const sizeValEl = document.getElementById('estimated-size-value');
        if (!sizeEl || !sizeValEl || !splitMasterZip) return;

        const checked = Array.from(document.querySelectorAll('.chap-checkbox:checked')).map(cb => cb.value);
        if (checked.length === 0) {
            sizeEl.classList.add('hidden');
            return;
        }

        let totalBytes = 0;
        for (let path in splitMasterZip.files) {
            if (path === "mimetype" || splitMasterZip.files[path].dir) continue;
            if (!path.endsWith('.html') && !path.endsWith('.xhtml')) {
                const f = splitMasterZip.files[path];
                if (f._data && f._data.uncompressedSize) totalBytes += f._data.uncompressedSize;
            }
        }
        checked.forEach(idref => {
            const chap = storyChapters.find(c => c.idref === idref);
            if (!chap) return;
            const fullPath = splitOpfDir + chap.originalName;
            const f = splitMasterZip.files[fullPath];
            if (f && f._data && f._data.uncompressedSize) totalBytes += f._data.uncompressedSize;
            else totalBytes += 50 * 1024;
        });

        sizeValEl.textContent = (totalBytes / (1024 * 1024)).toFixed(1);
        sizeEl.classList.remove('hidden');
    }

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('chap-checkbox')) updateEstimatedSize();
    });

    // --- Export as Plain ZIP ---
    document.getElementById('btn-export-zip')?.addEventListener('click', async () => {
        if (!splitMasterZip || storyChapters.length === 0) return showToast('No EPUB loaded', 'warn');
        const checked = Array.from(document.querySelectorAll('.chap-checkbox:checked')).map(cb => cb.value);
        if (checked.length === 0) return showToast('Select chapters first', 'warn');

        logMsg('Exporting as plain ZIP...');
        const zip = new JSZip();

        for (const idref of checked) {
            const chap = storyChapters.find(c => c.idref === idref);
            if (!chap) continue;
            const fullPath = splitOpfDir + chap.originalName;
            const f = splitMasterZip.files[fullPath];
            if (f) {
                const name = chap.customName || chap.originalName;
                zip.file(name.endsWith('.xhtml') || name.endsWith('.html') ? name : name + '.xhtml', await f.async('arraybuffer'));
            }
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const title = (splitTitleInput.value.trim() || baseBookTitle);
        a.download = `${sanitizeFilename(title)}_chapters.zip`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('ZIP exported!', 'success');
        addExportEntry(title + ' (ZIP)', 'split', `${checked.length} chapters`);
    });

    // --- Share Button (Web Share API) ---
    let lastExportBlob = null;

    document.getElementById('btn-share-export')?.addEventListener('click', async () => {
        if (!splitMasterZip || storyChapters.length === 0) return showToast('No EPUB loaded', 'warn');

        if (!navigator.canShare) return showToast('Web Share API not supported in this browser', 'warn');

        const checked = Array.from(document.querySelectorAll('.chap-checkbox:checked')).map(cb => cb.value);
        if (checked.length === 0) return showToast('Select chapters first', 'warn');

        // Trigger a split and share
        showToast('Generating file for sharing...', 'info');
        await executeSplit(checked, 'Custom Extract');

        if (lastExportBlob) {
            const title = (splitTitleInput.value.trim() || baseBookTitle);
            const file = new File([lastExportBlob], `${sanitizeFilename(title)}.epub`, { type: 'application/epub+zip' });
            try {
                await navigator.share({ files: [file], title });
                showToast('Shared!', 'success');
            } catch (e) {
                if (e.name !== 'AbortError') showToast('Share failed: ' + e.message, 'error');
            }
        }
    });

    // --- Export Presets ---
    function loadPresets() {
        try { return JSON.parse(localStorage.getItem('epub-studio-presets') || '[]'); } catch { return []; }
    }

    function savePresets(presets) {
        localStorage.setItem('epub-studio-presets', JSON.stringify(presets));
    }

    function renderPresetDropdown() {
        const sel = document.getElementById('export-presets');
        if (!sel) return;
        const presets = loadPresets();
        sel.innerHTML = '<option value="">Load Preset...</option>';
        presets.forEach((p, i) => {
            sel.innerHTML += `<option value="${i}">${p.name}</option>`;
        });
    }

    document.getElementById('btn-save-preset')?.addEventListener('click', () => {
        const name = prompt('Preset name:', 'My Preset');
        if (!name) return;
        const presets = loadPresets();
        presets.push({
            name,
            chunkSize: document.getElementById('chunk-size')?.value || '100',
            chunkSizeMb: document.getElementById('chunk-size-mb')?.value || '20',
            splitMode: document.querySelector('input[name="split-mode"]:checked')?.value || 'chapters',
            keepOnlyText: document.getElementById('keep-only-text')?.checked || false,
            cssTheme: document.getElementById('css-theme-inject')?.value || 'none'
        });
        savePresets(presets);
        renderPresetDropdown();
        showToast(`Preset "${name}" saved!`, 'success');
    });

    document.getElementById('export-presets')?.addEventListener('change', (e) => {
        const idx = parseInt(e.target.value);
        if (isNaN(idx)) return;
        const presets = loadPresets();
        const p = presets[idx];
        if (!p) return;
        if (document.getElementById('chunk-size')) document.getElementById('chunk-size').value = p.chunkSize;
        if (document.getElementById('chunk-size-mb')) document.getElementById('chunk-size-mb').value = p.chunkSizeMb;
        const radio = document.querySelector(`input[name="split-mode"][value="${p.splitMode}"]`);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
        if (document.getElementById('keep-only-text')) document.getElementById('keep-only-text').checked = p.keepOnlyText;
        if (document.getElementById('css-theme-inject')) document.getElementById('css-theme-inject').value = p.cssTheme;
        showToast(`Loaded preset: ${p.name}`, 'info');
        e.target.value = '';
    });

    renderPresetDropdown();

    // --- Undo/Redo for Chapter Selection ---
    let selectionHistory = [];
    let selectionFuture = [];

    function captureSelectionState() {
        return Array.from(document.querySelectorAll('.chap-checkbox')).map(cb => ({ id: cb.value, checked: cb.checked }));
    }

    function restoreSelectionState(state) {
        state.forEach(s => {
            const cb = document.querySelector(`.chap-checkbox[value="${s.id}"]`);
            if (cb) cb.checked = s.checked;
        });
        document.getElementById('preview-count').textContent = `${document.querySelectorAll('.chap-checkbox:checked').length} selected`;
        updateEstimatedSize();
    }

    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('chap-checkbox')) {
            selectionHistory.push(captureSelectionState());
            selectionFuture = [];
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            e.preventDefault();
            if (selectionHistory.length > 1) {
                selectionFuture.push(selectionHistory.pop());
                restoreSelectionState(selectionHistory[selectionHistory.length - 1]);
                showToast('Undo', 'info');
            }
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            const tag = document.activeElement.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            e.preventDefault();
            if (selectionFuture.length > 0) {
                const state = selectionFuture.pop();
                selectionHistory.push(state);
                restoreSelectionState(state);
                showToast('Redo', 'info');
            }
        }
    });

    window.splitterJsLoaded = true;
};
