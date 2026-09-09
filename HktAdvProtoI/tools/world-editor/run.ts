// World Run — **관찰자가 하나도 없는 채로** 세계 시계를 N 바퀴 굴리고 값의 궤적을 낸다
// (C025 ADDED · SPEC-009 · Play §6 E18).
//
//   npm run world:run                     두 바퀴를 굴리고 궤적을 표로 낸다 (기본)
//   npm run world:run -- --cycles 3       몇 바퀴를 굴릴 것인가
//   npm run world:run -- --dt 1           한 걸음이 몇 세계 초인가 (기본은 세계 자신의 Tick 간격)
//   npm run world:run -- --json           같은 것을 JSON 한 덩이로 (check.ts 의 --pretty 어법)
//
// 무엇을 하는가 — `createWorld()` 로 세계를 세우고 `tick` 으로만 굴린다. **join 을 한 번도
// 부르지 않는다**: 그것이 이 도구의 요점이다 (Concept W9 · Life F14 — "플레이어 없이 돈다" 를
// 생태에서 보이는 자리). 철이 바뀔 때마다 그 시각 · 철 · 개체군마다의 값과 `trend` 를 적고,
// 그것이 만든 자취(탄생지의 phase · `LEAVES` 가 세우는 원천의 phase)를 나란히 적는다.
//
// 무엇을 하지 않는가 —
//   · **판정하지 않는다.** 값이 좋은지 나쁜지 말하지 않고 궤적을 적을 뿐이다
//     (`world:observe` 가 그런 그대로). 그래서 굴린 뒤의 종료 코드는 언제나 0 이고,
//     모르는 인자를 받았을 때만 무엇이 틀렸는지 말하고 아무것도 하지 않는다 (2 · observe 의 어법).
//   · **아무것도 쓰지 않는다.** 저장소에 한 값도 남기지 않는다 — 그림도 파일도 없다 (SPEC-009 경계 ③).
//   · **이름을 손으로 적지 않는다.** 무엇을 낼지는 세계에서 읽어 온다 (REGION_SPECS 의
//     `ecology.populations` · `ecology.lifeFormation` · `ecology.links`). 개체군이 늘면 칸이 는다.
//   · **초를 손으로 적지 않는다.** 한 바퀴의 길이도 철의 눈금도 semantic/clock.ts 가 소유한다.
//
// 두 번 돌리면 **글자까지 같다** (SPEC-009 ②) — 시각·난수·현재 시간에 기대지 않는다:
// 걸음은 인자가 정하고, 차례는 전부 컨텐츠 데이터의 배열 순서(REGION_SPECS)다.

import { resolve } from 'node:path';
import { REGION_SPECS } from '../../content/regions';
import { createWorld } from '../../content/world';
import { CYCLE_SECONDS, seasonAt, seasonsStartedAt, worldClockAt } from '../../content/world/semantic/clock';
import { findResourceSource, sourceStateOf } from '../../content/world/semantic/resource';
import { lifeSiteStateOf } from '../../content/world/semantic/life';
import type { RegionState } from '../../content/world/semantic/region-state';
import { TICK_INTERVAL, type WorldState } from '../../content/world/semantic/world-state';

/** 인자를 하나도 주지 않았을 때 — Play 완료 확인 ⑥ 이 "두 바퀴" 다 */
const DEFAULT_CYCLES = 2;
/** 걸음의 기본 — 세계 자신의 Tick 간격이다 (여기서 초를 짓지 않는다) */
const DEFAULT_DT = TICK_INTERVAL;

/** 아직 한 철도 지나지 않아 방향이 없는 자리 (trend 는 철이 바뀔 때 적힌다) */
const NO_TREND = '—';

// ── 무엇을 볼 것인가 — 전부 세계에서 읽어 온다 ────────────────────────

/** 값이 도는 개체군 하나 — 이름도 상한도 데이터의 것이다 */
interface WatchedPopulation {
  regionId: string;
  id: string;
  scale: number;
}

/** phase 를 볼 자리 하나 — 탄생지이거나, 남긴 것이 세우는 원천이다 */
interface WatchedPhase {
  regionId: string;
  id: string;
}

/** 세계의 개체군 전부 — 방 차례 · 그 방 데이터 차례 (결정론) */
export const WATCHED_POPULATIONS: readonly WatchedPopulation[] = REGION_SPECS.flatMap((spec) =>
  (spec.ecology?.populations ?? []).map((population) => ({
    regionId: spec.id,
    id: population.id,
    scale: population.scale,
  })),
);

