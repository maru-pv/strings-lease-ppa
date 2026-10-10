// 使い方ページ（help.html）にボタン名が書かれているかを確かめる。
// 実行: node tests/help-check.mjs   （書かれていないボタンがあれば止まる）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_PAGES = new Set(['help.html', 'solar-sim.html']); // solar-sim は未使用
// どの画面にもある一般的なボタン名は、使い方に書かなくてよい
const IGNORE = new Set(['戻る', '次へ', '×', '✕', '閉じる', '←', '→', '', 'ログアウト']);

const clean = s => s
  .replace(/<svg[\s\S]*?<\/svg>/g, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\$\{[^}]*\}/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/[←→]/g, '')
  .replace(/\s+/g, ' ').trim();

const help = fs.readFileSync(path.join(root, 'help.html'), 'utf8');
const helpText = clean(help).replace(/\s+/g, '');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && !SKIP_PAGES.has(f));
const missing = [];
const seen = [];
for (const f of pages) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const labels = new Set();
  // <button ...>ラベル</button>
  // 選択肢のボタン（人数・容量・プランなどの値そのもの）は数が多いので対象外
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    if (/class="[^"]*\b(sel-btn|rb|opt)\b/.test(m[1])) continue;
    labels.add(clean(m[2]));
  }
  // 画面の進み具合で変わるボタン名（例: { 4:'まとめへ →', 6:'問い合わせを送る' }）
  for (const line of html.split('\n')) if (/labels\b/.test(line)) for (const m of line.matchAll(/\d+:'([^']{1,30})'/g)) labels.add(clean(m[1]));
  // onclick 付きの要素（a / div など）の見える文字
  for (const m of html.matchAll(/<(a|div|span|label)\b[^>]*\bonclick=[^>]*>([^<]{1,40})<\/\1>/g)) labels.add(clean(m[2]));
  // JS で書き換えるボタン名（textContent / innerHTML に入れる文字）
  for (const m of html.matchAll(/(?:btn\w*|Btn\w*)\.(?:textContent|innerHTML)\s*=\s*'([^']{1,30})'/g)) labels.add(clean(m[1]));
  for (const l of labels) {
    if (IGNORE.has(l) || l.includes('{{') || l.length > 30 || /^[\d\s.,¥%+−-]*$/.test(l)) continue;
    seen.push(`${f}: ${l}`);
    if (!helpText.includes(l.replace(/\s+/g, ''))) missing.push(`${f}: 「${l}」`);
  }
}
if (process.argv.includes('--list')) console.log(seen.join('\n'));
if (missing.length) {
  console.error('使い方ページ（help.html）に書かれていないボタンがあります:\n' + missing.join('\n'));
  process.exit(1);
}
console.log(`OK: ${seen.length} 個のボタン名がすべて使い方ページに載っています`);
