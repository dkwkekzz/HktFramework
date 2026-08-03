// P3-a 단위 테스트 — 원자 사이의 "먼저" 가 손이 아니라 P0 걸림에서 나오는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { stateHash } from '../../src/v1/index.ts';
import { ACTION_ATOMS, ATOM_GROUNDINGS, slotText, type AtomGrounding } from '../../src/p0/index.ts';
import {
  OBSERVATION_SLOT,
  UNSOURCED_SLOTS,
  checkPrerequisites,
  prerequisiteSummary,
  prerequisiteVerdict,
  prerequisitesOf,
  slotFillers,
  sourcesBefore,
  type UnsourcedSlot,
} from '../../src/p3/index.ts';

const report = checkPrerequisites();

/** 걸림 하나를 고쳐 다시 계산한다 — 세계가 달라지면 선행도 달라져야 한다. */
function patched(patch: (entry: AtomGrounding) => AtomGrounding, exceptions?: readonly UnsourcedSlot[]) {
  return checkPrerequisites(ATOM_GROUNDINGS.map(patch), exceptions);
}

const rules = (result: ReturnType<typeof checkPrerequisites>) => [
  ...new Set(result.violations.map((violation) => violation.rule)),
];

describe('선행 관계는 계산된다', () => {
  test('열여섯이 전부 요구를 갖고, 요구는 관측·재료 둘뿐이다', () => {
    assert.equal(report.violations.length, 0);
    assert.equal(report.complete, true);
    assert.equal(report.prerequisites.length, 40);
    assert.deepEqual(
      [...new Set(report.prerequisites.map((entry) => entry.route))].sort(),
      ['cost', 'observation'],
    );
    // 요구가 하나도 없는 원자는 없다 — 찾다마저 몸으로 치른다 (그 자리는 예외로 선언됐다).
    for (const atom of ACTION_ATOMS) {
      assert.ok(prerequisitesOf(atom).length > 0, atom);
    }
  });

  test('뿌리는 찾다 하나뿐이고, 열여섯이 전부 거기서 닿는다', () => {
    assert.deepEqual(report.roots, ['seek']);
    assert.deepEqual(report.unreachable, []);
    assert.equal(report.waves.flat().length, 16);
  });

  test('마지막 물결은 남과 등지는 넷이다 — 신뢰를 세우는 것이 주고받기 하나뿐이기 때문이다', () => {
    assert.equal(report.waves.length, 4);
    assert.deepEqual(report.waves[0], ['seek']);
    assert.deepEqual(report.waves[3], ['seize', 'persuade', 'coerce', 'betray']);
    // 넷 다 신뢰를 치르고, 그 자리를 세우는 원자는 교환 하나다.
    assert.deepEqual(slotFillers({ domain: 'relational', path: 'trust.{subject}' }), ['exchange']);
    for (const atom of ['seize', 'persuade', 'coerce', 'betray'] as const) {
      const trust = prerequisitesOf(atom).find(
        (entry) => slotText(entry.slot) === 'relational.trust.{subject}',
      );
      assert.deepEqual(trust?.satisfiedBy, ['exchange']);
    }
  });

  test('"먼저 찾아야 빼앗을 수 있다" 가 손으로 적히지 않고 나온다', () => {
    assert.ok(sourcesBefore('seize').includes('seek'));
    const observation = prerequisitesOf('seize').find((entry) => entry.route === 'observation');
    assert.equal(slotText(observation?.slot ?? OBSERVATION_SLOT), 'informational.knows.{claim}');
    // 앎을 세우는 것은 둘뿐이다 — 스스로 찾거나 남이 말해 주거나.
    assert.deepEqual(slotFillers(OBSERVATION_SLOT), ['seek', 'persuade']);
    // 조사는 없던 앎을 세우지 않는다 — 그래서 조사도 관측을 먼저 요구한다.
    assert.ok(prerequisitesOf('investigate').some((entry) => entry.route === 'observation'));
  });

  test('세우는 것과 건드리는 것은 다르다 — 깎는 원자와 지키는 원자는 자리를 세우지 않는다', () => {
    const stock = { domain: 'physical', path: 'broken' } as const;
    assert.deepEqual(slotFillers(stock), []); // destroy 가 쓰지만 bearing 이 clear 다
    assert.deepEqual(slotFillers({ domain: 'economic', path: 'stock.{entity}' }), [
      'acquire',
      'produce',
      'exchange',
      'seize',
    ]);
  });

  test('자기 자신은 자기를 세워 주지 못한다', () => {
    const cost = prerequisitesOf('produce').find(
      (entry) => slotText(entry.slot) === 'economic.stock.{entity}',
    );
    assert.deepEqual(cost?.satisfiedBy, ['acquire', 'exchange', 'seize']);
    for (const entry of report.prerequisites) {
      assert.ok(!entry.satisfiedBy.includes(entry.atom), `${entry.atom} ${slotText(entry.slot)}`);
    }
  });

  test('행동 밖에서 오는 자리 넷 — 몸·의념·빚·정당성', () => {
    assert.deepEqual(report.waivedSlots, [
      'biological.vitality',
      'psychic.energy',
      'relational.debt.{subject}',
      'transcendent.legitimacy',
    ]);
    for (const exception of UNSOURCED_SLOTS) {
      assert.notEqual(exception.reason, '');
      assert.notEqual(exception.owedTo, ''); // 갚을 자리를 대지 못하는 예외는 예외가 아니다
    }
  });
});

