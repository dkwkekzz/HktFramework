// World Lab — 후보 방들을 나란히 놓고 사람이 판정하는 자리 (T6 ADDED).
//
//   npm run world:lab                 후보를 모아 tools/world-editor/out/lab.html 한 장을 만든다
//   쓸 수 있는 것: --out <디렉터리> (후보가 머무는 자리)
//
// 판정하지 않는다 — **판정에 필요한 것을 한 화면에 모을 뿐**이다. 좋고 나쁨은 사람이 정한다
// (Tool-Scale §4 "재미를 판정하지 않는다"). 그래서 이 페이지에는 점수도 순위도 없고,
// 방마다 넷을 나란히 둔다: 위에서 본 그림 · 여덟 답 · 등급과 빠진 것 · **세계의 수가 어디로 미는가**.
//
// 넷째가 이 화면의 까닭이다. 한 방만 보면 다 그럴듯하다 — 백 개를 나란히 놓아야 기회 자리가
// 한쪽으로 쏠리는 것이, 어느 Carrier 만 느는 것이, 고립된 방이 는 것이 보인다. 그 수는 검사(T1)가
// 이미 세고 있으므로 새로 세지 않고, 후보를 넣기 전과 넣은 뒤를 견주어 **움직인 줄만** 싣는다.
//
// 페이지는 파일 하나다 — 그림도 안에 담는다(data URI). 띄울 서버가 없어야 어디서든 열린다.
// 그래서 이 페이지는 아무것도 쓰지 못한다: 승인은 `world:admit` 이 하고, 페이지는 그 명령을
// 방마다 적어 둘 뿐이다. **쓰는 자는 언제나 도구 하나**여야 한다.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANSWER_ORDER, isUnanswered, answerOf } from '../../engine/world-authoring/brief';
import { CANDIDATES_DIR, readCandidates, type Candidate } from './candidates';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 여덟 답의 사람이 읽는 이름 — Concept §17 의 일곱 + Life §3.5 의 여덟째 */
const ANSWER_NAMES: Record<string, string> = {
  distinction: '특별함',
  cause: '원인',
  dwelling: '거주',
  danger: '위험',
  worth: '귀함',
  discovery: '발견',
  opening: '열림',
  birth: '탄생',
};

/**
 * **아직 재지 못하는 편중**을 화면이 숨기지 않는다.
 *
 * 재료 계통의 편중(⑲ 기회 자리 · ⑳ Carrier · ㉒ 고립)은 실린다 — 후보의 원천과 그것이 새로
 * 낳는 재료를 함께 넣어 재기 때문이다 (author.ts 의 checkAuthored).
 *
 * 아직 못 재는 것은 **검사 자체가 없는 것들**이다: 철(㉕ ㉖ · C018) · 생명(㉚ ㉝ · C022 · C025) ·
 * 접근(㊱~㊵ ㊷ · Access). 없는 것을 통과로 적지 않는 것이 이 저장소의 어법이므로
 * (검사의 `absent`), 무엇을 못 재는지도 함께 적는다.
 */
const NOT_MEASURED =
  '<p class="none">아직 재지 못하는 편중 — 철(㉕ ㉖) · 생명(㉚ ㉝) · 접근(㊱~㊵ ㊷). ' +
  '그 검사들은 아직 세계에 없다 (C018 · C022 · C025 · Access).</p>';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 후보 하나의 카드 */
