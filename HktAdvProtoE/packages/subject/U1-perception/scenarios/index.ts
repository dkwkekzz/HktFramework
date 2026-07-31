import type {
  AssertionResult,
  LabRow,
  LabViewModel,
  ModuleContext,
  VerificationScenario,
} from '@hkt/v0-module-contract';
import type { StoreOperation } from '@hkt/k0-entity-state';
import type { RuleSpec } from '@hkt/k2-rule-transaction';
import { NATURAL_LAWS } from '@hkt/s1-natural-state';
import { SUBJECT_LAWS } from '@hkt/u0-subject-core';
import {
  channelsHeardBy,
  executeU1,
  missCodesFor,
  phenomenaNamed,
  validateOutput,
  U1_PURPOSE,
  type ScriptedIntent,
  type U1Input,
  type U1Output,
} from '../src/module.js';
import { CHANNEL_BOOK } from '../src/channels.js';
import { round } from '../src/perceive.js';
import {
  MISS,
  U1_CHANNELS,
  type Phenomenon,
  type StagePlacement,
  type Testimony,
} from '../src/types.js';
import {
  A_HUNT_NOBODY_SEES,
  COMPONENT_DEFINITIONS,
  LAYOUT,
  SCENE_RULES,
  THE_ATTUNED_AND_THE_BLIND,
  TWO_SIDES_OF_A_WALL,
  WIDE_LAYOUT,
  WITH_A_DEAF_SMITH,
  WORLD_SEED,
} from './fixtures.js';

interface SceneSpec {
  id: string;
  title: string;
  seed: bigint;
  arrange(): U1Input;
  check(input: U1Input, output: U1Output, context: ModuleContext): AssertionResult[];
  reasons(input: U1Input, output: U1Output): string[];
  candidates?(input: U1Input, output: U1Output): LabRow[];
  result?(output: U1Output): string;
}

