// P1-a 단위 테스트 — 방향 7종이 P0 원자에 묶이는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { STRATEGY_DIRECTIONS as O1_DIRECTIONS } from '../../src/o1/index.ts';
import { DIRECTION_RECONCILIATION } from '../../src/p0/index.ts';
import {
  atomsOf,
  BRANCH_RECONCILIATION,
  branchResolutionOf,
  checkDirections,
  directionLabel,
  directionSpec,
  directionVerdict,
  isStrategyDirection,
  STRATEGY_DIRECTION_SPECS,
  STRATEGY_DIRECTIONS,
  strategyViolationVerdict,
  WATER_BRANCHES,
  type DirectionResolution,
  type StrategyDirectionSpec,
} from '../../src/p1/index.ts';

describe('확정 7방향', () => {
  const report = checkDirections();

  test('이름표는 O1 이 고정한 것을 그대로 쓴다 — P1 은 근거와 원자만 붙인다', () => {
    assert.deepEqual([...STRATEGY_DIRECTIONS], [...O1_DIRECTIONS]);
    assert.equal(STRATEGY_DIRECTION_SPECS.length, 7);
    assert.deepEqual(
      STRATEGY_DIRECTION_SPECS.map((spec) => spec.direction),
      [...STRATEGY_DIRECTIONS],
    );
  });

  test('방향의 원자는 P0 환원표에서 읽어 온다 — 두 곳에 적지 않는다', () => {
    for (const spec of STRATEGY_DIRECTION_SPECS) {
      const fromP0 = DIRECTION_RECONCILIATION.find(
        (entry) => entry.original === spec.originalName,
      );
      assert.notEqual(fromP0, undefined, spec.direction);
      assert.deepEqual(atomsOf(spec.direction), fromP0?.atoms, spec.direction);
      assert.ok(atomsOf(spec.direction).length > 0, spec.direction);
    }
    assert.equal(report.complete, true);
    assert.deepEqual(report.violations, []);
  });

  test('충족은 네 원자를 주고, 대체·감소·생산·의존 제거는 하나씩만 준다', () => {
    assert.deepEqual(atomsOf('fulfill'), ['seek', 'acquire', 'exchange', 'seize']);
    assert.deepEqual(atomsOf('substitute'), ['substitute']);
    assert.deepEqual(atomsOf('reduce'), ['adapt']);
    assert.deepEqual(atomsOf('produce'), ['produce']);
    assert.deepEqual(atomsOf('removeDependency'), ['shed']);
  });

  test('남이 있어야 열리는 방향은 위임·경쟁 제거 둘이다', () => {
    assert.deepEqual(report.needOthers, ['delegate', 'removeRival']);
  });

  test('방향 정의를 이름으로 찾고, 없는 이름은 null 이다', () => {
    assert.equal(directionSpec('removeDependency')?.label, '의존 제거');
    assert.equal(directionSpec('flee' as never), null);
    assert.equal(directionLabel('delegate'), '위임');
    assert.equal(directionLabel('flee' as never), 'flee');
    assert.equal(isStrategyDirection('fulfill'), true);
    assert.equal(isStrategyDirection('detach'), false);
  });
});

describe('원문 물 부족 예시', () => {
  const report = checkDirections();

  test('일곱 갈래가 하나도 빠짐없이 방향에 붙는다', () => {
    assert.equal(WATER_BRANCHES.length, 7);
    assert.equal(BRANCH_RECONCILIATION.length, 7);
    assert.deepEqual(report.unresolved, []);
  });

  test('찾다·구매·훔치다 셋이 같은 충족 방향으로 접힌다 — 갈리는 것은 원자다', () => {
    for (const name of ['물을 찾는다', '물을 구매한다', '물을 훔친다']) {
      assert.equal(branchResolutionOf(name)?.direction, 'fulfill', name);
    }
    assert.deepEqual(
      ['물을 찾는다', '물을 구매한다', '물을 훔친다'].map(
        (name) => branchResolutionOf(name)?.atom,
      ),
      ['seek', 'exchange', 'seize'],
    );
  });

  test('원문 예시는 일곱 중 다섯 방향만 쓴다 — 남이 없는 예시이기 때문이다', () => {
    assert.deepEqual(report.unusedDirections, ['delegate', 'removeRival']);
    // 쓰이지 않은 둘이 곧 "남이 있어야 열리는 둘" 이다.
    assert.deepEqual(report.unusedDirections, report.needOthers);
  });

  test('판정 한 줄이 방향 확정 결과를 말한다', () => {
    assert.match(directionVerdict(report), /방향 7종이 P0 원자에 묶였다/);
  });
});