/** 세계의 탄생지 전부 — 바퀴가 닫히는 것은 여기 phase 로 보인다 (SPEC-008) */
export const WATCHED_LIFE_SITES: readonly WatchedPhase[] = REGION_SPECS.flatMap((spec) =>
  (spec.ecology?.lifeFormation ?? []).map((site) => ({ regionId: spec.id, id: site.id })),
);

/**
 * `LEAVES` 가 세우는 원천들 — 관계가 가리킨 `to` 를 세계에서 찾아 그 방을 얻는다.
 *
 * **세계가 모르는 원천을 가리킨 관계는 여기 오지 않는다** — 끊긴 참조는 조용하다
 * (RULE-POPULATION-LINK-001 의 경계가 그런 그대로). 같은 원천을 둘이 가리켜도 한 번만 본다.
 */
export const WATCHED_LEFT_SOURCES: readonly WatchedPhase[] = (() => {
  const seen = new Set<string>();
  const watched: WatchedPhase[] = [];
  for (const spec of REGION_SPECS) {
    for (const link of spec.ecology?.links ?? []) {
      if (link.kind !== 'LEAVES') continue;
      if (seen.has(link.to)) continue;
      const source = findResourceSource(link.to);
      if (!source) continue;
      seen.add(link.to);
      watched.push({ regionId: source.regionId, id: link.to });
    }
  }
  return watched;
})();

// ── 궤적 ──────────────────────────────────────────────────────────────

/** 개체군 하나의 그 순간 */
export interface PopulationTrace {
  id: string;
  value: number;
  scale: number;
  /** 그 철에 값이 어디로 갔는가 — 아직 한 철도 지나지 않았으면 없다 */
  trend: string | null;
}

/** 철이 바뀐 그 순간의 세계 한 장 */
export interface RunSample {
  /** 세계 시각 (초) */
  time: number;
  /** 세계가 선 뒤 바뀐 철의 수 — 걸음이 크면 한 번에 여럿이 는다 */
  seasonIndex: number;
  /** 몇 바퀴째인가 */
  seasonCycle: number;
  /** 어느 철인가 */
  season: string;
  populations: readonly PopulationTrace[];
  /** 탄생지 id → phase */
  lifeSites: readonly { id: string; phase: string }[];
  /** 남긴 것이 세우는 원천 id → phase */
  sources: readonly { id: string; phase: string }[];
}

export interface RunOptions {
  /** 한 걸음이 몇 세계 초인가 */
  dt: number;
  /** 몇 바퀴를 굴릴 것인가 */
  cycles: number;
}

export interface RunReport {
  dt: number;
  cycles: number;
  /** 굴린 세계 초 — 한 바퀴의 길이는 시계가 소유한다 */
  seconds: number;
  /** 몇 걸음을 굴렸는가 */
  steps: number;
  /** 세계에 들어간 관찰자의 수 — 언제나 0 이다 (SPEC-009 ①) */
  observers: number;
  trajectory: readonly RunSample[];
}

/** 그 순간의 세계를 한 장으로 뜬다 — 읽기만 한다 */
function sample(states: Record<string, RegionState>, time: number): RunSample {
  const clock = worldClockAt(time);
  return {
    time,
    seasonIndex: seasonsStartedAt(time),
    seasonCycle: clock.seasonCycle,
    season: seasonAt(time),
    populations: WATCHED_POPULATIONS.map((population) => {
      const state = states[population.regionId]?.populations?.[population.id];
      return {
        id: population.id,
        value: state?.value ?? 0,
        scale: population.scale,
        trend: state?.trend ?? null,
      };
    }),
    lifeSites: WATCHED_LIFE_SITES.map((site) => ({
      id: site.id,
      phase: lifeSiteStateOf(states, site.regionId, site.id).phase,
    })),
    sources: WATCHED_LEFT_SOURCES.map((source) => ({
      id: source.id,
      phase: sourceStateOf(states, source.regionId, source.id).phase,
    })),
  };
}

/**
 * **관찰자가 하나도 없는 채로** 세계를 굴린다 (SPEC-009 ①).
 *
 * `createWorld()` 는 손잡이를 하나도 받지 않는다 — 세운 것이 아니라 **그냥 선 세계**를
 * 굴리는 것이 이 도구의 요점이기 때문이다. `join` 도 `request` 도 부르지 않는다.
 *
 * 걸음은 마지막 하나만 잘려 정확히 N 바퀴에서 멎는다 — 그래야 "두 바퀴를 돌렸다" 가
 * 글자 그대로다. 시각은 세계가 쌓는 것과 **같은 차례로** 쌓아 둔다 (state.time += dt).
 */
