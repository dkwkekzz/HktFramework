// View 엔진 경계 — View 는 Cycle 도, 특정 게임 의미도 알지 못한다.
//
// "명세대로 그리는 엔진" 이 시간이 지나도 유지되는지 코드 자체로 검사한다.
// 에셋 등록(assets/registry.ts)은 예외다 — 역할→그림 매핑은 엔진 로직이 아니라 자료다.

import { describe, expect, it } from 'vitest';

const engineSources = import.meta.glob('../**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ENGINE = Object.entries(engineSources).filter(
  ([path]) => !path.endsWith('.spec.ts') && !path.includes('/assets/'),
);

// 특정 Cycle 의 존재·상호작용·사유 이름 — 엔진 코드에 있으면 그 Cycle 에 묶인 것이다
const CYCLE_WORDS = [
  'deposit',
  'stone',
  'pickaxe',
  'mining',
  'mine-',
  '광맥',
  '채굴',
  '곡괭이',
  'out-of-range',
  'C001',
];

describe('View 엔진 경계', () => {
  it('검사 대상 파일이 실제로 존재한다', () => {
    expect(ENGINE.length).toBeGreaterThan(4);
  });

  it('엔진 코드에 특정 Cycle 의 게임 의미 이름이 없다', () => {
    for (const [path, source] of ENGINE) {
      // 주석 줄은 설명이므로 제외하고 실제 코드만 본다
      const code = source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n')
        .toLowerCase();
      for (const word of CYCLE_WORDS) {
        expect(code, `${path} 에 Cycle 종속 이름 "${word}" 이 있다`).not.toContain(word);
      }
    }
  });

  it('View 는 world/ 를 참조하지 않는다', () => {
    for (const [path, source] of Object.entries(engineSources)) {
      expect(source, `${path} 이 world 를 참조한다`).not.toMatch(/from '.*\/world\//);
    }
  });
});
