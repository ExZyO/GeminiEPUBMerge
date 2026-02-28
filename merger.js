window.initMergerJs = function () {
    const container = document.getElementById('view-merge');
    if (!container || container.dataset.init === 'true') return;
    container.dataset.init = 'true';
    let mergeFiles = [];
    let customCoverFile = null;

    const mergeInput = document.getElementById('merge-input');
    const mergeUploadBox = document.getElementById('merge-upload-box');
    const mergeListContainer = document.getElementById('merge-list-container');
    const mergeFileList = document.getElementById('merge-file-list');
    const btnExecuteMerge = document.getElementById('btn-execute-merge');
    const mergeTitleInput = document.getElementById('merge-title');
    const memoryWarning = document.getElementById('memory-warning');
    const btnClearAllMerge = document.getElementById('btn-clear-all-merge');

    const coverInput = document.getElementById('cover-input');
    const btnSelectCover = document.getElementById('btn-select-cover');
    const btnRemoveCover = document.getElementById('btn-remove-cover');
    const coverPreview = document.getElementById('cover-preview');

    // Cover handling
    btnSelectCover?.addEventListener('click', () => coverInput?.click());
    coverPreview?.addEventListener('click', () => coverInput?.click());

    coverInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            customCoverFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                coverPreview.innerHTML = `<img src="${event.target.result}" class="w-full h-full object-cover">`;
                btnRemoveCover.classList.remove('hidden');
            };
            reader.readAsDataURL(customCoverFile);
        }
    });

    btnRemoveCover?.addEventListener('click', () => {
        customCoverFile = null;
        if (coverInput) coverInput.value = '';
        coverPreview.innerHTML = `<span class="text-[10px] leading-tight text-slate-400 text-center px-1">Book 1<br>Cover</span>`;
        btnRemoveCover.classList.add('hidden');
    });

    // Upload Handlers

    document.getElementById('btn-add-more-merge')?.addEventListener('click', () => mergeInput?.click());

    // NEW: Clear All Logic
    btnClearAllMerge?.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear all queued books?")) {
            mergeFiles = [];
            mergeTitleInput.value = '';
            renderMergeList();
        }
    });



    window.handleMergeFiles = async function handleMergeFiles(files) {
        const validFiles = files.filter(f => f.name.endsWith('.epub'));
        if (validFiles.length === 0) return;

        // Duplicate detection & Filtering
        const existingNames = new Set(mergeFiles.map(f => f.name));
        const uniqueFiles = validFiles.filter(f => !existingNames.has(f.name));

        if (validFiles.length > uniqueFiles.length) {
            showToast(`⚠️ Skipped ${validFiles.length - uniqueFiles.length} duplicate(s)`, 'warn');
        }

        if (uniqueFiles.length === 0) return;

        const isFirstAdd = mergeFiles.length === 0;
        mergeFiles = mergeFiles.concat(uniqueFiles);
        mergeUploadBox.classList.add('hidden');
        mergeListContainer.classList.remove('hidden');

        if (isFirstAdd && mergeFiles.length > 0) {
            // Auto-prefill Title from filename if not set
            if (!mergeTitleInput.value) {
                let baseName = mergeFiles[0].name.replace('.epub', '').replace(/\([^\)]+\)/g, '').trim();
                mergeTitleInput.value = `${baseName} (Merged)`;
            }

            // EXTRACT METADATA AND COVER FROM FIRST BOOK
            try {
                const firstZip = await new JSZip().loadAsync(mergeFiles[0]);
                const containerXml = await firstZip.file("META-INF/container.xml").async("text");
                const parser = new DOMParser();
                const opfPath = parser.parseFromString(containerXml, "text/xml").querySelector("rootfile").getAttribute("full-path");
                const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : "";
                const opfText = await firstZip.file(opfPath).async("text");
                const opfDoc = parser.parseFromString(opfText, "text/xml");

                const getTag = (tag) => { const el = opfDoc.getElementsByTagName(tag)[0]; return el ? el.textContent : ''; };

                const title = getTag('dc:title');
                if (title) mergeTitleInput.value = title + " (Merged)";

                const author = getTag('dc:creator');
                if (author) document.getElementById('merge-author').value = author;

                const publisher = getTag('dc:publisher');
                if (publisher) document.getElementById('merge-publisher').value = publisher;

                const language = getTag('dc:language');
                if (language) document.getElementById('merge-language').value = language;

                // Cover extraction
                try {
                    let coverItem = opfDoc.querySelector('item[properties~="cover-image"]');
                    if (!coverItem) {
                        const metaCover = opfDoc.querySelector('meta[name="cover"]');
                        if (metaCover) {
                            const coverId = metaCover.getAttribute("content");
                            coverItem = opfDoc.querySelector(`item[id="${coverId}"]`);
                        }
                    }
                    if (!coverItem) {
                        coverItem = Array.from(opfDoc.querySelectorAll('item[media-type^="image"]')).find(item => {
                            const h = (item.getAttribute('href') || '').toLowerCase();
                            const id = (item.getAttribute('id') || '').toLowerCase();
                            return h.includes('cover') || id.includes('cover');
                        });
                    }

                    if (coverItem) {
                        let coverHref = coverItem.getAttribute("href");
                        if (coverHref.startsWith('../')) coverHref = coverHref.replace('../', '');
                        const fullCoverPath = opfDir + coverHref;
                        const coverFile = firstZip.file(fullCoverPath);
                        if (coverFile) {
                            const coverBlob = await coverFile.async("blob");
                            const blobUrl = URL.createObjectURL(coverBlob);
                            coverPreview.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover">`;
                            btnRemoveCover.classList.remove('hidden');
                            customCoverFile = new File([coverBlob], "cover.jpg", { type: "image/jpeg" });
                        }
                    }
                } catch (ce) { console.log("Cover extraction failed", ce); }

            } catch (e) {
                console.log("Failed to extract metadata from first book", e);
            }
        }

        renderMergeList();
    }

    let draggedIdx = null;

    function renderMergeList() {
        mergeFileList.innerHTML = '';
        let totalBytes = mergeFiles.reduce((acc, f) => acc + f.size, 0);
        if (totalBytes > 300 * 1024 * 1024) memoryWarning.classList.remove('hidden');
        else memoryWarning.classList.add('hidden');

        if (mergeFiles.length === 0) {
            mergeListContainer.classList.add('hidden');
            mergeUploadBox.classList.remove('hidden');
            btnClearAllMerge.classList.add('hidden');
            return;
        } else {
            btnClearAllMerge.classList.remove('hidden');
        }

        mergeFiles.forEach((f, idx) => {
            const div = document.createElement('div');
            div.className = "p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between gap-2";

            // Desktop Drag events
            div.draggable = true;
            div.addEventListener('dragstart', () => draggedIdx = idx);
            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                div.classList.add('drag-over');
            });
            div.addEventListener('dragleave', () => {
                div.classList.remove('drag-over');
            });
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.classList.remove('drag-over');
                if (draggedIdx === null || draggedIdx === idx) return;
                const item = mergeFiles.splice(draggedIdx, 1)[0];
                mergeFiles.splice(idx, 0, item);
                renderMergeList();
            });

            // Initialize the custom label if it doesn't exist
            if (!f.customLabel) {
                f.customLabel = `Book ${idx + 1}`;
            }

            // UI FIX: Using flex-nowrap and min-w-0 for the filename to ensure it wraps correctly without pushing buttons
            div.innerHTML = `
            <div class="flex items-start gap-2 min-w-0 flex-1 cursor-move select-none p-1">
                <span class="text-xs font-bold text-fuchsia-500 mt-2 shrink-0">${idx + 1}.</span>
                <div class="flex flex-col min-w-0 flex-1 w-full">
                    <span class="font-medium text-xs leading-snug text-slate-500 dark:text-slate-400 break-all pr-1 pb-1">${f.name}</span>
                    <input type="text" class="book-label-input mt-1 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-500" value="${f.customLabel}" placeholder="e.g. Volume 1">
                </div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
                <button type="button" class="btn-up w-8 h-8 flex items-center justify-center text-slate-400 hover:text-fuchsia-500 bg-slate-100 dark:bg-slate-800 rounded disabled:opacity-30" ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="btn-down w-8 h-8 flex items-center justify-center text-slate-400 hover:text-fuchsia-500 bg-slate-100 dark:bg-slate-800 rounded disabled:opacity-30" ${idx === mergeFiles.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="btn-remove w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded font-bold">✕</button>
            </div>
        `;

            div.querySelector('.btn-up').onclick = (e) => {
                e.stopPropagation();
                if (idx > 0) {
                    const item = mergeFiles.splice(idx, 1)[0];
                    mergeFiles.splice(idx - 1, 0, item);
                    renderMergeList();
                }
            };

            div.querySelector('.btn-down').onclick = (e) => {
                e.stopPropagation();
                if (idx < mergeFiles.length - 1) {
                    const item = mergeFiles.splice(idx, 1)[0];
                    mergeFiles.splice(idx + 1, 0, item);
                    renderMergeList();
                }
            };

            div.querySelector('.btn-remove').onclick = (e) => {
                e.stopPropagation();
                mergeFiles.splice(idx, 1);
                renderMergeList();
            };

            div.querySelector('.book-label-input').addEventListener('input', (e) => {
                mergeFiles[idx].customLabel = e.target.value;
            });

            mergeFileList.appendChild(div);
        });
    }

    // Function to update the manual progress bar during parsing
    function updateParsingProgress(current, total) {
        const pWrapper = document.getElementById('merge-progress-wrapper');
        const pBar = document.getElementById('merge-progress-bar');
        const pPercent = document.getElementById('merge-progress-percent');
        const pStatus = document.getElementById('merge-progress-status');

        if (pWrapper) pWrapper.classList.remove('hidden');

        const percent = Math.floor((current / total) * 100);
        if (pBar) pBar.style.width = percent + '%';
        if (pPercent) pPercent.textContent = percent + '%';
        if (pStatus) pStatus.textContent = `Parsing Book ${current} of ${total}...`;
    }

    // Merge execution
    btnExecuteMerge?.addEventListener('click', async () => {
        if (mergeFiles.length < 2) return showToast("Add at least 2 books", "warn");

        const btnText = document.getElementById('merge-btn-text');
        const btnSpinner = document.getElementById('merge-spinner');
        btnText.textContent = "Processing...";
        btnSpinner.classList.remove('hidden');
        btnExecuteMerge.disabled = true;

        try {
            const newZip = new JSZip();
            newZip.file("mimetype", "application/epub+zip", { compression: "STORE" });

            const parser = new DOMParser();

            updateParsingProgress(1, mergeFiles.length);

            const masterZip = await new JSZip().loadAsync(mergeFiles[0]);
            for (let path in masterZip.files) {
                if (path === "mimetype" || masterZip.files[path].dir) continue;
                newZip.file(path, await masterZip.files[path].async("blob"));
            }

            const containerXml = await masterZip.file("META-INF/container.xml").async("text");
            const masterOpfPath = parser.parseFromString(containerXml, "text/xml").querySelector("rootfile").getAttribute("full-path");
            const masterOpfDir = masterOpfPath.includes("/") ? masterOpfPath.substring(0, masterOpfPath.lastIndexOf('/') + 1) : "";
            const masterOpfDoc = parser.parseFromString(await masterZip.file(masterOpfPath).async("text"), "text/xml");

            const cleanTitle = sanitizeFilename(mergeTitleInput.value || "Merged Book");
            setSmartTitle(masterOpfDoc, cleanTitle);
            forceNewIdentifier(masterOpfDoc);

            // Apply Advanced Metadata
            const metadataEl = masterOpfDoc.querySelector("metadata");
            if (metadataEl) {
                const mAuthor = document.getElementById("merge-author").value.trim();
                const mPublisher = document.getElementById("merge-publisher").value.trim();
                const mLanguage = document.getElementById("merge-language").value.trim();

                if (mAuthor) {
                    Array.from(metadataEl.getElementsByTagName("dc:creator")).forEach(el => el.remove());
                    const creatorNode = masterOpfDoc.createElementNS("http://purl.org/dc/elements/1.1/", "dc:creator");
                    creatorNode.textContent = mAuthor;
                    metadataEl.appendChild(creatorNode);
                }
                if (mPublisher) {
                    Array.from(metadataEl.getElementsByTagName("dc:publisher")).forEach(el => el.remove());
                    const pubNode = masterOpfDoc.createElementNS("http://purl.org/dc/elements/1.1/", "dc:publisher");
                    pubNode.textContent = mPublisher;
                    metadataEl.appendChild(pubNode);
                }
                if (mLanguage) {
                    Array.from(metadataEl.getElementsByTagName("dc:language")).forEach(el => el.remove());
                    const langNode = masterOpfDoc.createElementNS("http://purl.org/dc/elements/1.1/", "dc:language");
                    langNode.textContent = mLanguage;
                    metadataEl.appendChild(langNode);
                }
            }

            if (customCoverFile) {
                let coverItem = masterOpfDoc.querySelector('item[properties~="cover-image"]') ||
                    masterOpfDoc.querySelector(`item[id="${masterOpfDoc.querySelector('meta[name="cover"]')?.getAttribute("content")}"]`);
                const data = await customCoverFile.arrayBuffer();
                if (coverItem) newZip.file(masterOpfDir + coverItem.getAttribute("href"), data);
            }

            let masterNcxPath = null, masterNcxDoc = null;
            let masterNavMap = null;
            const ncxItem = masterOpfDoc.querySelector('item[media-type="application/x-dtbncx+xml"]');
            if (ncxItem) {
                masterNcxPath = masterOpfDir + ncxItem.getAttribute("href");
                if (masterZip.file(masterNcxPath)) {
                    masterNcxDoc = parser.parseFromString(await masterZip.file(masterNcxPath).async("text"), "application/xml");
                    masterNavMap = masterNcxDoc.querySelector("navMap");

                    // Nest original book 1's navPoints under a master navPoint
                    if (masterNavMap) {
                        const originalNavPoints = Array.from(masterNavMap.children).filter(el => el.tagName === 'navPoint');

                        const masterPoint = masterNcxDoc.createElement("navPoint");
                        masterPoint.setAttribute("id", "master_book_1");
                        masterPoint.setAttribute("playOrder", "1");

                        const navLabel = masterNcxDoc.createElement("navLabel");
                        const textNode = masterNcxDoc.createElement("text");
                        textNode.textContent = mergeFiles[0].customLabel || `Book 1`;
                        navLabel.appendChild(textNode);
                        masterPoint.appendChild(navLabel);

                        // Attach to the first valid content src we can find to act as the parent link
                        if (originalNavPoints.length > 0) {
                            const firstContent = originalNavPoints[0].querySelector("content");
                            if (firstContent) {
                                const masterContent = masterNcxDoc.createElement("content");
                                masterContent.setAttribute("src", firstContent.getAttribute("src"));
                                masterPoint.appendChild(masterContent);
                            }
                        }

                        // Move original points inside the master point
                        originalNavPoints.forEach(np => masterPoint.appendChild(np));
                        masterNavMap.appendChild(masterPoint);
                    }
                }
            }

            const navItem = masterOpfDoc.querySelector('item[properties~="nav"]');
            let masterNavPath = null, masterNavDoc = null;
            let masterNavList = null;
            if (navItem) {
                masterNavPath = masterOpfDir + navItem.getAttribute("href");
                if (masterZip.file(masterNavPath)) {
                    masterNavDoc = parser.parseFromString(await masterZip.file(masterNavPath).async("text"), "application/xhtml+xml");
                    const navEl = masterNavDoc.querySelector('nav[epub\\:type="toc"], nav#toc');
                    if (navEl) {
                        masterNavList = navEl.querySelector('ol');

                        // Nest original book 1's list items under an expandable tree
                        if (masterNavList) {
                            const originalLis = Array.from(masterNavList.children).filter(el => el.tagName.toLowerCase() === 'li');

                            const masterLi = masterNavDoc.createElement("li");
                            const masterSpan = masterNavDoc.createElement("span");
                            masterSpan.textContent = mergeFiles[0].customLabel || `Book 1`;

                            const subOl = masterNavDoc.createElement("ol");

                            // If there's an anchor, we could theoretically link the span, but a span is safer for pure headers
                            if (originalLis.length > 0) {
                                const firstA = originalLis[0].querySelector('a');
                                if (firstA) {
                                    const masterA = masterNavDoc.createElement("a");
                                    masterA.setAttribute("href", firstA.getAttribute("href"));
                                    masterA.textContent = masterSpan.textContent;
                                    masterLi.appendChild(masterA);
                                } else {
                                    masterLi.appendChild(masterSpan);
                                }
                            } else {
                                masterLi.appendChild(masterSpan);
                            }

                            // Move original LIs into the subOl
                            originalLis.forEach(li => subOl.appendChild(li));
                            masterLi.appendChild(subOl);

                            // Clear and append
                            masterNavList.innerHTML = '';
                            masterNavList.appendChild(masterLi);
                        }
                    }
                }
            }

            function resolveRelativePath(baseDir, relativePath) {
                if (!relativePath) return "";
                const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];
                const parts = relativePath.split('/');
                for (let p of parts) {
                    if (p === '.') continue;
                    if (p === '..') stack.pop();
                    else stack.push(p);
                }
                return stack.join('/');
            }

            // Loop through remaining books
            for (let i = 1; i < mergeFiles.length; i++) {
                updateParsingProgress(i + 1, mergeFiles.length);

                const subZip = await new JSZip().loadAsync(mergeFiles[i]);
                const subContainerXml = await subZip.file("META-INF/container.xml").async("text");
                const subOpfPath = parser.parseFromString(subContainerXml, "text/xml").querySelector("rootfile").getAttribute("full-path");
                const subOpfDir = subOpfPath.includes("/") ? subOpfPath.substring(0, subOpfPath.lastIndexOf('/') + 1) : "";
                const subOpfDoc = parser.parseFromString(await subZip.file(subOpfPath).async("text"), "text/xml");

                const subManifest = subOpfDoc.querySelectorAll("manifest > item");
                const idMap = {};
                const hrefMap = {};

                for (let j = 0; j < subManifest.length; j++) {
                    const it = subManifest[j];
                    const oldId = it.getAttribute("id");
                    const oldHref = it.getAttribute("href");
                    const newId = `b${i}_${oldId}`;
                    const newHref = `b${i}_${oldHref.split('/').pop()}`;
                    idMap[oldId] = newId;
                    hrefMap[oldHref] = newHref;
                }

                for (let j = 0; j < subManifest.length; j++) {
                    const it = subManifest[j];
                    const oldHref = it.getAttribute("href");
                    const mime = it.getAttribute("media-type") || "";
                    const newHref = hrefMap[oldHref];
                    const fullPath = subOpfDir + oldHref;

                    if (subZip.file(fullPath)) {
                        if (mime.includes("html") || mime.includes("xml") || mime.includes("css")) {
                            let txt = await subZip.file(fullPath).async("text");
                            const oDir = oldHref.includes('/') ? oldHref.substring(0, oldHref.lastIndexOf('/') + 1) : "";
                            txt = txt.replace(/(href|src)=["']([^"']+)["']/g, (m, attr, val) => {
                                let lp = val.split('#')[0];
                                let h = val.split('#')[1] ? '#' + val.split('#')[1] : '';
                                if (lp.startsWith('http') || lp.startsWith('data:')) return m;
                                let res = resolveRelativePath(oDir, lp);
                                if (hrefMap[res]) return `${attr}="${hrefMap[res]}${h}"`;
                                return m;
                            });
                            newZip.file(masterOpfDir + newHref, txt);
                        } else {
                            newZip.file(masterOpfDir + newHref, await subZip.file(fullPath).async("blob"));
                        }
                        const ni = masterOpfDoc.createElement("item");
                        ni.setAttribute("id", idMap[it.getAttribute("id")]);
                        ni.setAttribute("href", newHref);
                        ni.setAttribute("media-type", mime);
                        masterOpfDoc.querySelector("manifest").appendChild(ni);
                    }
                }

                const subSpine = subOpfDoc.querySelectorAll("spine > itemref");
                subSpine.forEach(ref => {
                    const sid = ref.getAttribute("idref");
                    if (idMap[sid]) {
                        const nr = masterOpfDoc.createElement("itemref");
                        nr.setAttribute("idref", idMap[sid]);
                        masterOpfDoc.querySelector("spine").appendChild(nr);
                    }
                });

                if (masterNcxDoc && masterNavMap) {
                    const subNcx = subOpfDoc.querySelector('item[media-type="application/x-dtbncx+xml"]');
                    if (subNcx) {
                        const snPath = subOpfDir + subNcx.getAttribute("href");
                        const snDir = subNcx.getAttribute("href").includes('/') ? subNcx.getAttribute("href").substring(0, subNcx.getAttribute("href").lastIndexOf('/') + 1) : "";
                        if (subZip.file(snPath)) {
                            const snd = parser.parseFromString(await subZip.file(snPath).async("text"), "application/xml");

                            // Create master wrapper for the appended book
                            const masterPoint = masterNcxDoc.createElement("navPoint");
                            masterPoint.setAttribute("id", `master_book_${i + 1}`);
                            masterPoint.setAttribute("playOrder", `${i + 1}`); // Basic ordering

                            const navLabel = masterNcxDoc.createElement("navLabel");
                            const textNode = masterNcxDoc.createElement("text");
                            textNode.textContent = mergeFiles[i].customLabel || `Book ${i + 1}`;
                            navLabel.appendChild(textNode);
                            masterPoint.appendChild(navLabel);

                            let firstContentFound = false;

                            snd.querySelectorAll("navMap > navPoint").forEach(np => {
                                const cl = np.cloneNode(true);
                                cl.querySelectorAll("content").forEach(c => {
                                    let s = c.getAttribute("src");
                                    let lp = s.split('#')[0];
                                    let res = resolveRelativePath(snDir, lp);
                                    if (hrefMap[res]) {
                                        const finalSrc = hrefMap[res] + (s.split('#')[1] ? '#' + s.split('#')[1] : '');
                                        c.setAttribute("src", finalSrc);

                                        // Use the first valid child as the URL for the parent block
                                        if (!firstContentFound) {
                                            const masterContent = masterNcxDoc.createElement("content");
                                            masterContent.setAttribute("src", finalSrc);
                                            masterPoint.appendChild(masterContent);
                                            firstContentFound = true;
                                        }
                                    }
                                });
                                masterPoint.appendChild(cl);
                            });

                            masterNavMap.appendChild(masterPoint);
                        }
                    }
                }
            }

            // Setup for Final Compression Stage
            if (masterNcxDoc) newZip.file(masterNcxPath, new XMLSerializer().serializeToString(masterNcxDoc));
            if (masterNavDoc) newZip.file(masterNavPath, new XMLSerializer().serializeToString(masterNavDoc));
            newZip.file(masterOpfPath, new XMLSerializer().serializeToString(masterOpfDoc));

            btnText.textContent = "Compressing Final File...";
            const compressionLevel = document.getElementById('merge-compression') ? document.getElementById('merge-compression').value : "DEFLATE";
            const pStatus = document.getElementById('merge-progress-status');
            if (pStatus) pStatus.textContent = "Compressing Final File...";
            const pBar = document.getElementById('merge-progress-bar');
            if (pBar) pBar.style.width = '0%';

            let b = await newZip.generateAsync(
                { type: "blob", compression: compressionLevel, mimeType: "application/epub+zip" },
                function updateCallback(metadata) {
                    const pWrapper = document.getElementById('merge-progress-wrapper');
                    const pBar = document.getElementById('merge-progress-bar');
                    const pPercent = document.getElementById('merge-progress-percent');
                    if (pWrapper) pWrapper.classList.remove('hidden');
                    if (pBar) pBar.style.width = metadata.percent.toFixed(0) + '%';
                    if (pPercent) pPercent.textContent = metadata.percent.toFixed(0) + '%';
                }
            );

            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = `${cleanTitle}.epub`;
            a.click();
            showToast("Books merged!", "success");
            addExportEntry(cleanTitle, 'merge', `${mergeFiles.length} books`);

        } catch (err) {
            console.error(err);
            showToast("Merge failed.", "error");
        } finally {
            btnText.textContent = "Merge & Download";
            btnSpinner.classList.add('hidden');
            btnExecuteMerge.disabled = false;

            const pWrapper = document.getElementById('merge-progress-wrapper');
            const pBar = document.getElementById('merge-progress-bar');
            if (pWrapper) pWrapper.classList.add('hidden');
            if (pBar) pBar.style.width = '0%';
        }
    });

    window.mergerJsLoaded = true;
};
