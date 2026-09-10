// World Author — brief 하나에서 방 하나의 뼈대를 낸다 (T3 ADDED).
//
//   npm run world:author -- <brief.json>            낼 것을 글자로 보인다 (파일을 쓰지 않는다)
//   npm run world:author -- <brief.json> --write    content/regions/<방>.ts 를 굳힌다
//
// 판정도 자리 고르기도 기반이 한다 (engine/world-authoring/author.ts). 이 도구가 하는 일은 셋이다:
// 템플릿(게임 명사)을 건네는 것 · 그 방을 어떻게 컴파일하는지 알려 주는 것 ·
// 나온 뼈대를 **이 저장소의 파일 모양**으로 옮기는 것.
//
// 파일 모양을 아는 것이 왜 도구인가 — 어느 폴더에 무슨 이름으로 두는지는 세계의 사실이 아니라
// 이 저장소의 사정이기 때문이다. 기반은 값을 내고, 이 도구가 그 값을 글자로 굳힌다.
//
// 굳힌 것은 **데이터다.** 방 하나가 느는 데 규칙 코드는 한 줄도 늘지 않는다 (등급 A · Tool-Scale §2).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_OPPORTUNITIES,
  COMPILE_RULES,
  gatherOpportunity,
  LIFE_SEEDS,
  MATERIAL_SEEDS,
  REGION_GRAPH,
  REGION_RULE_IDS,
} from '../../content/regions';
import { WORLD_AUTHOR_TEMPLATES, WORLD_CONTRACTS } from '../../content/authoring';
import { authorRegion, type AuthoredRegion } from '../../engine/world-authoring/author';
import { parseRegionBrief, type RegionBrief } from '../../engine/world-authoring/brief';
import {
  checkRegions,
  type CheckAccess,
  type CheckAccessLock,
  type CheckAccessSeed,
  type CheckAccessSeedSource,
  type CheckEcology,
  type CheckEcologySource,
  type CheckLife,
  type CheckLifeAbsence,
  type CheckLifeFormation,
  type CheckLifeLink,
  type CheckLifePopulation,
  type CheckRegion,
  type CheckReport,
} from '../../engine/world-authoring/check';
import type { RegionOp } from '../../engine/world-authoring/description';
import type { Opportunity } from '../../engine/world-authoring/opportunity';
import type { ResourceSourceSpec } from '../../content/regions';
import { gradeRegion, type GradeResult } from '../../engine/world-authoring/grade';
import { compileRegion } from '../../engine/world-authoring/compile';
import {
  WORLD_CHECK_ACCESS,
  WORLD_CHECK_CONTRACT,
  WORLD_CHECK_ECOLOGY,
  WORLD_CHECK_LIFE,
  WORLD_CHECK_OPPORTUNITY,
  WORLD_CHECK_REGIONS,
} from './check';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** brief 파일 하나 → 형을 통과한 brief. 통과하지 못하면 걸린 자리를 대고 멈춘다 */
export function readBrief(path: string): RegionBrief {
  const parsed = parseRegionBrief(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.ok) {
    const lines = parsed.problems.map((p) => `    ${p.path || '(뿌리)'}  ${p.message}`);
    throw new Error(['brief 가 형을 통과하지 못했다:', ...lines].join('\n'));
  }
  return parsed.brief;
}

/** 이 세계의 계약 목록과 대조한 등급 (T4) */
export function gradeFromFile(path: string): GradeResult {
  return gradeRegion(readBrief(path), WORLD_CONTRACTS);
}

/** 빠진 것들을 GAP 형식으로 — CLAUDE.md 의 네 줄 그대로 */
export function renderGrade(grade: GradeResult): string {
  const lines = [`  등급 ${grade.grade} — ${grade.because}`];
  const block = (title: string, gaps: GradeResult['blocking']) => {
    if (gaps.length === 0) return;
    lines.push('', `  ${title}`);
    for (const gap of gaps) {
      lines.push('    GAP');
      lines.push(`      Required   ${gap.required}`);
      lines.push(`      Missing    ${gap.missing}`);
      if (gap.reason) lines.push(`      Reason     ${gap.reason}`);
      lines.push(`      Return To  ${gap.returnTo}`);
    }
  };
  block('등급을 가른 것', grade.blocking);
  block('등급을 가르지는 않으나 채워야 할 것 (여덟 답)', grade.pending);
  return lines.join('\n');
}

/**
 * 뼈대를 낸 brief 를 뼈대 곁에 매어 두는 자리 — **⑩ 의 성질이 뼈대에 실려 나오지 못해서다**.
 *
 * 성질은 **재료의 것**이고(`MaterialSeed.properties`) 원천의 것이 아니다. 그래서 생성기는 그것을
 * 낼 자리가 없다 — 원천에 실으면 굳힌 방 파일이 서지 못한다 (`ResourceSourceSpec` 에 없는 키다).
 * 그렇다고 버려 두면 검사 ㉞ ㉟ 이 후보의 새 재료를 **성질 없는 재료**로 읽어, 답을 적은 brief 와
 * 적지 않은 brief 가 한 답으로 보인다.
 *
 * 그래서 도구가 붙잡아 둔다: 뼈대를 내는 자리가 하나(`authorBrief`)이므로 뼈대 하나에 brief 하나가
 * 맞물린다. 손으로 지은 뼈대에는 답이 없고, 그때의 성질은 빈 목록이다 (지어내지 않는다).
 * 기반이 성질을 지고 나오게 되면 이 자리는 지운다.
 */
const BRIEF_OF = new WeakMap<AuthoredRegion, RegionBrief>();

/** brief 하나 → 뼈대 하나. 이 세계의 템플릿과 컴파일 규칙을 건네는 자리다 */
export function authorBrief(brief: RegionBrief): AuthoredRegion {
  const authored = authorRegion({
    brief,
    templates: WORLD_AUTHOR_TEMPLATES,
    compile: (space) => compileRegion(space, COMPILE_RULES).world,
  });
  BRIEF_OF.set(authored, brief);
  return authored;
}

/** brief 파일 하나 → 뼈대 하나 */
export function authorFromFile(path: string): AuthoredRegion {
  return authorBrief(readBrief(path));
}

