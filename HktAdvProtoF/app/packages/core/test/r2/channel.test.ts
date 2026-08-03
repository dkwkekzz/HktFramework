// R2-a 단위 테스트 — 세계의 표면이 온전한가: 무엇이 새고, 무엇이 새지 않는다고 선언됐는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PHENOMENON_CHANNELS } from '../../src/o1/index.ts';
import { ATOM_GROUNDINGS, type AtomGrounding } from '../../src/p0/index.ts';
import {
  LEAK_CHANNELS,
  SEALED_SLOTS,
  atomsMoving,
  checkLeakChannels,
  leakOf,
  leakSummary,
  leakVerdict,
  movableSlots,
  sealedOf,
  type LeakChannel,
  type SealedSlot,
} from '../../src/r2/index.ts';

const report = checkLeakChannels();

describe('R2-a 흔적의 통로 — 선언', () => {
  test('원자가 움직일 수 있는 자리가 전부 답을 갖는다', () => {
    assert.equal(report.complete, true, leakVerdict(report));
    assert.deepEqual(report.unchanneled, []);
    assert.deepEqual(report.violations, []);
  });

  test('그 자리 수는 P0-b 걸림에서 세어 온다 — R2 가 따로 적지 않는다', () => {
    const counted = new Set<string>();
    for (const grounding of ATOM_GROUNDINGS) {
      for (const ref of [...grounding.writes, ...grounding.pays]) {
        counted.add(`${ref.domain}.${ref.path}`);
      }
    }
    assert.equal(report.movable, counted.size);
    assert.equal(movableSlots().length, counted.size);
  });

  test('O1 이 연 통로 6종이 전부 쓰인다 — 쓰이지 않는 통로는 통로가 아니다', () => {
    assert.deepEqual(report.unusedChannels, []);
    for (const channel of PHENOMENON_CHANNELS) {
      assert.ok(
        (report.byChannel[channel] ?? []).length > 0,
        `${channel} 로 새는 자리가 없다`,
      );
    }
  });

  test('한 자리가 여러 통로로 샌다 — 부서지는 것은 소리가 나고 부서진 채로 남는다', () => {
    const broken = leakOf('physical', 'broken');
    assert.deepEqual(broken?.channels, ['sound', 'trace']);
  });

  test('실제 경로도 패턴에 걸린다 — 재고는 자리가 누구 것이든 같은 통로로 샌다', () => {
    const leak = leakOf('economic', 'stock.entity:315be47c6381');
    assert.deepEqual(leak?.channels, ['light']);
    assert.equal(leakOf('economic', 'stock.{entity}')?.slot.path, 'stock.{entity}');
  });
});

describe('R2-a 새지 않는 자리 — 선언된 예외', () => {
  test('앎은 새지 않는다 — 정보 영역 다섯 자리가 전부 봉인이다', () => {
    const knowing = SEALED_SLOTS.filter((entry) => entry.slot.domain === 'informational');
    assert.equal(knowing.length, 5);
    assert.equal(sealedOf('informational', 'knows.claim:867942326e01')?.slot.domain, 'informational');
    assert.equal(leakOf('informational', 'knows.claim:867942326e01'), null);
  });

  test('몸 안에 머무는 값도 새지 않는다 — 허기와 대사', () => {
    assert.notEqual(sealedOf('biological', 'hunger'), null);
    assert.notEqual(sealedOf('biological', 'metabolism'), null);
    // 그러나 체력은 샌다 — 깎이는 몸은 상처와 지침으로 드러난다.
    assert.equal(sealedOf('biological', 'vitality'), null);
    assert.deepEqual(leakOf('biological', 'vitality')?.channels, ['smell', 'trace']);
  });

  test('봉인마다 "그러면 어떻게 알려지는가" 가 함께 적힌다', () => {
    for (const entry of SEALED_SLOTS) {
      assert.ok(entry.reason.length > 0, `${entry.slot.path} 의 이유가 비었다`);
      assert.ok(entry.knownBy.length > 0, `${entry.slot.path} 의 알려지는 길이 비었다`);
    }
  });

  test('정보 영역이라도 퍼지는 중인 말은 들린다 — rumorSpread 는 봉인이 아니다', () => {
    assert.equal(sealedOf('informational', 'rumorSpread.claim:867942326e01'), null);
    assert.deepEqual(leakOf('informational', 'rumorSpread.{claim}')?.channels, ['report']);
  });
});

