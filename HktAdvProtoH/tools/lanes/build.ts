// Lanes 관찰판 — 레인 배차(LANES.md)와 저장소의 실제 상태를 겹쳐 두 축으로 그린다.
//
//   npm run lanes            LANES.html (흐름 축 + 배차 축) 을 만든다
//   npm run lanes:check      아무것도 쓰지 않고 판과 실제의 어긋남만 보고한다
//
// 축은 셋이고 이 도구는 그중 둘을 소유한다. 의미 축(Goal→Possibility→Capability)은
// master:graph 가 소유한다 — 여기서는 링크만 건다.
//
//   흐름 축   기획서 → master → 후보(작업리스트) → Cycle 1~8 → Feedback — 일감이 어디 있나
//   배차 축   어느 레인이 열려/막혀 있나 — LANES.md 렌더
//
// 원천은 전부 기존 Artifact 다 — 이 도구는 읽고 그릴 뿐, master/ 나 BACKLOG.md 를 수정하지
// 않는다. 판(LANES.md)의 판단(막힘·충돌)은 사람/Agent 소유이고, 여기서 겹치는 것은
// 기계가 셀 수 있는 사실(Stage 도달 · SELECTED · 미처리 Feedback · BACKLOG 수)뿐이다.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activePackDir } from '../active-pack';

function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

const HTML_FILE = 'LANES.html';
const ARTIFACT_FILE = 'LANES.artifact.html';
const STAGES = [
  '01-cycle.md',
  '02-intent.md',
  '03-world-semantic.md',
  '04-gameview.spec.yaml',
  '05-review.md',
  '06-world-implementation.md',
  '07-view-implementation.md',
  '08-verification.md',
];
const STAGE_LABELS = ['정의', '의도', '의미', '계약', '리뷰', 'World', 'View', '검증'];
const LANE_STATES = new Set(['OPEN', 'RUNNING', 'BLOCKED', 'HUMAN', 'HOLD']);

// ── 사실 수집 ──────────────────────────────────────────────────────────────

interface CycleFacts {
  id: string;
  reached: number; // 존재하는 Stage Artifact 의 최대 번호 (1~8)
  status: string; // 01-cycle.md 의 STATUS 값
}

interface TrackFacts {
  track: string; // ITEM · COMBAT …
  selected: string; // SELECTED 블록의 첫 줄
  candidates: number; // "### FR-" 후보 수
  cycle: CycleFacts | null; // SELECTED 가 가리키는 Cycle (있으면)
}

interface Facts {
  tracks: TrackFacts[];
  pendingFeedback: string[]; // 08 에 MASTER FEEDBACK 이 있는데 feedback/<id>.md 가 없다
  backlogItems: number;
  backlogStarted: string[]; // 상태에 V 번호가 적힌 항목
  designDocs: number; // <pack>/design/Design-*.md
}

function readCycle(cyclesDir: string, id: string): CycleFacts | null {
  const dir = join(cyclesDir, id);
  if (!existsSync(dir)) return null;
  let reached = 0;
  STAGES.forEach((f, i) => {
    if (existsSync(join(dir, f))) reached = i + 1;
  });
  const cyclePath = join(dir, '01-cycle.md');
  let status = '?';
  if (existsSync(cyclePath)) {
    const m = readFileSync(cyclePath, 'utf8').match(/^STATUS\s+(.+)$/m);
    if (m?.[1]) status = m[1].trim();
  }
  return { id, reached, status };
}

/** SELECTED 텍스트에서 Cycle 디렉터리를 찾는다 — 전체 이름 또는 번호(`C025` · `C-ITEM-001`)만으로도 */
function cycleIdIn(text: string, cyclesDir: string): string | null {
  const full = text.match(/C(?:-[A-Z]+-\d+|\d{3})-[a-z0-9-]+/);
  if (full && existsSync(join(cyclesDir, full[0]))) return full[0];
  const bare = text.match(/C(?:-[A-Z]+-\d+|\d{3})(?![\w-])/);
  if (bare && existsSync(cyclesDir))
    for (const d of readdirSync(cyclesDir)) if (d.startsWith(`${bare[0]}-`)) return d;
  return null;
}