/**
 * 생성한 방을 **지금 세계 곁에 세워** 검사한다 (T3 의 산출 → T1). 저장소는 건드리지 않는다 —
 * 어느 방을 세계에 들이는가는 컨텐츠 층의 결정이고 도구가 정할 일이 아니다 (Tool-Scale §4).
 *
 * 생성기는 이웃 쪽 anchor 의 **이름만** 댄다 (그 방의 땅을 모르므로). 여기서는 그것을 실제로
 * 놓아 준다 — 그러지 않으면 새 방은 언제나 ⑤ 에 걸리고, 그 걸림은 brief 를 고쳐서는 풀리지 않는다.
 * 곧 이 검사가 답하는 것은 "**들이고 나면** 이 방이 서는가" 다.
 *
 * **재료 계통 검사(⑩~㉒)도 함께 건다.** 그러려면 그 방이 새로 낳는 재료가 재료 표에 있어야 하므로
 * 여기서 실어 준다 — 이웃 쪽 anchor 를 놓아 주는 것과 같은 어법이다 (사람이 붙일 줄을
 * `renderSeams` 가 대고, 이 검사는 붙인 뒤를 잰다). 그래서 편중(⑲ ⑳ ㉒)이 후보에게도 잡힌다.
 *
 * **생명 검사(㉗~㉝)도 같은 어법으로 건다** (T3 CHANGED — 생성기가 `ecology` 를 내게 되었다).
 * 건네지 않으면 일곱이 전부 `absent` 라, 탄생지가 없는 것과 탄생지를 재지 않은 것이 한 답으로
 * 보인다. 무엇을 실어 주는지는 `authoredLife` 가 적는다.
 *
 * **접근 검사(㉞~㊷)도 같은 어법이다** (T2 확장 ADDED — 생성기가 `access` 를 내게 되었다).
 * 무엇을 실어 주는지는 `authoredAccess` 가 적는다.
 */
export function checkAuthored(authored: AuthoredRegion): CheckReport {
  const anchorOps: RegionOp[] = authored.neighbourAnchors.map((a) => ({
    id: `anchor-${a.anchor.toLowerCase().replace(/_/g, '-')}`,
    kind: 'point',
    layer: WORLD_CHECK_CONTRACT.anchorLayer,
    tag: a.anchor,
    position: { x: 0, z: 0 },
  }));
  const regions: CheckRegion[] = [
    ...WORLD_CHECK_REGIONS.map((region) =>
      authored.neighbourAnchors.some((a) => a.region === region.id)
        ? { ...region, space: { ...region.space, ops: [...region.space.ops, ...anchorOps] } }
        : region,
    ),
    {
      id: authored.spec.id,
      depth: authored.spec.depth,
      space: authored.spec.space,
      coreRules: 0,
    },
  ];
  const sources = authored.spec.resourceEcology?.sources ?? [];
  return checkBeside(
    regions,
    {
      ...REGION_GRAPH,
      regions: [...REGION_GRAPH.regions, authored.spec.id],
      connectors: [...REGION_GRAPH.connectors, ...authored.connectors],
    },
    {
      ...WORLD_CHECK_ECOLOGY,
      // 그 방이 새로 낳는 재료 — 사람이 재료 표에 붙일 줄이다 (renderSeams 가 댄다)
      materials: [
        ...WORLD_CHECK_ECOLOGY.materials,
        ...freshMaterials(authored).map((seed) => ({ id: seed.id, worldCause: seed.worldCause })),
      ],
      sources: [
        ...WORLD_CHECK_ECOLOGY.sources,
        ...sources.map(
          (source): CheckEcologySource => ({
            id: source.id,
            region: authored.spec.id,
            materialId: source.materialId,
            worldCause: source.worldCause,
            supply: source.supply,
            // 이 세계의 원천은 전부 되돌아오고 유한하지 않다 (world:check 와 같은 답이다)
            renewable: true,
            recoveryCause: source.recoveryCause,
            finite: false,
            depletionConsequence: '',
            traces: source.traceOps,
            opportunity: source.opportunity,
            carrier: source.carrier,
          }),
        ),
      ],
      // 원천을 가진 방은 스스로 낳으므로 고립을 밝힐 것이 없다 (검사 ㉒ 가 그렇게 묻는다)
      regions: [
        ...WORLD_CHECK_ECOLOGY.regions,
        { id: authored.spec.id, isolationReason: '' },
      ],
    },
    authoredLife(authored),
    // 후보가 내미는 것 — 그 방의 원천마다 채집 기회 하나 (세계의 기본형과 같은 유도다).
    // 뼈대의 원천은 어휘가 아직 좁혀지지 않은 값(carrier · opportunity 가 string)이라 형으로
    // 좁혀 건넨다 — 유도가 읽는 것은 id · 자리 역할 · 때 · 조건뿐이다.
    [
      ...ALL_OPPORTUNITIES,
      ...sources.map((source) => gatherOpportunity(authored.spec.id, source as unknown as ResourceSourceSpec)),
    ],
    authoredAccess(authored),
  );
}

/**
 * 후보가 **묻는 것**을 지금 세계의 것 곁에 세운다 (검사 ㉞~㊷ 이 이것을 읽는다).
 *
 * 계통 · 생명을 건네는 어법 그대로다 — 세계의 계약(`WORLD_CHECK_ACCESS`)에 후보의 것을 이어
 * 붙인다. 이어 붙이는 것은 셋이다:
 *
 *   `locks`        그 방이 묻는 것. 요구는 **밝힌 갈래마다 한 줄**로 편다 (세계의 계약이 세운
 *                  어법 그대로 — 갈래를 글자로 가르지 않고 어느 필드를 밝혔는가로 가른다).
 *   `seeds`        그 방이 **새로 낳는 재료**와 그 성질 (⑩). 이것을 실어 주지 않으면 ㉟ 이
 *                  "요구에 답할 성질의 원천이 없다" 로 읽는다 — 답을 적은 brief 가 적지 않은
 *                  brief 와 한 답으로 보이는 자리다.
 *   `seedSources`  그 재료를 내는 원천이 **어느 방에 섰는가**. ㉟ 이 "그 Lock 을 지나지 않고
 *                  닿는가" 를 여기서 읽으므로, 성질만 실어 주고 자리를 대지 않으면 답이 놓인 적
 *                  없는 것이 된다. 새 재료가 아닌 원천도 함께 댄다 — 이미 아는 재료를 그 방이
 *                  새로 내미는 것도 답의 자리이기 때문이다.
 *
 * `silences` 는 **판정되지 않는다** — 묻지 않는 방이 밝힌 사유를 보고에 그대로 옮길 뿐이다
 * (생명의 `absences` 가 선 그 자리 그대로). 밝히지 않은 방은 여기 오지 않는다.
 *
 * `relaxations` 에는 후보가 더할 것이 없다 — 생성기는 무르게 하는 자락을 내지 않는다
 * (brief 가 그것을 묻지 않는다). 잰 적 없는 것을 지어내지 않는다.
 */
