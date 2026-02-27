// api_merger.js - Headless API for EPUB Merging
window.EpubMerger = {
    async mergeEpubs(files, title, options = {}) {
        if (!files || files.length < 2) throw new Error("At least 2 files required to merge");

        const newZip = new JSZip();
        newZip.file("mimetype", "application/epub+zip", { compression: "STORE" });

        const parser = new DOMParser();

        // 1. Process Master Book (First File)
        const masterZip = await new JSZip().loadAsync(files[0]);
        for (let path in masterZip.files) {
            if (path === "mimetype" || masterZip.files[path].dir) continue;
            newZip.file(path, await masterZip.files[path].async("blob"));
        }

        const containerXml = await masterZip.file("META-INF/container.xml").async("text");
        const masterOpfPath = parser.parseFromString(containerXml, "text/xml").querySelector("rootfile").getAttribute("full-path");
        const masterOpfDir = masterOpfPath.includes("/") ? masterOpfPath.substring(0, masterOpfPath.lastIndexOf('/') + 1) : "";
        const masterOpfDoc = parser.parseFromString(await masterZip.file(masterOpfPath).async("text"), "text/xml");

        // Update Master Title
        const titleNode = masterOpfDoc.getElementsByTagName("dc:title")[0];
        if (titleNode) {
            titleNode.textContent = title || "Merged Book";
        }

        // Generate new UUID
        let idNode = masterOpfDoc.querySelector('identifier[id="uuid_id"]') || masterOpfDoc.querySelector('identifier');
        if (idNode) idNode.textContent = `urn:uuid:${crypto.randomUUID()}`;

        let masterNcxPath = null, masterNcxDoc = null;
        let masterNavMap = null;
        const ncxItem = masterOpfDoc.querySelector('item[media-type="application/x-dtbncx+xml"]');
        if (ncxItem) {
            masterNcxPath = masterOpfDir + ncxItem.getAttribute("href");
            if (masterZip.file(masterNcxPath)) {
                masterNcxDoc = parser.parseFromString(await masterZip.file(masterNcxPath).async("text"), "application/xml");
                masterNavMap = masterNcxDoc.querySelector("navMap");

                // Nest original book 1's navPoints
                if (masterNavMap) {
                    const originalNavPoints = Array.from(masterNavMap.children).filter(el => el.tagName === 'navPoint');
                    const masterPoint = masterNcxDoc.createElement("navPoint");
                    masterPoint.setAttribute("id", "master_book_1");
                    masterPoint.setAttribute("playOrder", "1");

                    const navLabel = masterNcxDoc.createElement("navLabel");
                    const textNode = masterNcxDoc.createElement("text");
                    textNode.textContent = files[0].name || `Book 1`;
                    navLabel.appendChild(textNode);
                    masterPoint.appendChild(navLabel);

                    if (originalNavPoints.length > 0) {
                        const firstContent = originalNavPoints[0].querySelector("content");
                        if (firstContent) {
                            const masterContent = masterNcxDoc.createElement("content");
                            masterContent.setAttribute("src", firstContent.getAttribute("src"));
                            masterPoint.appendChild(masterContent);
                        }
                    }

                    originalNavPoints.forEach(np => masterPoint.appendChild(np));
                    masterNavMap.appendChild(masterPoint);
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

        // 2. Loop through appendable books
        for (let i = 1; i < files.length; i++) {
            if (options.onProgress) options.onProgress(`Parsing Book ${i + 1} of ${files.length}...`);

            const subZip = await new JSZip().loadAsync(files[i]);
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
                const newHref = `b${i}_${oldHref.split('/').pop()}`; // Flatten directory structure for sub-books
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

            // Adjust NCX
            if (masterNcxDoc && masterNavMap) {
                const subNcx = subOpfDoc.querySelector('item[media-type="application/x-dtbncx+xml"]');
                if (subNcx) {
                    const snPath = subOpfDir + subNcx.getAttribute("href");
                    const snDir = subNcx.getAttribute("href").includes('/') ? subNcx.getAttribute("href").substring(0, subNcx.getAttribute("href").lastIndexOf('/') + 1) : "";
                    if (subZip.file(snPath)) {
                        const snd = parser.parseFromString(await subZip.file(snPath).async("text"), "application/xml");

                        const masterPoint = masterNcxDoc.createElement("navPoint");
                        masterPoint.setAttribute("id", `master_book_${i + 1}`);
                        masterPoint.setAttribute("playOrder", `${i + 1}`);

                        const navLabel = masterNcxDoc.createElement("navLabel");
                        const textNode = masterNcxDoc.createElement("text");
                        textNode.textContent = files[i].name || `Book ${i + 1}`;
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

        // 3. Finalize
        if (options.onProgress) options.onProgress(`Compressing Final File...`);
        if (masterNcxDoc) newZip.file(masterNcxPath, new XMLSerializer().serializeToString(masterNcxDoc));
        newZip.file(masterOpfPath, new XMLSerializer().serializeToString(masterOpfDoc));

        const blob = await newZip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/epub+zip" });
        return blob;
    }
};
