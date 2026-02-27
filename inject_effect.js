const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const target1 = "      }, [activeTab]);\n\n      useEffect(() => {\n        const g = JSON.parse(localStorage.getItem('savedGlossaries') || '[]'); setSavedGlossaries(g);";

const replacement1 = `      }, [activeTab]);

      // Initialize Studio Vanilla Scripts
      useEffect(() => {
        if (activeTab === 'studio') {
          setTimeout(() => {
            if (window.initSplitterJs && !window.splitterJsLoaded) window.initSplitterJs();
            if (window.initMergerJs && !window.mergerJsLoaded) window.initMergerJs();

            const tabSplit = document.getElementById('tab-split');
            const tabMerge = document.getElementById('tab-merge');
            const viewSplit = document.getElementById('view-split');
            const viewMerge = document.getElementById('view-merge');

            if (tabSplit && tabMerge) {
                if (!viewSplit.classList.contains('hidden') && !viewMerge.classList.contains('hidden')) {
                     viewMerge.classList.add('hidden');
                }
                if (!viewSplit.classList.contains('hidden')) {
                   tabSplit.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400";
                   tabMerge.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white";
                }

                tabSplit.onclick = () => {
                    viewSplit?.classList.remove('hidden');
                    viewMerge?.classList.add('hidden');
                    tabSplit.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400";
                    tabMerge.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white";
                };
                tabMerge.onclick = () => {
                    viewMerge?.classList.remove('hidden');
                    viewSplit?.classList.add('hidden');
                    tabMerge.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400";
                    tabSplit.className = "flex items-center space-x-2 px-8 py-2.5 rounded-lg font-bold transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white";
                };
            }
          }, 100);
        }
      }, [activeTab]);

      useEffect(() => {
        const g = JSON.parse(localStorage.getItem('savedGlossaries') || '[]'); setSavedGlossaries(g);`;

if (!html.includes(target1)) {
    // try different line endings
    const target1Alt = target1.replace(/\n/g, '\r\n');
    if (html.includes(target1Alt)) {
        html = html.replace(target1Alt, replacement1);
        console.log("Replaced target1 with CRLF");
    } else {
        console.log("Could not find target1!");
    }
} else {
    html = html.replace(target1, replacement1);
    console.log("Replaced target1");
}

const target2 = `
              // Studio UI replacing legacy
              h('div', { 
                dangerouslySetInnerHTML: { __html: \`
>         <div class="flex justify-center mb-6">\``;

if (html.includes(target2)) {
    const replacement2 = `
              // Studio UI replacing legacy
              h('div', { 
                dangerouslySetInnerHTML: { __html: \`
        <div class="flex justify-center mb-6">\``;
    html = html.replace(target2, replacement2);
    console.log("Replaced target2");
} else {
    const target2Alt = target2.replace(/\n/g, '\r\n');
    if (html.includes(target2Alt)) {
        const replacement2 = `\r\n              // Studio UI replacing legacy\r\n              h('div', { \r\n                dangerouslySetInnerHTML: { __html: \`\r\n        <div class="flex justify-center mb-6">\``;
        html = html.replace(target2Alt, replacement2);
        console.log("Replaced target2 with CRLF");
    } else {
        console.log("Could not find target2!");
    }
}

const target3 = `activeTab === 'studio' && h('div', { className: 'space-y-6' },`;

if (html.includes(target3)) {
    const replacement3 = `h('div', { className: \`space-y-6 \${activeTab === 'studio' ? 'block' : 'hidden'}\` },`;
    html = html.replace(target3, replacement3);
    console.log("Replaced target3");
} else {
    console.log("Could not find target3!");
}

fs.writeFileSync('index.html', html);