function authoredAccess(authored: AuthoredRegion): CheckAccess {
  const region = authored.spec.id;
  const access = authored.spec.access;
  const sources = authored.spec.resourceEcology?.sources ?? [];
  // 답의 종류 — 재료가 첫째다. 어느 것이 재료인가를 두 자리가 다르게 고르지 않도록 세계의
  // 계약이 이미 고른 그 자리(check.ts 의 seeds)를 그대로 따른다
  const materialKind = WORLD_CHECK_ACCESS.answerKinds[0] ?? '';
  return {
    ...WORLD_CHECK_ACCESS,
    locks: [
      ...WORLD_CHECK_ACCESS.locks,
      ...(access?.locks ?? []).map(
        (lock): CheckAccessLock => ({
          id: lock.id,
          region,
          at: { kind: lock.at.kind, ref: lock.at.ref },
          important: lock.important ?? false,
          requires: lock.requires.flatMap((requirement) => {
            const out: { property?: string; kind: string }[] = [];
            if (requirement.property !== undefined) {
              out.push({ property: requirement.property, kind: 'property' });
            }
            if (requirement.time !== undefined) out.push({ kind: 'time' });
            if (requirement.state !== undefined) out.push({ kind: 'state' });
            if (requirement.knowledge !== undefined) out.push({ kind: 'knowledge' });
            return out;
          }),
          traces: lock.traces.map((trace) => trace.op),
          relaxations: [],
        }),
      ),
    ],
    seeds: [
      ...WORLD_CHECK_ACCESS.seeds,
      ...freshMaterials(authored).map(
        (seed): CheckAccessSeed => ({
          id: seed.id,
          answerKind: materialKind,
          properties: (seed.properties ?? []).map((property) => ({
            tag: property.tag,
            from: property.from,
          })),
        }),
      ),
    ],
    seedSources: [
      ...WORLD_CHECK_ACCESS.seedSources,
      ...sources.map(
        (source): CheckAccessSeedSource => ({
          seed: source.materialId,
          region,
          source: source.id,
        }),
      ),
    ],
    silences: [
      ...(WORLD_CHECK_ACCESS.silences ?? []),
      ...(access?.silence ? [{ region, reason: access.silence }] : []),
    ],
  };
}

/**
 * 후보의 생명 계통을 지금 세계의 것 **곁에 세운다** (검사 ㉗~㉝ 이 이것을 읽는다).
 *
 * 재료 계통을 건네는 어법 그대로다 — 세계의 계약(`WORLD_CHECK_LIFE`)에 후보의 것을 이어
 * 붙인다. 기반이 보는 것은 하나의 세계이므로, 후보의 탄생지가 **다른 방의** 원천 · 개체군을
 * 가리켜도 그대로 재어진다 (붉은 눈의 거목이 둥지의 균사를 가리키는 그 자리다).
 *
 * `regionRules` 도 함께 는다: 탄생지가 가리키는 규칙이 세계의 표에 서 있지 않으면 ㉗ 이
 * 잡는데, 그 걸림은 brief 를 고쳐서 풀리지 않는다 — **사람이 붙일 줄**이기 때문이다
 * (새 재료와 같은 자리다. `renderSeams` 가 그것을 댄다).
 *
 * `lifeRecoveries` 와 `residueSourceIds` 에는 후보가 더할 것이 없다 — 뼈대의 원천은
 * 회복을 잇는 개체군도 잔류 표시도 내지 않는다. 잰 적 없는 것을 지어내지 않는다.
 */
function authoredLife(authored: AuthoredRegion): CheckLife {
  const region = authored.spec.id;
  const ecology = authored.spec.ecology;
  const sites = ecology?.lifeFormation ?? [];
  return {
    ...WORLD_CHECK_LIFE,
    formations: [
      ...WORLD_CHECK_LIFE.formations,
      ...sites.map(
        (site): CheckLifeFormation => ({
          id: site.id,
          region,
          mode: site.mode,
          worldCause: site.worldCause,
          regionRule: site.condition.regionRule,
          sourceMaterialIds: site.source.materials,
          sourceStateCodes: site.source.states,
          // 요구를 **어느 필드를 밝혔는가**로 가른다 — 요구의 kind 는 이 세계의 어휘이고
          // (템플릿이 정한다) 기반의 형은 가리키는 것을 필드로 나눠 두었다. 글자로 가르면
          // 어휘가 하나 늘 때마다 이 줄이 조용히 틀린다
          requiredSourceIds: site.condition.requires.flatMap((requirement) =>
            requirement.sourceId ? [requirement.sourceId] : [],
          ),
          requiredPopulationIds: site.condition.requires.flatMap((requirement) =>
            requirement.populationId ? [requirement.populationId] : [],
          ),
          consumesSourceIds: site.consumes,
          // 전조와 태어난 뒤의 자락을 함께 편다 (세계의 계약이 세운 어법 그대로 — ㉗ 은
          // 그 op 이 그 방 Description 에 실제로 서 있는가를 본다)
          traceOpIds: [...site.traces.before.map((trace) => trace.op), ...site.traces.after],
          population: site.population,
        }),
      ),
    ],
    populations: [
      ...WORLD_CHECK_LIFE.populations,
      ...(ecology?.populations ?? []).map(
        (population): CheckLifePopulation => ({ id: population.id, region }),
      ),
    ],
    // 생성기는 `via` 를 내지 않는다 — 두 끝이 어느 방에 사는지를 brief 하나로는 알 수 없다.
    // 방을 넘는 관계라면 사람이 이음을 붙여야 하고, 그 자리를 `renderSeams` 가 댄다
    links: [
      ...WORLD_CHECK_LIFE.links,
      ...(ecology?.links ?? []).map(
        (link): CheckLifeLink => ({ from: link.from, to: link.to, kind: link.kind }),
      ),
    ],
    absences: [
      ...(WORLD_CHECK_LIFE.absences ?? []),
      ...(ecology?.absenceReason
        ? [{ region, reason: ecology.absenceReason } satisfies CheckLifeAbsence]
        : []),
    ],
    regionRules: [...WORLD_CHECK_LIFE.regionRules, ...freshRegionRules(authored)],
  };
}

