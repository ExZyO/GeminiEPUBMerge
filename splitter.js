// Utility script for EPUB Studio Splitting
// Attaches to window for direct browser usage without bundlers

window.EpubSplitter = {
    splitEpub: async (file, maxBytesPerChunk = 25 * 1024 * 1024) => {
        if (!window.JSZip) throw new Error("JSZip is required for EPUB splitting.");

        // 1. Unzip original
        const zip = await window.JSZip.loadAsync(file);
        const opfPath = await window.EpubSplitter.getOpfPath(zip);
        const opfContent = await zip.file(opfPath).async("string");
        const opfDoc = new DOMParser().parseFromString(opfContent, "application/xml");

        // 2. Map itemrefs
        const spine = Array.from(opfDoc.querySelectorAll("spine itemref"));
        const manifest = Array.from(opfDoc.querySelectorAll("manifest item"));

        let currentChunkSize = 0;
        let currentChunkParts = [];
        const chunks = [];

        for (const itemRef of spine) {
            const idref = itemRef.getAttribute("idref");
            const item = manifest.find(i => i.getAttribute("id") === idref);
            if (!item) continue;

            const href = item.getAttribute("href");
            const basePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
            const fullPath = basePath + href;

            const fileObj = zip.file(fullPath);
            if (fileObj) {
                const content = await fileObj.async("uint8array");
                if (currentChunkSize + content.byteLength > maxBytesPerChunk && currentChunkParts.length > 0) {
                    chunks.push([...currentChunkParts]);
                    currentChunkParts = [];
                    currentChunkSize = 0;
                }
                currentChunkParts.push(idref);
                currentChunkSize += content.byteLength;
            }
        }

        if (currentChunkParts.length > 0) {
            chunks.push(currentChunkParts);
        }

        // Return illustrative split info for now. Full feature would zip and download parts.
        return chunks.map((chunkItemRefs, index) => {
            return {
                partName: `Part ${index + 1}`,
                chapters: chunkItemRefs.length,
                message: `Will contain ${chunkItemRefs.length} chapters.`
            };
        });
    },

    getOpfPath: async (zip) => {
        const container = zip.file("META-INF/container.xml");
        if (!container) throw new Error("META-INF/container.xml not found");
        const content = await container.async("string");
        const doc = new DOMParser().parseFromString(content, "application/xml");
        const rootfile = doc.querySelector("rootfile");
        if (!rootfile) throw new Error("No rootfile element found");
        return rootfile.getAttribute("full-path");
    }
};