describe('설 수 없는 선행은 사유와 함께 거부된다', () => {
  test('몸의 예외를 지우면 열둘이 걸리고 뿌리마저 사라진다', () => {
    const without = checkPrerequisites(
      ATOM_GROUNDINGS,
      UNSOURCED_SLOTS.filter((entry) => slotText(entry.slot) !== 'biological.vitality'),
    );
    assert.equal(without.complete, false);
    // 몸으로 치르는 열둘이 각자 사유를 받고, 그중에 찾다가 있어 세계가 시작하지도 못한다.
    assert.equal(without.violations.filter((entry) => entry.rule === 'unsourced-cost').length, 12);
    assert.deepEqual(rules(without).sort(), [
      'rootless-atoms',
      'unreachable-atom',
      'unsourced-cost',
    ]);
    assert.deepEqual(without.roots, []);
    assert.equal(without.unreachable.length, 16); // 몸을 아무도 세우지 못하면 열여섯이 다 선다는 말이 거짓이 된다
  });

  test('세우는 원자가 있는 자리를 예외로 적으면 낡은 예외로 걸린다', () => {
    const stale = checkPrerequisites(ATOM_GROUNDINGS, [
      ...UNSOURCED_SLOTS,
      {
        slot: { domain: 'economic', path: 'stock.{entity}' },
        reason: '재고는 아무도 못 만든다고 우겨 본다',
        owedTo: '아무도',
      },
    ]);
    assert.deepEqual(rules(stale), ['stale-cost-exception']);
  });

  test('스스로를 딛고 서지 못한다 — 빚 예외를 지우면 동맹이 걸린다', () => {
    const without = checkPrerequisites(
      ATOM_GROUNDINGS,
      UNSOURCED_SLOTS.filter((entry) => slotText(entry.slot) !== 'relational.debt.{subject}'),
    );
    assert.deepEqual(rules(without).sort(), ['self-only-source', 'unreachable-atom']);
    assert.deepEqual([...new Set(without.violations.map((entry) => entry.atom))], ['ally']);
    assert.deepEqual(without.unreachable, ['ally']);
  });

  test('찾다가 눈을 잃으면 세계가 시작하지 못한다', () => {
    const blind = patched((entry) =>
      entry.atom === 'seek' ? { ...entry, requiresObservation: true } : entry,
    );
    assert.deepEqual(blind.roots, []);
    assert.ok(rules(blind).includes('rootless-atoms'));
    assert.equal(blind.unreachable.length, 16);
    assert.match(prerequisiteVerdict(blind), /선행 관계가 막혔다/);
  });
});

describe('경계 — 하나가 빠지면 어디까지 무너지는가', () => {
  test('주고받기가 세우기를 그만두면 남과 등지는 넷이 통째로 무너진다', () => {
    const guarded = patched((entry) =>
      entry.atom === 'exchange' ? { ...entry, bearing: 'guard' } : entry,
    );
    assert.deepEqual(guarded.unreachable, ['seize', 'persuade', 'coerce', 'betray']);
    assert.deepEqual(rules(guarded).sort(), ['unreachable-atom', 'unsourced-cost']);
    // 나머지 열둘은 그대로 선다 — 무너지는 것은 신뢰를 치르는 쪽뿐이다.
    assert.equal(guarded.waves.flat().length, 12);
  });

  test('앎을 세우는 둘 중 남이 말해 주는 쪽만 남으면 아무도 첫 걸음을 떼지 못한다', () => {
    const mute = patched((entry) =>
      entry.atom === 'seek'
        ? { ...entry, writes: entry.writes.filter((ref) => ref.path !== 'knows.{claim}') }
        : entry,
    );
    assert.deepEqual(slotFillers(OBSERVATION_SLOT, ATOM_GROUNDINGS), ['seek', 'persuade']);
    assert.deepEqual(mute.roots, ['seek']); // 찾다는 여전히 보지 않고 서지만
    assert.deepEqual(mute.unreachable.length, 15); // 그 뒤가 아무도 서지 못한다
  });

  test('요구가 하나도 없는 세계는 온전하지 않다 — 빈 걸림은 판정을 통과하지 못한다', () => {
    const empty = checkPrerequisites([], UNSOURCED_SLOTS);
    assert.equal(empty.complete, false);
    assert.deepEqual(empty.prerequisites, []);
    assert.ok(rules(empty).includes('rootless-atoms'));
  });
});

describe('결정성', () => {
  test('같은 걸림을 100번 계산해도 같은 해시가 나온다', () => {
    const first = stateHash(checkPrerequisites());
    for (let index = 0; index < 100; index += 1) {
      assert.equal(stateHash(checkPrerequisites()), first);
    }
  });

  test('요약 줄이 물결을 그대로 편다', () => {
    const summary = prerequisiteSummary(report);
    assert.equal(summary.length, 3 + report.waves.length);
    assert.match(summary[0] ?? '', /찾다/);
    assert.match(prerequisiteVerdict(report), /^뿌리 seek/);
  });
});