/**
 * 후보 **없이** 같은 검사를 돌린다 — 편중 요약이 견줄 바탕이다 (T6).
 *
 * `checkAuthored` 와 **같은 잣대**여야 한다. 한쪽만 재료 계통(⑩~㉒) · 생명 계통(㉗~㉝) ·
 * 접근(㉞~㊷)을 걸면 견준 차이가 후보 때문인지 잣대 때문인지 갈리지 않는다. 그래서 둘 다 같은
 * 자리(`checkBeside`)를 지나고, 이쪽은 지금 세계의 계약을 손대지 않은 채로 건넨다.
 */
export function checkBaseline(): CheckReport {
  return checkBeside(WORLD_CHECK_REGIONS, REGION_GRAPH, WORLD_CHECK_ECOLOGY, WORLD_CHECK_LIFE);
}

function checkBeside(
  regions: readonly CheckRegion[],
  graph: typeof REGION_GRAPH,
  ecology: CheckEcology,
  life: CheckLife,
  opportunities: readonly Opportunity[] = ALL_OPPORTUNITIES,
  // 접근 쪽 계약도 **양쪽에 같은 잣대로** 건넨다 (T2 확장) — 바탕은 지금 세계의 것 그대로이고,
  // 후보 쪽은 그 위에 자기 Lock · 새 재료의 성질 · 침묵을 얹은 것이다
  access: CheckAccess = WORLD_CHECK_ACCESS,
): CheckReport {
  return checkRegions({
    regions,
    graph,
    contract: WORLD_CHECK_CONTRACT,
    compile: (region) => compileRegion(region.space, COMPILE_RULES).world,
    ecology,
    life,
    access,
    // 기회 쪽 계약도 **양쪽에 같은 잣대로** 건넨다 (T6 · C037) — 한쪽만 걸면 편중 요약이
    // 후보 때문인지 잣대 때문인지 갈리지 않는다. 후보의 기회는 그 방의 원천에서 유도한다.
    opportunity: {
      ...WORLD_CHECK_OPPORTUNITY,
      opportunities,
      vocabulary: {
        ...WORLD_CHECK_OPPORTUNITY.vocabulary,
        targets: {
          ...WORLD_CHECK_OPPORTUNITY.vocabulary.targets,
          source: [
            ...(WORLD_CHECK_OPPORTUNITY.vocabulary.targets.source ?? []),
            ...opportunities.flatMap((one) => (one.target.kind === 'source' ? [one.target.ref] : [])),
          ],
        },
        progressPaths: [
          ...(WORLD_CHECK_OPPORTUNITY.vocabulary.progressPaths ?? []),
          ...opportunities.flatMap((one) => (one.progress.ref ? [one.progress.ref] : [])),
        ],
      },
    },
  });
}

