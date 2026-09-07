// C014 — 조건과 흐름, 그리고 보고 · **도구** 쪽 검증 시나리오 (spec SPEC-007 · SPEC-008)
//
// 이 둘은 세계가 아니라 도구를 잰다 — 검사 보고는 관찰 계약이 아니고, 도구가 데이터에서
// 직접 읽는 것이다 (spec Observable 마지막 줄). 그래서 재는 것은 다섯이다:
//   ① 검사 **스물둘**이 번호 순으로 나온다 (아홉 뒤에 열셋이 이어 붙는다)
//   ② 이 세계에서 **fail 이 하나도 없다** — 끊긴 참조가 없다
//   ③ 잴 것이 놓이지 않은 검사는 pass 가 아니라 **absent** 다 (⑮ 유한 원천 · ① · ④)
//   ④ ⑲ ⑳ 은 **report** 다 — 판정하지 않고 ok 와 종료 코드에 영향을 주지 않는다
//   ⑤ `npm run world:check` 가 그 보고를 그대로 내고 종료 코드가 0 이다
//
// **참조를 끊으면 fail 로 돌아서는가**는 기반의 단위 테스트가 손으로 지은 데이터로 잰다.
// 여기서는 **이 세계의 데이터가 온전한가**만 본다 — 실제 데이터를 훼손하지 않는다.
// 자리는 이 폴더의 선례를 따랐다 (c007-observe.spec.ts · check.spec.ts).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CheckItem, CheckReport, CheckStatus } from '../../../engine/world-authoring/check';
import {
  BIO_ORE_FIELD,
  EXPLORER_RUIN,
  FOREST_DEEP,
  FOREST_EDGE,
  HEART_LAKE,
  HEART_RIVER,
  PREDATOR_NEST,
  RED_EYE_TREE,
  WHITE_KING_DOMAIN,
  regionSpec,
  type ResourceSourceSpec,
} from '../../../content/regions';
import { runWorldCheck } from '../check';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECK = 'tools/world-editor/check.ts';

/** 번호 스물둘 — spec 이 ⑩~㉒ 를 검사 아홉 뒤에 잇는다고 못 박았다 */
const MARKS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪',
  '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳', '㉑', '㉒',
] as const;

/** 이 Cycle 이 이어 붙이는 열셋 */
const ADDED_MARKS = MARKS.slice(9);
/** 판정하지 않는 둘 (R9) */
const REPORT_MARKS = ['⑲', '⑳'];
/** 잴 것이 놓이지 않은 것들 — ⑮ 유한 원천 · ① 자원과 위험 · ④ phenomenon (Out of Scope) */
const ABSENT_MARKS = ['①', '④', '⑮'];

const REPORT: CheckReport = runWorldCheck();

/** 번호가 붙은 항목들 — 번호 밖의 것('·')은 이 셈에서 빠진다 */
const numbered = (report: CheckReport): CheckItem[] => report.items.filter((i) => i.mark !== '·');

function itemAt(mark: string): CheckItem {
  const found = numbered(REPORT).find((i) => i.mark === mark);
  if (!found) throw new Error(`보고에 검사 ${mark} 가 없다`);
  return found;
}

const statusAt = (mark: string): CheckStatus => itemAt(mark).status;