function card(candidate: Candidate): string {
  const { judgement, brief } = candidate;
  const badge =
    judgement.outcome === 'passed'
      ? `<span class="badge grade-${judgement.grade}">등급 ${judgement.grade}</span>`
      : judgement.outcome === 'returned'
        ? `<span class="badge returned">돌아옴 · 등급 ${judgement.grade ?? '?'}</span>`
        : '<span class="badge failed">서지 못했다</span>';

  const parts: string[] = [];
  parts.push('<article class="card">');
  parts.push(
    `<header><h2>${escapeHtml(brief?.name ?? candidate.key)}</h2>${badge}` +
      `<p class="id">${escapeHtml(candidate.key)}${
        brief ? ` · 깊이 ${escapeHtml(brief.depth)}` : ''
      }${brief && brief.kinds.length > 0 ? ` · ${escapeHtml(brief.kinds.join(' '))}` : ''}</p>` +
      `<p class="unknown">${escapeHtml(judgement.unknown)}</p></header>`,
  );

  // ① 위에서 본 그림 — 컴파일 결과 그대로다 (도구가 덧그리지 않는다)
  parts.push(
    candidate.topPng
      ? `<img class="top" alt="${escapeHtml(candidate.key)} 를 위에서 본 그림"` +
        ` src="data:image/png;base64,${candidate.topPng.toString('base64')}">`
      : '<div class="top empty">그림이 없다 — 서지 못한 방은 컴파일할 것이 없다</div>',
  );

  // ② 여덟 답 — 비운 답은 비운 채로 보인다 (지어내지 않았다는 것이 판정의 재료다)
  if (brief) {
    const rows = ANSWER_ORDER.map((key) => {
      const answer = answerOf(brief, key);
      const empty = isUnanswered(answer);
      return (
        `<tr class="${empty ? 'unanswered' : ''}"><th>${ANSWER_NAMES[key] ?? key}</th>` +
        `<td>${escapeHtml(empty ? `아직 — ${answer.unanswered}` : answer)}</td></tr>`
      );
    }).join('');
    parts.push(`<table class="answers">${rows}</table>`);
    const sources = brief.answers.worth.sources;
    if (sources.length > 0) {
      parts.push(
        `<p class="sources">원천 ${sources.length} — ` +
          sources
            .map((s) => `${escapeHtml(s.id)}(${escapeHtml(s.material)} · ${escapeHtml(s.role)})`)
            .join(' · ') +
          '</p>',
      );
    }
    if (brief.neighbours.length > 0) {
      parts.push(
        `<p class="sources">이웃 — ` +
          brief.neighbours
            .map(
              (n) =>
                `${escapeHtml(n.region)}(${escapeHtml(n.transition)}${n.frontier ? ' · 경계' : ''})`,
            )
            .join(' · ') +
          '</p>',
      );
    }
  }

  // ③ 세계의 수가 어디로 미는가 — 편중 요약
  if (judgement.shifts.length > 0) {
    const rows = judgement.shifts
      .map(
        (shift) =>
          `<tr class="${shift.broke ? 'broke' : ''}"><th>${shift.mark} ${escapeHtml(shift.name)}</th>` +
          `<td>${shift.before === undefined ? '' : `${escapeHtml(shift.before)} →`} ` +
          `${escapeHtml(shift.after)}</td></tr>`,
      )
      .join('');
    parts.push(
      '<h3>이 방이 세계를 미는 자리</h3>',
      `<table class="shifts">${rows}</table>`,
      NOT_MEASURED,
    );
  } else if (judgement.outcome === 'passed') {
    parts.push(
      '<h3>이 방이 세계를 미는 자리</h3>',
      '<p class="none">움직인 수가 없다.</p>',
      NOT_MEASURED,
    );
  }

  // ④ 걸린 것 · 아직 답하지 않은 것
  const gaps = (title: string, list: typeof judgement.blocking) =>
    list.length === 0
      ? ''
      : `<h3>${title}</h3><ul class="gaps">` +
        list
          .map(
            (gap) =>
              `<li><b>${escapeHtml(gap.required)}</b><br>${escapeHtml(gap.missing)}` +
              `${gap.reason ? `<br><i>${escapeHtml(gap.reason)}</i>` : ''}` +
              `<br><span class="return">→ ${escapeHtml(gap.returnTo)}</span></li>`,
          )
          .join('') +
        '</ul>';
  parts.push(gaps('등급을 가른 것', judgement.blocking));
  parts.push(gaps('아직 답하지 않은 질문', judgement.pending));

  if (judgement.outcome !== 'passed') {
    const rounds = judgement.rounds
      .filter((round) => round.problems.length > 0)
      .map(
        (round) =>
          `<li>${round.round} 번째 (${round.stage === 'shape' ? '형' : '세계'})<ul>` +
          round.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join('') +
          '</ul></li>',
      )
      .join('');
    if (rounds) parts.push('<h3>무엇이 걸렸는가</h3>', `<ul class="rounds">${rounds}</ul>`);
  }

  // 승인/반려 — 페이지는 쓰지 못한다. 명령을 적어 둘 뿐이다
  parts.push(
    '<footer>',
    judgement.outcome === 'passed'
      ? `<code>npm run world:admit -- ${escapeHtml(candidate.key)}</code>` +
        `<code class="reject">npm run world:admit -- ${escapeHtml(candidate.key)} --reject</code>`
      : `<code class="reject">npm run world:admit -- ${escapeHtml(candidate.key)} --reject</code>` +
        '<span class="note">서지 못한 방은 들일 수 없다</span>',
    '</footer>',
  );
  parts.push('</article>');
  return parts.join('');
}

