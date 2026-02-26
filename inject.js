const fs = require('fs');
const srcPath = 'C:/Users/Administrator/Desktop/Android Studio/Antigravity/Gemini-Translator-main/Gemini-Translator-main/EPUB-Studio-Clone/index.html';
const dstPath = 'C:/Users/Administrator/Desktop/Android Studio/Antigravity/Gemini-Translator-main/Gemini-Translator-main/GeminiEPUBMerge/index.html';

const src = fs.readFileSync(srcPath, 'utf8');
const dst = fs.readFileSync(dstPath, 'utf8');

const sIdx = src.indexOf('<div id="view-merge"');
const eIdx = src.indexOf('<!-- Chapter Preview Modal -->');
if (sIdx === -1 || eIdx === -1) { console.error('Src markers not found'); process.exit(1); }
const toInsert = src.substring(sIdx, eIdx);

const insertTarget = '    <!-- Chapter Preview Modal -->';
const insertPos = dst.indexOf(insertTarget);
if (insertPos === -1) { console.error('Dst marker not found'); process.exit(1); }

const newDst = dst.substring(0, insertPos) + toInsert + dst.substring(insertPos);
fs.writeFileSync(dstPath, newDst, 'utf8');
console.log('Successfully injected view-merge!');