function run(args: readonly string[]) {
  const result = spawnSync('npx', ['tsx', CHECK, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

// ─────────────────────────────────────────────────────────────────────

describe('SPEC-007 검사가 끊긴 참조를 잡는다 (⑩ ⑪ ⑫ ⑬ ⑭ ⑮ ⑯ ⑰ ⑱ ㉑ ㉒)', () => {
  it('S-071 열셋이 검사 아홉 뒤에 **번호 순으로** 이어 붙는다', () => {
    expect(numbered(REPORT).map((i) => i.mark)).toEqual([...MARKS]);
  });

  it('S-072 이 세계에서 fail 이 하나도 없다 — 끊긴 참조가 없다', () => {
    expect({ fail: REPORT.counts.fail, ok: REPORT.ok }).toEqual({ fail: 0, ok: true });
    expect(REPORT.items.filter((i) => i.status === 'fail')).toEqual([]);
  });

  it('S-073 (경계 ②) 잴 것이 놓이지 않은 검사는 pass 가 아니라 absent 다', () => {
    for (const mark of ABSENT_MARKS) {
      expect({ mark, status: statusAt(mark) }).toEqual({ mark, status: 'absent' });
    }
  });

  it('S-074 열셋이 저마다 기계가 잡을 답을 낸다 — 열쇠 · 판정 · 한 줄 답', () => {
    for (const mark of ADDED_MARKS) {
      const item = itemAt(mark);
      expect({ mark, id: item.id.length > 0, answer: item.answer.length > 0 }).toEqual({
        mark,
        id: true,
        answer: true,
      });
      expect({ mark, status: item.status }).toEqual({
        mark,
        status: expect.stringMatching(/^(pass|fail|absent|report)$/) as unknown as CheckStatus,
      });
      // 걸린 것이 없으면 걸린 자리도 없다
      if (item.status === 'pass') expect({ mark, refs: item.refs }).toEqual({ mark, refs: [] });
    }
  });

  it('S-075 명령이 그 보고를 그대로 내고 종료 코드가 0 이다', () => {
    const plain = run([]);
    const parsed = JSON.parse(plain.out) as CheckReport;
    expect(parsed).toEqual(JSON.parse(JSON.stringify(REPORT)));
    expect(numbered(parsed).map((i) => i.mark)).toEqual([...MARKS]);
    expect(plain.status).toBe(0);
  });
});

describe('SPEC-008 요약은 판정하지 않는다 (⑲ ⑳)', () => {
  it('S-081 기회 자리의 분포와 방마다의 Carrier · 원천 수가 실린다', () => {
    for (const mark of REPORT_MARKS) {
      const item = itemAt(mark);
      expect({ mark, status: item.status }).toEqual({ mark, status: 'report' });
      // 한 줄 답에 **수**가 실린다 — 요약은 세는 것이다
      expect({ mark, counted: /\d/.test(item.answer) }).toEqual({ mark, counted: true });
    }
  });

  it('S-082 (경계) 요약은 ok 판정에 영향을 주지 않는다 — 종료 코드는 fail 이 정한다', () => {
    expect(REPORT.counts.report).toBeGreaterThanOrEqual(REPORT_MARKS.length);
    // 요약이 실렸는데도 ok 는 참이고, 그 판정은 fail 의 수 하나로 갈린다
    expect({ ok: REPORT.ok }).toEqual({ ok: REPORT.counts.fail === 0 });
    expect(run([]).status).toBe(0);
  });
});

// 검사가 헛돌지 않으려면 이 세계의 데이터가 온전해야 한다 —
// 그 온전함을 여기서 따로 잰다 (데이터를 훼손하지 않는 쪽으로).
describe('이 세계의 데이터가 온전하다', () => {
  const SEVEN = [
    { id: 'MOLT_LITTER', region: FOREST_EDGE },
    { id: 'RUIN_SPOIL', region: EXPLORER_RUIN },
    { id: 'ORE_OUTCROP', region: BIO_ORE_FIELD },
    { id: 'ROOT_NODULE', region: RED_EYE_TREE },
    { id: 'NEST_FUNGUS', region: PREDATOR_NEST },
    { id: 'RIVER_SILT', region: FOREST_DEEP },
    { id: 'LAKE_SILT_BED', region: HEART_LAKE },
  ] as const;

  type SourceShape = ResourceSourceSpec & { worldCause?: string; recoveryCause?: string };

  const sourceOf = (region: string, id: string): SourceShape => {
    const found = regionSpec(region)?.resourceEcology?.sources.find((s) => s.id === id);
    if (!found) throw new Error(`데이터가 원천 '${id}' 를 모른다 (${region})`);
    return found as SourceShape;
  };

  it('D-001 원천 일곱이 세계 원인 · 재료 · 공급 유형 · 되돌아옴의 원인 · 흔적을 가리킨다 (⑪ ⑬ ⑭ ⑯)', () => {
    const causes = new Set<string>();
    for (const one of SEVEN) {
      const spec = sourceOf(one.region, one.id);
      causes.add(String(spec.worldCause));
      expect({
        id: one.id,
        cause: typeof spec.worldCause,
        material: spec.materialId.length > 0,
        supply: typeof spec.supply,
        recovery: typeof spec.recoveryCause,
        trace: (spec.traceOps?.length ?? 0) > 0,
      }).toEqual({
        id: one.id,
        cause: 'string',
        material: true,
        supply: 'string',
        recovery: 'string',
        trace: true,
      });
    }
    // 그 사슬은 하나다 — 재료 셋과 원천 일곱이 같은 세계 원인에 매달린다 (기본형 ①)
    expect(causes.size).toBe(1);
  });

  it('D-002 흐름의 양 끝과 Connector 가 실재한다 (⑱)', () => {
    // 두 끝의 방과 원천이 데이터에 있고
    expect(sourceOf(HEART_LAKE, 'LAKE_SILT_BED').materialId).toBe(
      sourceOf(FOREST_DEEP, 'RIVER_SILT').materialId,
    );
    // Connector 는 C001 이 이미 그래프에 놓았다
    expect(HEART_RIVER.length).toBeGreaterThan(0);
  });

  it('D-003 백왕령은 원천이 없고 **왜 없는지**가 적혀 있다 (㉒)', () => {
    const ecology = regionSpec(WHITE_KING_DOMAIN)?.resourceEcology as
      | { sources: readonly unknown[]; isolationReason?: string }
      | undefined;
    expect(ecology?.sources ?? []).toEqual([]);
    expect(typeof ecology?.isolationReason).toBe('string');
    expect(String(ecology?.isolationReason).length).toBeGreaterThan(0);
  });
});

// 하네스로 놓을 수 없는 Given — 보고에 함께 적는다
describe('하네스 결손', () => {
  it.todo(
    'GAP: 참조를 끊으면 그 검사가 **fail 로 돌아서는가** — 이 파일은 실제 데이터를 훼손하지 않는다. 손으로 지은 데이터로 재는 것은 기반의 단위 테스트(engine/world-authoring)가 소유한다 (spec SPEC-007 경계 ①)',
  );
  it.todo(
    'GAP: 분포의 **편중이 사람에게 읽히는가** — ⑲ ⑳ 은 판정하지 않으므로 이 층이 잴 수 있는 것은 "수가 실렸다" 까지다',
  );
});
