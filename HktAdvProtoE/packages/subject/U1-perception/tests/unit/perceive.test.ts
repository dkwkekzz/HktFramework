import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHANNEL_BOOK,
  MISS,
  perceiveAll,
  receiveTestimonies,
  reportFor,
  round,
  type Phenomenon,
  type Sensorium,
  type Testimony,
} from '../../src/index.js';

/**
 * 손으로 세운 감각계 — 저장소 없이 걸러 내는 부분만 시험한다.
 *
 * `perceive.ts` 가 `Sensorium` 만 받기 때문에 가능한 일이다. 저장소를 받았다면 이 시험은
 * 세계 하나를 통째로 세워야 했을 것이다.
 */
interface StageOptions {
  bodies?: Record<string, { x: number; y: number; z: number } | null>;
  senses?: Record<string, Record<string, number>>;
  capabilities?: Record<string, string[]>;
  members?: Record<string, string[]>;
  blockers?: string[];
}

function stage(options: StageOptions = {}): Sensorium {
  const bodies = options.bodies ?? { a_body: { x: 0, y: 0, z: 0 } };
  const members = options.members ?? { alice: ['a_body'] };
  return {
    subjects: () => Object.keys(members).sort(),
    kindOf: () => 'person',
    bodiesOf: (subject) => [...(members[subject] ?? [])].sort(),
    ownerOfBody: (entity) =>
      Object.entries(members).find(([, list]) => list.includes(entity))?.[0] ?? null,
    positionOf: (entity) => bodies[entity] ?? null,
    sightBlockers: () => [...(options.blockers ?? [])].sort(),
    sensesOf: (subject) => options.senses?.[subject] ?? { visual: 1, audio: 1, aura: 1, report: 0.2, rumor: 0.2 },
    capabilitiesOf: (subject) => options.capabilities?.[subject] ?? [],
    has: (entity) => entity in bodies || entity in members,
  };
}

const phenomenon = (over: Partial<Phenomenon> = {}): Phenomenon => ({
  id: 't1_bell_toll_bell',
  tags: [],
  channels: ['visual', 'audio'],
  measurements: { visual: 6, audio: 12 },
  location: [10, 0, 0],
  occurredAtTick: 1,
  evidenceIds: ['event_1'],
  sourceEntityId: 'bell',
  ...over,
});

const codes = (misses: { code: string }[]): string[] => [...new Set(misses.map((miss) => miss.code))].sort();

describe('다섯 관문', () => {
  it('감각이 없으면 E_NO_SENSE', () => {
    const pass = perceiveAll(stage({ senses: { alice: { visual: 1 } } }), [phenomenon()], CHANNEL_BOOK);
    expect(codes(pass.misses)).toEqual([MISS.NO_SENSE]);
    expect(pass.perceived.map((entry) => entry.channel)).toEqual(['visual']);
  });

  it('의념은 능력이 있어야 한다 — E_NO_CAPABILITY', () => {
    const aura = phenomenon({ channels: ['aura'], measurements: { aura: 9 } });
    expect(codes(perceiveAll(stage(), [aura], CHANNEL_BOOK).misses)).toEqual([MISS.NO_CAPABILITY]);
    const attuned = stage({ capabilities: { alice: ['sense_aura'] } });
    expect(perceiveAll(attuned, [aura], CHANNEL_BOOK).perceived.length).toBe(1);
  });

  it('몸이 없으면 E_NO_BODY', () => {
    const pass = perceiveAll(stage({ members: { alice: [] } }), [phenomenon()], CHANNEL_BOOK);
    expect(codes(pass.misses)).toEqual([MISS.NO_BODY]);
  });

  it('현상에 자리가 없으면 E_NO_LOCATION', () => {
    const nowhere = { ...phenomenon() };
    delete (nowhere as { location?: unknown }).location;
    expect(codes(perceiveAll(stage(), [nowhere], CHANNEL_BOOK).misses)).toEqual([MISS.NO_LOCATION]);
  });

  it('너무 멀면 E_OUT_OF_RANGE', () => {
    const far = phenomenon({ location: [500, 0, 0] });
    expect(codes(perceiveAll(stage(), [far], CHANNEL_BOOK).misses)).toEqual([MISS.OUT_OF_RANGE]);
  });

  it('시선이 막히면 E_SIGHT_BLOCKED — 그리고 막은 것을 지목한다', () => {
    const pass = perceiveAll(stage({ blockers: ['wall'] }), [phenomenon()], CHANNEL_BOOK);
    const blocked = pass.misses.find((miss) => miss.channel === 'visual');
    expect(blocked?.code).toBe(MISS.SIGHT_BLOCKED);
    expect(blocked?.blockedBy).toEqual(['wall']);
  });

  it('문턱을 못 넘으면 E_BELOW_THRESHOLD — 그리고 수치가 남는다', () => {
    const pass = perceiveAll(
      stage({ senses: { alice: { visual: 99, audio: 99 } } }),
      [phenomenon()],
      CHANNEL_BOOK,
    );
    const miss = pass.misses.find((entry) => entry.channel === 'audio');
    expect(miss?.code).toBe(MISS.BELOW_THRESHOLD);
    expect(miss?.strength).toBeGreaterThan(0);
    expect(miss?.threshold).toBe(99);
  });

  it('관문의 순서가 고정되어 있다 — 몸이 없어도 감각이 먼저 없으면 그것이 먼저 나온다', () => {
    const pass = perceiveAll(
      stage({ members: { alice: [] }, senses: { alice: {} } }),
      [phenomenon()],
      CHANNEL_BOOK,
    );
    expect(codes(pass.misses)).toEqual([MISS.NO_SENSE]);
  });
});