/** 값을 글자로 — 키 순서가 값의 순서 그대로여야 두 번 내도 같다 */
function literal(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map((v) => `${indent}  ${literal(v, `${indent}  `)}`).join(',\n');
    return `[\n${inner},\n${indent}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const inner = entries
      .map(([key, v]) => `${indent}  ${key}: ${literal(v, `${indent}  `)}`)
      .join(',\n');
    return `{\n${inner},\n${indent}}`;
  }
  return JSON.stringify(value);
}

/** 값 글자를 이 저장소의 글자꼴로 — 키에 따옴표를 두지 않고 홑따옴표를 쓴다 */
function asSource(text: string): string {
  return text.replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:').replace(/"/g, "'");
}

/**
 * 굳힌 파일이 layer 이름을 **글자가 아니라 상수로** 지도록 하는 표 — 어느 상수가 어느 파일에서
 * 오는지는 이 저장소의 사정이므로 도구가 안다 (기반은 layer 이름만 낸다).
 *
 * 값은 템플릿이 준 것을 쓴다. 컨텐츠의 표가 바뀌면 템플릿이 따라가고 이 표는 그대로다 —
 * 여기서 정하는 것은 "그 값이 어느 이름으로 어디서 오는가" 하나뿐이다.
 */
const LAYER_CONSTANTS: readonly { layer: string; constant: string; from: string }[] = [
  { layer: WORLD_AUTHOR_TEMPLATES.anchorLayer, constant: 'ANCHOR_LAYER', from: './spec' },
  {
    layer: WORLD_AUTHOR_TEMPLATES.resourceLayer,
    constant: 'RESOURCE_LAYER',
    from: './resource-ecology',
  },
  { layer: WORLD_AUTHOR_TEMPLATES.traceLayer, constant: 'TRACE_LAYER', from: './resource-ecology' },
  // 생명이 붙으면 늘어나는 것 — 떼의 자락 (T3 ADDED)
  {
    layer: WORLD_AUTHOR_TEMPLATES.presenceLayer,
    constant: 'PRESENCE_LAYER',
    from: './resource-ecology',
  },
  // 철이 붙으면 늘어나는 것 — 깊이 · 위험 덧씌움 (T3 ADDED)
  { layer: WORLD_AUTHOR_TEMPLATES.depthLayer, constant: 'DEPTH_LAYER', from: './phases' },
  { layer: WORLD_AUTHOR_TEMPLATES.hazardLayer, constant: 'HAZARD_LAYER', from: './phases' },
  // 물음이 붙으면 늘어나는 것 — 흔적이 사는 자락 (T2 확장 ADDED).
  //
  // 이 이름의 **소유는 환상 미로**다 (content/regions/fantasy-maze.ts 가 짓고, 묶음
  // index.ts 가 그 파일의 것을 그대로 내보낸다 — 템플릿이 집는 것도 그것이다).
  // 규칙 표(terrain-rules.ts)에 같은 글자가 한 벌 더 있으나 그것은 **그리는 쪽으로 내보낼
  // layer 목록**을 위한 사본이고(표가 방 파일을 import 하지 않으려고 글자로 든다), 굳힌 방이
  // 짚어야 할 것은 사본이 아니라 소유자다.
  { layer: WORLD_AUTHOR_TEMPLATES.clueLayer, constant: 'CLUE_LAYER', from: './fantasy-maze' },
];

/** 방 하나의 파일 — content/regions/<slug>.ts 에 그대로 들어간다 */
export function renderRegionModule(authored: AuthoredRegion): string {
  const spec = authored.spec;
  const missing = authored.unanswered.length;
  // **실제로 쓰인 layer 만** 되돌린다 — 생명도 철도 없는 방에는 그 셋의 op 이 아예 오지 않고,
  // 쓰지 않는 이름을 import 하면 굳힌 파일이 쓰이지 않는 것을 지고 선다 (굳힌 파일은 반드시
  // 컴파일되어야 한다 — 이 파일 머리가 선언한 완료 조건이다)
  const used = LAYER_CONSTANTS.filter((entry) =>
    spec.space.ops.some((op) => 'layer' in op && op.layer === entry.layer),
  );
  // import 줄은 파일마다 하나 — 위 표의 차례가 곧 줄의 차례다 (같은 뼈대는 같은 글자를 낸다)
  const imports = [...new Set(used.map((entry) => entry.from))].map((from) => {
    const names = used.filter((entry) => entry.from === from).map((entry) => entry.constant);
    return `import { ${names.join(', ')} } from '${from}';`;
  });
  const body = [
    `// ${authored.name} — depth ${spec.depth}. **world:author 가 낸 뼈대다** (T3).`,
    '//',
    '// 손으로 쓴 방들이 지닌 실측 근거(왜 이 반경인가 · 왜 이 깊이인가)가 이 파일에는 없다.',
    '// 생성기가 댄 것은 서기는 하는 방 하나다 — 검사 아홉을 통과하고, 놓인 원천에 걸어 닿는다.',
    '// 값을 손으로 고치는 순간 이 파일은 생성물이 아니라 손으로 쓴 방이 된다 (그래도 좋다).',
    '//',
    missing > 0
      ? `// 이 방의 brief 는 아직 ${missing} 가지를 답하지 못했다: ${authored.unanswered.join(' · ')}.`
      : '// 이 방의 brief 는 여덟 답을 다 채웠다.',
    '//',
    `// seed ${spec.space.seed} 는 brief 를 해시한 값이다 — 같은 brief 는 언제나 같은 방을 낸다.`,
    '',
    "import type { RegionSpec } from './spec';",
    ...imports,
    '',
    `export const ${spec.id} = '${spec.id}';`,
    '',
    `export const ${spec.id}_SPEC: RegionSpec = ${literal(spec, '')};`,
    '',
  ].join('\n');
  // layer 이름과 방 이름을 글자가 아니라 상수로 — 컨텐츠의 표가 바뀌면 이 파일도 따라간다.
  // **`layer:` 자리에서만** 되돌린다: 철이 붙으면서 같은 글자가 값이 아닌 자리에도 서기
  // 때문이다 (`depth: 'deep'` · `hazard: 'hazard/creature'` — 그 둘은 layer 가 아니다)
  let text = body;
  for (const entry of used) {
    text = text.replace(new RegExp(`layer: "${entry.layer}"`, 'g'), `layer: ${entry.constant}`);
  }
  return asSource(text.replace(new RegExp(`"${spec.id}"`, 'g'), spec.id));
}

/** graph 와 view 표에 이어 붙일 줄들 — 손으로 옮겨 넣는 자리를 정확히 댄다 */
/**
 * 그 방이 **새로 낳는 재료** — 재료 표(MATERIAL_SEEDS)에 아직 없는 것들.
 *
 * 방 하나를 들이는 일은 방 파일 하나로 끝나지 않는다. 그 방이 낳는 재료가 세계의 재료 표에
 * 서 있지 않으면 검사 ⑪(원천이 아는 재료를 가리키는가)과 ㉑(그 원천이 내는 재료가 있는가)이
 * 잡는다 — 승인해 놓고 검사가 깨지는 자리가 여기였다.
 *
 * 그래도 **도구가 그 표를 고치지 않는다.** 무엇이 이 세계의 재료인가는 방 하나의 사정이 아니라
 * 계통의 일이고(재료 셋이 사슬 하나에 매달려 있다 — A.1), 그 판단은 사람의 것이다.
 * 도구가 하는 일은 graph 줄과 view 줄에 한 것과 같다: **어디에 무엇을 붙여야 하는지 정확히 대는 것**.
 *
 * **성질(⑩)도 함께 댄다** (T2 확장 ADDED). 성질은 원천이 아니라 **재료**의 것이므로 붙을 자리가
 * 여기다 — brief 가 `worth.sources[].properties` 로 적은 것을 그 재료의 줄에 얹는다.
 * 밝히지 않은 재료에는 키를 두지 않는다 (재료 표가 그런 그대로 — 성질 없는 재료는 결손이 아니다).
 */
