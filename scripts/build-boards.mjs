// 从 BOSS 快照（服务客户 × 招聘人员）提取「项目池」账号归属，
// 注入 project-data.json（新增 project_pools 字段）。
// 用法：node scripts/build-boards.mjs [boss快照csv路径]（默认取最新快照目录）
// 客户名归一化表见下方 ALIAS。只写 project-data.json，其他文件不动。
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// ---------- 定位最新 BOSS 快照 ----------
function latestBossCsv() {
  if (process.argv[2]) return resolve(process.argv[2]);
  const base = 'C:/Users/A1/WorkBuddy/Claw/outputs/wecom_snapshot';
  if (!existsSync(base)) throw new Error('未找到快照目录：' + base);
  const dirs = readdirSync(base).filter(d => statSync(join(base, d)).isDirectory()).sort();
  for (const d of dirs.reverse()) {
    const f = join(base, d, 'boss.csv');
    if (existsSync(f)) return f;
  }
  throw new Error('快照目录中无 boss.csv');
}

const csvPath = latestBossCsv();
const text = readFileSync(csvPath, 'utf8');
const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
const header = lines[0].split(',').map(s => s.trim());
const iWho = header.indexOf('招聘人员');
const iClient = header.indexOf('服务客户');
const iJob = header.indexOf('职位简称');
const iPub = header.indexOf('职位发布');
const iDate = header.indexOf('日期');
if (iWho < 0 || iClient < 0) throw new Error('boss.csv 缺少 招聘人员/服务客户 列');

// 解析 CSV 行（处理引号内逗号）
function parseLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// ---------- 客户名归一化 ----------
const ALIAS = [
  ['天超电器', ['天超电器', '天超']],
  ['星驱科技', ['星驱科技', '星 驱科技', '星驱', '桐乡星驱']],
  ['东睦集团', ['东睦集团', '东睦']],
  ['合达电子', ['合达电子', '合达']],
  ['福建骏鹏', ['福建骏鹏', '骏鹏']],
  ['博格华纳', ['博格华纳', '博格']],
  ['泰昌铁塔', ['泰昌', '温州泰昌铁塔']],
  ['慈兴集团', ['慈兴', '慈兴集团']],
  ['美硕电子', ['美硕', '温州美硕']],
  ['秋水外包', ['秋水', '宁波秋水外包']],
  ['达尔实业', ['达尔']],
];
const canon = name => {
  for (const [std, list] of ALIAS) if (list.includes(name)) return std;
  return name;
};

// ---------- 聚合：客户 → 账号（人）→ 岗位 ----------
// 只统计近期（最近 14 个有数据的日期）活跃的客户-账号组合
const pool = new Map(); // client -> person -> {jobs:Set, lastDay, days}
for (const line of lines.slice(1)) {
  const cells = parseLine(line);
  const who = (cells[iWho] || '').trim();
  const client = canon((cells[iClient] || '').trim());
  const job = (cells[iJob] || cells[iPub] || '').trim();
  const day = (cells[iDate] || '').trim();
  if (!who || !client) continue;
  if (!pool.has(client)) pool.set(client, new Map());
  const people = pool.get(client);
  if (!people.has(who)) people.set(who, { jobs: new Set(), lastDay: '', days: new Set() });
  const rec = people.get(who);
  if (job) rec.jobs.add(job);
  if (day) { rec.days.add(day); if (day > rec.lastDay) rec.lastDay = day; }
}

const project_pools = [...pool.entries()].map(([client, people]) => ({
  client,
  accounts: [...people.entries()].map(([person, r]) => ({
    person,
    job_count: r.jobs.size,
    jobs: [...r.jobs],
    last_day: r.lastDay,
    active_days: r.days.size,
  })).sort((a, b) => b.job_count - a.job_count || a.person.localeCompare(b.person, 'zh')),
  account_count: people.size,
})).sort((a, b) => b.account_count - a.account_count || a.client.localeCompare(b.client, 'zh'));

// ---------- 注入 project-data.json ----------
const projPath = resolve(root, 'project-data.json');
const proj = JSON.parse(readFileSync(projPath, 'utf8'));
proj.project_pools = project_pools;
proj.pool_meta = {
  source: 'BOSS数据底表快照（服务客户×招聘人员）',
  csv: csvPath,
  generated_at: new Date().toISOString(),
  note: '项目池=BOSS 账号挂靠的客户；账号=该客户下有岗位发布记录的招聘人员账号。',
};
writeFileSync(projPath, JSON.stringify(proj));
const totalAccounts = project_pools.reduce((s, p) => s + p.account_count, 0);
console.log(`已生成项目池：${project_pools.length} 个项目池 · ${totalAccounts} 个账号归属 · 来源 ${csvPath}`);
