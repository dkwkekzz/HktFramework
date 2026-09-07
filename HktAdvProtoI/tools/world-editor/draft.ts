// World Draft — 미지 한 줄에서 brief 하나를 낸다 (T5 ADDED).
//
//   npm run world:draft -- "<미지 한 줄>"            낼 것을 글자로 보인다 (파일을 쓰지 않는다)
//   npm run world:draft -- "<미지 한 줄>" --write    content/authoring/briefs/<ID>.json 을 굳힌다
//   쓸 수 있는 것: --attempts <N> (되먹임 상한 · 기본 3) · --model <이름> (기본 opus)
//                  --answer <파일> (모델을 부르지 않고 그 파일을 답으로 — 재현 · 시험용)
//
// 고리는 기반이 돈다 (engine/world-authoring/draft.ts). 이 도구가 하는 일은 넷이다:
// **모델을 부르는 것** · 시스템 글을 짓도록 문서를 열어 주는 것 · 낸 것을 이 세계에 넣어 재는 것
// (T4 → T3 → T1) · 통과한 것을 파일로 굳히는 것.
//
// ── 모델을 어떻게 부르는가
//
// `claude -p` 를 자식 프로세스로 부른다. Claude Code 의 비대화 모드라 **구독 로그인을 그대로
// 쓴다** — Console API 키가 필요 없다. 답은 자유 문장이 아니라 `--json-schema` 가 강제하는
// 구조화 출력이고, 그 값이 `structured_output` 으로 온다.
//   · 시스템 글은 `--system-prompt-file` 로 건넨다 — 확정 문서를 줄이지 않고 이으면 십만 자를
//     넘고, 인자 하나의 상한(리눅스 128 KiB)에 걸린다.
//   · `--tools "" --setting-sources "" --strict-mcp-config --no-session-persistence`
//     도구도 훅도 MCP 도 세션 저장도 없이 **답 하나만** 받는다. 이 도구는 저장소를 읽고 쓰는
//     주체가 여기(우리 코드)임을 지킨다 — 부른 쪽이 무엇을 만졌는지 모르는 일이 없어야 한다.
//   · `--bare` 는 쓰지 않는다 — 구독 로그인을 읽지 않는다 (API 키 전용 모드다).
//   · `ANTHROPIC_API_KEY` 는 자식에게서 지운다 — 남아 있으면 `-p` 에서 묻지 않고 그 키가 이긴다.
//
// ── 무엇이 세계에 들어가는가
//
// 굳히는 것은 **brief 하나뿐**이다. 방 파일(content/regions/)은 이 도구가 쓰지 않는다 —
// 사람이 `world:author -- <그 brief> --write` 로 들인다. 승인 표면은 T6 의 것이고, 그때까지
// "무엇이 세계에 들어가는가" 는 사람의 자리로 남는다 (Tool-Scale §4).
//
// 초안은 비결정이다. 그래도 세계는 결정론이다 — 굳은 brief 가 원본이고, 거기서 나오는 방은
// 언제나 같다 (T3 의 seed 는 brief 의 해시다).

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { REGION_SPECS } from '../../content/regions';
import { DRAFT_PROMPT, WORLD_CONTRACTS } from '../../content/authoring';
import { RegionBriefSchema, type RegionBrief } from '../../engine/world-authoring/brief';
import {
  draftRegion,
  renderDraftSystem,
  type DraftPort,
  type DraftResult,
  type DraftTrial,
  type DraftWorldFacts,
} from '../../engine/world-authoring/draft';
import { gradeRegion, type GradeResult } from '../../engine/world-authoring/grade';
import { authorBrief, checkAuthored, renderGrade } from './author';
import { runWorldCheck } from './check';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 답이 지켜야 할 형 — T2 의 schema 그대로다. 손으로 옮겨 적지 않는다 */
export function draftSchema(): unknown {
  // Claude Code 의 구조화 출력은 draft-07 로 잰다 — zod 의 기본(2020-12)이 아니다
  return z.toJSONSchema(RegionBriefSchema, { target: 'draft-7' });
}

/**
 * 지금 서 있는 세계 — 계약(T4)과 검사(T1)에서 읽는다. 손으로 옮겨 적은 값이 하나도 없으므로
 * 세계가 자라면 초안기가 보는 것도 저절로 자란다.
 */
