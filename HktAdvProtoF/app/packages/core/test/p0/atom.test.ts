// P0-a 단위 테스트 — 원문 세 목록의 행동 환원.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_ATOM_SPECS,
  ACTION_ATOMS,
  ATOM_RECONCILIATION,
  atomLabel,
  atomReconciliationVerdict,
  atomSpec,
  atomViolationVerdict,
  EXAMPLE_RECONCILIATION,
  isActionAtom,
  P1_DIRECTIONS,
  P2_EXAMPLES,
  reconcileAtoms,
  atomResolutionOf,
  UNUSED_ATOM_DEBT,
  type ActionAtomSpec,
  type AtomResolution,
} from '../../src/p0/index.ts';

describe('확정 16원자', () => {
  test('원문 P0 목록의 열여섯에 정의가 하나씩 붙는다', () => {
    assert.equal(ACTION_ATOMS.length, 16);
    assert.equal(ACTION_ATOM_SPECS.length, 16);
    assert.deepEqual(
      ACTION_ATOM_SPECS.map((spec) => spec.atom),
      [...ACTION_ATOMS],
    );
  });

  test('모든 원자가 이름·하는 일·예·원문 근거를 갖는다', () => {
    for (const spec of ACTION_ATOM_SPECS) {
      assert.notEqual(spec.label, '', spec.atom);
      assert.notEqual(spec.originalName, '', spec.atom);
      assert.notEqual(spec.does, '', spec.atom);
      assert.notEqual(spec.example, '', spec.atom);
      assert.match(spec.source, /ModulePlan|MasterPlan/, spec.atom);
    }
  });

  test('원자 정의를 이름으로 찾고, 없는 이름은 null 이다', () => {
    assert.equal(atomSpec('betray')?.label, '배신');
    assert.equal(atomSpec('hunt' as never), null);
    assert.equal(atomLabel('shed'), '탈피');
    assert.equal(atomLabel('hunt' as never), 'hunt');
  });

  test('16원자만 행동으로 인정한다 — 사냥은 행동이 아니라 조합이다', () => {
    assert.equal(isActionAtom('seize'), true);
    assert.equal(isActionAtom('hunt'), false);
    assert.equal(isActionAtom(7), false);
  });
});

describe('원문 세 목록 환원', () => {
  const report = reconcileAtoms();

  test('P1 방향 7 · P2 예시 15 가 하나도 빠짐없이 환원된다', () => {
    assert.equal(P1_DIRECTIONS.length, 7);
    assert.equal(P2_EXAMPLES.length, 15);
    assert.equal(ATOM_RECONCILIATION.length, 22);
    assert.deepEqual(report.unresolved, []);
    assert.deepEqual(report.danglingTargets, []);
    assert.equal(report.complete, true);
  });

  test('P2 예시 열다섯 중 다섯은 조합이라 새 행동이 아니다', () => {
    assert.deepEqual(report.compounds, ['사냥', '독점', '통제', '의례 요구', '금기 부여', '영역 변형']);
    assert.deepEqual(atomResolutionOf('사냥')?.atoms, ['seek', 'destroy', 'acquire']);
  });

  test('징수와 영역 침범은 빼앗다 하나로 접힌다 — 갈리는 것은 법이지 행동이 아니다', () => {
    assert.deepEqual(atomResolutionOf('징수')?.atoms, ['seize']);
    assert.deepEqual(atomResolutionOf('영역 침범')?.atoms, ['seize']);
    assert.match(atomResolutionOf('징수')?.reason ?? '', /institutional\.law/);
  });

  test('이동·운송·섭식이 전부 획득으로 접힌다', () => {
    for (const name of ['이동', '운송', '섭식']) {
      assert.deepEqual(atomResolutionOf(name)?.atoms, ['acquire'], name);
    }
  });

  test('P1 일곱은 행동이 아니라 방향으로 남는다', () => {
    for (const direction of P1_DIRECTIONS) {
      assert.equal(atomResolutionOf(direction.name)?.resolution, 'direction', direction.name);
    }
  });

  test('원문 P1·P2 가 한 번도 쓰지 않는 원자 둘은 갚을 모듈을 댄다', () => {
    assert.deepEqual(report.unusedAtoms, ['investigate', 'betray']);
    for (const atom of report.unusedAtoms) {
      assert.match(UNUSED_ATOM_DEBT[atom] ?? '', /R4|E2/, atom);
    }
  });

  test('판정 한 줄이 환원 결과를 말한다', () => {
    assert.match(atomReconciliationVerdict(report), /16원자로 환원됐다/);
  });
});