const STYLE = `
:root { color-scheme: dark; }
body { margin: 0; padding: 24px; background: #070910; color: #d8dee9;
       font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.65; }
h1 { color: #eaf0ff; font-size: 16px; margin: 0 0 4px; }
.lead { color: #7f8aa0; font-size: 12px; margin: 0 0 20px; max-width: 820px; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); }
.card { background: #0d1018; border: 1px solid #1c2231; border-radius: 8px; padding: 14px 16px; }
.card header { border-bottom: 1px solid #1c2231; padding-bottom: 8px; margin-bottom: 10px; }
h2 { color: #eaf0ff; font-size: 14px; margin: 0 8px 0 0; display: inline; }
h3 { color: #9dcaff; font-size: 11px; margin: 14px 0 4px; text-transform: none; }
.id { color: #5d6879; font-size: 11px; font-family: ui-monospace, monospace; margin: 4px 0 0; }
.unknown { color: #a9b4c7; font-size: 12px; margin: 6px 0 0; font-style: italic; }
.badge { font-size: 11px; padding: 1px 7px; border-radius: 10px; vertical-align: 2px; }
.grade-A { background: #14361f; color: #7ee2a8; }
.grade-B { background: #3a3113; color: #e8c964; }
.grade-C, .returned { background: #3a1d13; color: #f0a07c; }
.failed { background: #2a2f3c; color: #9aa5b8; }
img.top { display: block; width: 100%; max-width: 240px; margin: 0 auto 10px;
          image-rendering: pixelated; border: 1px solid #1c2231; border-radius: 4px; }
.top.empty { color: #5d6879; font-size: 11px; text-align: center; padding: 24px 0; }
table { width: 100%; border-collapse: collapse; }
th { color: #7f8aa0; font-weight: 600; text-align: left; vertical-align: top;
     padding: 3px 8px 3px 0; white-space: nowrap; font-size: 11px; }
td { padding: 3px 0; vertical-align: top; }
.answers tr.unanswered td { color: #6b7688; font-style: italic; }
.shifts th { color: #9dcaff; white-space: normal; }
.shifts tr.broke td { color: #f0a07c; }
.sources { color: #8b96a8; font-size: 11px; margin: 6px 0 0;
           font-family: ui-monospace, monospace; }
.none { color: #5d6879; font-size: 11px; margin: 2px 0; }
ul { margin: 4px 0; padding-left: 18px; }
.gaps li { margin-bottom: 8px; }
.gaps i { color: #8b96a8; font-style: normal; }
.gaps .return { color: #7f8aa0; font-size: 11px; }
.rounds { color: #b9a08a; font-size: 11.5px; }
footer { margin-top: 14px; padding-top: 10px; border-top: 1px solid #1c2231; }
code { display: block; background: #131824; color: #9dcaff; padding: 5px 8px; border-radius: 4px;
       font-family: ui-monospace, monospace; font-size: 11px; margin-bottom: 4px;
       user-select: all; }
code.reject { color: #8b96a8; }
.note { color: #5d6879; font-size: 11px; }
`;

/** 후보들을 한 장으로 — 파일 하나이고 그림도 안에 담는다 */
export function renderLab(candidates: readonly Candidate[]): string {
  const passed = candidates.filter((c) => c.judgement.outcome === 'passed').length;
  const returned = candidates.filter((c) => c.judgement.outcome === 'returned').length;
  const failed = candidates.length - passed - returned;
  return (
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<title>World Lab — 후보 방 판정</title>' +
    `<style>${STYLE}</style></head><body>` +
    '<h1>World Lab — 후보 방 판정</h1>' +
    `<p class="lead">후보 ${candidates.length} — 선 것 ${passed} · 돌아온 것 ${returned} · 못 선 것 ${failed}.
     판정하지 않는다. 무엇을 세계에 들일지는 사람이 정하고, 이 화면은 그 판정에 필요한 것을 모을 뿐이다.
     한 방만 보면 다 그럴듯하다 — 나란히 놓아야 편중이 보인다.</p>` +
    (candidates.length === 0
      ? '<p class="none">후보가 없다. <code>npm run world:draft -- --batch &lt;목록파일&gt;</code> 로 낸다.</p>'
      : `<div class="grid">${candidates.map(card).join('')}</div>`) +
    '</body></html>'
  );
}

function main(argv: readonly string[]): number {
  const valueOf = (name: string): string | undefined => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const known = ['--out'];
  const unknown = argv.filter((arg) => arg.startsWith('--') && !known.includes(arg));
  const values = ['out'].map(valueOf).filter((v) => v !== undefined);
  const extra = argv.filter((arg) => !arg.startsWith('--') && !values.includes(arg));
  if (unknown.length > 0 || extra.length > 0) {
    process.stderr.write(
      [
        '  world:lab — 후보 방들을 나란히 놓는다',
        `    모르는 인자: ${[...unknown, ...extra].join(' ')}`,
        '    사용: npm run world:lab [-- --out <디렉터리>]',
        '',
      ].join('\n'),
    );
    return 2;
  }

  const dir = valueOf('out') ?? CANDIDATES_DIR;
  const candidates = readCandidates(dir);
  const out = resolve(ROOT, 'tools/world-editor/out/lab.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderLab(candidates), 'utf8');
  process.stdout.write(
    `  후보 ${candidates.length} → tools/world-editor/out/lab.html  (${dir} 에서 읽었다)\n`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
