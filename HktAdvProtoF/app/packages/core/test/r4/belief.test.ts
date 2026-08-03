// R4-b 단위 테스트 — 자기가 낼 수 있는 것으로 읽고, 확신은 좁힘을 넘지 못한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { classify } from '../../src/o1/index.ts';
import { ACTION_ATOMS, type ActionAtom } from '../../src/p0/index.ts';
import { buildGrammar, type PossibilityGrammar } from '../../src/p2/index.ts';
import type { Percept } from '../../src/r3/index.ts';
import {
  CONFIDENCE_WEIGHTS,
  beliefIdOf,
  beliefLine,
  checkBelief,
  confidenceCap,
  confidenceFactors,
  confidenceOf,
  confidenceTrace,
  formBelief,
  guessFor,
  narrowByGrammar,
  reinforce,
  scoreOf,
  type Belief,
  type BeliefViolation,
} from '../../src/r4/index.ts';

const hunterId = deterministicId('subject', 'person', '몰이꾼 04');
const canyonId = deterministicId('entity', 'place', '협곡');
const traceId = deterministicId('phenomenon', '자국');

const perceptOf = (overrides: Partial<Percept> = {}): Percept => ({
  id: deterministicId('percept', hunterId, '자국'),
  subjectId: hunterId,
  phenomenonId: traceId,
  channel: 'trace',
  intensity: 0.6,
  placeId: canyonId,
  distance: 0,
  atTick: 415,
  ambiguity: 0.73,
  ...overrides,
});

/** 사람의 손 — 유형만으로 선 문법(문화도 능력도 금기도 없다). */
const bareGrammar = (denied: readonly ActionAtom[] = []): PossibilityGrammar => {
  const base = buildGrammar({
    archetype: {
      id: deterministicId('species', '사람'),
      name: '사람',
      subjectKind: 'person',
    } as never,
  });
  if (denied.length === 0) return base;
  return {
    ...base,
    allowed: base.allowed.filter((atom) => !denied.includes(atom)),
    denied: [...base.denied, ...denied],
  };
};

const rulesOf = (violations: readonly BeliefViolation[]): readonly string[] => [
  ...new Set(violations.map((violation) => violation.rule)),
];

describe('R4-b 자기가 낼 수 있는 것으로 읽는다', () => {
  test('후보는 통로가 정하고 좁힘은 문법이 정한다', () => {
    const candidates = guessFor('trace')?.candidates ?? [];
    const all = narrowByGrammar(candidates, bareGrammar());
    const noKilling = narrowByGrammar(candidates, bareGrammar(['destroy']));

    assert.equal(all.narrowedBy, 'grammar');
    assert.equal(all.suspected.includes('destroy'), true);
    // 죽이지 않는 자에게 그 자국은 죽임이 아니다 — 후보에서 아예 서지 않는다.
    assert.equal(noKilling.suspected.includes('destroy'), false);
    assert.equal(noKilling.suspected.length, all.suspected.length - 1);
  });

  test('겹침이 없으면 후보 전체가 남는다 — 내가 낼 수 있는 무엇도 아니라는 것도 하나의 읽기다', () => {
    const candidates = guessFor('psychic')?.candidates ?? [];
    const banned = narrowByGrammar(candidates, bareGrammar(candidates));
    assert.equal(candidates.length, 3);
    assert.equal(banned.narrowedBy, 'none');
    assert.deepEqual(banned.suspected, candidates);
  });

  test('후보가 하나뿐이면 문법을 묻지 않는다 — 고를 것이 없으면 편향도 없다', () => {
    const candidates = guessFor('sound')?.candidates ?? [];
    const priest = narrowByGrammar(candidates, bareGrammar(['destroy']));
    // 부서지는 소리를 들은 사제는 제가 죽이지 않아도 무언가 부서졌다는 것을 안다.
    assert.deepEqual(priest.suspected, ['destroy']);
    assert.equal(priest.narrowedBy, 'none');
  });

  test('문법이 없으면 좁혀지지 않는다', () => {
    const candidates = guessFor('trace')?.candidates ?? [];
    assert.deepEqual(narrowByGrammar(candidates, null), {
      suspected: candidates,
      narrowedBy: 'none',
    });
  });
});