export function freshMaterials(
  authored: AuthoredRegion,
): {
  id: string;
  worldCause: string;
  forms: string[];
  properties?: { tag: string; from: string }[];
}[] {
  const known = new Set(MATERIAL_SEEDS.map((seed) => seed.id));
  // ⑩ — 그 원천이 내는 것의 성질. **재료마다** 모은다: 같은 재료를 원천 둘이 내면 밝힌 것을
  // 이어 붙이되 같은 태그는 한 번만 선다 (순도가 갈려도 성질은 그 재료의 것이다)
  const properties = new Map<string, { tag: string; from: string }[]>();
  for (const source of BRIEF_OF.get(authored)?.answers.worth.sources ?? []) {
    const rows = properties.get(source.material) ?? [];
    for (const property of source.properties) {
      if (rows.some((row) => row.tag === property.tag)) continue;
      rows.push({ tag: property.tag, from: property.from });
    }
    properties.set(source.material, rows);
  }
  const fresh = new Map<
    string,
    { id: string; worldCause: string; forms: string[]; properties?: { tag: string; from: string }[] }
  >();
  for (const source of authored.spec.resourceEcology?.sources ?? []) {
    if (known.has(source.materialId)) continue;
    const seed = fresh.get(source.materialId) ?? {
      id: source.materialId,
      worldCause: source.worldCause,
      forms: [],
    };
    // 같은 재료가 여러 형태로 난다 — 종류를 늘린 것이 아니라 순도를 늘린 것이다 (A.1)
    if (!seed.forms.includes(source.form)) seed.forms.push(source.form);
    fresh.set(source.materialId, seed);
  }
  // 성질은 **마지막에** 얹는다 — 굳힌 글자의 키 차례가 재료 표(MaterialSeed)의 차례여야 한다
  for (const seed of fresh.values()) {
    const rows = properties.get(seed.id) ?? [];
    if (rows.length > 0) seed.properties = rows;
  }
  return [...fresh.values()];
}

/**
 * 그 방이 **올리는 개체군** 가운데 세계가 아직 모르는 것들 — Life Seed 표(LIFE_SEEDS)에 없는 것.
 *
 * 재료와 같은 자리다 (`freshMaterials` 의 어법 그대로). 방 하나가 개체군을 올린다고 해서
 * 그것이 세계에 사는 것이 되지는 않는다 — 무엇이 이 세계에 사는가는 방 하나의 사정이 아니라
 * 사슬의 일이고(넷이 하나의 원인 아래 선다 — lives.ts), 그 판단은 사람의 것이다.
 *
 * 세계 원인은 **지어내지 않는다** — 그 개체군을 올리는 탄생지가 밝힌 것을 그대로 옮기고,
 * 올리는 탄생지가 없으면 비워 둔다 (무엇에 매달려 사는지를 사람이 밝혀야 한다).
 */
export function freshLives(authored: AuthoredRegion): { id: string; worldCause: string }[] {
  const known = new Set(LIFE_SEEDS.map((seed) => seed.id));
  const sites = authored.spec.ecology?.lifeFormation ?? [];
  const fresh = new Map<string, { id: string; worldCause: string }>();
  for (const population of authored.spec.ecology?.populations ?? []) {
    if (known.has(population.id) || fresh.has(population.id)) continue;
    const raising = sites.find((site) => site.population === population.id);
    fresh.set(population.id, { id: population.id, worldCause: raising?.worldCause ?? '' });
  }
  return [...fresh.values()];
}

/**
 * 그 방의 탄생지가 가리키는 **Region Rule id** 가운데 세계가 아직 모르는 것들.
 *
 * 더하지 않으면 검사 ㉗ 이 잡는다 — 세계가 모르는 규칙이 일으키는 탄생이 되기 때문이다.
 * 그래도 도구가 그 표를 고치지 않는다: 어느 규칙이 이 세계에 서는가는 규칙 코드가 실제로
 * 굴러야 성립하는 일이고(ecology.ts 의 RULE_* 상수와 그것을 도는 시스템), 방 하나가
 * 이름을 댔다고 규칙이 서지는 않는다.
 */
export function freshRegionRules(authored: AuthoredRegion): string[] {
  const known = new Set(REGION_RULE_IDS);
  const fresh: string[] = [];
  for (const site of authored.spec.ecology?.lifeFormation ?? []) {
    const rule = site.condition.regionRule;
    if (known.has(rule) || fresh.includes(rule)) continue;
    fresh.push(rule);
  }
  return fresh;
}

/**
 * **방을 넘는 관계들** — 생성기가 이음(`via`)을 내지 못한 자리.
 *
 * 생성기는 brief 하나만 보므로 관계의 두 끝이 어느 방에 사는지 모른다. 그래서 관계는 언제나
 * 이음 없이 나오고, 끝이 **다른 방의 개체군**이면 사람이 이음 이름을 붙여야 한다 —
 * 밝히지 않으면 그 관계는 아무 일도 하지 않는다 (붉은 눈의 거목이 세운 어법: 방을 넘는
 * 관계는 `via` 로 문 이름을 밝힌다).
 *
 * `livesIn` 이 비었으면 그 끝이 **세계에 아직 없는 개체군**이다 — 어느 방에 세울지가 먼저다.
 */
export function crossingLinks(
  authored: AuthoredRegion,
): { from: string; to: string; kind: string; livesIn: string }[] {
  const region = authored.spec.id;
  // 어느 개체군이 어느 방에 사는가 — 지금 세계의 것에 후보의 것을 얹는다 (검사와 같은 봄이다)
  const regionOf = new Map(WORLD_CHECK_LIFE.populations.map((one) => [one.id, one.region]));
  for (const population of authored.spec.ecology?.populations ?? []) {
    regionOf.set(population.id, region);
  }
  const crossing: { from: string; to: string; kind: string; livesIn: string }[] = [];
  for (const link of authored.spec.ecology?.links ?? []) {
    if (link.via !== undefined) continue;
    const livesIn = regionOf.get(link.to) ?? '';
    // 같은 방 안의 관계는 밝힐 이음이 없다 — 댈 것이 없으면 대지 않는다
    if (livesIn === region) continue;
    crossing.push({ from: link.from, to: link.to, kind: link.kind, livesIn });
  }
  return crossing;
}

