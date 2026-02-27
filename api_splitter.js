// api_splitter.js - Headless API for EPUB Splitting
window.EpubSplitter = {
    async analyzeEpub(file) {
        const zip = await new JSZip().loadAsync(file);
        const containerXml = await zip.file("META-INF/container.xml").async("text");
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, "text/xml");
        const opfPath = containerDoc.querySelector("rootfile").getAttribute("full-path");
        const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : "";

        const opfText = await zip.file(opfPath).async("text");
        const opfDoc = parser.parseFromString(opfText, "text/xml");

        let title = "Unknown Title";
        const titleNode = opfDoc.getElementsByTagName("dc:title")[0];
        if (titleNode) title = titleNode.textContent;

        const allItems = Array.from(opfDoc.querySelectorAll("manifest > item")).map(el => ({
            id: el.getAttribute("id"),
            href: el.getAttribute("href"),
            mediaType: el.getAttribute("media-type")
        }));

        const spineItems = Array.from(opfDoc.querySelectorAll("spine > itemref")).map(el => el.getAttribute("idref"));
        const storyChapters = [];
        const frontMatter = [];

        spineItems.forEach((idref, index) => {
            const item = allItems.find(i => i.id === idref);
            if (!item) return;
            const textCheck = (item.href + idref).toLowerCase();
            const isFrontMatter = /cover|title[-_]?page|copyright|dedication|acknowledgment|toc|nav[-_]?doc|preface|foreword|front[-_]?matter|half[-_]?title|series[-_]?page|about[-_]?author|epigraph|also[-_]?by/.test(textCheck);

            if (isFrontMatter) {
                frontMatter.push({ idref, item, index, originalName: item.href });
            } else {
                storyChapters.push({ idref, item, index, originalName: item.href, displayIndex: storyChapters.length + 1 });
            }
        });

        // Get word counts and sizes
        for (let chap of storyChapters) {
            const fullPath = opfDir + chap.originalName;
            const f = zip.files[fullPath];
            chap.fileSize = 0;
            chap.wordCount = 0;
            if (f) {
                if (f._data && f._data.uncompressedSize) chap.fileSize = f._data.uncompressedSize;
                try {
                    const txt = await f.async('text');
                    const stripped = txt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                    chap.wordCount = stripped.split(' ').filter(w => w.length > 0).length;
                } catch (e) { }
            }
        }

        return {
            title,
            zip,
            opfDoc,
            opfPath,
            opfDir,
            allItems,
            spineItems,
            storyChapters,
            frontMatter
        };
    },

    async generateSplit(analysis, selectedIdrefs, titleSuffix, options = {}) {
        const { zip: masterZip, opfDoc: origOpfDoc, opfPath, opfDir, frontMatter } = analysis;
        const newZip = new JSZip();

        const allowedIdrefs = new Set([...frontMatter.map(f => f.idref), ...selectedIdrefs]);
        const allowedHrefs = new Set();

        const newOpfDoc = origOpfDoc.cloneNode(true);
        const spine = newOpfDoc.querySelector("spine");
        const manifest = newOpfDoc.querySelector("manifest");

        // Strip spine
        Array.from(spine.querySelectorAll("itemref")).forEach(ref => {
            const id = ref.getAttribute("idref");
            if (!allowedIdrefs.has(id)) spine.removeChild(ref);
        });

        // Strip manifest and collect allowed hrefs
        Array.from(manifest.querySelectorAll("item")).forEach(item => {
            const id = item.getAttribute("id");
            const media = item.getAttribute("media-type");
            const href = item.getAttribute("href");

            if (media.includes("html") && !allowedIdrefs.has(id)) {
                manifest.removeChild(item);
            } else {
                allowedHrefs.add(href);
            }
        });

        // Copy files
        for (let path in masterZip.files) {
            if (path === "mimetype" || masterZip.files[path].dir) continue;
            let shouldInclude = true;
            if (path.endsWith('.html') || path.endsWith('.xhtml')) {
                shouldInclude = false;
                for (let href of allowedHrefs) {
                    if (path.endsWith(href)) { shouldInclude = true; break; }
                }
            }
            if (shouldInclude || path.includes("META-INF") || path.endsWith(".opf") || path.endsWith(".ncx")) {
                newZip.file(path, await masterZip.files[path].async("arraybuffer"));
            }
        }

        // Update Title
        const titleNode = newOpfDoc.getElementsByTagName("dc:title")[0];
        if (titleNode) {
            titleNode.textContent = `${analysis.title} (${titleSuffix})`;
        }

        // Generate new UUID
        let idNode = newOpfDoc.querySelector('identifier[id="uuid_id"]') || newOpfDoc.querySelector('identifier');
        if (idNode) idNode.textContent = `urn:uuid:${crypto.randomUUID()}`;

        newZip.file(opfPath, new XMLSerializer().serializeToString(newOpfDoc));

        // Generate Blob
        const blob = await newZip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/epub+zip" });
        return blob;
    }
};