describe('R4-b 믿음이 선다', () => {
  test('읽은 것 하나에서 믿음이 서고 O1 Claim 으로 지난다', () => {
    const { belief, violations } = formBelief(perceptOf(), bareGrammar());
    assert.deepEqual(violations, []);
    assert.notEqual(belief, null);
    assert.equal(classify(belief).kind, 'Claim');
    assert.equal(belief?.id, beliefIdOf(hunterId, traceId));
    assert.equal(belief?.holderId, hunterId);
    assert.equal(belief?.aboutId, traceId);
    assert.equal(belief?.observations, 1);
    assert.deepEqual(belief?.sourceIds, [perceptOf().id]);
  });

  test('믿음에는 진실이 실리지 않는다 — 지각에 없던 자리는 믿음에도 없다', () => {
    const { belief } = formBelief(perceptOf(), bareGrammar());
    for (const field of ['domain', 'path', 'actorId', 'atom', 'effectKind', 'causeEventId']) {
      assert.equal(field in (belief as object), false, `${field} 가 실렸다`);
    }
  });

  test('짐작할 수 없는 지각은 믿음이 되지 않는다', () => {
    const { belief, violations } = formBelief(
      perceptOf({ channel: 'telepathy' as never }),
      bareGrammar(),
    );
    assert.equal(belief, null);
    assert.deepEqual(rulesOf(violations), ['unknown-channel']);
  });

  test('무엇이라고 여기는지는 좁힘에서 나온다 — 손으로 적지 않는다', () => {
    const wide = formBelief(perceptOf(), bareGrammar()).belief as Belief;
    // 소리는 원자 하나를 가리키므로 그 지각의 애매함도 0 이다 (R4-a 애매함 하한).
    const heard = perceptOf({ channel: 'sound', ambiguity: 0 });
    const sharp = formBelief(heard, bareGrammar()).belief as Belief;
    // 의념 잔향의 후보 셋을 전부 못 내는 자 — 무엇인지는 모르고 제 일이 아니라는 것만 안다.
    const psychic = guessFor('psychic')?.candidates ?? [];
    const blind = formBelief(
      perceptOf({ channel: 'psychic', ambiguity: 0.1 }),
      bareGrammar(psychic),
    ).belief as Belief;

    assert.match(wide.assertion, /내가 낼 수 있는 12 중 하나다/);
    assert.match(sharp.assertion, /제거|부순다|없앤다/);
    assert.match(blind.assertion, /내가 낼 수 있는 무엇도 아니다/);
    assert.match(beliefLine(wide), /확신 0\.\d\d/);
  });
});

describe('R4-b 확신은 요소에서 나오고 좁힘을 넘지 못한다', () => {
  test('무게는 좁힘 > 세기 > 반복이다 (R4 의 선언)', () => {
    assert.deepEqual(CONFIDENCE_WEIGHTS, { narrowing: 3, intensity: 2, repetition: 1 });
  });

  test('요소 셋의 출처가 갈린다 — 하나는 R3, 둘은 R4 자신이다', () => {
    const factors = confidenceFactors(['destroy'], 0.6, 1);
    assert.deepEqual(
      factors.map((factor) => factor.key),
      ['narrowing', 'intensity', 'repetition'],
    );
    assert.equal(factors[1]?.source, 'R3 Percept.intensity');
    assert.equal(factors.filter((factor) => factor.source.startsWith('R4')).length, 2);
  });

  test('점수는 Σ(값×무게) ÷ Σ무게 다 (P4-c 와 같은 식)', () => {
    const factors = confidenceFactors(['destroy'], 0.6, 1);
    assert.equal(scoreOf(factors), (1 * 3 + 0.6 * 2 + 0 * 1) / 6);
  });

  test('좁힘이 상한이다 — 열둘 중 하나인 자국은 아무리 진하게 봐도 확신할 수 없다', () => {
    const wide = confidenceFactors(guessFor('trace')?.candidates ?? [], 1, 10);
    assert.equal(confidenceCap(wide), 1 - 11 / 15);
    assert.equal(confidenceOf(wide), confidenceCap(wide));
    assert.ok(scoreOf(wide) > confidenceCap(wide), '점수가 상한보다 컸는데 잘리지 않았다');
  });

  test('옅게 읽으면 상한에 닿지도 못한다', () => {
    const faint = confidenceFactors(guessFor('trace')?.candidates ?? [], 0.05, 1);
    assert.ok(confidenceOf(faint) < confidenceCap(faint));
    assert.equal(confidenceOf(faint), scoreOf(faint));
  });

  test('확신이 어디서 왔는지는 언제나 네 줄로 펴진다', () => {
    const belief = formBelief(perceptOf(), bareGrammar()).belief as Belief;
    const trace = confidenceTrace(belief);
    assert.equal(trace.length, 4);
    assert.match(trace[3] ?? '', /상한/);
  });
});

