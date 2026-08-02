// S0-b 감지 프로필 — 같은 현상 앞에서 주체마다 다른 세계가 보이는가.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicId } from '../../src/v1/index.ts';
import { PHENOMENON_CHANNELS, type Phenomenon } from '../../src/o1/index.ts';
import {
  acuityOf,
  channelSpec,
  CHANNEL_SPECS,
  checkPerception,
  isBodyChannel,
  MAX_PERCEPTION_RANGE,
  openChannels,
  perceives,
  perceptionSummary,
  type Boundary,
  type PerceptionProfile,
  type SubjectRef,
  type SubjectViolation,
} from '../../src/s0/index.ts';

const hunterId = deterministicId('subject', 'veil', 'hunter');
const nationId = deterministicId('subject', 'veil', 'nation');
const bodyId = deterministicId('entity', 'veil', 'hunter-body');
const capitalId = deterministicId('entity', 'veil', 'capital');

const hunter: SubjectRef = { id: hunterId, name: '붉은 장막 사냥꾼', subjectKind: 'person' };
const nation: SubjectRef = { id: nationId, name: '협곡 국가', subjectKind: 'nation' };

const hunterBoundaries: readonly Boundary[] = [
  { kind: 'body', ofId: bodyId, note: '사냥꾼의 몸' },
];
const nationBoundaries: readonly Boundary[] = [
  { kind: 'membership', ofId: hunterId, note: '국민 한 명' },
  { kind: 'territory', ofId: capitalId, note: '수도' },
];

const hunterEyes: PerceptionProfile = {
  channels: [
    { channel: 'light', threshold: 0.2, range: 300 },
    { channel: 'sound', threshold: 0.3, range: 120 },
    { channel: 'trace', threshold: 0.1, range: 5 },
    { channel: 'report', threshold: 0.5, range: MAX_PERCEPTION_RANGE },
  ],
};
const nationEars: PerceptionProfile = {
  channels: [{ channel: 'report', threshold: 0.4, range: MAX_PERCEPTION_RANGE }],
};

/** 붉은 장막이 걷힐 때의 빛 — 세기 0.6. */
const veilLight: Pick<Phenomenon, 'channel' | 'intensity'> = { channel: 'light', intensity: 0.6 };

function rulesOf(
  subject: SubjectRef,
  profile: PerceptionProfile,
  boundaries: readonly Boundary[],
): string[] {
  const out: SubjectViolation[] = [];
  checkPerception(subject, profile, boundaries, out);
  return out.map((violation) => violation.rule);
}

describe('통로 카탈로그', () => {
  test('O1 현상 통로 6종이 하나도 빠짐없이 성격을 갖는다', () => {
    assert.deepEqual(
      CHANNEL_SPECS.map((spec) => spec.channel),
      [...PHENOMENON_CHANNELS],
    );
    for (const spec of CHANNEL_SPECS) {
      assert.notEqual(spec.label, '', spec.channel);
      assert.notEqual(spec.note, '', spec.channel);
    }
  });

  test('몸을 거치는 통로 넷과 거치지 않는 통로 둘로 갈린다', () => {
    assert.deepEqual(PHENOMENON_CHANNELS.filter(isBodyChannel), [
      'light',
      'sound',
      'trace',
      'smell',
    ]);
    assert.deepEqual(PHENOMENON_CHANNELS.filter((channel) => !isBodyChannel(channel)), [
      'psychic',
      'report',
    ]);
    assert.equal(channelSpec('report')?.route, 'mediated');
  });
});