export function runWorld(options: RunOptions): RunReport {
  const world = createWorld();
  const seconds = options.cycles * CYCLE_SECONDS;

  const readStates = (): Record<string, RegionState> =>
    (world.snapshot().state as WorldState).regionStates;

  const trajectory: RunSample[] = [sample(readStates(), 0)];
  let time = 0;
  let steps = 0;
  let lastSeasonIndex = seasonsStartedAt(0);

  while (time < seconds) {
    const step = Math.min(options.dt, seconds - time);
    world.tick(step);
    time += step;
    steps++;
    // 철이 바뀐 그 걸음에서만 한 장을 뜬다 (스냅샷은 비싸다 · 궤적은 철의 눈금이다)
    const seasonIndex = seasonsStartedAt(time);
    if (seasonIndex !== lastSeasonIndex) {
      trajectory.push(sample(readStates(), time));
      lastSeasonIndex = seasonIndex;
    }
  }

  return {
    dt: options.dt,
    cycles: options.cycles,
    seconds,
    steps,
    observers: (world.snapshot().state as WorldState).observers.length,
    trajectory,
  };
}

// ── 사람이 읽는 표 ────────────────────────────────────────────────────
//
// tools/world-editor/observe.ts 의 방식(들여쓴 줄 · 보이는 너비로 맞춘 칸 · 가로줄)을 따른다.

const RULE_WIDTH = 100;

function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // 한글·한자·전각 기호 — 두 칸
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    width += wide ? 2 : 1;
  }
  return width;
}

function pad(text: string, width: number): string {
  const gap = width - displayWidth(text);
  return gap > 0 ? text + ' '.repeat(gap) : text;
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const widths = header.map((cell, i) =>
    Math.max(displayWidth(cell), ...rows.map((row) => displayWidth(row[i] ?? ''))),
  );
  const line = (cells: readonly string[]) =>
    '    ' +
    cells
      .map((cell, i) => (i === cells.length - 1 ? cell : pad(cell, widths[i]!)))
      .join('  ')
      .trimEnd();
  return [line(header), ...rows.map(line)];
}

function rule(): string {
  return '  ' + '-'.repeat(RULE_WIDTH);
}

/**
 * 세계 초를 글자로 — 걸음이 나누어떨어지지 않으면 시각도 딱 떨어지지 않는다.
 *
 * 자릿수를 **한 표에서 하나로** 쓴다: 한 칸만 정수로 적히면 4440 곁의 4380.00 이 서로 다른
 * 눈금처럼 보이기 때문이다. 딱 떨어지는 값들뿐이면 정수로, 아니면 전부 소수 두 자리로 적는다
 * (같은 인자면 같은 글자다 · SPEC-009 ②).
 */
function formatSeconds(seconds: number, decimals = 0): string {
  return decimals === 0 ? String(Math.round(seconds)) : seconds.toFixed(decimals);
}

/** 그 궤적을 적는 데 필요한 자릿수 — 하나라도 딱 떨어지지 않으면 둘이다 */
function timeDecimals(trajectory: readonly RunSample[]): number {
  return trajectory.every((step) => Number.isInteger(step.time)) ? 0 : 2;
}

/** 걸음의 크기를 글자로 — 1/30 같은 값도 눈금이 보이게 적는다 (넘치는 0 은 자른다) */
function formatStep(dt: number): string {
  return String(Number(dt.toFixed(4)));
}