export function draftWorldFacts(): DraftWorldFacts {
  const report = runWorldCheck();
  const failed = report.items.filter((item) => item.status === 'fail');
  return {
    vocabulary: [
      { of: '깊이 (depth)', names: WORLD_CONTRACTS.depths },
      { of: '갈래 (kinds)', names: WORLD_CONTRACTS.hazardKinds },
      { of: '이음의 종류 (neighbours[].transition)', names: WORLD_CONTRACTS.transitions },
      { of: '붙잡는 것 (sources[].heldBy)', names: WORLD_CONTRACTS.carriers },
      { of: '맡은 자리 (sources[].role)', names: WORLD_CONTRACTS.roles },
      { of: '이미 지어진 방 (neighbours[].region)', names: WORLD_CONTRACTS.regions },
      { of: '아직 짓지 않은 곳 (neighbours[].region)', names: WORLD_CONTRACTS.frontiers },
      { of: '이미 선 규칙', names: WORLD_CONTRACTS.rules },
    ],
    standing: [
      ...REGION_SPECS.map((spec) => `방 ${spec.id} — 깊이 ${spec.depth}`),
      failed.length === 0
        ? `검사 ${report.items.length} 가지가 지금 다 서 있다 — 네가 낸 방이 하나라도 무너뜨리면 돌려보내진다.`
        : `검사 가운데 ${failed.length} 가지가 지금 걸려 있다: ${failed.map((i) => i.id).join(' · ')}`,
    ],
  };
}

/** 초안기가 읽을 시스템 글 — 확정 문서를 줄이지 않고 그대로 잇는다 */
export function draftSystem(): string {
  return renderDraftSystem(DRAFT_PROMPT, draftWorldFacts(), (path) =>
    readFileSync(resolve(ROOT, path), 'utf8'),
  );
}

/** GAP 하나를 한 줄로 — 되먹임에 실릴 글이다 */
function gapLine(gap: { required: string; missing: string; reason: string }): string {
  return `${gap.required}: ${gap.missing}${gap.reason ? ` (${gap.reason})` : ''}`;
}

/**
 * 낸 brief 하나를 이 세계에 넣어 본다 — T4(등급) → T3(뼈대) → T1(검사).
 *
 * 되먹일 것과 돌려보낼 것을 여기서 가른다. 가르는 잣대는 **요구를 지운 brief 를 다시 재는 것**이다:
 *   · 지워도 걸림이 남는다  → 어휘 밖의 이름이나 없는 이웃을 쓴 것이다. 알려 주면 고칠 수 있다 (되먹인다)
 *   · 지우면 걸림이 없다    → 그 방이 **진짜로** 규칙이나 새 축을 요구한다. 되물어도 같은 답이 온다.
 *                            사람에게 돌아간다 (T4 의 B · C — Tool-Scale §4 "문법을 넓히지 않는다")
 */
export function trialBrief(brief: RegionBrief): DraftTrial {
  const grade = gradeRegion(brief, WORLD_CONTRACTS);
  if (grade.blocking.length > 0) {
    const stripped = gradeRegion({ ...brief, requires: [] }, WORLD_CONTRACTS);
    return {
      ok: false,
      problems: grade.blocking.map(gapLine),
      retry: stripped.blocking.length > 0,
    };
  }

  const report = checkAuthored(authorBrief(brief));
  const failed = report.items.filter((item) => item.status === 'fail');
  if (failed.length > 0) {
    return {
      ok: false,
      problems: failed.map(
        (item) =>
          `검사 ${item.mark} ${item.name}: ${item.answer}${
            item.refs.length > 0
              ? ` — ${item.refs.map((ref) => `${ref.where}(${ref.detail})`).join(' · ')}`
              : ''
          }`,
      ),
      retry: true,
    };
  }
  return { ok: true, problems: [], retry: false };
}

export interface ClaudeOptions {
  model: string;
  /** 한 번 물을 때 기다릴 상한 (ms) */
  timeout: number;
}

/**
 * `claude -p` 하나를 부른다. 구독 로그인 그대로이고, 받는 것은 `structured_output` 뿐이다.
 *
 * 답이 형을 지켰다고 **믿지 않는다** — 형 판정은 고리가 다시 한다 (engine 의 parseRegionBrief).
 * 여기서 던지는 것은 답 자체가 오지 않은 경우뿐이다.
 */