function defineScene(spec: SceneSpec): VerificationScenario<U1Input, U1Output> {
  return {
    id: spec.id,
    title: spec.title,
    seed: spec.seed,
    arrange: spec.arrange,
    act: (input, _context) => executeU1(input),
    assert: spec.check,
    toLabView: (input, output, context): LabViewModel => {
      const assertions = spec.check(input, output, context);
      return {
        purpose: U1_PURPOSE,
        input: [
          { label: '틱', value: `${input.ticks}일 · 시드 ${input.worldSeed}` },
          { label: '주체와 감각', value: describeSenses(output) },
          { label: '세계가 한 일', value: describeScript(input) },
          { label: '남은 현상', value: describePhenomena(output) },
          {
            label: '채널',
            value: CHANNEL_BOOK.map(
              (channel) =>
                `${channel.title}(${channel.id}) ${channel.onBlocked === 'cut' ? '막히면 끊김' : `막히면 ×${channel.dampPerBlocker}`}`,
            ).join(' · '),
          },
          { label: '사전에 없던 흔적', value: output.gaps.map((gap) => `${gap.phenomenonId} ${gap.code}`).join(' · ') || '없음' },
        ],
        candidates: spec.candidates?.(input, output) ?? defaultCandidates(output),
        result: spec.result?.(output) ?? defaultResult(output),
        reasons: spec.reasons(input, output),
        // 이 모듈의 목적을 그대로 읽는다 — 실제 사건 → 감지할 수 있는 현상 → 각자가 아는 것.
        before: `세계에 일어난 일 — 사건 ${output.events}건${
          output.silentEvents > 0 ? ` (그중 ${output.silentEvents}건은 아무 흔적도 남기지 않았다)` : ''
        } → 감지할 수 있는 현상 ${output.phenomena.length}개`,
        after: `주체가 알게 된 것 — ${
          output.reports.map((report) => `${report.subjectId} ${report.known.length}개`).join(' · ') || '아무도 없다'
        }  (닿지 못한 ${output.misses.length}개에는 모두 이유가 붙어 있다)`,
        checks: assertions.map((assertion) => ({
          label: assertion.reason ? `${assertion.id} — ${assertion.reason}` : assertion.id,
          passed: assertion.passed,
        })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 화면 — 공간에서 일어나는 일이므로 공간으로 그린다
//
// 원문 「24」는 "그래픽 모듈이 아니더라도 표·그래프·타임라인을 통해 반드시 눈으로 확인할 수
// 있어야 한다"고 요구한다. 지각에서 그것은 **무대와 감각의 길**이다. `E_SIGHT_BLOCKED` 라는
// 코드를 나열하는 것으로는 "벽이 시선을 끊고 소리는 줄인다"가 눈에 보이지 않는다.
//
// 그래서 세 가지를 그린다.
//
//   ① 위에서 본 무대   누가 어디에 있고 무엇이 사이를 막고 있는가
//   ② 감각의 길        현상에서 몸까지 가는 길에 무슨 일이 있었는가 (끊김 ╳ / 줄어듦 ┈)
//   ③ 감쇠 사다리      원래 세기가 거리와 벽을 지나며 어떻게 줄어 문턱을 넘거나 못 넘는가
// ---------------------------------------------------------------------------

/** `t1_bell_toll_chapel_bell` → `bell_toll@1` — 화면에서 읽히는 길이로 줄인다. */
export function shortId(id: string): string {
  const match = /^t(\d+)_(.+?)_([a-z0-9_]+)$/.exec(id);
  if (!match) return id;
  return `${match[2]}@${match[1]}`;
}

const FILL = '·';
const MAP_WIDTH = 68;

/** 자리 하나를 무대에서 찾는다. */
function placeOf(output: U1Output, id: string): StagePlacement | undefined {
  return output.stage.find((entry) => entry.id === id);
}

/**
 * ① 위에서 본 무대.
 *
 * 한 칸이 1m 다. 빈 칸은 `·` 로 채운다 — HTML 은 이어진 공백을 접으므로 공백으로 그리면
 * 무대가 무너진다.
 */
function stageMap(output: U1Output, phenomenon: Phenomenon | undefined): LabRow[] {
  if (output.stage.length === 0) return [];
  const marks = new Map<string, { glyph: string; x: number; y: number }>();

  for (const place of output.stage) {
    const [x, y] = place.at;
    let glyph = place.role === 'blocker' ? (place.opaque ? '▓' : '▒') : '○';
    if (place.role === 'source') glyph = '✷';
    if (place.role === 'body') {
      // 알게 된 몸과 모르는 몸을 가른다 — 무대만 보고도 누가 알았는지 읽힌다.
      // 현상을 지정하면 그 현상 기준, 지정하지 않으면 "무엇이든 알았는가" 기준이다.
      glyph = sensedBy(output, place.id, phenomenon) ? '◉' : '○';
    }
    marks.set(place.id, { glyph, x: Math.round(x), y: Math.round(y) });
  }

  // 무대가 화면보다 넓으면 한 칸의 뜻을 늘린다. 잘라 내면 멀리 있는 것이 화면에서 사라지고,
  // 사라진 것이 곧 "없는 것"으로 읽힌다 — 이 장면에서는 바로 그 멀리 있는 것이 요지다.
  const xs = [...marks.values()].map((mark) => mark.x);
  const span = Math.max(...xs) + 1;
  const metersPerCell = Math.max(1, Math.ceil(span / MAP_WIDTH));
  const width = Math.min(MAP_WIDTH, Math.ceil(span / metersPerCell) + 1);
  const rows: LabRow[] = [];

  for (const y of [...new Set([...marks.values()].map((mark) => mark.y))].sort((a, b) => b - a)) {
    const line = Array.from({ length: width }, () => FILL);
    for (const mark of marks.values()) {
      if (mark.y !== y) continue;
      const cell = Math.floor(mark.x / metersPerCell);
      if (cell < 0 || cell >= width) continue;
      line[cell] = mark.glyph;
    }
    rows.push({ label: `y=${y}`, value: line.join('') });
  }

  const ruler = Array.from({ length: width }, (_, index) =>
    index % 10 === 0 ? String(((index * metersPerCell) / 10) % 10 | 0) : index % 5 === 0 ? '+' : '-',
  );
  rows.push({
    label: metersPerCell === 1 ? 'x(m)' : `x(한 칸 ${metersPerCell}m)`,
    value: ruler.join(''),
  });
  rows.push({
    label: '자리',
    value: output.stage
      .map((place) => `${glyphOf(place, output, phenomenon)} ${place.id}(${place.at[0]},${place.at[1]})`)
      .join('  '),
  });
  return rows;
}

function glyphOf(place: StagePlacement, output: U1Output, phenomenon: Phenomenon | undefined): string {
  if (place.role === 'source') return '✷';
  if (place.role === 'blocker') return place.opaque ? '▓' : '▒';
  return sensedBy(output, place.id, phenomenon) ? '◉' : '○';
}

/** 이 몸이 그 현상을(현상을 지정하지 않으면 무엇이든) 잡았는가. */
function sensedBy(output: U1Output, body: string, phenomenon: Phenomenon | undefined): boolean {
  return output.perceived.some(
    (entry) => entry.sensedBy === body && (phenomenon === undefined || entry.phenomenonId === phenomenon.id),
  );
}

const RAY_WIDTH = 16;

/**
 * ② 감각의 길 — 현상에서 몸까지.
 *
 * ```text
 * ✷━━━━━━━━━━━━━━◉   막는 것 없이 닿았다
 * ✷━━━━━━▓┈┈┈┈┈┈◉   벽이 줄였지만 넘어왔다
 * ✷━━━━━━▓╳╳╳╳╳╳○   벽이 끊었다
 * ✷━━━━╌╌╌╌╌╌╌╌╌○   닿는 거리 밖에서 흩어졌다
 * ```
 *
 * 이 네 줄이 이 모듈의 요지다. 벽 하나가 어떤 감각에는 `╳` 이고 어떤 감각에는 `┈` 이라는 것을
 * 숫자 없이도 한눈에 읽을 수 있어야 한다.
 */
function ray(
  output: U1Output,
  phenomenon: Phenomenon,
  blockers: readonly string[],
  reached: boolean,
  cut: boolean,
  scattered: boolean,
): string {
  const source = phenomenon.location;
  const stop = cut || scattered ? '○' : reached ? '◉' : '○';
  const line = Array.from({ length: RAY_WIDTH }, () => '━');

  // 막는 것을 길 위의 제 자리에 놓는다 — 근원에서 얼마나 떨어져 있는지의 비율로.
  const marks: number[] = [];
  for (const id of blockers) {
    const place = placeOf(output, id);
    if (!place || !source) continue;
    const total = Math.hypot(place.at[0] - source[0], place.at[1] - source[1]);
    const span = distanceTo(output, phenomenon, blockers);
    const at = span > 0 ? Math.round((total / span) * (RAY_WIDTH - 1)) : 0;
    const index = Math.max(1, Math.min(RAY_WIDTH - 2, at));
    line[index] = '▓';
    marks.push(index);
  }

  const after = marks.length > 0 ? Math.max(...marks) + 1 : RAY_WIDTH;
  if (cut) for (let index = after; index < RAY_WIDTH; index += 1) line[index] = '╳';
  else if (marks.length > 0) for (let index = after; index < RAY_WIDTH; index += 1) line[index] = '┈';
  if (scattered) for (let index = Math.floor(RAY_WIDTH / 3); index < RAY_WIDTH; index += 1) line[index] = '╌';

  return `✷${line.join('')}${stop}`;
}

function distanceTo(output: U1Output, phenomenon: Phenomenon, blockers: readonly string[]): number {
  const hit = output.perceived.find((entry) => entry.phenomenonId === phenomenon.id && entry.distance !== null);
  if (hit?.distance) return hit.distance;
  const miss = output.misses.find((entry) => entry.phenomenonId === phenomenon.id && entry.distance !== null);
  return miss?.distance ?? blockers.length + 1;
}

/** ③ 감쇠 사다리 — 원래 세기가 무엇을 지나며 얼마가 되었는가. */
function ladder(
  base: number,
  distance: number | null,
  afterDistance: number | null,
  blockers: readonly string[],
  final: number | null,
  threshold: number | null,
  passed: boolean,
): string {
  const steps = [`${base}`];
  if (distance !== null && afterDistance !== null) steps.push(`${afterDistance} (${distance}m 를 지나며)`);
  if (blockers.length > 0 && final !== null) steps.push(`${final} (${blockers.join('·')} 를 지나며)`);
  else if (final !== null && steps.length === 1) steps.push(`${final}`);
  const verdict = threshold === null ? '' : ` ${passed ? '≥' : '<'} 문턱 ${threshold}`;
  return `${steps.join(' → ')}${verdict}`;
}

/**
 * 한 현상이 한 주체에게 어떻게 갔는가 — 감각마다 한 줄.
 *
 * 닿은 것과 닿지 못한 것을 **같은 줄 모양으로** 그린다. 닿은 것만 그리면 "왜 저 사람은
 * 모르는가"가 화면에서 사라진다.
 */
function pathsFor(output: U1Output, phenomenon: Phenomenon, subject: string): LabRow[] {
  const rows: LabRow[] = [];
  const spec = new Map(CHANNEL_BOOK.map((channel) => [channel.id, channel]));

  for (const channel of phenomenon.channels) {
    const title = spec.get(channel)?.title ?? channel;
    const base = phenomenon.measurements[channel] ?? 0;
    const hit = output.perceived.find(
      (entry) =>
        entry.perceiverId === subject && entry.phenomenonId === phenomenon.id && entry.channel === channel,
    );
    if (hit) {
      const afterDistance =
        hit.dampedBy.length > 0 && hit.distance !== null
          ? round(base / (1 + (spec.get(channel)?.falloff ?? 0) * hit.distance))
          : hit.strength;
      rows.push({
        label: `  ${title}`,
        value: `${ray(output, phenomenon, hit.dampedBy, true, false, false)}  ${ladder(
          base,
          hit.distance,
          afterDistance,
          hit.dampedBy,
          hit.strength,
          hit.threshold,
          true,
        )}  ✓ ${verbFor(channel, true)}`,
      });
      continue;
    }

    const miss = output.misses.find(
      (entry) =>
        entry.perceiverId === subject && entry.phenomenonId === phenomenon.id && entry.channel === channel,
    );
    if (!miss) continue;
    const cut = miss.code === MISS.SIGHT_BLOCKED;
    const scattered = miss.code === MISS.OUT_OF_RANGE;
    rows.push({
      label: `  ${title}`,
      value: `${ray(output, phenomenon, miss.blockedBy, false, cut, scattered)}  ${WHY[miss.code] ?? miss.code}${
        miss.strength !== null ? ` — ${ladder(base, miss.distance, null, miss.blockedBy, miss.strength, miss.threshold, false)}` : ''
      }  ✗ ${verbFor(channel, false)}`,
    });
  }
  return rows;
}

const WHY: Record<string, string> = {
  [MISS.SIGHT_BLOCKED]: '벽이 시선을 끊는다',
  [MISS.OUT_OF_RANGE]: '닿는 거리 밖에서 흩어진다',
  [MISS.BELOW_THRESHOLD]: '닿기는 했으나 알아채지 못한다',
  [MISS.NO_SENSE]: '그 감각이 없다',
  [MISS.NO_CAPABILITY]: '느낄 능력이 없다',
  [MISS.NO_BODY]: '세계에 몸이 없다',
  [MISS.NO_LOCATION]: '현상에 자리가 없다',
  [MISS.SENDER_NEVER_PERCEIVED]: '전한 사람이 본 적이 없다',
  [MISS.UNKNOWN_PHENOMENON_IN_TESTIMONY]: '세계에 없는 일을 전했다',
};

function verbFor(channel: string, hit: boolean): string {
  const words: Record<string, [string, string]> = {
    visual: ['보인다', '보이지 않는다'],
    audio: ['들린다', '들리지 않는다'],
    smell: ['냄새가 난다', '냄새가 나지 않는다'],
    touch: ['닿는다', '닿지 않는다'],
    aura: ['기척을 느낀다', '느끼지 못한다'],
    report: ['전해 들었다', '전해 듣지 못했다'],
    rumor: ['소문으로 들었다', '소문도 못 들었다'],
  };
  const pair = words[channel] ?? ['닿는다', '닿지 않는다'];
  return hit ? pair[0] : pair[1];
}

/** 사람이 들고 온 것은 길이 아니라 사람이다. */
function carriedRows(output: U1Output, phenomenon: Phenomenon, subject: string): LabRow[] {
  return output.perceived
    .filter(
      (entry) => entry.perceiverId === subject && entry.phenomenonId === phenomenon.id && entry.via !== null,
    )
    .map((entry) => ({
      label: `  ${CHANNEL_BOOK.find((channel) => channel.id === entry.channel)?.title ?? entry.channel}`,
      value: `${entry.via} ✎┈┈┈┈┈┈┈┈┈┈┈┈┈┈▶ ${subject}  세기 ${entry.strength} ≥ 문턱 ${entry.threshold} · 왜곡 ${entry.distortion}  ✓ ${verbFor(entry.channel, true)}`,
    }));
}

/** 길을 하나하나 그려도 읽히는 한계. 이보다 많으면 근원별로 묶어 보인다. */
const DETAILED = 4;

/**
 * 후보 구획 — 무대 하나, 그리고 감각의 길.
 *
 * 무대는 **장면당 한 번만** 그린다. 현상마다 다시 그리면 거의 같은 지도가 열여덟 번 쌓여
 * 아무것도 읽히지 않는다 — 그리는 것이 많다고 눈에 보이는 것은 아니다.
 *
 * 현상이 많으면 길을 다 그리지 않고 **근원별로 묶는다.** 묶을 때는 몇 개를 묶었는지 화면에
 * 적는다 — 조용히 잘라 내면 "전부 보여 주었다"로 읽힌다.
 */
function defaultCandidates(output: U1Output): LabRow[] {
  if (output.phenomena.length === 0) {
    return [{ label: '세계', value: '아무 일도 일어나지 않았다 — 지각할 것이 없다' }];
  }
  const rows: LabRow[] = [
    { label: '── 무대', value: '✷ 일이 난 자리 · ◉ 무언가 알게 된 몸 · ○ 아무것도 모르는 몸 · ▓ 시선을 막는 것' },
    ...stageMap(output, undefined),
  ];

  if (output.phenomena.length <= DETAILED) {
    for (const phenomenon of output.phenomena) {
      rows.push({
        label: `── ${shortId(phenomenon.id)}`,
        value: `${phenomenon.occurredAtTick}일 · ${phenomenon.sourceEntityId ?? '?'} 에서 · ${phenomenon.channels
          .map((channel) => `${channel} ${phenomenon.measurements[channel] ?? 0}`)
          .join(' · ')}`,
      });
      for (const report of output.reports) {
        rows.push(reachRow(output, phenomenon, report.subjectId));
        for (const row of pathsFor(output, phenomenon, report.subjectId)) rows.push(row);
        for (const row of carriedRows(output, phenomenon, report.subjectId)) rows.push(row);
      }
    }
    return rows;
  }

  // 현상이 많은 세계 — 근원별로 묶는다.
  const bySource = new Map<string, Phenomenon[]>();
  for (const phenomenon of output.phenomena) {
    const key = phenomenon.sourceEntityId ?? '어디인지 모름';
    (bySource.get(key) ?? bySource.set(key, []).get(key) ?? []).push(phenomenon);
  }

  rows.push({
    label: '── 어디서 난 일인가',
    value: `현상 ${output.phenomena.length}개를 근원 ${bySource.size}곳으로 묶는다`,
  });
  const samples: Phenomenon[] = [];
  for (const [source, group] of [...bySource.entries()].sort()) {
    const place = placeOf(output, source);
    samples.push(group[0] as Phenomenon);
    rows.push({
      label: `  ${source}`,
      value: `${place ? `(${place.at[0]},${place.at[1]})` : '자리 없음'} · 현상 ${group.length}개 — ${output.reports
        .map((report) => summarize(output, report.subjectId, group))
        .join(' / ')}`,
    });
  }

  rows.push({
    label: '── 감각의 길',
    value: `근원마다 하나씩 ${samples.length}개만 그린다 (나머지 ${output.phenomena.length - samples.length}개는 위 묶음이 전부다)`,
  });
  for (const phenomenon of samples) {
    rows.push({
      label: `  ${shortId(phenomenon.id)}`,
      value: `${phenomenon.occurredAtTick}일 · ${phenomenon.channels
        .map((channel) => `${channel} ${phenomenon.measurements[channel] ?? 0}`)
        .join(' · ')}`,
    });
    for (const report of output.reports) {
      rows.push(reachRow(output, phenomenon, report.subjectId));
      for (const row of pathsFor(output, phenomenon, report.subjectId)) rows.push(row);
    }
  }
  return rows;
}

/** 한 주체가 이 무리의 현상을 몇 개나 알았는가, 모른다면 왜. */
function summarize(output: U1Output, subject: string, group: readonly Phenomenon[]): string {
  const ids = new Set(group.map((entry) => entry.id));
  const known = new Set(
    output.perceived.filter((entry) => entry.perceiverId === subject && ids.has(entry.phenomenonId))
      .map((entry) => entry.phenomenonId),
  );
  if (known.size === group.length) return `${subject} 는 전부 안다`;
  const why = output.misses
    .filter((entry) => entry.perceiverId === subject && ids.has(entry.phenomenonId) && !known.has(entry.phenomenonId))
    .map((entry) => WHY[entry.code] ?? entry.code);
  const dominant = [...new Set(why)].sort();
  return `${subject} 는 ${known.size}/${group.length} 만 안다${dominant.length > 0 ? ` (${dominant.join(' · ')})` : ''}`;
}

/** 그 주체의 몸이 어디에 있고 사이에 무엇이 있는가. */
function reachRow(output: U1Output, phenomenon: Phenomenon, subject: string): LabRow {
  const body = output.stage.find((place) => place.owner === subject);
  const hit = output.perceived.find(
    (entry) => entry.perceiverId === subject && entry.phenomenonId === phenomenon.id,
  );
  const miss = output.misses.find(
    (entry) => entry.perceiverId === subject && entry.phenomenonId === phenomenon.id,
  );
  const span = hit?.distance ?? miss?.distance ?? null;
  const walls = hit?.dampedBy.length ? hit.dampedBy : (miss?.blockedBy ?? []);
  return {
    label: subject,
    value: `${body ? `${body.id}(${body.at[0]},${body.at[1]})` : '몸 없음'}${span === null ? '' : ` · ${span}m`}${
      walls.length > 0 ? ` · 사이에 ${walls.join('·')}` : ' · 사이에 아무것도 없음'
    }`,
  };
}

function defaultResult(output: U1Output): string {
  return (
    output.reports
      .map((report) => {
        const heard = Object.entries(report.byChannel)
          .map(([channel, ids]) => `${verbFor(channel, true)}: ${ids.map(shortId).join(',')}`)
          .join(' · ');
        return `${report.subjectId} → ${heard || '아무것도 알지 못한다'}`;
      })
      .join('   /   ') || '주체가 없다'
  );
}

function describeSenses(output: U1Output): string {
  return output.reports
    .map((report) => `${report.subjectId}(${report.kind}) 앎 ${report.known.length} / 모름 ${report.unknown.length}`)
    .join('   ');
}

function describeScript(input: U1Input): string {
  const scripted = (input.script ?? []).map((entry) => `${entry.tick}일 ${entry.intent.verb}`);
  const laws: string[] = [];
  if ((input.naturalLaws ?? []).length > 0) laws.push('S1 자연 법칙');
  if ((input.subjectLaws ?? []).length > 0) laws.push('U0 주체 법칙');
  return [...scripted, ...laws].join(' · ') || '없음';
}

function describePhenomena(output: U1Output): string {
  return (
    output.phenomena.map((entry) => `${shortId(entry.id)}[${entry.channels.join('·')}]`).join(' ') || '없음'
  );
}

// ---------------------------------------------------------------------------
// 단정 도우미
// ---------------------------------------------------------------------------

const eq = (id: string, expected: unknown, actual: unknown, reason?: string): AssertionResult => ({
  id,
  passed: JSON.stringify(expected) === JSON.stringify(actual),
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

const ok = (
  id: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
  reason?: string,
): AssertionResult => ({
  id,
  passed,
  expected,
  actual,
  ...(reason === undefined ? {} : { reason }),
});

interface WorldOptions {
  script?: ScriptedIntent[];
  rules?: RuleSpec[];
  naturalLaws?: RuleSpec[];
  subjectLaws?: RuleSpec[];
  testimonies?: Testimony[];
}

const world = (operations: StoreOperation[], ticks: number, options: WorldOptions = {}): U1Input => ({
  world: { components: COMPONENT_DEFINITIONS, operations },
  layout: LAYOUT,
  worldSeed: WORLD_SEED,
  ticks,
  ...options,
});

/** 종을 울리고 화약을 터뜨린다 — 같은 자리, 다른 크기. */
const RING_AND_BLAST: ScriptedIntent[] = [
  { tick: 1, intent: { id: 't1_toll', actor: 'chapel_bell', verb: 'toll' } },
  { tick: 2, intent: { id: 't2_blast', actor: 'powder_keg', verb: 'detonate' } },
];

const idOf = (output: U1Output, name: string): string => phenomenaNamed(output, name)[0]?.id ?? `없음:${name}`;

// ---------------------------------------------------------------------------
// 1. 대표 검증 — 벽은 시선을 끊고 소리를 줄인다
// ---------------------------------------------------------------------------
const aWallHidesTheSightButNotTheBlast = defineScene({
  id: 'a_wall_hides_the_sight_but_not_the_blast',
  title: '벽 뒤 사건은 보지 못하지만 큰 폭발음은 들을 수 있다',
  seed: 601n,
  arrange: () => world(TWO_SIDES_OF_A_WALL, 2, { script: RING_AND_BLAST, rules: SCENE_RULES }),
  check: (_input, output) => {
    const bell = idOf(output, 'bell_toll');
    const blast = idOf(output, 'blast');

    return [
      // ① 두 일이 실제로 일어났고 같은 자리에서 났다.
      eq('both_events_left_a_trace', 2, output.phenomena.length, '종소리와 폭발이 현상으로 남았다'),
      eq(
        'they_happened_at_the_same_spot',
        output.phenomena[0]?.location,
        output.phenomena[1]?.location,
        '거리도 벽도 같다 — 가르는 것은 세기뿐이다',
      ),

      // ② 벽 이쪽에서는 둘 다 보이고 들린다.
      eq('the_watchman_sees_and_hears_the_bell', ['audio', 'visual'], channelsHeardBy(output, 'watchman', bell)),
      eq(
        'the_watchman_feels_the_blast_on_his_skin',
        ['audio', 'touch', 'visual'],
        channelsHeardBy(output, 'watchman', blast),
        '2m 앞의 폭발은 열기까지 닿는다',
      ),

      // ③ 벽 뒤에서는 아무것도 보이지 않는다 — 원문 「11」 대표 검증의 앞 절.
      eq('the_hermit_sees_nothing', [], channelsHeardBy(output, 'hermit', blast).filter((c) => c === 'visual')),
      eq(
        'and_the_wall_is_what_cut_it',
        [MISS.SIGHT_BLOCKED],
        missCodesFor(output, 'hermit', blast, 'visual'),
        '막은 것이 무엇인지까지 나온다',
      ),
      eq(
        'the_wall_names_itself',
        ['stone_wall'],
        output.misses.find(
          (miss) => miss.perceiverId === 'hermit' && miss.phenomenonId === blast && miss.channel === 'visual',
        )?.blockedBy,
      ),

      // ④ 그러나 큰 폭발음은 넘어온다 — 대표 검증의 뒤 절.
      eq('the_hermit_hears_the_blast', ['audio'], channelsHeardBy(output, 'hermit', blast)),
      eq(
        'but_not_the_bell',
        [],
        channelsHeardBy(output, 'hermit', bell),
        '같은 자리의 작은 소리는 벽을 넘지 못한다',
      ),
      eq('and_the_bell_says_why', [MISS.BELOW_THRESHOLD], missCodesFor(output, 'hermit', bell, 'audio')),

      // ⑤ 벽이 소리를 끊은 것이 아니라 줄였다는 것이 수치로 남는다.
      ok(
        'the_wall_dampened_rather_than_cut',
        strengthOf(output, 'hermit', blast, 'audio') < strengthOf(output, 'watchman', blast, 'audio'),
        '은자의 폭발음 < 파수꾼의 폭발음',
        `${strengthOf(output, 'hermit', blast, 'audio')} < ${strengthOf(output, 'watchman', blast, 'audio')}`,
      ),
      eq(
        'and_the_wall_is_named_as_the_damper',
        ['stone_wall'],
        output.perceived.find(
          (entry) => entry.perceiverId === 'hermit' && entry.phenomenonId === blast && entry.channel === 'audio',
        )?.dampedBy,
      ),

      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => {
    const bell = idOf(output, 'bell_toll');
    const blast = idOf(output, 'blast');
    return [
      `종소리 — 파수꾼 ${strengthOf(output, 'watchman', bell, 'audio')} · 은자 ${
        output.misses.find((m) => m.perceiverId === 'hermit' && m.phenomenonId === bell && m.channel === 'audio')
          ?.strength ?? '—'
      } (문턱 2.5 미달)`,
      `폭발음 — 파수꾼 ${strengthOf(output, 'watchman', blast, 'audio')} · 은자 ${strengthOf(output, 'hermit', blast, 'audio')} (넘어온다)`,
      '시각은 벽 하나에 끊긴다 — 아무리 밝아도 넘어오지 않는다 (channel.onBlocked = cut)',
      '청각은 벽 하나마다 ×0.25 로 줄 뿐이다 (channel.onBlocked = damped)',
    ];
  },
});

function strengthOf(output: U1Output, subject: string, phenomenonId: string, channel: string): number {
  return (
    output.perceived.find(
      (entry) =>
        entry.perceiverId === subject && entry.phenomenonId === phenomenonId && entry.channel === channel,
    )?.strength ?? 0
  );
}

// ---------------------------------------------------------------------------
// 2. 원문 「2.4」 — 시각과 청각은 따로 도착한다
// ---------------------------------------------------------------------------
const sightAndSoundArriveAsSeparatePerceptions = defineScene({
  id: 'sight_and_sound_arrive_as_separate_perceptions',
  title: '같은 종소리라도 눈으로 잡은 것과 귀로 잡은 것은 따로 남는다',
  seed: 602n,
  arrange: () => world(WITH_A_DEAF_SMITH, 1, { script: [RING_AND_BLAST[0] as ScriptedIntent], rules: SCENE_RULES }),
  check: (_input, output) => {
    const bell = idOf(output, 'bell_toll');
    const watchman = output.reports.find((report) => report.subjectId === 'watchman');
    const smith = output.reports.find((report) => report.subjectId === 'deaf_smith');
    const hermit = output.reports.find((report) => report.subjectId === 'hermit');

    const both = output.perceived.filter(
      (entry) => entry.perceiverId === 'watchman' && entry.phenomenonId === bell,
    );

    return [
      // 원문 「2.4」: A는 소리를 듣는다 / B는 시각적으로 종을 보지 못한다.
      eq('the_watchman_hears_it', true, (watchman?.byChannel['audio'] ?? []).includes(bell)),
      eq('the_hermit_does_not_see_it', undefined, hermit?.byChannel['visual']),
      eq(
        'sight_and_sound_are_separate_rows',
        ['audio', 'visual'],
        both.map((entry) => entry.channel).sort(),
        '한 사건이 두 개의 지각으로 남는다',
      ),
      ok(
        'and_they_carry_different_strengths',
        new Set(both.map((entry) => entry.strength)).size === both.length,
        '두 지각의 세기가 서로 다르다',
        both.map((entry) => `${entry.channel} ${entry.strength}`),
      ),
      eq(
        'each_names_its_own_channel',
        both.length,
        both.filter((entry) => U1_CHANNELS.includes(entry.channel)).length,
      ),

      // 같은 자리에 서 있어도 감각이 다르면 아는 것이 다르다.
      eq(
        'the_deaf_smith_sees_but_never_hears',
        ['visual'],
        channelsHeardBy(output, 'deaf_smith', bell),
        '귀가 없는 사람은 같은 자리에서도 소리를 얻지 못한다',
      ),
      eq(
        'and_the_reason_is_not_distance_but_absence',
        [MISS.NO_SENSE],
        missCodesFor(output, 'deaf_smith', bell, 'audio'),
        '문턱을 못 넘은 것과 감각이 없는 것은 다른 일이다',
      ),
      ok(
        'the_three_know_different_things',
        new Set([
          JSON.stringify(watchman?.byChannel),
          JSON.stringify(smith?.byChannel),
          JSON.stringify(hermit?.byChannel),
        ]).size === 3,
        '세 사람이 저마다 다른 것을 안다',
        [watchman, smith, hermit].map((report) => `${report?.subjectId}: ${JSON.stringify(report?.byChannel)}`),
      ),

      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) =>
    output.reports.map(
      (report) =>
        `${report.subjectId} — ${
          Object.entries(report.byChannel)
            .map(([channel, ids]) => `${channel}: ${ids.map(shortId).join(',')}`)
            .join(' / ') || '아무것도 알지 못한다'
        }`,
    ),
});

// ---------------------------------------------------------------------------
// 3. 의념 — 능력이 있어야 느낀다
// ---------------------------------------------------------------------------
const onlyTheAttunedFeelTheAura = defineScene({
  id: 'only_the_attuned_feel_the_aura',
  title: '의념 감지 능력이 없는 주체는 기척을 느끼지 못하지만 물리 흔적은 얻는다',
  seed: 603n,
  arrange: () =>
    world(THE_ATTUNED_AND_THE_BLIND, 2, { naturalLaws: NATURAL_LAWS, subjectLaws: SUBJECT_LAWS }),
  check: (_input, output) => {
    const auras = output.phenomena.filter((entry) => entry.channels.includes('aura'));
    const physical = output.phenomena.filter((entry) => entry.channels.includes('smell'));
    const seerAura = auras.filter((entry) => channelsHeardBy(output, 'seer', entry.id).includes('aura'));
    const plainAura = auras.filter((entry) => channelsHeardBy(output, 'plain_walker', entry.id).includes('aura'));
    const plainSmell = physical.filter((entry) =>
      channelsHeardBy(output, 'plain_walker', entry.id).includes('smell'),
    );

    return [
      ok('the_world_left_both_kinds_of_trace', auras.length > 0 && physical.length > 0, '의념과 물리 흔적이 모두 있다', {
        aura: auras.length,
        physical: physical.length,
      }),
      ok('the_attuned_feels_them', seerAura.length > 0, '느낀다', seerAura.map((entry) => shortId(entry.id))),
      eq('the_unattuned_feels_none', 0, plainAura.length, '능력이 없으면 하나도 느끼지 못한다'),
      eq(
        'and_the_reason_is_the_missing_capability',
        [MISS.NO_CAPABILITY],
        missCodesFor(output, 'plain_walker', auras[0]?.id ?? '', 'aura'),
      ),
      ok(
        'but_the_physical_trace_still_reaches_him',
        plainSmell.length > 0,
        '곪는 냄새는 능력 없이도 맡는다',
        plainSmell.map((entry) => shortId(entry.id)),
        '원문 「10」 S3 의 대표 검증과 같은 선 — 잔향은 못 보아도 물리 흔적은 본다',
      ),
      ok(
        'the_capability_came_from_U0',
        output.reports.length > 0,
        '능력은 U0 의 cap_ 태그에서 온다',
        'cap_sense_aura',
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => {
    const auras = output.phenomena.filter((entry) => entry.channels.includes('aura'));
    return [
      `세계가 남긴 기척 ${auras.length}개 — ${auras.map((entry) => shortId(entry.id)).join(' ')}`,
      `seer (cap_sense_aura 있음) → ${output.reports.find((r) => r.subjectId === 'seer')?.known.length ?? 0}개를 안다`,
      `plain_walker (없음) → ${output.reports.find((r) => r.subjectId === 'plain_walker')?.known.length ?? 0}개를 안다`,
      '두 사람은 같은 자리에 서 있다. 가른 것은 오직 능력이다.',
    ];
  },
});

// ---------------------------------------------------------------------------
// 4. 보고와 소문 — 본 사람만 전할 수 있다
// ---------------------------------------------------------------------------
const wordOfMouthNeedsAMouthThatSawIt = defineScene({
  id: 'word_of_mouth_needs_a_mouth_that_saw_it',
  title: '보고와 소문은 저절로 오지 않는다 — 본 사람이 말해야 오고, 못 본 것은 전할 수 없다',
  seed: 604n,
  arrange: () => {
    const blastId = 't2_blast_powder_keg';
    const testimonies: Testimony[] = [
      // ① 파수꾼은 폭발을 보았다. 그가 은자에게 전한다 → 닿는다.
      {
        id: 'a_watchman_reports',
        tick: 3,
        senderId: 'watchman',
        receiverId: 'hermit',
        phenomenonId: blastId,
        channel: 'report',
        distortion: 0.2,
        concealment: 0,
        persuasion: 1,
      },
      // ② 은자는 폭발을 **보지** 못했다(소리만 들었다). 그래도 들은 것은 지각이므로 전할 수 있다.
      //    그러나 종소리는 아예 지각하지 못했으므로 전할 수 없다.
      {
        id: 'b_hermit_spreads_what_he_never_got',
        tick: 3,
        senderId: 'hermit',
        receiverId: 'watchman',
        phenomenonId: 't1_bell_toll_chapel_bell',
        channel: 'rumor',
        distortion: 0.5,
        concealment: 0,
        persuasion: 1,
      },
      // ③ 파수꾼이 숨기며 말한다 → 문턱을 넘지 못한다.
      {
        id: 'c_watchman_whispers_and_hides',
        tick: 3,
        senderId: 'watchman',
        receiverId: 'hermit',
        phenomenonId: 't1_bell_toll_chapel_bell',
        channel: 'rumor',
        distortion: 0.1,
        concealment: 0.95,
        persuasion: 1,
      },
    ];
    return world(TWO_SIDES_OF_A_WALL, 3, { script: RING_AND_BLAST, rules: SCENE_RULES, testimonies });
  },
  check: (_input, output) => {
    const blast = idOf(output, 'blast');
    const bell = idOf(output, 'bell_toll');
    const reported = output.perceived.find(
      (entry) => entry.perceiverId === 'hermit' && entry.phenomenonId === blast && entry.channel === 'report',
    );

    return [
      // ① 본 사람의 전언은 닿는다.
      ok('a_report_from_a_witness_lands', reported !== undefined, '닿는다', reported?.id),
      eq('and_it_names_who_carried_it', 'watchman', reported?.via, '누가 전했는지가 남는다'),
      eq('and_how_twisted_it_was', 0.2, reported?.distortion, '원본 26장의 왜곡이 실려 온다 — U2 가 확신도로 쓴다'),
      eq('a_carried_word_has_no_distance', null, reported?.distance, '공간을 건너오지 않았다'),
      ok(
        'the_hermit_now_knows_the_blast_two_ways',
        channelsHeardBy(output, 'hermit', blast).length === 2,
        '귀로 한 번, 말로 한 번',
        channelsHeardBy(output, 'hermit', blast),
      ),

      // ② 못 본 것은 전할 수 없다 — 소문 채널이 전지적 지식의 뒷문이 되지 않는다.
      eq(
        'you_cannot_pass_on_what_you_never_perceived',
        [MISS.SENDER_NEVER_PERCEIVED],
        missCodesFor(output, 'watchman', bell, 'rumor').filter((code) => code === MISS.SENDER_NEVER_PERCEIVED),
        'GI-02 — 은자는 종소리를 지각한 적이 없다',
      ),
      eq(
        'so_it_never_reaches_the_watchman_as_a_rumor',
        [],
        channelsHeardBy(output, 'watchman', bell).filter((channel) => channel === 'rumor'),
      ),

      // ③ 숨기고 말하면 닿지 않는다.
      ok(
        'a_hidden_word_falls_short',
        missCodesFor(output, 'hermit', bell, 'rumor').includes(MISS.BELOW_THRESHOLD),
        '숨김 0.95 → 세기 0.05 < 문턱 0.2',
        missCodesFor(output, 'hermit', bell, 'rumor'),
      ),

      // ④ 전언이 없었다면 아무 일도 없다.
      ok(
        'without_a_mouth_there_is_no_report',
        executeU1(
          world(TWO_SIDES_OF_A_WALL, 3, { script: RING_AND_BLAST, rules: SCENE_RULES }),
        ).perceived.every((entry) => entry.via === null),
        '전언을 빼면 보고도 소문도 하나도 없다',
        true,
      ),

      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => [
    '보고와 소문은 공간을 건너오지 않는다 — 사람이 들고 온다',
    ...output.perceived
      .filter((entry) => entry.via !== null)
      .map((entry) => `${entry.via} → ${entry.perceiverId} : ${shortId(entry.phenomenonId)} (왜곡 ${entry.distortion})`),
    ...output.misses
      .filter((entry) => entry.code === MISS.SENDER_NEVER_PERCEIVED || entry.channel === 'rumor')
      .map((entry) => `막힘 — ${entry.message}`),
  ],
});

// ---------------------------------------------------------------------------
// 5. 세계는 사건을 나눠 주지 않는다
// ---------------------------------------------------------------------------
const theWorldDoesNotHandItsEventsToEveryone = defineScene({
  id: 'the_world_does_not_hand_its_events_to_everyone',
  title: '멀리서 일어난 사냥은 실제로 일어나지만 아무도 알지 못한다',
  seed: 605n,
  arrange: () => ({
    ...world(A_HUNT_NOBODY_SEES, 3, {
      naturalLaws: NATURAL_LAWS,
      rules: SCENE_RULES,
      // 아무 흔적도 남기지 않는 일 — 세계에는 그런 일도 있다.
      script: [{ tick: 1, intent: { id: 't1_dust', actor: 'villager_body', verb: 'settle_dust' } }],
    }),
    layout: WIDE_LAYOUT,
  }),
  check: (_input, output) => {
    const villager = output.reports.find((report) => report.subjectId === 'villager');
    const hunt = output.phenomena.filter((entry) => entry.id.includes('_predation_'));
    const known = new Map(output.phenomena.map((entry) => [entry.id, entry]));

    return [
      ok('the_hunt_really_happened', hunt.length > 0, '사냥이 사건으로 일어났다', hunt.map((entry) => shortId(entry.id))),
      eq(
        'but_nobody_knows_the_hunt',
        [],
        output.perceived.filter((entry) => entry.phenomenonId.includes('_predation_')),
        '260m 밖의 사냥은 아무에게도 닿지 않는다',
      ),
      ok(
        'and_the_reason_is_distance',
        (villager?.reasons[hunt[0]?.id ?? ''] ?? []).includes(MISS.OUT_OF_RANGE),
        '너무 멀다',
        villager?.reasons[hunt[0]?.id ?? ''],
      ),
      ok(
        'the_villager_knows_only_his_own_body',
        (villager?.known ?? []).every((id) => known.get(id)?.sourceEntityId === 'villager_body'),
        '아는 것은 모두 제 몸이 낸 것뿐이다',
        (villager?.known ?? []).map(shortId),
      ),
      ok(
        'some_events_leave_no_trace_at_all',
        output.silentEvents > 0,
        '흔적을 남기지 않는 사건이 있다',
        `${output.silentEvents}건 (먼지가 가라앉는다)`,
        '세계가 바뀌었다고 해서 누군가 알아채는 것은 아니다',
      ),
      ok(
        'the_world_ran_more_events_than_anyone_perceived',
        output.events > output.perceived.length,
        '사건 수 > 지각 수',
        `${output.events} > ${output.perceived.length}`,
      ),
      // 지각은 읽기다. 세계를 한 칸도 바꾸지 않는다.
      eq(
        'perceiving_changed_nothing',
        output.storeHash,
        output.storeHashAfterPerceiving,
        '지각 전후의 세계 해시가 같다',
      ),
      ok(
        'the_alias_table_did_its_work',
        hunt.every((entry) => entry.channels.includes('visual') && entry.channels.includes('audio')),
        'S1 의 sight·sound 가 원본 10장의 visual·audio 로 옮겨졌다',
        hunt[0]?.channels,
      ),
      eq('nothing_was_dropped_silently', [], output.gaps, '사전에 없는 흔적이 하나도 없다'),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => [
    `사건 ${output.events}건 · 현상 ${output.phenomena.length}개 · 누군가에게 닿은 것 ${output.perceived.length}개`,
    `마을 사람이 모르는 현상 ${output.reports.find((r) => r.subjectId === 'villager')?.unknown.length ?? 0}개`,
    '늑대는 260m 밖에 있다 — 청각이 닿는 60m 밖이라 소리는 흩어져 사라진다.',
    '지각은 세계를 읽을 뿐 바꾸지 않는다 — 상태 해시가 그대로다.',
  ],
});

// ---------------------------------------------------------------------------
// 6. 못 본 이유가 언제나 남는다
// ---------------------------------------------------------------------------
const everyMissNamesTheReasonItMissed = defineScene({
  id: 'every_miss_names_the_reason_it_missed',
  title: '닿지 못한 것은 모두 왜 닿지 못했는지를 이름으로 남긴다',
  seed: 606n,
  arrange: () =>
    world(
      [
        ...WITH_A_DEAF_SMITH,
        // 몸이 없는 주체 — 공간에 있지 않다.
        {
          op: 'spawn',
          id: 'wandering_spirit',
          kind: 'god',
          tags: [],
          components: {
            senses: { visual: 1, audio: 1, aura: 1, report: 0.2, rumor: 0.2 },
            needs: { hunger: 0, duty: 5, safety: 0 },
            values: { duty: 1, survival: 0, temperance: 1 },
            traits: { patient: 1, impulsive: 0, cautious: 0 },
            emotions: { fear: 0, despair: 0 },
            resources: { provision: 0, salve: 0 },
            body: { entity_ids: [] },
          },
        } as StoreOperation,
      ],
      2,
      // 주체 법칙을 함께 굴려 의념의 기척도 나게 한다 — 여기 있는 누구도 그것을 느낄 능력이 없다.
      { script: RING_AND_BLAST, rules: SCENE_RULES, subjectLaws: SUBJECT_LAWS },
    ),
  check: (_input, output) => {
    const codes = [...new Set(output.misses.map((miss) => miss.code))].sort();
    const wanted = [MISS.BELOW_THRESHOLD, MISS.NO_BODY, MISS.NO_CAPABILITY, MISS.NO_SENSE, MISS.SIGHT_BLOCKED];

    return [
      eq(
        'the_five_spatial_reasons_all_appear',
        wanted,
        wanted.filter((code) => codes.includes(code)),
        '문턱 · 몸 없음 · 능력 없음 · 감각 없음 · 시선 막힘',
      ),
      ok('every_miss_carries_a_message', output.misses.every((miss) => miss.message !== ''), true, true),
      ok(
        'a_blocked_sight_names_what_blocked_it',
        output.misses
          .filter((miss) => miss.code === MISS.SIGHT_BLOCKED)
          .every((miss) => miss.blockedBy.length > 0),
        true,
        output.misses.find((miss) => miss.code === MISS.SIGHT_BLOCKED)?.blockedBy,
      ),
      ok(
        'a_missed_threshold_shows_the_numbers',
        output.misses
          .filter((miss) => miss.code === MISS.BELOW_THRESHOLD)
          .every((miss) => miss.strength !== null && miss.threshold !== null),
        true,
        output.misses.find((miss) => miss.code === MISS.BELOW_THRESHOLD),
      ),
      ok(
        'a_bodiless_subject_perceives_nothing_spatial',
        (output.reports.find((report) => report.subjectId === 'wandering_spirit')?.known ?? ['?']).length === 0,
        '몸이 없으면 공간을 느끼지 못한다',
        output.reports.find((report) => report.subjectId === 'wandering_spirit')?.reasons,
      ),
      ok(
        'nothing_is_missing_without_a_reason',
        output.reports.every((report) =>
          report.unknown.every((id) => (report.reasons[id] ?? []).length > 0),
        ),
        '모르는 현상마다 이유가 붙어 있다',
        true,
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => {
    const byCode = new Map<string, number>();
    for (const miss of output.misses) byCode.set(miss.code, (byCode.get(miss.code) ?? 0) + 1);
    return [
      ...[...byCode.entries()].sort().map(([code, count]) => `${code} — ${count}건`),
      '"멀어서"와 "막혀서"와 "감각이 없어서"는 다른 일이다. 구분되지 않으면 뒤에 오는 모듈은 "왜 저 NPC 는 모르는가"에 답할 수 없다.',
    ];
  },
});

// ---------------------------------------------------------------------------
// 7. 결정성
// ---------------------------------------------------------------------------
const theSameWorldIsPerceivedTheSameWay = defineScene({
  id: 'the_same_world_is_perceived_the_same_way',
  title: '같은 세계와 같은 시드는 같은 지각을 만든다',
  seed: 607n,
  arrange: () =>
    world(THE_ATTUNED_AND_THE_BLIND, 3, { naturalLaws: NATURAL_LAWS, subjectLaws: SUBJECT_LAWS }),
  check: (input, output) => {
    const again = executeU1(input);
    return [
      eq('same_digest', output.digest, again.digest, '같은 입력 → 같은 지각 (GI-12)'),
      eq('same_log_hash', output.logHash, again.logHash),
      eq('resimulated_log_hash', output.logHash, output.resimulatedLogHash),
      eq('same_store_hash', output.storeHash, again.storeHash),
      ok(
        'phenomena_are_ordered',
        output.phenomena.every(
          (entry, index) => index === 0 || (output.phenomena[index - 1] as { id: string }).id < entry.id,
        ),
        '현상이 id 오름차순이다',
        true,
      ),
      ok(
        'perceptions_are_ordered_within_each_tick',
        // 틱을 가로질러 정렬하지 않는다 — 시간 순서가 먼저다. 한 틱 안에서만 id 오름차순이다.
        output.series.every((sample) =>
          Object.values(sample.perceived).every((list) =>
            list.every((entry, index) => index === 0 || (list[index - 1] as { id: string }).id <= entry.id),
          ),
        ),
        '한 틱 안의 지각이 id 오름차순이다',
        true,
      ),
      ok(
        'a_shorter_run_is_a_prefix_of_a_longer_one',
        JSON.stringify(executeU1({ ...input, ticks: 1 }).series) ===
          JSON.stringify(output.series.slice(0, 1)),
        '짧게 굴린 세계는 길게 굴린 세계의 앞부분이다',
        true,
      ),
      eq('no_invariant_issue', [], validateOutput(output)),
    ];
  },
  reasons: (_input, output) => [
    `사건 해시 ${output.logHash.slice(0, 24)}…`,
    `지각 해시 ${output.digest.slice(0, 24)}…`,
    '주체 오름차순 · 현상 id 오름차순 · 채널은 책의 순서 — 세 곳에 못을 박아 순서를 고정한다',
  ],
});

export const u1Scenarios: VerificationScenario<U1Input, U1Output>[] = [
  aWallHidesTheSightButNotTheBlast,
  sightAndSoundArriveAsSeparatePerceptions,
  onlyTheAttunedFeelTheAura,
  wordOfMouthNeedsAMouthThatSawIt,
  theWorldDoesNotHandItsEventsToEveryone,
  everyMissNamesTheReasonItMissed,
  theSameWorldIsPerceivedTheSameWay,
];