describe('R2-a 애매함의 재료 — 같은 자국을 누가 남길 수 있는가', () => {
  test('체력은 열둘이 움직인다 — 가장 흔하고 가장 애매한 흔적', () => {
    const movers = atomsMoving({ domain: 'biological', path: 'vitality' });
    assert.equal(movers.length, 12);
    assert.ok(movers.includes('seek'));
    assert.ok(movers.includes('destroy'));
  });

  test('파손은 하나뿐이다 — 부서진 것은 부순 자를 가리킨다', () => {
    assert.deepEqual(atomsMoving({ domain: 'physical', path: 'broken' }), ['destroy']);
  });

  test('재고를 움직이는 원자는 여섯이다 — 줄었다는 것만 보이고 누가 가져갔는지는 보이지 않는다', () => {
    assert.equal(atomsMoving({ domain: 'economic', path: 'stock.{entity}' }).length, 6);
  });

  test('요약 줄이 그 사실을 말한다', () => {
    const summary = leakSummary(report);
    assert.ok(summary.some((line) => line.includes('biological.vitality')));
    assert.ok(summary.some((line) => line.includes('새지 않는 자리')));
  });
});

describe('R2-a 표면이 무너지는 자리', () => {
  const one = (slotPath: string, channels: LeakChannel['channels']): LeakChannel => ({
    slot: { domain: 'physical', path: slotPath },
    channels,
    note: '검사용',
  });

  test('원자가 움직이는 자리인데 통로가 없으면 걸린다', () => {
    const trimmed = LEAK_CHANNELS.filter((entry) => entry.slot.path !== 'broken');
    const broken = checkLeakChannels(trimmed, SEALED_SLOTS);
    assert.equal(broken.complete, false);
    assert.ok(broken.unchanneled.includes('physical.broken'));
    assert.equal(broken.violations[0]?.rule, 'unchanneled-slot');
  });

  test('세계에 없는 자리가 샌다고 적으면 걸린다', () => {
    const bogus = checkLeakChannels([...LEAK_CHANNELS, one('aura', ['light'])], SEALED_SLOTS);
    assert.ok(bogus.violations.some((violation) => violation.rule === 'phantom-channel'));
  });

  test('통로 없이 적으면 예외로 선언하라고 말한다', () => {
    const silent = checkLeakChannels(
      [...LEAK_CHANNELS.filter((entry) => entry.slot.path !== 'broken'), one('broken', [])],
      SEALED_SLOTS,
    );
    assert.ok(silent.violations.some((violation) => violation.rule === 'undeclared-silence'));
  });

  test('6종에 없는 통로는 걸린다', () => {
    const alien = checkLeakChannels(
      [
        ...LEAK_CHANNELS.filter((entry) => entry.slot.path !== 'broken'),
        one('broken', ['telepathy' as never]),
      ],
      SEALED_SLOTS,
    );
    assert.ok(alien.violations.some((violation) => violation.rule === 'unknown-channel'));
  });

  test('새지 않는다고 선언해 놓고 통로를 가지면 예외가 낡은 것이다', () => {
    const both: readonly SealedSlot[] = [
      ...SEALED_SLOTS,
      {
        slot: { domain: 'physical', path: 'broken' },
        reason: '검사용',
        knownBy: '검사용',
      },
    ];
    const stale = checkLeakChannels(LEAK_CHANNELS, both);
    assert.ok(stale.violations.some((violation) => violation.rule === 'stale-silence'));
  });

  test('아무 자리도 쓰지 않는 통로가 생기면 걸린다', () => {
    const noSound = LEAK_CHANNELS.map((entry) =>
      entry.slot.path === 'broken' ? { ...entry, channels: ['trace' as const] } : entry,
    );
    const quiet = checkLeakChannels(noSound, SEALED_SLOTS);
    assert.ok(quiet.violations.some((violation) => violation.rule === 'unused-channel'));
    assert.deepEqual(quiet.unusedChannels, ['sound']);
  });

  test('원자가 새 자리를 열면 그 자리도 답을 요구한다 — 표면은 P0 을 따라 자란다', () => {
    const invented: readonly AtomGrounding[] = ATOM_GROUNDINGS.map((grounding) =>
      grounding.atom === 'seek'
        ? { ...grounding, writes: [...grounding.writes, { domain: 'physical', path: 'speed' }] }
        : grounding,
    );
    const grown = checkLeakChannels(LEAK_CHANNELS, SEALED_SLOTS, invented);
    assert.ok(grown.unchanneled.includes('physical.speed'));
  });
});