describe('벽은 시선을 끊고 소리를 줄인다', () => {
  it('시각은 벽 하나에 완전히 끊긴다', () => {
    const pass = perceiveAll(stage({ blockers: ['wall'] }), [phenomenon()], CHANNEL_BOOK);
    expect(pass.perceived.some((entry) => entry.channel === 'visual')).toBe(false);
  });

  it('청각은 벽마다 줄 뿐이고, 충분히 크면 넘어온다', () => {
    const loud = phenomenon({ channels: ['audio'], measurements: { audio: 40 } });
    const quiet = phenomenon({ id: 't1_whisper_x', channels: ['audio'], measurements: { audio: 2 } });
    const walled = stage({ blockers: ['wall'], senses: { alice: { audio: 2.5 } } });
    expect(perceiveAll(walled, [loud], CHANNEL_BOOK).perceived.length).toBe(1);
    expect(perceiveAll(walled, [quiet], CHANNEL_BOOK).perceived.length).toBe(0);
  });

  it('벽이 많을수록 더 줄어든다', () => {
    const loud = phenomenon({ channels: ['audio'], measurements: { audio: 40 } });
    const one = perceiveAll(stage({ blockers: ['w1'] }), [loud], CHANNEL_BOOK).perceived[0]?.strength ?? 0;
    const two = perceiveAll(stage({ blockers: ['w1', 'w2'] }), [loud], CHANNEL_BOOK).perceived[0]?.strength ?? 0;
    expect(two).toBeLessThan(one);
    expect(two).toBeGreaterThan(0);
  });

  it('멀수록 약해진다', () => {
    const near = perceiveAll(stage(), [phenomenon({ location: [2, 0, 0] })], CHANNEL_BOOK);
    const far = perceiveAll(stage(), [phenomenon({ location: [30, 0, 0] })], CHANNEL_BOOK);
    expect(far.perceived[0]?.strength).toBeLessThan(near.perceived[0]?.strength ?? 0);
  });
});

describe('몸이 여럿이면 가장 가까운 몸이 느낀다', () => {
  it('가까운 쪽이 잡고, 어느 몸이 잡았는지가 남는다', () => {
    const many = stage({
      bodies: { near: { x: 9, y: 0, z: 0 }, far: { x: 0, y: 0, z: 0 } },
      members: { alice: ['near', 'far'] },
    });
    const pass = perceiveAll(many, [phenomenon()], CHANNEL_BOOK);
    expect(pass.perceived.every((entry) => entry.sensedBy === 'near')).toBe(true);
    expect(pass.perceived[0]?.distance).toBe(1);
  });

  it('거리가 같으면 id 오름차순으로 깬다 (GI-12)', () => {
    const tie = stage({
      bodies: { beta: { x: 0, y: 0, z: 0 }, alpha: { x: 20, y: 0, z: 0 } },
      members: { alice: ['alpha', 'beta'] },
    });
    const pass = perceiveAll(tie, [phenomenon()], CHANNEL_BOOK);
    expect(pass.perceived.every((entry) => entry.sensedBy === 'alpha')).toBe(true);
  });
});