function collectFacts(packDir: string): Facts {
  const cyclesDir = join(packDir, 'cycles');
  const frontierDir = join(packDir, 'master', 'frontier');
  const feedbackDir = join(packDir, 'master', 'feedback');
  const designDir = join(packDir, 'design');

  const tracks: TrackFacts[] = [];
  if (existsSync(frontierDir)) {
    for (const f of readdirSync(frontierDir).sort()) {
      if (!f.endsWith('.md') || f === 'README.md') continue;
      const text = readFileSync(join(frontierDir, f), 'utf8');
      const sel = text.match(/## SELECTED\s*\n+```text\n([\s\S]*?)```/)?.[1];
      const selected = sel ? (sel.trim().split('\n')[0] ?? '').trim() : '(SELECTED 절 없음)';
      const candidates = (text.match(/^### FR-/gm) ?? []).length;
      const cycleId = sel ? cycleIdIn(sel, cyclesDir) : null;
      tracks.push({
        track: f.replace(/\.md$/, '').toUpperCase(),
        selected,
        candidates,
        cycle: cycleId ? readCycle(cyclesDir, cycleId) : null,
      });
    }
  }

  // 미처리 Feedback — feedback-gate 와 같은 규칙. 옛 번호공간은 feedback/ 도입(C024 전후)
  // 이전 것을 HISTORY 가 소유하므로, 08 이 명시적으로 feedback 레인을 지목한 것만 센다.
  const pendingFeedback: string[] = [];
  if (existsSync(cyclesDir)) {
    for (const e of readdirSync(cyclesDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const v = join(cyclesDir, e.name, '08-verification.md');
      if (!existsSync(v)) continue;
      const text = readFileSync(v, 'utf8');
      if (!text.includes('MASTER FEEDBACK')) continue;
      if (existsSync(join(feedbackDir, `${e.name}.md`))) continue;
      const isTrack = /^C-[A-Z]+-\d+/.test(e.name);
      const asksFeedback = /feedback\/(?:<CycleId>|C[\w-]*)\.md|FEEDBACK\s*레인/i.test(text);
      if (isTrack || asksFeedback) pendingFeedback.push(e.name);
    }
  }
  pendingFeedback.sort();

  let backlogItems = 0;
  const backlogStarted: string[] = [];
  const backlogPath = join(packDir, 'BACKLOG.md');
  if (existsSync(backlogPath)) {
    const text = readFileSync(backlogPath, 'utf8');
    const items = text.split(/^### /m).slice(1);
    backlogItems = items.length;
    for (const item of items) {
      if (/상태\s+IN PROGRESS/.test(item)) backlogStarted.push(item.split(/\s|—/)[0] ?? '?');
    }
  }
  const designDocs = existsSync(designDir)
    ? readdirSync(designDir).filter((f) => /^Design-.*\.md$/.test(f)).length
    : 0;

  return { tracks, pendingFeedback, backlogItems, backlogStarted, designDocs };
}

// ── 배차판 파싱 ────────────────────────────────────────────────────────────

interface LaneRow {
  lane: string;
  state: string;
  now: string;
  waiting: string;
}

interface Board {
  rows: LaneRow[];
  problems: string[];
}

function parseBoard(packDir: string): Board {
  const path = join(packDir, 'LANES.md');
  const problems: string[] = [];
  if (!existsSync(path)) return { rows: [], problems: ['LANES.md 가 없다'] };
  const text = readFileSync(path, 'utf8');
  const rows: LaneRow[] = [];
  const section = text.match(/## 레인\n([\s\S]*?)(?=\n## |$)/)?.[1];
  if (!section) return { rows, problems: ['LANES.md 에 "## 레인" 절이 없다'] };
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!m) continue;
    const [, lane = '', state = '', now = '', waiting = ''] = m;
    if (lane === '레인' || /^-+$/.test(lane.replace(/\s/g, ''))) continue;
    if (!LANE_STATES.has(state)) problems.push(`레인 "${lane}" 의 상태 "${state}" 는 어휘 밖이다 (OPEN·RUNNING·BLOCKED·HUMAN·HOLD)`);
    rows.push({ lane, state, now, waiting });
  }
  if (rows.length === 0) problems.push('LANES.md 레인 표에 줄이 없다');
  return { rows, problems };
}

// ── 판과 사실의 대조 (check) ───────────────────────────────────────────────

function crossCheck(board: Board, facts: Facts): string[] {
  const warns: string[] = [];
  const row = (name: string) => board.rows.find((r) => r.lane.toUpperCase().includes(name));

  const fb = row('FEEDBACK');
  if (facts.pendingFeedback.length > 0) {
    if (fb && !['OPEN', 'RUNNING'].includes(fb.state))
      warns.push(`미처리 Feedback 이 있는데(${facts.pendingFeedback.join(' · ')}) FEEDBACK 레인이 ${fb.state} 다`);
    for (const id of facts.pendingFeedback) {
      const short = id.match(/^C(?:-[A-Z]+-\d+|\d{3})/)?.[0] ?? id;
      if (fb && !fb.now.includes(short)) warns.push(`FEEDBACK "지금" 칸이 ${short} 를 말하지 않는다`);
    }
  } else if (fb && fb.state === 'OPEN' && /반영/.test(fb.now)) {
    warns.push('미처리 Feedback 이 없는데 FEEDBACK 레인이 반영 대기로 적혀 있다');
  }

  for (const t of facts.tracks) {
    const r = row(t.track);
    if (!r) {
      warns.push(`frontier 트랙 ${t.track} 이 배차판에 없다`);
      continue;
    }
    const hasSelected = !/없음|대기/.test(t.selected);
    // 닫혔지만 Feedback 이 아직 후보를 쓸어내지 않은 트랙은 후보 수가 부풀어 있다 — 대조하지 않는다
    const unswept = t.cycle !== null && facts.pendingFeedback.includes(t.cycle.id);
    // SELECTED 가 있으면 레인은 대개 OPEN·RUNNING 이다. **다만 HUMAN 은 예외다** —
    // 그 트랙의 Cycle 이 Human 관문(Stage 5 Semantic Review · Stage 8 Human Play)에
    // 서 있으면 works.md 는 HUMAN 이라 적으라고 한다. 그 경우까지 어긋남으로 세면
    // 판이 맞는데 검사가 상시로 시끄러워지고, 시끄러운 검사는 아무도 안 본다.
    const waitsOnHuman =
      r.state === 'HUMAN' && t.cycle !== null && !/COMPLETE/.test(t.cycle.status);
    if (hasSelected && !['OPEN', 'RUNNING'].includes(r.state) && !waitsOnHuman)
      warns.push(`${t.track}: SELECTED 가 있는데("${t.selected}") 레인이 ${r.state} 다`);
    if (!hasSelected && !unswept && t.candidates > 0 && r.state === 'BLOCKED')
      warns.push(`${t.track}: 후보가 ${t.candidates}개 있는데 BLOCKED 다 — HUMAN(선택 대기)이 맞지 않나`);
    if (t.candidates === 0 && r.state === 'HUMAN')
      warns.push(`${t.track}: 후보가 0 인데 HUMAN(선택 대기)이다 — 고를 것이 없다`);
  }

  const view = row('VIEW');
  if (view && facts.backlogItems === 0 && view.state === 'OPEN')
    warns.push('VIEW: BACKLOG 가 비었는데 OPEN 이다');
  return warns;
}

// ── HTML 렌더 ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stageBar(c: CycleFacts | null): string {
  if (!c) return '<span class="dim">Cycle 없음</span>';
  const done = /COMPLETE/.test(c.status);
  const cells = STAGE_LABELS.map((label, i) => {
    const n = i + 1;
    const cls = done ? 'st done' : n < c.reached ? 'st done' : n === c.reached ? 'st here' : 'st';
    return `<span class="${cls}" title="Stage ${n}">${n} ${label}</span>`;
  }).join('');
  return `<div class="cycle"><b>${esc(c.id)}</b> <span class="dim">— ${esc(c.status)}</span><div class="bar">${cells}</div></div>`;
}

function laneClass(state: string): string {
  return { OPEN: 'open', RUNNING: 'run', BLOCKED: 'blk', HUMAN: 'hum', HOLD: 'hold' }[state] ?? '';
}

function renderParts(board: Board, facts: Facts, warns: string[]): { style: string; body: string } {
  const trackRows = facts.tracks
    .map(
      (t) => `<div class="flow">
  <div class="fhead"><b>WORLD·${esc(t.track)}</b><span class="dim">후보 ${t.candidates}</span></div>
  <div class="pipe">기획서(design/) → master(graph) → <b>후보</b> ${esc(t.selected)}</div>
  ${stageBar(t.cycle)}
  <div class="pipe">→ Feedback ${
    facts.pendingFeedback.some((id) => t.cycle && id === t.cycle.id) ? '<span class="warn">미반영</span>' : '<span class="dim">—</span>'
  }</div>
</div>`,
    )
    .join('\n');

  const viewFlow = `<div class="flow">
  <div class="fhead"><b>VIEW</b></div>
  <div class="pipe">UX 기획서 → 주입(번역) → <b>BACKLOG ${facts.backlogItems}건</b>${
    facts.backlogStarted.length ? ` · 착수 ${facts.backlogStarted.map(esc).join(', ')}` : ''
  } → V-NNN 닫기</div>
</div>`;

  const fbFlow = `<div class="flow">
  <div class="fhead"><b>FEEDBACK</b></div>
  <div class="pipe">닫힌 Cycle → 미처리 ${
    facts.pendingFeedback.length ? `<span class="warn">${facts.pendingFeedback.map(esc).join(' · ')}</span>` : '<span class="dim">없음</span>'
  } → overlay · frontier 반영</div>
</div>`;

  const boardRows = board.rows
    .map(
      (r) =>
        `<tr><td><b>${esc(r.lane)}</b></td><td><span class="lane ${laneClass(r.state)}">${esc(r.state)}</span></td><td>${esc(r.now)}</td><td>${esc(r.waiting)}</td></tr>`,
    )
    .join('\n');

  const warnBlock = warns.length
    ? `<div class="sec"><h2>판과 실제의 어긋남</h2><ul>${warns.map((w) => `<li class="warn">${esc(w)}</li>`).join('')}</ul></div>`
    : '';

  const style = `<style>
:root{color-scheme:light dark;--bg:#f7f7f5;--panel:#fff;--line:#d8d8d2;--ink:#1b1b19;--ink2:#5c5c55;
--open:#2f7d3f;--open-bg:#ddf0e2;--run:#4a6785;--run-bg:#e3ecf6;--blk:#b91c1c;--blk-bg:#fbe3e3;
--hum:#a5871a;--hum-bg:#f6eecd;--hold:#7a7a84;--hold-bg:#e8e8ea;--warn:#b45309;--done:#2f7d3f;--here:#a5871a}
@media (prefers-color-scheme:dark){:root{--bg:#14141a;--panel:#1c1c24;--line:#33333f;--ink:#e8e8ef;--ink2:#a8a8b8;
--open:#5cbf72;--open-bg:#16351f;--run:#7ea3cc;--run-bg:#1f2d3d;--blk:#f87171;--blk-bg:#3a1c1c;
--hum:#d6c04e;--hum-bg:#35301a;--hold:#7b7b8c;--hold-bg:#26262e;--warn:#fbbf24;--done:#5cbf72;--here:#d6c04e}}
body{margin:0;background:var(--bg);color:var(--ink);font:13px/1.6 -apple-system,'Noto Sans KR','Malgun Gothic',sans-serif;padding:18px}
h1{font-size:16px;margin:0 0 4px}.sub{color:var(--ink2);margin:0 0 18px;font-size:12px}
.sec{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:0 0 14px;overflow-x:auto}
.sec h2{margin:0 0 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2)}
.flow{padding:8px 0;border-top:1px dashed var(--line)}.flow:first-of-type{border-top:0}
.fhead{display:flex;gap:10px;align-items:baseline;margin-bottom:2px}
.pipe{color:var(--ink2)}.dim{color:var(--ink2);opacity:.75}
.cycle{margin:4px 0}.bar{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}
.st{border:1px solid var(--line);border-radius:4px;padding:1px 6px;font-size:11px;color:var(--ink2)}
.st.done{border-color:var(--done);color:var(--done)}.st.here{border-color:var(--here);color:var(--here);font-weight:600}
table{border-collapse:collapse;width:100%}td,th{border-top:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
tr:first-child td{border-top:0}
.lane{display:inline-block;border-radius:4px;padding:1px 7px;font-size:11px;font-weight:600}
.lane.open{background:var(--open-bg);color:var(--open)}.lane.run{background:var(--run-bg);color:var(--run)}
.lane.blk{background:var(--blk-bg);color:var(--blk)}.lane.hum{background:var(--hum-bg);color:var(--hum)}
.lane.hold{background:var(--hold-bg);color:var(--hold)}
.warn{color:var(--warn)}a{color:var(--run)}
</style>`;
  const body = `<h1>Lanes — 흐름 · 배차 관찰판</h1>
<p class="sub">생성물이다 — 원천은 LANES.md · frontier/ · cycles/ · BACKLOG.md. 의미 축(Goal→Capability)은
<a href="master/graph/graph-view.html">master graph 뷰어</a>가 소유한다. 팩 기획서(design/) ${facts.designDocs}건.</p>
${warnBlock}
<div class="sec"><h2>흐름 축 — 일감이 어디 있나</h2>
${trackRows}
${viewFlow}
${fbFlow}
</div>
<div class="sec"><h2>배차 축 — 레인 상태 (LANES.md)</h2>
<table><tr><th>레인</th><th>상태</th><th>지금</th><th>기다리는 것</th></tr>
${boardRows}
</table></div>
`;
  return { style, body };
}

function renderHtml(board: Board, facts: Facts, warns: string[]): string {
  const { style, body } = renderParts(board, facts, warns);
  return `<!doctype html><html lang="ko"><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lanes — 흐름 · 배차 관찰판</title>
${style}</head><body>
${body}</body></html>
`;
}

/** Artifact 발행판 — 발행기가 스켈레톤을 감싸므로 title + style + body 만 낸다 */
function renderArtifactPage(board: Board, facts: Facts, warns: string[]): string {
  const { style, body } = renderParts(board, facts, warns);
  return `<title>Lanes Board</title>
${style}
${body}`;
}

// ── 실행 ───────────────────────────────────────────────────────────────────

export function run(argv: string[]): number {
  const checkOnly = argv.includes('--check');
  const packDir = activePackDir(projectRoot());
  const facts = collectFacts(packDir);
  const board = parseBoard(packDir);
  const warns = crossCheck(board, facts);

  for (const p of board.problems) console.error(`✗ ${p}`);
  for (const w of warns) console.log(`· ${w}`);

  if (checkOnly) {
    if (board.problems.length > 0) {
      console.error('\n배차판 구조 실패');
      return 1;
    }
    console.log(warns.length === 0 ? '· 판과 실제가 맞는다' : `\n어긋남 ${warns.length}건 — LANES.md 를 갱신할 것`);
    return warns.length === 0 ? 0 : 1;
  }

  const htmlPath = join(packDir, HTML_FILE);
  writeFileSync(htmlPath, renderHtml(board, facts, warns), 'utf8');
  writeFileSync(join(packDir, ARTIFACT_FILE), renderArtifactPage(board, facts, warns), 'utf8');
  console.log(`· LANES.html 갱신 — 트랙 ${facts.tracks.length} · 레인 줄 ${board.rows.length} · 미처리 Feedback ${facts.pendingFeedback.length}`);
  return board.problems.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