/**
 * 그 방이 **처음 쓰는 성질 태그**들 — 세계의 어느 재료도 가지지 않고 어느 답 규칙도 말하지 않은 것.
 *
 * 새 재료 · 새 개체군과 같은 자리다 (`freshMaterials` 의 어법 그대로). 태그 하나가 서는 것은 방
 * 하나의 사정이 아니라 **어휘의 일**이고, 그 판단은 사람의 것이다 — 무엇이 무엇에 답하는가를
 * 세계가 적지 않으면 그 성질은 아무 요구에도 닿지 않고(검사 ㉟) 그 요구는 답 없는 요구가 된다.
 *
 * 축·관계가 어휘에 있는지도 함께 낸다: 없으면 등급 판정기(T4)가 먼저 잡는 자리라 사람이
 * 어디부터 붙여야 하는지가 갈린다.
 */
export function freshProperties(
  authored: AuthoredRegion,
): { tag: string; where: string; inVocabulary: boolean }[] {
  const { aspects, relations, tagSeparator, answers, seeds } = WORLD_CHECK_ACCESS;
  const aspectIds = new Set(aspects);
  const relationIds = new Set(relations);
  // 이 세계가 이미 말한 태그들 — 재료가 가진 것과 답 규칙이 양쪽 열에서 부르는 것
  const known = new Set<string>();
  for (const seed of seeds) for (const property of seed.properties) known.add(property.tag);
  for (const answer of answers) {
    known.add(answer.requirement);
    known.add(answer.property);
  }
  const fresh: { tag: string; where: string; inVocabulary: boolean }[] = [];
  const seen = new Set<string>();
  const add = (tag: string, where: string): void => {
    if (known.has(tag) || seen.has(tag)) return;
    seen.add(tag);
    const parts = tagSeparator === '' ? [] : tag.split(tagSeparator);
    fresh.push({
      tag,
      where,
      inVocabulary:
        parts.length === 2 && aspectIds.has(parts[0] ?? '') && relationIds.has(parts[1] ?? ''),
    });
  };
  // 새 재료가 가진 성질 먼저, 그 다음이 Lock 의 요구다 (뼈대가 낸 차례 그대로)
  for (const material of freshMaterials(authored)) {
    for (const property of material.properties ?? []) add(property.tag, `새 재료 ${material.id}`);
  }
  for (const lock of authored.spec.access?.locks ?? []) {
    for (const requirement of lock.requires) {
      if (requirement.property !== undefined) add(requirement.property, `Lock ${lock.id} 의 요구`);
    }
  }
  return fresh;
}

/**
 * Lock 이 가리키는 자리 가운데 **실제로 서 있지 않은** 것들 (검사 ㉞ 이 잡는 그 자리).
 *
 * 생성기는 brief 가 댄 이름을 그대로 옮길 뿐이고, 그 이름의 문·자락이 세계에 있는지는 모른다.
 * 문이면 세계의 Connector 표(그 방이 새로 들이는 것까지)에, 자락이면 **그 방 Description 의
 * area op** 에 그 이름이 있어야 한다 — 기반이 보는 것과 같은 두 자리를 같은 규칙으로 본다.
 *
 * 그 둘이 아닌 갈래는 묻지 않는다: 무엇을 찾을지 기반이 모르는 자리이고, 갈래의 이름이
 * 성립하는지는 등급 판정기가 대조한다.
 */
export function unplacedLocks(
  authored: AuthoredRegion,
): { lock: string; kind: string; ref: string }[] {
  const { connectorLockKind, areaLockKind } = WORLD_CHECK_ACCESS;
  const connectorIds = new Set([
    ...REGION_GRAPH.connectors.map((connector) => connector.id),
    ...authored.connectors.map((connector) => connector.id),
  ]);
  const areaIds = new Set(
    authored.spec.space.ops.flatMap((op) => (op.kind === 'area' ? [op.id] : [])),
  );
  const unplaced: { lock: string; kind: string; ref: string }[] = [];
  for (const lock of authored.spec.access?.locks ?? []) {
    const { kind, ref } = lock.at;
    const stands =
      kind === connectorLockKind
        ? connectorIds.has(ref)
        : kind === areaLockKind
          ? areaIds.has(ref)
          : true;
    if (!stands) unplaced.push({ lock: lock.id, kind, ref });
  }
  return unplaced;
}

/** 방 이름 → 파일 이름 — 굳히는 자리와 이음을 대는 자리가 같은 답을 내야 한다 */
function regionSlug(id: string): string {
  return id.toLowerCase().replace(/_/g, '-');
}