export function renderRunReport(report: RunReport): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(
    `  World Run — 관찰자가 하나도 없는 채로 세계 시계를 ${report.cycles} 바퀴 굴렸다 (읽기 전용 · 아무것도 쓰지 않았다)`,
  );
  lines.push(rule());
  lines.push(
    `  걸음 ${formatStep(report.dt)} 세계 초 × ${report.steps} · 굴린 시간 ${formatSeconds(report.seconds)} 세계 초 · 관찰자 ${report.observers}`,
  );
  const decimals = timeDecimals(report.trajectory);

  // 개체군의 궤적 — 철이 바뀔 때마다 한 줄
  lines.push(rule());
  lines.push(`  개체군의 궤적 ${WATCHED_POPULATIONS.length} — 철이 바뀔 때마다 (값/상한 · 방향)`);
  if (WATCHED_POPULATIONS.length === 0) {
    lines.push('    이 세계에 개체군이 하나도 없다.');
  } else {
    lines.push(
      ...table(
        ['t', '바퀴', '철', ...WATCHED_POPULATIONS.map((population) => population.id)],
        report.trajectory.map((step) => [
          formatSeconds(step.time, decimals),
          String(step.seasonCycle),
          step.season,
          ...step.populations.map(
            (trace) => `${trace.value}/${trace.scale} ${trace.trend ?? NO_TREND}`,
          ),
        ]),
      ),
    );
  }

  // 그 값이 만든 자취 — 같은 자리에서 (탄생지 · 남긴 것이 세우는 원천)
  const phaseColumns = [...WATCHED_LIFE_SITES, ...WATCHED_LEFT_SOURCES];
  lines.push(rule());
  lines.push(
    `  세계의 자취 ${phaseColumns.length} — 탄생지 ${WATCHED_LIFE_SITES.length} · 남긴 것이 세우는 원천 ${WATCHED_LEFT_SOURCES.length}`,
  );
  if (phaseColumns.length === 0) {
    lines.push('    이 세계에 탄생지도 남긴 것도 하나도 없다.');
  } else {
    lines.push(
      ...table(
        ['t', '철', ...phaseColumns.map((column) => column.id)],
        report.trajectory.map((step) => [
          formatSeconds(step.time, decimals),
          step.season,
          ...step.lifeSites.map((site) => site.phase),
          ...step.sources.map((source) => source.phase),
        ]),
      ),
    );
  }

  lines.push(rule());
  lines.push('  세계는 그대로다 — 저장소에 한 값도 쓰지 않았다.');
  lines.push('');
  return lines.join('\n');
}

export function renderRunJson(report: RunReport, pretty: boolean): string {
  return JSON.stringify(report, null, pretty ? 2 : 0);
}

// ── 인자 ──────────────────────────────────────────────────────────────

export type ParsedArgs =
  | { kind: 'run'; options: RunOptions; json: boolean; pretty: boolean }
  | { kind: 'usage'; unknown: readonly string[] };

/**
 * 모르는 인자 · 뜻이 서지 않는 값은 조용히 기본값으로 읽지 않는다 —
 * 무엇이 틀렸는지 밝히고 아무것도 하지 않는다 (world:observe 의 그 어법).
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const unknown: string[] = [];
  let cycles = DEFAULT_CYCLES;
  let dt = DEFAULT_DT;
  let json = false;
  let pretty = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--json') json = true;
    else if (arg === '--pretty') pretty = true;
    else if (arg === '--cycles' || arg === '--dt') {
      const raw = argv[i + 1];
      if (raw === undefined || raw.startsWith('--')) {
        unknown.push(`${arg} (값이 없다)`);
        continue;
      }
      i++;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        unknown.push(`${arg} ${raw} (0 보다 큰 수여야 한다)`);
      } else if (arg === '--cycles' && !Number.isInteger(value)) {
        unknown.push(`${arg} ${raw} (바퀴는 정수여야 한다)`);
      } else if (arg === '--cycles') cycles = value;
      else dt = value;
    } else unknown.push(arg);
  }

  if (unknown.length > 0) return { kind: 'usage', unknown };
  return { kind: 'run', options: { cycles, dt }, json, pretty };
}

export function renderUsage(unknown: readonly string[]): string {
  return [
    '',
    `  모르는 인자: ${unknown.join(' · ')}`,
    '  world:run — 관찰자가 하나도 없는 채로 세계 시계를 굴리고 값의 궤적을 낸다.',
    `    --cycles <n>   몇 바퀴를 굴릴 것인가 (기본 ${DEFAULT_CYCLES} · 한 바퀴 ${CYCLE_SECONDS} 세계 초)`,
    `    --dt <초>      한 걸음이 몇 세계 초인가 (기본 ${formatStep(DEFAULT_DT)} — 세계의 Tick 간격)`,
    '    --json         표 대신 JSON 한 덩이로',
    '    --pretty       JSON 을 들여써서 (--json 과 함께)',
    '  아무것도 하지 않았다. 세계도 파일도 그대로다.',
    '',
  ].join('\n');
}

function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv);
  if (parsed.kind === 'usage') {
    process.stdout.write(renderUsage(parsed.unknown));
    // 아무것도 하지 않았으므로 성공으로 끝내지 않는다 (world:observe 의 어법 그대로 2 다)
    return 2;
  }
  const report = runWorld(parsed.options);
  process.stdout.write(
    parsed.json ? `${renderRunJson(report, parsed.pretty)}\n` : `${renderRunReport(report)}\n`,
  );
  // **판정하지 않는다** — 값이 어떻게 돌았든 종료 코드는 0 이다 (SPEC-009)
  return 0;
}

// tsx 로 직접 돌렸을 때만 실행한다 — 테스트가 import 해도 아무 일이 없어야 한다
// (world:check · world:compile 과 같은 판정법이다)
if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
