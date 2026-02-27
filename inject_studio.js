const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const rawHtml = fs.readFileSync('epub_studio_content.html', 'utf8');

// The marker in index.html to replace. We'll replace the entire `activeTab === 'studio' && h('div', ...)` block
// up until `, // Error display`
// Wait, regex might be tricky. Let's use string splitting.

const parts = indexHtml.split('// Studio UI replacing legacy');

if (parts.length === 2) {
    const endParts = parts[1].split('// Error display');
    if (endParts.length === 2) {

        // Escape the raw HTML for a JS template literal
        const escapedHtml = rawHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const newReactCode = `\n              h('div', { 
                dangerouslySetInnerHTML: { __html: \`${escapedHtml}\` },
                className: "epub-studio-injected-container"
              })
            )
          ),

          `;

        const newHtml = parts[0] + '// Studio UI replacing legacy' + newReactCode + '// Error display' + endParts[1];
        fs.writeFileSync('index.html', newHtml);
        console.log("Successfully injected raw HTML into React Tab!");
    } else {
        console.log("Could not find '// Error display'");
    }
} else {
    console.log("Could not find '// Studio UI replacing legacy'");
}