export function renderSeams(authored: AuthoredRegion): string {
  const lines: string[] = [];
  lines.push('  content/regions/graph.ts — regions 에 이름 하나, connectors 끝에 아래를 이어 붙인다');
  for (const c of authored.connectors) {
    lines.push(`    ${asSource(literal(c, '    '))},`);
  }
  lines.push('');
  lines.push('  content/view/region-presentation.ts — REGION_NAMES 에 한 줄');
  lines.push(`    ${authored.spec.id}: '${authored.name}',`);
  if (authored.neighbourAnchors.length > 0) {
    lines.push('');
    lines.push('  이웃 쪽에 늘어야 하는 anchor — 자리는 그 방의 땅을 아는 쪽이 정한다');
    lines.push('  (놓지 않으면 world:check 의 ⑤ missing-anchor 가 잡는다)');
    for (const a of authored.neighbourAnchors) {
      lines.push(`    ${a.region}  point(layer=${WORLD_AUTHOR_TEMPLATES.anchorLayer}, tag=${a.anchor})`);
    }
  }
  const fresh = freshMaterials(authored);
  if (fresh.length > 0) {
    lines.push('');
    lines.push('  content/regions/resource-ecology.ts — MATERIAL_SEEDS 에 아래를 더한다');
    lines.push('  (그 방이 **새로 낳는 재료**다. 더하지 않으면 world:check 의 ⑪ 과 ㉑ 이 잡는다 —');
    lines.push('   원천이 아는 재료를 가리키지 않고, 그 원천이 내는 재료가 없는 것이 된다)');
    for (const material of fresh) {
      lines.push(`    ${asSource(literal(material, '    '))},`);
    }
  }
  const lives = freshLives(authored);
  if (lives.length > 0) {
    lines.push('');
    lines.push('  content/regions/lives.ts — LIFE_SEEDS 에 아래를 더한다 (개체군의 id 상수도 함께)');
    lines.push('  (그 방이 **올리는 개체군** 가운데 세계가 아직 모르는 것이다. 더하지 않으면 방은');
    lines.push('   값을 올리는데 무엇이 어느 원인에서 사는지는 세계 어디에도 적히지 않은 것이 된다)');
    for (const life of lives) {
      lines.push(`    ${asSource(literal(life, '    '))},`);
      if (life.worldCause === '') {
        lines.push('      ↑ 세계 원인이 비었다 — 이 방에 그 개체군을 올리는 탄생지가 없다. 사람이 밝힌다');
      }
    }
  }
  const rules = freshRegionRules(authored);
  if (rules.length > 0) {
    lines.push('');
    lines.push('  content/regions/ecology.ts — REGION_RULE_IDS 에 아래를 더한다 (RULE_* 상수도 함께)');
    lines.push('  (탄생지를 일으키는 규칙이다. 더하지 않으면 world:check 의 ㉗ 이 잡는다 —');
    lines.push('   세계가 모르는 규칙이 일으키는 탄생이 된다)');
    for (const rule of rules) {
      lines.push(`    ${rule}`);
    }
  }
  const crossing = crossingLinks(authored);
  if (crossing.length > 0) {
    lines.push('');
    lines.push(
      `  content/regions/${regionSlug(authored.spec.id)}.ts — ecology.links 의 via 를 밝힌다`,
    );
    lines.push('  (생성기는 두 끝이 어느 방에 사는지 모르므로 이음을 내지 않는다. 방을 넘는 관계에');
    lines.push('   이음을 밝히지 않으면 **그 관계는 아무 일도 하지 않는다**)');
    for (const link of crossing) {
      lines.push(`    ${link.from} --${link.kind}--> ${link.to}`);
      lines.push(
        link.livesIn === ''
          ? `      ${link.to} 는 세계에 아직 없다 — 어느 방에 세울지가 먼저다 (위 LIFE_SEEDS 줄)`
          : `      ${link.to} 는 ${link.livesIn} 에 산다 — 두 방을 잇는 Connector 이름을 via 에`,
      );
    }
  }
  const properties = freshProperties(authored);
  if (properties.length > 0) {
    lines.push('');
    lines.push('  content/regions/properties.ts — PROPERTY_ANSWERS 에 아래 태그의 줄을 더한다');
    lines.push('  (이 세계가 **아직 말하지 않은 성질**이다. 무엇이 무엇에 답하는가를 적지 않으면');
    lines.push('   그 성질은 아무 요구에도 닿지 않고, 그 요구는 답 없는 요구가 된다 — 검사 ㉟)');
    for (const property of properties) {
      lines.push(`    ${property.tag}   ${property.where}`);
      if (!property.inVocabulary) {
        lines.push(
          '      ↑ 축·관계가 어휘에 없다 — PROPERTY_ASPECTS · PROPERTY_RELATIONS 이 먼저다 (등급도 여기서 갈린다)',
        );
      }
    }
  }
  const unplaced = unplacedLocks(authored);
  if (unplaced.length > 0) {
    lines.push('');
    lines.push('  Lock 이 가리키는 자리가 서 있지 않다 — 자리를 세우거나 가리키는 이름을 고친다');
    lines.push('  (놓지 않으면 world:check 의 ㉞ 이 잡는다 — 없는 문 · 없는 자락에 걸린 물음이다)');
    for (const lock of unplaced) {
      lines.push(
        lock.kind === WORLD_CHECK_ACCESS.connectorLockKind
          ? `    ${lock.lock}  ${lock.ref} 은 아는 Connector 가 아니다 — graph.ts 의 connectors 에 그 이름이 있어야 한다`
          : `    ${lock.lock}  ${lock.ref} 이 이 방의 area op 로 없다 — 그 자락을 Description 에 세운다`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * 뼈대 하나를 이 저장소의 자리에 굳힌다 — 어느 폴더에 무슨 이름인지는 저장소의 사정이므로
 * 도구가 안다 (기반은 값만 낸다). 굳힌 자리를 돌려준다.
 *
 * 승인 표면(T6 의 world:admit)도 같은 자리를 지난다 — 세계에 방이 들어오는 길은 하나여야 한다.
 */
export function writeRegionModule(authored: AuthoredRegion, dir = 'content/regions'): string {
  const path = `${dir}/${regionSlug(authored.spec.id)}.ts`;
  const out = resolve(ROOT, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, renderRegionModule(authored), 'utf8');
  return path;
}

function main(argv: readonly string[]): number {
  const files = argv.filter((a) => !a.startsWith('-'));
  const flags = argv.filter((a) => a.startsWith('-'));
  const unknown = flags.filter((f) => f !== '--write');
  if (files.length !== 1 || unknown.length > 0) {
    process.stderr.write(
      [
        '  world:author — brief 하나에서 방 하나의 뼈대를 낸다',
        unknown.length > 0 ? `    모르는 인자: ${unknown.join(' ')}` : '    brief 파일 하나를 밝힌다',
        '    사용: npm run world:author -- <brief.json> [--write]',
        '',
      ].join('\n'),
    );
    return 2;
  }
  const path = resolve(ROOT, files[0]!);
  const grade = gradeFromFile(path);
  // 등급 C 의 방은 굳히지 않는다 — 지금 없는 의미를 요구하므로 뼈대가 서도 세계에 붙지 못한다
  if (grade.grade === 'C' && flags.includes('--write')) {
    process.stderr.write(`${renderGrade(grade)}\n\n  등급 C 는 굳히지 않는다 — 기반 층의 그 행이 먼저다.\n`);
    return 1;
  }
  const authored = authorFromFile(path);
  const module = renderRegionModule(authored);
  if (flags.includes('--write')) {
    const written = writeRegionModule(authored);
    process.stdout.write(
      `${renderGrade(grade)}\n\n  굳혔다: ${written}\n\n${renderSeams(authored)}\n`,
    );
    return 0;
  }
  process.stdout.write(`${module}\n${renderSeams(authored)}\n\n${renderGrade(grade)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  process.exitCode = main(process.argv.slice(2));
}