describe('설 수 없는 방향', () => {
  function checkWith(patch: {
    specs?: readonly StrategyDirectionSpec[];
    resolutions?: readonly DirectionResolution[];
  }) {
    return checkDirections(
      patch.specs ?? STRATEGY_DIRECTION_SPECS,
      WATER_BRANCHES,
      patch.resolutions ?? BRANCH_RECONCILIATION,
    );
  }

  test('P0 환원표에 없는 문장을 적으면 원자를 찾지 못한다', () => {
    const report = checkWith({
      specs: STRATEGY_DIRECTION_SPECS.map((spec) =>
        spec.direction === 'reduce' ? { ...spec, originalName: '적게 먹는다' } : spec,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'direction-atom-drift');
    assert.match(report.violations[0]?.message ?? '', /P0 환원표에/);
  });

  test('P0 이 방향이 아니라고 환원한 문장을 방향으로 적으면 걸린다', () => {
    const report = checkWith({
      specs: STRATEGY_DIRECTION_SPECS.map((spec) =>
        spec.direction === 'produce' ? { ...spec, originalName: '법제화' } : spec,
      ),
    });
    const rules = report.violations.map((violation) => violation.rule);
    assert.ok(rules.includes('direction-atom-drift'));
    assert.match(report.violations[0]?.message ?? '', /방향이 아니라 same/);
  });

  test('근거 없는 방향은 지어낸 것이다', () => {
    const report = checkWith({
      specs: STRATEGY_DIRECTION_SPECS.map((spec) =>
        spec.direction === 'delegate' ? { ...spec, example: '' } : spec,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'unsourced-direction');
    assert.match(report.violations[0]?.path ?? '', /example$/);
  });

  test('O1 이 고정한 이름에 정의가 없으면 이름만 있는 방향이 된다', () => {
    const report = checkWith({
      specs: STRATEGY_DIRECTION_SPECS.filter((spec) => spec.direction !== 'removeRival'),
    });
    assert.equal(report.violations[0]?.rule, 'unsourced-direction');
    assert.equal(report.violations[0]?.direction, 'removeRival');
  });

  test('같은 방향을 두 번 적으면 걸린다', () => {
    const first = STRATEGY_DIRECTION_SPECS[0] as StrategyDirectionSpec;
    const report = checkWith({ specs: [...STRATEGY_DIRECTION_SPECS, first] });
    assert.equal(report.violations[0]?.rule, 'duplicate-direction');
  });

  test('원문 갈래를 빼면 붙지 않은 갈래로 지목된다', () => {
    const report = checkWith({
      resolutions: BRANCH_RECONCILIATION.filter((entry) => entry.original !== '빗물을 저장한다'),
    });
    assert.deepEqual(report.unresolved, ['빗물을 저장한다']);
    assert.equal(report.violations[0]?.rule, 'unresolved-example');
  });

  test('7종에 없는 방향으로 붙이면 거부된다', () => {
    const report = checkWith({
      resolutions: BRANCH_RECONCILIATION.map((entry) =>
        entry.original === '물을 훔친다' ? { ...entry, direction: 'raid' as never } : entry,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'dangling-example');
  });

  test('방향이 주지 않는 원자를 쓰는 갈래는 걸린다', () => {
    const report = checkWith({
      resolutions: BRANCH_RECONCILIATION.map((entry) =>
        entry.original === '수분 손실을 줄인다' ? { ...entry, atom: 'shed' as const } : entry,
      ),
    });
    assert.equal(report.violations[0]?.rule, 'direction-atom-drift');
    assert.match(report.violations[0]?.message ?? '', /감소 방향은 적응 만 준다/);
  });

  test('온전하면 위반 목록도 한 줄로 온전하다', () => {
    assert.equal(strategyViolationVerdict([]), '전개가 온전하다');
  });
});
