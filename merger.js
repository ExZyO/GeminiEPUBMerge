// Utility script for EPUB Studio Merging
// Attaches to window for direct browser usage without bundlers

window.EpubMerger = {
    mergeEpub: async (files) => {
        if (!window.JSZip) throw new Error("JSZip is required for EPUB merging.");
        if (files.length < 2) throw new Error("Need at least 2 files to merge.");

        const sortedFiles = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));

        const baseZip = await window.JSZip.loadAsync(sortedFiles[0]);
        const basePath = await window.EpubMerger.getOpfPath(baseZip);
        const baseOpfContent = await baseZip.file(basePath).async("string");
        const baseOpfDoc = new DOMParser().parseFromString(baseOpfContent, "application/xml");

        const baseSpine = baseOpfDoc.querySelector("spine");
        const baseManifest = baseOpfDoc.querySelector("manifest");

        for (let i = 1; i < sortedFiles.length; i++) {
            const partZip = await window.JSZip.loadAsync(sortedFiles[i]);
            const partOpfPath = await window.EpubMerger.getOpfPath(partZip);
            const partOpfDoc = new DOMParser().parseFromString(await partZip.file(partOpfPath).async("string"), "application/xml");

            for (const relativePath in partZip.files) {
                if (!partZip.files[relativePath].dir && relativePath !== partOpfPath && !relativePath.startsWith('META-INF/')) {
                    const content = await partZip.file(relativePath).async("uint8array");
                    baseZip.file(relativePath, content);
                }
            }

            const partManifestItems = Array.from(partOpfDoc.querySelectorAll("manifest item"));
            for (const item of partManifestItems) {
                const id = item.getAttribute("id");
                if (!baseOpfDoc.querySelector(`manifest item[id="${id}"]`)) {
                    baseManifest.appendChild(item.cloneNode(true));
                }
            }

            const partSpineItems = Array.from(partOpfDoc.querySelectorAll("spine itemref"));
            for (const itemref of partSpineItems) {
                baseSpine.appendChild(itemref.cloneNode(true));
            }
        }

        const serializer = new XMLSerializer();
        baseZip.file(basePath, serializer.serializeToString(baseOpfDoc));

        return await baseZip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
    },

    getOpfPath: async (zip) => {
        const container = zip.file("META-INF/container.xml");
        const content = await container.async("string");
        const doc = new DOMParser().parseFromString(content, "application/xml");
        return doc.querySelector("rootfile").getAttribute("full-path");
    }
};
