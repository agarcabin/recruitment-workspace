// 加微看板数据快照：从企微表格《创新招聘组每日数据》「企微添加」子表
// 拉取逐条加微流水（添加人/添加时间/客户名称），聚合成 jiawei-data.json 静态快照。
// 发布网页前运行一次即可：node scripts/build-jiawei.mjs
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const DOCID = 'e3_AQsA_wYCAFMCNYd3nGEL1QQ6zjpQz'; // 《创新招聘组每日数据》
const SHEET_NAME = '企微添加';

const CLI_JS = 'C:/Users/A1/.workbuddy/binaries/node/cli-connector-packages/node_modules/@wecom/cli/bin/wecom.js';
const run = args => {
  const r = spawnSync(process.execPath, [CLI_JS, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || r.error) throw new Error('wecom-cli 失败: ' + ((r.stderr || r.stdout || '') + (r.error?.message || '')).slice(0, 400));
  const raw = r.stdout || '';
  return JSON.parse(raw.slice(raw.indexOf('{')));
};

// 1. 找子表
const wb = run(['sheet', 'workbook', 'get', '--json', JSON.stringify({ docid: DOCID })]);
const sheet = (wb.sheets || []).find(s => s.name === SHEET_NAME);
if (!sheet) throw new Error('未找到子表：' + SHEET_NAME);
const m = sheet.range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
if (!m) throw new Error('无法解析子表范围：' + sheet.range);
const lastRow = Number(m[4]);
console.log(`子表 ${SHEET_NAME} 范围 ${sheet.range}（${lastRow} 行）`);

// 2. 读全量
const res = run(['sheet', 'cells', 'get', '--json', JSON.stringify({ docid: DOCID, sheet: sheet.sheet_id, range: `A1:F${lastRow}` })]);
const rows = res.cells || res.values;
if (!rows?.length) throw new Error('未读到数据');

// 3. 添加时间 → 北京时间（与 build-followup 同一约定：toISOString 结果即北京墙上时间）
// 表内格式混用：前段为 Excel 日期序列（数字），后段为 "2026/10/17 6:51" 字符串
const BASE = Date.UTC(1899, 11, 30);
const pad2 = n => String(n).padStart(2, '0');
const parseTs = v => {
  if (v && typeof v === 'object') return '';
  if (typeof v === 'number') return new Date(BASE + v * 86400000).toISOString();
  const s = String(v || '').trim();
  const mdt = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (mdt) {
    const [, y, mo, d, h = '00', mi = '00'] = mdt;
    return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}`;
  }
  if (/^\d+(\.\d+)?$/.test(s) && s) return new Date(BASE + Number(s) * 86400000).toISOString();
  return '';
};

// 4. 提取流水
const records = [];
const emptyish = v => v === null || v === undefined || (typeof v === 'object') || String(v).trim() === '';
for (const r of rows.slice(1)) {
  const g = i => emptyish(r[i]) ? '' : String(r[i]).trim();
  const person = g(0);
  if (!person || emptyish(r[2])) continue;
  const iso = parseTs(r[2]);
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) continue;
  records.push({
    p: person,
    d: iso.slice(0, 10),
    ts: iso.length >= 16 ? iso.slice(11, 16) : '',
    cand: g(4) || g(3) || '（未署名）',
  });
}
if (!records.length) throw new Error('无有效流水记录');

// 5. 聚合
const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = n => new Date(new Date(today + 'T00:00:00').getTime() - n * 86400000).toISOString().slice(0, 10);
const from7 = daysAgo(6), from30 = daysAgo(29);
const daily = {};
for (const r of records) daily[r.d] = (daily[r.d] || 0) + 1;
const in7 = records.filter(r => r.d >= from7);
const in30 = records.filter(r => r.d >= from30);
const peopleSet = [...new Set(records.map(r => r.p))];
const by_person = peopleSet.map(p => ({
  person: p,
  all: records.filter(r => r.p === p).length,
  last7: in7.filter(r => r.p === p).length,
  today: records.filter(r => r.p === p && r.d === today).length,
})).sort((a, b) => b.all - a.all);

const allDays = records.map(r => r.d).sort();
const out = {
  meta: {
    source: `企微表格《创新招聘组每日数据》「${SHEET_NAME}」子表`,
    captured_at: new Date().toISOString().slice(0, 16),
    today,
    rows_read: lastRow - 1,
    range: { from: allDays[0], to: allDays[allDays.length - 1] },
    note: '加微 = 企微新增好友流水，一条记录即一次成功添加；按添加时间统计。',
  },
  totals: { all: records.length, today: daily[today] || 0, last7: in7.length, last30: in30.length },
  by_person,
  daily,
  records: records.slice().sort((a, b) => (b.d + b.ts).localeCompare(a.d + a.ts)),
};

const outPath = resolve(root, 'jiawei-data.json');
writeFileSync(outPath, JSON.stringify(out));
console.log(`已写入 jiawei-data.json：流水 ${records.length} 条 · 区间 ${out.meta.range.from} — ${out.meta.range.to} · 今日 ${out.totals.today} · 近7日 ${out.totals.last7} · 近30日 ${out.totals.last30} · ${by_person.length} 位添加人`);