describe('감지 판정', () => {
  test('사냥꾼은 장막의 빛을 본다', () => {
    const verdict = perceives(hunterEyes, veilLight, 100);
    assert.equal(verdict.perceived, true);
    assert.equal(verdict.miss, null);
  });

  test('같은 현상을 국가는 보지 못한다 — 통로가 없다', () => {
    const verdict = perceives(nationEars, veilLight, 100);
    assert.equal(verdict.perceived, false);
    assert.equal(verdict.miss, 'no-channel');
    assert.ok(verdict.message.includes('일어나지 않은 것과 같다'), verdict.message);
  });

  test('세기가 문턱에 못 미치면 못 본다 — 은폐가 성립하는 지점', () => {
    const verdict = perceives(hunterEyes, { channel: 'light', intensity: 0.1 }, 10);
    assert.equal(verdict.miss, 'too-faint');
    assert.ok(verdict.message.includes('0.2'), verdict.message);
  });

  test('세기가 충분해도 멀면 못 본다', () => {
    const verdict = perceives(hunterEyes, veilLight, 1000);
    assert.equal(verdict.miss, 'too-far');
    assert.ok(verdict.message.includes('300m'), verdict.message);
  });

  test('문턱과 거리의 끝은 감지 쪽이다 — 딱 맞으면 본다', () => {
    assert.equal(perceives(hunterEyes, { channel: 'light', intensity: 0.2 }, 300).perceived, true);
    assert.equal(perceives(hunterEyes, { channel: 'light', intensity: 0.2 }, 300.1).perceived, false);
  });

  test('같은 현상·같은 거리면 언제나 같은 판정이다', () => {
    assert.deepEqual(perceives(hunterEyes, veilLight, 100), perceives(hunterEyes, veilLight, 100));
  });

  test('열린 통로와 감도를 그대로 읽을 수 있다', () => {
    assert.deepEqual([...openChannels(nationEars)], ['report']);
    assert.equal(acuityOf(hunterEyes, 'sound')?.range, 120);
    assert.equal(acuityOf(hunterEyes, 'smell'), null);
  });
});

describe('감지 프로필 검사', () => {
  test('사냥꾼의 감각과 국가의 보고망은 둘 다 온전하다', () => {
    assert.deepEqual(rulesOf(hunter, hunterEyes, hunterBoundaries), []);
    assert.deepEqual(rulesOf(nation, nationEars, nationBoundaries), []);
  });

  test('몸 없는 국가가 눈을 선언하면 걸린다 — 국가는 보고로만 안다', () => {
    const out: SubjectViolation[] = [];
    checkPerception(
      nation,
      { channels: [{ channel: 'light', threshold: 0.2, range: 300 }] },
      nationBoundaries,
      out,
    );
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['bodiless-sense'],
    );
    assert.ok(out[0]?.message.includes('보고와 의념 잔향'), out[0]?.message);
  });

  test('몸 없는 주체도 의념 잔향은 탄다 — 신이 세계를 아는 방법', () => {
    assert.deepEqual(
      rulesOf(
        { id: nationId, name: '둥지의 어미', subjectKind: 'god' },
        { channels: [{ channel: 'psychic', threshold: 0.05, range: MAX_PERCEPTION_RANGE }] },
        [{ kind: 'anchor', ofId: capitalId, note: '앵커' }],
      ),
      [],
    );
  });

  test('문턱 0 은 거부된다 — 전지한 감각은 은폐도 기만도 무너뜨린다', () => {
    const out: SubjectViolation[] = [];
    checkPerception(
      hunter,
      { channels: [{ channel: 'light', threshold: 0, range: 300 }] },
      hunterBoundaries,
      out,
    );
    assert.deepEqual(
      out.map((violation) => violation.rule),
      ['omniscient-channel'],
    );
    assert.equal(out[0]?.path, '$.perception.channels[0].threshold');
  });

  test('없는 통로 · 두 번 적힌 통로 · 범위 밖 거리가 각각의 사유로 걸린다', () => {
    assert.deepEqual(
      rulesOf(
        hunter,
        { channels: [{ channel: 'telepathy' as never, threshold: 0.5, range: 10 }] },
        hunterBoundaries,
      ),
      ['unknown-channel'],
    );
    assert.deepEqual(
      rulesOf(
        hunter,
        {
          channels: [
            { channel: 'light', threshold: 0.2, range: 300 },
            { channel: 'light', threshold: 0.9, range: 1 },
          ],
        },
        hunterBoundaries,
      ),
      ['duplicate-channel'],
    );
    assert.deepEqual(
      rulesOf(hunter, { channels: [{ channel: 'light', threshold: 0.2, range: -1 }] }, hunterBoundaries),
      ['bad-range'],
    );
    assert.deepEqual(
      rulesOf(
        hunter,
        { channels: [{ channel: 'light', threshold: 0.2, range: MAX_PERCEPTION_RANGE + 1 }] },
        hunterBoundaries,
      ),
      ['bad-range'],
    );
  });

  test('통로 없는 주체는 첫 질문에 답하지 못한다', () => {
    assert.deepEqual(rulesOf(hunter, { channels: [] }, hunterBoundaries), ['senseless-subject']);
    assert.equal(perceptionSummary({ channels: [] }), '아무것도 감지하지 못한다');
  });

  test('감지 요약이 통로별 문턱과 거리를 한 줄로 편다', () => {
    assert.equal(perceptionSummary(nationEars), '보고 ≥0.4 · 1000000m');
  });
});
