// P0-b 단위 테스트 — 열여섯 원자가 세계에 걸리는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DEPENDENCY_KINDS } from '../../src/d0/index.ts';
import { STATE_SCHEMA } from '../../src/o2/index.ts';
import {
  ACTION_ATOMS,
  ATOM_GROUNDINGS,
  atomGrounding,
  atomGroundingVerdict,
  atomsFilling,
  atomsTouching,
  checkAtomGroundings,
  groundingSignature,
  atomGroundingSummary,
  slotText,
  UNFILLABLE_KINDS,
  type AtomGrounding,
} from '../../src/p0/index.ts';

const report = checkAtomGroundings();

function patched(patch: (entry: AtomGrounding) => AtomGrounding) {
  return checkAtomGroundings(ATOM_GROUNDINGS.map(patch));
}

describe('열여섯의 세계 걸림', () => {
  test('원자마다 걸림이 하나씩 있고 전부 온전하다', () => {
    assert.equal(ATOM_GROUNDINGS.length, 16);
    assert.deepEqual(
      ATOM_GROUNDINGS.map((entry) => entry.atom),
      [...ACTION_ATOMS],
    );
    assert.deepEqual(report.violations, []);
    assert.equal(report.complete, true);
  });

  test('모든 원자가 바꾸는 자리와 치르는 자리를 대고, 그 자리는 O2 에 실재한다', () => {
    for (const entry of ATOM_GROUNDINGS) {
      assert.ok(entry.writes.length > 0, entry.atom);
      assert.ok(entry.pays.length > 0, entry.atom);
      for (const ref of [...entry.reads, ...entry.writes, ...entry.pays]) {
        assert.ok(
          STATE_SCHEMA.fields.some(
            (field) => field.domain === ref.domain && field.path === ref.path,
          ),
          `${entry.atom} → ${slotText(ref)}`,
        );
      }
    }
  });

  test('손대는 곳이 넷으로 갈리고 열여섯을 남김없이 나눈다', () => {
    assert.deepEqual(report.byTouch['world'], ['acquire', 'produce', 'protect', 'destroy']);
    assert.deepEqual(report.byTouch['knowing'], ['seek', 'conceal', 'investigate']);
    assert.deepEqual(report.byTouch['between'], [
      'exchange',
      'seize',
      'persuade',
      'coerce',
      'ally',
      'betray',
    ]);
    assert.deepEqual(report.byTouch['self'], ['adapt', 'substitute', 'shed']);
    assert.equal(
      Object.values(report.byTouch).reduce((sum, list) => sum + list.length, 0),
      16,
    );
  });

  test('상대가 끼는 여섯이 동의 하나로 셋씩 짝을 이룬다', () => {
    assert.deepEqual(report.pairs, [
      'exchange↔seize',
      'destroy↔protect',
      'conceal↔seek',
      'coerce↔persuade',
      'ally↔betray',
    ]);
    assert.equal(atomGrounding('exchange')?.consent, 'mutual');
    assert.equal(atomGrounding('seize')?.consent, 'against');
    // 같은 것을 노리는데 동의 하나만 다르다 — 바꾸는 자리가 겹친다.
    assert.deepEqual(
      atomGrounding('exchange')?.writes.map(slotText).slice(0, 1),
      atomGrounding('seize')?.writes.map(slotText).slice(0, 1),
    );
  });

  test('보지 않고 할 수 있는 것은 찾는 것 하나뿐이다', () => {
    assert.deepEqual(report.blindAtoms, ['seek']);
    for (const entry of ATOM_GROUNDINGS) {
      if (entry.requiresObservation) continue;
      for (const ref of entry.writes) assert.equal(ref.domain, 'informational', entry.atom);
    }
  });

  test('되돌릴 수 없는 원자 다섯 — 원한·두려움·부서짐·배신·탈피', () => {
    assert.deepEqual(
      ATOM_GROUNDINGS.filter((entry) => !entry.reversible).map((entry) => entry.atom),
      ['seize', 'destroy', 'coerce', 'betray', 'shed'],
    );
  });

  test('배신만 저항할 수 없다 — 이미 안에 있는 자가 하는 일이기 때문이다', () => {
    assert.equal(atomGrounding('betray')?.resistable, false);
    assert.equal(atomGrounding('ally')?.resistable, true);
  });
});

