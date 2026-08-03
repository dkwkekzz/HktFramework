// P1-b 단위 테스트 — 결핍 하나 앞에서 무엇이 열리고 무엇이 왜 막히는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import type { DependencyEdge, DependencyNode } from '../../src/d1/index.ts';
import {
  BLOCK_REASONS,
  BLOCK_SPECS,
  blockSpec,
  checkOptions,
  leadingEdge,
  openOption,
  openOptions,
  optionText,
  type StrategyOption,
} from '../../src/p1/index.ts';

import { baseGraphOf, plain } from '../d3/fixture.ts';

const graph = baseGraphOf(plain);
const nodeOf = (label: string): DependencyNode =>
  graph.nodes.find((node) => node.label === label) as DependencyNode;

const berry = nodeOf('겨울 열매'); // 자원 · consumes · 갈아탐 0.6
const den = nodeOf('겨울 굴'); // 공간 · protected_by
const hungerRoot = nodeOf('주린 몸'); // 뿌리

const blocked = (options: readonly StrategyOption[], direction: string): string | null =>
  options.find((option) => option.direction === direction)?.blockedBy ?? null;

/** 손으로 세운 노드 — 그래프에는 없지만 종만 다른 자리를 보기 위한 것. */
function nodeWithKind(kind: DependencyNode['kind'], label: string): DependencyNode {
  return { ...berry, id: deterministicId('dep-node', label), kind, label };
}

describe('결핍 앞에 열리는 갈래', () => {
  const options = openOptions(graph, berry);

  test('일곱 방향이 언제나 일곱으로 선다 — 막힌 것도 자리를 지킨다', () => {
    assert.equal(options.length, 7);
    assert.deepEqual(checkOptions(options), []);
  });

  test('자원 결핍 앞에는 여섯이 열린다', () => {
    assert.deepEqual(
      options.filter((option) => option.open).map((option) => option.direction),
      ['fulfill', 'substitute', 'reduce', 'produce', 'delegate', 'removeDependency'],
    );
  });

  test('충족이 주는 원자는 그 종을 채울 수 있는 것만 남는다 — 찾다는 자원을 채우지 못한다', () => {
    const fulfill = options.find((option) => option.direction === 'fulfill');
    assert.deepEqual(fulfill?.atoms, ['acquire', 'exchange', 'seize']);
    assert.match(optionText(fulfill as StrategyOption), /충족 — 획득 · 교환 · 빼앗다/);
  });

  test('열린 갈래는 왜 열렸는지를 한 줄로 말한다', () => {
    for (const option of options.filter((entry) => entry.open)) {
      assert.notEqual(option.why, '', option.direction);
      assert.equal(option.blockedBy, null, option.direction);
    }
  });
});

describe('막히는 자리 — 전부 앞 계층이 못박은 성질에서 나온다', () => {
  test('공간 결핍 앞에는 셋만 열린다 — 장소는 만들 수도 맡길 수도 덜 쓸 수도 없다', () => {
    const options = openOptions(graph, den);
    assert.deepEqual(
      options.filter((option) => option.open).map((option) => option.direction),
      ['fulfill', 'substitute', 'removeDependency'],
    );
    assert.equal(blocked(options, 'reduce'), 'nothing-to-reduce');
    assert.equal(blocked(options, 'produce'), 'unproducible-kind');
    assert.equal(blocked(options, 'delegate'), 'untransferable');
  });

  test('써서 없애는 기댐만 덜 쓸 수 있다 (D1 consumes)', () => {
    assert.equal(blocked(openOptions(graph, berry), 'reduce'), null);
    const option = openOption('reduce', den, leadingEdge(graph, den.id), false);
    assert.equal(option.blockedBy, 'nothing-to-reduce');
    assert.match(option.why, /protected_by/);
  });

  test('갈아탐 0 인 기댐은 대체가 막힌다 (D1 substitutability)', () => {
    const edge = leadingEdge(graph, berry.id) as DependencyEdge;
    const option = openOption('substitute', berry, { ...edge, substitutability: 0 }, false);
    assert.equal(option.blockedBy, 'not-substitutable');
    assert.match(option.why, /그 대상이어야 하는 기댐/);
  });

  test('내 몸의 자리는 남이 대신 채워 주지 못한다 (D0 transferable)', () => {
    const options = openOptions(graph, hungerRoot);
    assert.equal(blocked(options, 'delegate'), 'untransferable');
  });

  test('종이 물려준 뿌리는 통째로 버리지 못한다 (D2·D3)', () => {
    const option = openOption('removeDependency', hungerRoot, null, true);
    assert.equal(option.blockedBy, 'species-root');
    assert.equal(option.owedTo, 'G3 성장 — 종의 자리 자체를 바꾸는 탈피는 그쪽이 승인한다');
    // 사슬 안쪽이면 같은 방향이 열린다.
    assert.equal(openOption('removeDependency', berry, null, false).open, true);
  });

  test('시간 의존은 채울 수 없다 — 기다리는 것은 행동이 아니다 (D0)', () => {
    const option = openOption('fulfill', nodeWithKind('time', '장막 주기'), null, false);
    assert.equal(option.blockedBy, 'no-target');
  });

  test('규칙 의존은 채우는 원자가 열여섯 중에 없다 (P0)', () => {
    const option = openOption('fulfill', nodeWithKind('rule', '의념의 법'), null, false);
    assert.equal(option.blockedBy, 'no-filling-atom');
    assert.equal(option.owedTo, 'W2 규칙 실체화 — 규칙이 세계 상태가 되면 그때 채울 길이 생긴다');
  });

  test('겨루는 자를 아직 볼 수 없어 경쟁 제거는 늘 막힌다 — D5 가 갚는다', () => {
    assert.equal(blocked(openOptions(graph, berry), 'removeRival'), 'no-known-rival');
    // 호출자가 경쟁자를 알려 주면 그때 열린다 — 문법은 이미 서 있다.
    const withRival = openOptions(graph, berry, { rivals: [plain.id] });
    assert.equal(blocked(withRival, 'removeRival'), null);
    assert.deepEqual(
      withRival.find((option) => option.direction === 'removeRival')?.atoms,
      ['destroy', 'coerce', 'conceal'],
    );
  });

  test('들어오는 기댐이 없는 자리는 대체·감소가 함께 막힌다', () => {
    const orphan = { ...berry, id: deterministicId('dep-node', '뜬 자리') };
    const options = openOptions(graph, orphan);
    assert.equal(blocked(options, 'substitute'), 'not-substitutable');
    assert.equal(blocked(options, 'reduce'), 'nothing-to-reduce');
  });
});