describe('보고와 소문', () => {
  const bell = phenomenon();
  const known = new Map([[bell.id, bell]]);
  const testimony = (over: Partial<Testimony> = {}): Testimony => ({
    id: 'tale',
    tick: 1,
    senderId: 'bob',
    receiverId: 'alice',
    phenomenonId: bell.id,
    channel: 'report',
    distortion: 0.3,
    concealment: 0,
    persuasion: 1,
    ...over,
  });

  it('본 사람의 말은 닿고, 누가 전했는지와 얼마나 뒤틀렸는지가 남는다', () => {
    const pass = receiveTestimonies(stage(), [testimony()], known, new Set([`bob:${bell.id}`]), CHANNEL_BOOK);
    expect(pass.perceived[0]).toMatchObject({ via: 'bob', distortion: 0.3, distance: null, sensedBy: null });
  });

  it('못 본 것은 전할 수 없다 (GI-02)', () => {
    const pass = receiveTestimonies(stage(), [testimony()], known, new Set(), CHANNEL_BOOK);
    expect(codes(pass.misses)).toEqual([MISS.SENDER_NEVER_PERCEIVED]);
    expect(pass.perceived).toEqual([]);
  });

  it('세계에 없는 현상은 전할 수 없다', () => {
    const pass = receiveTestimonies(
      stage(),
      [testimony({ phenomenonId: 'made_up' })],
      known,
      new Set(['bob:made_up']),
      CHANNEL_BOOK,
    );
    expect(codes(pass.misses)).toEqual([MISS.UNKNOWN_PHENOMENON_IN_TESTIMONY]);
  });

  it('숨기면 닿지 않는다 — 설득력이 숨김을 이겨야 한다', () => {
    const seen = new Set([`bob:${bell.id}`]);
    const hidden = receiveTestimonies(
      stage(),
      [testimony({ concealment: 0.95 })],
      known,
      seen,
      CHANNEL_BOOK,
    );
    expect(codes(hidden.misses)).toEqual([MISS.BELOW_THRESHOLD]);
    const plain = receiveTestimonies(stage(), [testimony({ concealment: 0 })], known, seen, CHANNEL_BOOK);
    expect(plain.perceived.length).toBe(1);
  });

  it('받는 감각이 없으면 닿지 않는다', () => {
    const deaf = stage({ senses: { alice: { visual: 1 } } });
    const pass = receiveTestimonies(deaf, [testimony()], known, new Set([`bob:${bell.id}`]), CHANNEL_BOOK);
    expect(codes(pass.misses)).toEqual([MISS.NO_SENSE]);
  });
});

describe('주체별 요약', () => {
  it('채널마다 따로 적힌다 — 원문 「2.4」의 "시각 주장과 청각 주장이 구분된다"', () => {
    const bell = phenomenon();
    const pass = perceiveAll(stage(), [bell], CHANNEL_BOOK);
    const report = reportFor('alice', 'person', [bell], pass.perceived, pass.misses);
    expect(Object.keys(report.byChannel).sort()).toEqual(['audio', 'visual']);
    expect(report.known).toEqual([bell.id]);
    expect(report.unknown).toEqual([]);
  });

  it('모르는 현상마다 이유가 붙는다', () => {
    const bell = phenomenon({ location: [500, 0, 0] });
    const pass = perceiveAll(stage(), [bell], CHANNEL_BOOK);
    const report = reportFor('alice', 'person', [bell], pass.perceived, pass.misses);
    expect(report.known).toEqual([]);
    expect(report.unknown).toEqual([bell.id]);
    expect(report.reasons[bell.id]).toEqual([MISS.OUT_OF_RANGE]);
  });

  it('한 채널로라도 잡았으면 아는 것이다 — 다른 채널의 실패는 이유에 남지 않는다', () => {
    const bell = phenomenon();
    const pass = perceiveAll(stage({ blockers: ['wall'] }), [bell], CHANNEL_BOOK);
    const report = reportFor('alice', 'person', [bell], pass.perceived, pass.misses);
    expect(report.known).toEqual([bell.id]);
    expect(report.reasons[bell.id]).toBeUndefined();
  });
});

describe('반올림', () => {
  it('음의 0 을 남기지 않는다 — JSON 에서 굳으면 해시가 갈린다', () => {
    expect(Object.is(round(-0.00001), -0)).toBe(false);
  });
});

describe('GI-02 — 거르는 쪽은 세계를 손에 쥐지 않는다', () => {
  const importsOf = (file: string): string[] => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    return [...source.matchAll(/^\s*import[\s\S]*?from\s+'([^']+)'/gm)].map((match) => match[1] as string);
  };

  it('perceive.ts 는 저장소도 공간 모듈도 들여오지 않는다', () => {
    expect(importsOf('../../src/perceive.ts')).toEqual(['./sensorium.js', './types.js']);
  });

  it('저장소를 만지는 자리는 sensorium.ts 하나다', () => {
    const readers = ['../../src/perceive.ts', '../../src/channels.ts', '../../src/sensorium.ts'].filter((file) =>
      importsOf(file).includes('@hkt/k0-entity-state'),
    );
    expect(readers).toEqual(['../../src/sensorium.ts']);
  });
});