export function claudePort(options: ClaudeOptions): DraftPort {
  return async (ask) => {
    const env = { ...process.env };
    // 구독 로그인이 이기게 한다 — -p 는 키가 있으면 묻지 않고 그것을 쓴다
    delete env.ANTHROPIC_API_KEY;

    // 시스템 글은 **파일로** 건넨다. 확정 문서를 줄이지 않고 이으므로 십만 자를 넘고,
    // 인자 하나의 상한(리눅스 128 KiB)에 걸려 spawn 이 E2BIG 으로 죽는다.
    const dir = mkdtempSync(join(tmpdir(), 'world-draft-'));
    const systemFile = join(dir, 'system.md');
    let stdout: string;
    try {
      writeFileSync(systemFile, ask.system, 'utf8');
      stdout = execFileSync(
        'claude',
        [
          '-p',
          ask.user,
          '--system-prompt-file',
          systemFile,
          '--output-format',
          'json',
          '--json-schema',
          JSON.stringify(ask.schema),
          '--model',
          options.model,
          // 도구도 훅도 MCP 도 세션 저장도 없이 답 하나만
          '--tools',
          '',
          '--setting-sources',
          '',
          '--strict-mcp-config',
          '--no-session-persistence',
        ],
        { env, input: '', encoding: 'utf8', timeout: options.timeout, maxBuffer: 64 * 1024 * 1024 },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const answer = JSON.parse(stdout) as {
      subtype?: string;
      structured_output?: unknown;
      result?: string;
    };
    if (answer.structured_output === undefined) {
      throw new Error(
        `모델이 형에 맞는 답을 내지 못했다 (subtype ${answer.subtype ?? '알 수 없음'}): ${
          answer.result ?? ''
        }`.trim(),
      );
    }
    return answer.structured_output;
  };
}

/** 미지 한 줄 하나를 돌린다 — 부르는 쪽(시험 · CLI)이 port 를 정한다 */
export function runDraft(
  unknown: string,
  ask: DraftPort,
  attempts: number,
): Promise<DraftResult> {
  return draftRegion({
    unknown,
    system: draftSystem(),
    schema: draftSchema(),
    ask,
    trial: trialBrief,
    attempts,
  });
}

/** 굳힌 brief 가 놓일 자리 */
export function briefPathOf(brief: RegionBrief): string {
  return `content/authoring/briefs/${brief.id}.json`;
}

/** 사람이 읽는 보고 — 무엇을 몇 번 물었고 무엇이 걸렸는가 */
export function renderDraft(result: DraftResult, grade?: GradeResult): string {
  const lines: string[] = [];
  for (const round of result.rounds) {
    lines.push(
      round.problems.length === 0
        ? `  ${round.round} 번째 — 섰다`
        : `  ${round.round} 번째 — ${round.stage === 'shape' ? '형' : '세계'}에 걸렸다`,
    );
    for (const problem of round.problems) lines.push(`      ${problem}`);
  }
  lines.push('');
  if (result.outcome === 'passed') {
    lines.push('  섰다 — 이 방은 들이고 나면 검사를 통과한다.');
  } else if (result.outcome === 'returned') {
    lines.push('  돌려보낸다 — 되물어도 같은 답이 온다. 이 방은 규칙이나 새 축을 요구한다.');
  } else {
    lines.push(`  ${result.rounds.length} 번 물어도 서지 않았다 — 마지막에 걸린 것이 위에 있다.`);
  }
  if (grade) lines.push('', renderGrade(grade));
  return lines.join('\n');
}

async function main(argv: readonly string[]): Promise<number> {
  const words = argv.filter((arg) => !arg.startsWith('--'));
  const valueOf = (name: string): string | undefined => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const known = ['--write', '--attempts', '--model', '--answer'];
  const unknownFlags = flags.filter((flag) => !known.includes(flag));
  // 값을 가진 인자의 값은 낱말로 세지 않는다
  const values = ['attempts', 'model', 'answer'].map(valueOf).filter((v) => v !== undefined);
  const line = words.filter((word) => !values.includes(word));

  if (line.length !== 1 || unknownFlags.length > 0) {
    process.stderr.write(
      [
        '  world:draft — 미지 한 줄에서 brief 하나를 낸다',
        unknownFlags.length > 0
          ? `    모르는 인자: ${unknownFlags.join(' ')}`
          : '    미지 한 줄을 따옴표로 묶어 하나만 밝힌다',
        '    사용: npm run world:draft -- "<미지 한 줄>" [--write] [--attempts N] [--model 이름] [--answer 파일]',
        '',
      ].join('\n'),
    );
    return 2;
  }

  const attempts = Number(valueOf('attempts') ?? 3);
  if (!Number.isInteger(attempts) || attempts < 1) {
    process.stderr.write(`  --attempts 는 1 이상의 정수다: ${valueOf('attempts')}\n`);
    return 2;
  }
  const answerFile = valueOf('answer');
  const ask: DraftPort = answerFile
    ? async () => JSON.parse(readFileSync(resolve(ROOT, answerFile), 'utf8'))
    : claudePort({ model: valueOf('model') ?? 'opus', timeout: 10 * 60 * 1000 });

  const result = await runDraft(line[0]!, ask, attempts);
  const grade = result.brief ? gradeRegion(result.brief, WORLD_CONTRACTS) : undefined;
  const report = renderDraft(result, grade);

  if (result.outcome !== 'passed') {
    process.stderr.write(
      `${result.brief ? `${JSON.stringify(result.brief, null, 2)}\n\n` : ''}${report}\n`,
    );
    return 1;
  }

  const brief = result.brief!;
  const text = `${JSON.stringify(brief, null, 2)}\n`;
  if (flags.includes('--write')) {
    const path = briefPathOf(brief);
    const out = resolve(ROOT, path);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text, 'utf8');
    process.stdout.write(
      [
        report,
        '',
        `  굳혔다: ${path}`,
        '',
        '  세계에 들이려면 (사람이 정한다):',
        `    npm run world:author -- ${path} --write`,
        '',
      ].join('\n'),
    );
    return 0;
  }
  process.stdout.write(`${text}\n${report}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
