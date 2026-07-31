import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NATURAL_LAWS } from '@hkt/s1-natural-state';
import { SUBJECT_LAWS } from '@hkt/u0-subject-core';
import {
  CHANNEL_ALIASES,
  CHANNEL_BOOK,
  CHANNEL_IDS,
  PERCEPTION_CHANNELS,
  PHENOMENON_BOOK,
  U1_CHANNELS,
} from '../../src/index.js';

describe('원문 「11」 U1 의 포함 일곱 항목', () => {
  it('시각·청각·냄새·접촉·의념·보고·소문이 모두 채널로 있다', () => {
    expect(CHANNEL_IDS).toEqual([...U1_CHANNELS].sort());
    expect(U1_CHANNELS.length).toBe(7);
  });

  it('기억은 지각이 아니다 — 원본 10장의 여덟 갈래 중 하나만 U1 밖이다', () => {
    expect(PERCEPTION_CHANNELS).toContain('memory');
    expect(U1_CHANNELS).not.toContain('memory');
    expect(PERCEPTION_CHANNELS.length - U1_CHANNELS.length).toBe(1);
  });

  it('다섯은 공간을 건너오고 둘은 사람이 들고 온다', () => {
    const spatial = CHANNEL_BOOK.filter((channel) => !channel.carriedByPeople).map((channel) => channel.id);
    const carried = CHANNEL_BOOK.filter((channel) => channel.carriedByPeople).map((channel) => channel.id);
    expect(spatial.sort()).toEqual(['aura', 'audio', 'smell', 'touch', 'visual'].sort());
    expect(carried.sort()).toEqual(['report', 'rumor']);
  });
});

describe('벽이 두 감각에 다르게 작용한다', () => {
  it('시선은 끊기고 소리는 줄어든다 — 대표 검증이 걸려 있는 두 줄', () => {
    const visual = CHANNEL_BOOK.find((channel) => channel.id === 'visual');
    const audio = CHANNEL_BOOK.find((channel) => channel.id === 'audio');
    expect(visual?.onBlocked).toBe('cut');
    expect(audio?.onBlocked).toBe('damped');
    expect(audio?.dampPerBlocker).toBeGreaterThan(0);
    expect(audio?.dampPerBlocker).toBeLessThan(1);
  });

  it('의념만 능력을 요구한다', () => {
    const gated = CHANNEL_BOOK.filter((channel) => channel.requiredCapability !== undefined);
    expect(gated.map((channel) => channel.id)).toEqual(['aura']);
    expect(gated[0]?.requiredCapability).toBe('sense_aura');
  });

  it('모든 채널이 거리 감쇠와 최대 거리를 갖는다', () => {
    for (const channel of CHANNEL_BOOK) {
      expect(channel.falloff, channel.id).toBeGreaterThanOrEqual(0);
      expect(channel.maxDistance, channel.id).toBeGreaterThan(0);
    }
  });
});

/**
 * 앞선 모듈이 남기는 흔적이 하나도 빠짐없이 사전에 있는지 **기계적으로** 센다.
 *
 * 사람이 세면 빠뜨린다. 그리고 빠뜨리면 그 현상은 조용히 사라진다 —
 * 늑대의 사냥이 아무에게도 들리지 않게 되고, 아무도 그것을 이상하다 하지 않는다.
 */
describe('현상 사전이 앞선 모듈을 모두 덮는가', () => {
  const emitted = [...NATURAL_LAWS, ...SUBJECT_LAWS].flatMap((law) => law.emits);
  const book = new Map(PHENOMENON_BOOK.map((entry) => [entry.id, entry]));

  it('S1 과 U0 의 법칙이 남기는 모든 흔적이 사전에 있다', () => {
    const missing = [...new Set(emitted.map((entry) => entry.id))].filter((id) => !book.has(id)).sort();
    expect(missing, '사전에 없는 흔적').toEqual([]);
  });

  it('법칙이 선언한 모든 채널에 세기가 매겨져 있다', () => {
    const holes: string[] = [];
    for (const trace of emitted) {
      const entry = book.get(trace.id);
      if (!entry) continue;
      for (const raw of trace.channels) {
        const channel = CHANNEL_ALIASES[raw];
        if (!channel) {
          holes.push(`${trace.id}/${raw} — 옮길 이름이 없다`);
          continue;
        }
        if (entry.measurements[channel] === undefined) {
          holes.push(`${trace.id}/${channel} — 세기가 없다`);
        }
      }
    }
    expect(holes, '채널은 선언되었으나 세기가 없는 자리').toEqual([]);
  });

  it('사전의 모든 세기가 양수다 — 0 은 "안 들린다"를 조용히 만든다', () => {
    for (const entry of PHENOMENON_BOOK) {
      for (const [channel, value] of Object.entries(entry.measurements)) {
        expect(value, `${entry.id}/${channel}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('채널 이름 옮기기 (CHANNEL_ALIASES)', () => {
  it('S1 의 말씨를 원본 10장의 이름으로 옮긴다', () => {
    expect(CHANNEL_ALIASES['sight']).toBe('visual');
    expect(CHANNEL_ALIASES['sound']).toBe('audio');
  });

  it('원본 10장의 이름은 그대로 자기 자신으로 옮겨진다', () => {
    for (const channel of PERCEPTION_CHANNELS) {
      expect(CHANNEL_ALIASES[channel], channel).toBe(channel);
    }
  });

  it('옮긴 결과는 언제나 원본 10장의 여덟 갈래 안이다', () => {
    for (const value of Object.values(CHANNEL_ALIASES)) {
      expect(PERCEPTION_CHANNELS).toContain(value);
    }
  });

  it('S1 을 고치지 않았다 — 옮기는 일은 이름을 쓰는 쪽이 한다', () => {
    const source = readFileSync(
      new URL('../../../../world-state/S1-natural-state/src/laws.ts', import.meta.url),
      'utf8',
    );
    // S1 은 여전히 자기 말씨로 적혀 있다. 남의 모듈을 고치지 않았다는 것을 실물로 확인한다(원문 「23」).
    expect(source).toContain("channels: ['sight']");
  });
});