describe('의존 종 커버리지', () => {
  test('열한 종 중 아홉은 채우는 원자를 갖는다', () => {
    const filled = DEPENDENCY_KINDS.filter((kind) => atomsFilling(kind).length > 0);
    assert.equal(filled.length, 9);
    assert.deepEqual(atomsFilling('resource'), ['acquire', 'produce', 'exchange', 'seize']);
    assert.deepEqual(atomsFilling('ritual'), ['ally']);
  });

  test('시간과 규칙은 아무 원자도 채우지 못하고, 그것이 예외로 선언돼 있다', () => {
    assert.deepEqual(report.unfillable, ['rule', 'time']);
    assert.deepEqual(
      UNFILLABLE_KINDS.map((entry) => entry.kind),
      ['time', 'rule'],
    );
    for (const entry of UNFILLABLE_KINDS) {
      assert.notEqual(entry.reason, '', entry.kind);
      assert.notEqual(entry.owedTo, '', entry.kind);
    }
  });

  test('채우지 못해도 벗어나는 원자 셋은 어느 종에나 닿는다', () => {
    for (const kind of DEPENDENCY_KINDS) {
      const touching = atomsTouching(kind);
      assert.ok(touching.includes('adapt'), kind);
      assert.ok(touching.includes('substitute'), kind);
      assert.ok(touching.includes('shed'), kind);
    }
  });

  test('요약 네 줄과 판정 한 줄이 상태를 말한다', () => {
    assert.equal(atomGroundingSummary(report).length, 4);
    assert.match(atomGroundingVerdict(report), /열여섯이 전부 세계에 걸린다/);
  });
});