describe('막힘 사유의 서식', () => {
  test('여덟 사유가 전부 뜻과 갚을 자리를 댄다', () => {
    assert.equal(BLOCK_REASONS.length, 8);
    assert.equal(BLOCK_SPECS.length, 8);
    for (const spec of BLOCK_SPECS) {
      assert.notEqual(spec.says, '', spec.reason);
    }
  });

  test('뒤에서 열릴 수 있는 사유 셋만 갚을 모듈을 댄다', () => {
    assert.deepEqual(
      BLOCK_SPECS.filter((spec) => spec.owedTo !== null).map((spec) => spec.reason),
      ['no-filling-atom', 'no-known-rival', 'species-root'],
    );
    assert.equal(blockSpec('no-target')?.owedTo, null);
    assert.equal(blockSpec('nowhere' as never), null);
  });
});

describe('설 수 없는 갈래 판정', () => {
  const sound = openOptions(graph, berry);

  test('열렸다면서 원자가 없으면 그것은 열린 것이 아니다', () => {
    const broken = sound.map((option) =>
      option.direction === 'fulfill' ? { ...option, atoms: [] } : option,
    );
    assert.equal(checkOptions(broken)[0]?.rule, 'open-without-atom');
  });

  test('막혔는데 사유가 없으면 임의의 규칙이다', () => {
    const broken = sound.map((option) =>
      option.direction === 'removeRival' ? { ...option, blockedBy: null } : option,
    );
    assert.equal(checkOptions(broken)[0]?.rule, 'unreasoned-block');
  });

  test('선언되지 않은 사유로는 막을 수 없다', () => {
    const broken = sound.map((option) =>
      option.direction === 'removeRival' ? { ...option, blockedBy: 'because' as never } : option,
    );
    assert.equal(checkOptions(broken)[0]?.rule, 'unknown-block');
  });

  test('뒤에서 갚을 사유인데 갚을 자리를 안 적으면 걸린다', () => {
    const broken = sound.map((option) =>
      option.direction === 'removeRival' ? { ...option, owedTo: null } : option,
    );
    assert.equal(checkOptions(broken)[0]?.rule, 'unowed-block');
  });

  test('열렸는데 막힌 사유도 달려 있으면 걸린다', () => {
    const broken = sound.map((option) =>
      option.direction === 'produce' ? { ...option, blockedBy: 'no-target' as const } : option,
    );
    assert.equal(checkOptions(broken)[0]?.rule, 'unreasoned-block');
  });

  test('경로는 몇 번째 갈래가 막혔는지까지 말한다', () => {
    const broken = sound.map((option) =>
      option.direction === 'removeRival' ? { ...option, blockedBy: null } : option,
    );
    assert.equal(checkOptions(broken, '$.branches[2].options')[0]?.path, '$.branches[2].options[5]');
  });
});