describe('R4-b 같은 흔적을 다시 읽으면 굳는다', () => {
  test('두 번째 읽기는 새 믿음이 아니라 같은 믿음이다', () => {
    const first = formBelief(perceptOf(), bareGrammar()).belief as Belief;
    const again = reinforce(first, perceptOf({ id: deterministicId('percept', hunterId, '다시') }))
      .belief as Belief;

    assert.equal(again.id, first.id);
    assert.equal(again.observations, 2);
    assert.equal(again.sourceIds.length, 2);
    assert.deepEqual(again.suspected, first.suspected, '다시 봐도 후보는 통로가 정한다');
    assert.ok(again.confidence >= first.confidence);
  });

  test('가장 진하게 읽은 것이 남는다 — 가까이서 한 번이 멀리서 열 번보다 낫다', () => {
    const faint = formBelief(perceptOf({ intensity: 0.1 }), bareGrammar()).belief as Belief;
    const closer = reinforce(faint, perceptOf({ intensity: 0.9, id: deterministicId('percept', '가까이') }))
      .belief as Belief;
    assert.equal(closer.intensity, 0.9);
  });

  test('같은 지각을 두 번 넣어도 근거는 늘지 않는다', () => {
    const first = formBelief(perceptOf(), bareGrammar()).belief as Belief;
    const again = reinforce(first, perceptOf()).belief as Belief;
    assert.equal(again.sourceIds.length, 1);
    assert.equal(again.observations, 2);
  });

  test('남이 읽은 것으로는 굳지 않는다 — 소문은 아직 없다', () => {
    const first = formBelief(perceptOf(), bareGrammar()).belief as Belief;
    const other = reinforce(first, perceptOf({ subjectId: deterministicId('subject', 'person', '남') }));
    assert.equal(other.belief, null);
    assert.deepEqual(rulesOf(other.violations), ['foreign-belief']);
  });

  test('다른 흔적으로도 굳지 않는다', () => {
    const first = formBelief(perceptOf(), bareGrammar()).belief as Belief;
    const other = reinforce(first, perceptOf({ phenomenonId: deterministicId('phenomenon', '딴것') }));
    assert.equal(other.belief, null);
    assert.deepEqual(rulesOf(other.violations), ['unperceived-belief']);
  });
});

describe('R4-b 설 수 없는 믿음은 사유와 함께 물린다', () => {
  const percepts = [perceptOf()];
  const sound = (): Belief => formBelief(perceptOf(), bareGrammar()).belief as Belief;
  const checkOne = (belief: Belief, pool: readonly Percept[] = percepts): readonly BeliefViolation[] => {
    const out: BeliefViolation[] = [];
    checkBelief(belief, pool, out);
    return out;
  };

  test('온전한 믿음에는 아무 말도 남지 않는다 — 틀렸는지는 묻지 않는다', () => {
    assert.deepEqual(checkOne(sound()), []);
  });

  test('읽은 것 없이 선 믿음이 걸린다', () => {
    assert.deepEqual(rulesOf(checkOne({ ...sound(), sourceIds: [] })), ['unperceived-belief']);
  });

  test('읽은 적 없는 지각을 근거로 삼으면 걸린다', () => {
    assert.deepEqual(rulesOf(checkOne(sound(), [])), ['unperceived-belief']);
  });

  test('남의 눈으로 읽은 것을 제 근거로 삼으면 걸린다', () => {
    const mine = sound();
    const theirs = perceptOf({ subjectId: deterministicId('subject', 'person', '남') });
    assert.deepEqual(rulesOf(checkOne(mine, [theirs])), ['foreign-belief']);
  });

  test('통로가 열지 않은 원자를 짚으면 걸린다', () => {
    const off = { ...sound(), suspected: ['persuade'] as readonly ActionAtom[] };
    assert.deepEqual(rulesOf(checkOne(off)), ['off-candidate-belief', 'confidence-drift']);
  });

  test('후보를 손으로 늘리면 걸린다', () => {
    const stray = { ...sound(), candidates: [...ACTION_ATOMS] };
    assert.equal(rulesOf(checkOne(stray)).includes('off-candidate-belief'), true);
  });

  test('확신을 손으로 고쳐 넣으면 요소와 어긋난다', () => {
    assert.deepEqual(rulesOf(checkOne({ ...sound(), confidence: 0.9 })), ['confidence-drift']);
  });

  test('0~1 밖의 확신은 그 앞에서 걸린다', () => {
    assert.deepEqual(rulesOf(checkOne({ ...sound(), confidence: 2 })), ['bad-confidence']);
  });

  test('좁힘이 허락한 상한을 넘는 확신이 걸린다', () => {
    const base = sound();
    const inflated: Belief = {
      ...base,
      // 요소는 그대로 두고 상한만 낮춘 것처럼 꾸민다 — 재계산과는 맞고 상한과는 어긋난다.
      factors: base.factors.map((factor) =>
        factor.key === 'narrowing' ? { ...factor, value: 0.1 } : factor,
      ),
    };
    assert.deepEqual(rulesOf(checkOne(inflated)), ['overconfident-belief']);
  });

  test('믿는 자가 없는 믿음이 걸린다', () => {
    assert.equal(rulesOf(checkOne({ ...sound(), holderId: '' })).includes('unheld-belief'), true);
  });

  test('흔적을 통째로 스프레드하면 진실이 실린다', () => {
    const leaked = {
      ...sound(),
      atom: 'destroy',
      actorId: hunterId,
      domain: 'biological',
      path: 'vitality',
    } as unknown as Belief;
    assert.equal(rulesOf(checkOne(leaked)).includes('truth-copied'), true);
  });
});