describe('설 수 없는 걸림', () => {
  test('아무 자리도 바꾸지 않는 원자는 말이지 행동이 아니다', () => {
    const broken = patched((entry) => (entry.atom === 'seek' ? { ...entry, writes: [] } : entry));
    assert.equal(broken.violations[0]?.rule, 'changeless-atom');
    assert.equal(broken.violations[0]?.atom, 'seek');
  });

  test('아무것도 치르지 않는 원자는 세계를 붕괴시킨다', () => {
    const broken = patched((entry) => (entry.atom === 'seize' ? { ...entry, pays: [] } : entry));
    assert.equal(broken.violations[0]?.rule, 'costless-atom');
    assert.match(broken.violations[0]?.message ?? '', /verifiable-cost/);
  });

  test('세계에 없는 자리를 바꾸거나 치르겠다면 거부된다', () => {
    const broken = patched((entry) =>
      entry.atom === 'produce'
        ? { ...entry, pays: [{ domain: 'economic' as const, path: 'karma' }] }
        : entry,
    );
    assert.equal(broken.violations[0]?.rule, 'phantom-slot');
    assert.match(broken.violations[0]?.message ?? '', /economic\.karma/);
  });

  test('축·자리·대가가 모두 같은 둘은 한 원자로 접힌다', () => {
    const seize = atomGrounding('seize') as AtomGrounding;
    const broken = patched((entry) =>
      entry.atom === 'betray'
        ? { ...entry, touches: seize.touches, consent: seize.consent, bearing: seize.bearing, writes: seize.writes, pays: seize.pays }
        : entry,
    );
    assert.equal(broken.violations[0]?.rule, 'redundant-atom');
    assert.deepEqual(broken.redundant, ['seize↔betray']);
  });

  test('상대가 끼는 원자가 동의 축을 비우면 걸린다', () => {
    const broken = patched((entry) =>
      entry.atom === 'persuade' ? { ...entry, consent: 'none' as const } : entry,
    );
    assert.equal(broken.violations[0]?.rule, 'consentless-encounter');
  });

  test('상대가 없는 원자에 동의 축을 적으면 걸린다', () => {
    const broken = patched((entry) =>
      entry.atom === 'produce' ? { ...entry, consent: 'mutual' as const } : entry,
    );
    assert.equal(broken.violations[0]?.rule, 'consent-without-other');
  });

  test('어느 의존에도 닿지 않는 원자는 아무도 고르지 않는다', () => {
    const broken = patched((entry) => (entry.atom === 'acquire' ? { ...entry, kinds: [] } : entry));
    assert.equal(broken.violations[0]?.rule, 'aimless-atom');
  });

  test('벗어나는 원자가 종을 지목하면 걸린다', () => {
    const broken = patched((entry) =>
      entry.atom === 'shed' ? { ...entry, kinds: ['resource' as const] } : entry,
    );
    assert.equal(broken.violations[0]?.rule, 'kindful-escape');
  });

  test('보지 않고 앎 밖의 자리를 바꾸면 공리가 막는다', () => {
    const broken = patched((entry) =>
      entry.atom === 'seize' ? { ...entry, requiresObservation: false } : entry,
    );
    assert.equal(broken.violations[0]?.rule, 'blind-manipulation');
    assert.match(broken.violations[0]?.message ?? '', /observed-manipulation/);
  });

  test('짝이 서로를 가리키지 않으면 걸린다', () => {
    const broken = patched((entry) =>
      entry.atom === 'seize' ? { ...entry, counterpart: 'ally' as const } : entry,
    );
    assert.ok(broken.violations.some((violation) => violation.rule === 'broken-pair'));
  });

  test('채우는 원자를 모두 잃은 종은 갚을 길 없는 자리로 지목된다', () => {
    const broken = patched((entry) =>
      entry.bearing === 'fill' && entry.kinds.includes('information')
        ? { ...entry, kinds: entry.kinds.filter((kind) => kind !== 'information') }
        : entry,
    );
    const first = broken.violations.find((violation) => violation.rule === 'unfillable-kind');
    assert.match(first?.message ?? '', /information/);
    assert.ok(broken.unfillable.includes('information'));
  });

  test('채울 수 없다고 적어 놓고 채우면 예외가 낡은 것이다', () => {
    const stale = checkAtomGroundings(ATOM_GROUNDINGS, [
      ...UNFILLABLE_KINDS,
      { kind: 'resource', reason: '억지 예외', owedTo: '없음' },
    ]);
    assert.equal(stale.violations[0]?.rule, 'stale-exception');
    assert.match(stale.violations[0]?.message ?? '', /예외가 낡았다/);
  });

  test('걸림 자체가 없는 원자는 요청이 되지 못한다', () => {
    const broken = checkAtomGroundings(ATOM_GROUNDINGS.filter((entry) => entry.atom !== 'adapt'));
    assert.equal(broken.violations[0]?.rule, 'ungrounded-atom');
    assert.deepEqual(broken.ungrounded, ['adapt']);
    assert.match(atomGroundingVerdict(broken), /걸림 없는 원자 adapt/);
  });

  test('같은 걸림을 두 번 적으면 걸린다', () => {
    const first = ATOM_GROUNDINGS[0] as AtomGrounding;
    const broken = checkAtomGroundings([...ATOM_GROUNDINGS, first]);
    assert.deepEqual(broken.duplicates, ['seek']);
  });

  test('서명은 축과 자리로 만들어진다 — 같은 서명은 같은 원자라는 뜻이다', () => {
    assert.match(groundingSignature(atomGrounding('ally') as AtomGrounding), /between \/ mutual \/ fill/);
    assert.notEqual(
      groundingSignature(atomGrounding('ally') as AtomGrounding),
      groundingSignature(atomGrounding('exchange') as AtomGrounding),
    );
  });
});
