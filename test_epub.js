const fs = require('fs');
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');

async function testEpub(filePath) {
    console.log(`Testing parsing for: ${filePath}`);
    const f = fs.readFileSync(filePath);

    try {
        const zip = await JSZip.loadAsync(f);
        console.log("Successfully loaded zip.");

        const cf = zip.file('META-INF/container.xml');
        if (!cf) throw new Error('Invalid EPUB: Missing META-INF/container.xml');

        const cc = await cf.async('text');
        const dom = new JSDOM("");
        const parser = new dom.window.DOMParser();
        const cd = parser.parseFromString(cc, 'text/xml');

        const rp = cd.querySelector('rootfile')?.getAttribute('full-path');
        if (!rp) throw new Error('No rootfile found in container.xml');
        console.log(`Rootfile path: ${rp}`);

        const od = rp.includes('/') ? rp.substring(0, rp.lastIndexOf('/') + 1) : "";
        const of2 = zip.file(rp);
        if (!of2) {
            console.log("Files in zip:");
            Object.keys(zip.files).forEach(k => console.log(k));
            throw new Error('OPF not found at ' + rp);
        }

        const oc = await of2.async('text');
        const opf = parser.parseFromString(oc, 'text/xml');

        const spineItems = opf.querySelectorAll('spine itemref');
        console.log(`Found ${spineItems.length} spine items.`);

        let validDocs = 0;
        for (const ir of spineItems) {
            const id = ir.getAttribute('idref');
            const mi = opf.querySelector(`manifest item[id="${id}"]`);
            const href = mi?.getAttribute('href');
            if (!href) continue;

            const cp = od + href;
            const mt = mi.getAttribute('media-type');

            if (mt && (mt === 'application/xhtml+xml' || mt === 'text/html')) {
                const file = zip.file(cp);
                if (file) {
                    validDocs++;
                } else {
                    console.error(`Missing file in zip: ${cp}`);
                }
            }
        }

        console.log(`Successfully parsed ${validDocs} readable HTML/XHTML documents.`);

    } catch (e) {
        console.error("FAIL:", e);
    }
}

testEpub('Shi_Jie_Zheng_Yi_DOWN.epub');
