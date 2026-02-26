const fs = require('fs');
const srcPath = 'C:/Users/Administrator/Desktop/Android Studio/Antigravity/Gemini-Translator-main/Gemini-Translator-main/EPUB-Studio-Clone/index.html';
const dstPath = 'C:/Users/Administrator/Desktop/Android Studio/Antigravity/Gemini-Translator-main/Gemini-Translator-main/GeminiEPUBMerge/index.html';

const src = fs.readFileSync(srcPath, 'utf8');
let dst = fs.readFileSync(dstPath, 'utf8');

// The header starts with <header class="text-center space-y-3 pt-4"> and ends before <div class="flex justify-center mb-6 mt-4"> (where our injection string currently has the inner tabs)
const sIdx = src.indexOf('<header class="text-center space-y-3 pt-4">');
const eIdx = src.indexOf('<div class="flex justify-center mb-6">');
if (sIdx === -1 || eIdx === -1) { console.error('Src markers not found'); process.exit(1); }
const headerHtml = src.substring(sIdx, eIdx);

// In GeminiEPUBMerge/index.html, it currently has:
// __html: `
//         <div class="max-w-6xl mx-auto space-y-6 relative">
//             <div
//                 class="bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 inline-flex">
//                 <button id="tab-split"

// So we insert it right after `<div class="max-w-6xl mx-auto space-y-6 relative">\n`
const targetStr = '<div class="max-w-6xl mx-auto space-y-6 relative">\n';
const insertPos = dst.indexOf(targetStr) + targetStr.length;
if (insertPos === -1) { console.error('Dst marker not found'); process.exit(1); }

dst = dst.substring(0, insertPos) + headerHtml + '\n<div class="flex justify-center mb-6 mt-4">\n' + dst.substring(insertPos);
fs.writeFileSync(dstPath, dst, 'utf8');
console.log('Successfully injected header!');