describe('설 수 없는 환원', () => {
  const specs = ACTION_ATOM_SPECS;

  function reconcileWith(patch: {
    specs?: readonly ActionAtomSpec[];
    resolutions?: readonly AtomResolution[];
  }) {
    return reconcileAtoms(
      patch.specs ?? specs,
      [...P1_DIRECTIONS, ...P2_EXAMPLES],
      patch.resolutions ?? ATOM_RECONCILIATION,
    );
  }

  test('환원되지 않은 원문 이름은 지목된다 — 남는 행동이 있으면 최소가 아니다', () => {
    const report = reconcileWith({
      resolutions: ATOM_RECONCILIATION.filter((entry) => entry.original !== '징수'),
    });
    assert.deepEqual(report.unresolved, ['징수']);
    assert.equal(report.violations[0]?.rule, 'unresolved-original');
    assert.match(atomViolationVerdict(report.violations), /unresolved-original/);
  });

  test('16종에 없는 원자로 보내면 거부된다', () => {
    const report = reconcileWith({
      resolutions: ATOM_RECONCILIATION.map((entry) =>
        entry.original === '해체' ? { ...entry, atoms: ['butcher' as never] } : entry,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'dangling-resolution');
    assert.deepEqual(report.danglingTargets, ['해체→butcher']);
  });

  test('아무 원자로도 보내지 않으면 환원이 아니라 삭제다', () => {
    const report = reconcileWith({
      resolutions: ATOM_RECONCILIATION.map((entry) =>
        entry.original === '해체' ? { ...entry, atoms: [] } : entry,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'dangling-resolution');
    assert.match(report.violations[0]?.message ?? '', /삭제/);
  });

  test('"같음" 이라 적고 둘로 보내면 걸린다', () => {
    const report = reconcileWith({
      resolutions: ATOM_RECONCILIATION.map((entry) =>
        entry.original === '구매' ? { ...entry, atoms: ['exchange', 'acquire'] } : entry,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'dangling-resolution');
    assert.match(report.violations[0]?.message ?? '', /하나/);
  });

  test('조합이라 적고 원자 하나만 들면 걸린다', () => {
    const report = reconcileWith({
      resolutions: ATOM_RECONCILIATION.map((entry) =>
        entry.original === '사냥' ? { ...entry, atoms: ['destroy'] } : entry,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'dangling-resolution');
    assert.match(report.violations[0]?.message ?? '', /조합이 아니라 같음/);
  });

  test('근거 없는 원자는 지어낸 것이다', () => {
    const report = reconcileWith({
      specs: specs.map((spec) => (spec.atom === 'shed' ? { ...spec, source: '' } : spec)),
    });
    assert.deepEqual(report.unsourced, ['shed']);
    assert.equal(report.violations[0]?.rule, 'unsourced-atom');
    assert.match(report.violations[0]?.path ?? '', /source$/);
  });

  test('원문 P0 의 이름이 정의를 잃으면 이름만 있는 칸이 되고, 그 원자를 부르던 방향도 함께 끊긴다', () => {
    const report = reconcileWith({ specs: specs.filter((spec) => spec.atom !== 'conceal') });
    const rules = report.violations
      .filter((violation) => violation.atom === 'conceal')
      .map((violation) => violation.rule);
    assert.deepEqual(rules, ['dangling-resolution', 'unsourced-atom']);
    assert.deepEqual(report.danglingTargets, ['경쟁자를 제거한다→conceal']);
  });

  test('같은 원자를 두 번 적으면 걸린다', () => {
    const first = specs[0] as ActionAtomSpec;
    const report = reconcileWith({ specs: [...specs, first] });
    assert.deepEqual(report.duplicateAtoms, ['seek']);
    assert.equal(report.violations[0]?.rule, 'duplicate-atom');
  });

  test('원자가 하나도 없으면 판정이 그 사실을 말한다', () => {
    const report = reconcileWith({ specs: [] });
    assert.equal(report.complete, false);
    assert.match(atomReconciliationVerdict(report), /확정 원자가 없다/);
  });

  test('온전하면 위반 목록도 한 줄로 온전하다', () => {
    assert.equal(atomViolationVerdict([]), '행동 문법이 온전하다');
  });
});
