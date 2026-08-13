// Cycle Scope — "특정 Cycle 까지의 게임" 합성 테스트
// 합성 규칙 자체는 합성 Registry 로 검증한다 (없는 Cycle 을 실제 Registry 에 만들지 않는다).

import { describe, expect, it } from 'vitest';
import { RULE_MINE, RULE_MOVE } from '../../protocol/semantic-id';
import { CYCLE_REGISTRY, createWorld, latestCycleId, listCycles, NO_RULE } from '../index';
import type { CycleModule } from '../kernel/module';
import { resolveCycleScope, UnknownCycleError } from '../kernel/scope';

// 구조 가드용 원본 — 번들러가 읽어주므로 파일시스템 API 가 필요 없다
const cycleSources = import.meta.glob('../cycles/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const kernelSources = import.meta.glob('../kernel/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const artifactSources = import.meta.glob('../../cycles/*/01-cycle.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const dirOf = (path: string, root: string): string =>
  path.slice(path.indexOf(root) + root.length).split('/')[0] ?? '';
const moduleDirs = [...new Set(Object.keys(cycleSources).map((p) => dirOf(p, 'cycles/')))].sort();
const artifactDirs = [...new Set(Object.keys(artifactSources).map((p) => dirOf(p, 'cycles/')))].sort();

// --- 합성 규칙 확인용 가짜 Cycle 2개 -------------------------------------------------
// X001 이 세계를 만들고, X002 가 그 위에 Mine 을 더하면서 Move 를 CHANGED 로 덮는다.

const X001: CycleModule = {
  id: 'X001',
  dir: 'X001-first',
  title: '첫 Cycle — 이동만 있는 세계',
  seed: (state) => {
    (state as { steps?: string[] }).steps = [];
  },
  rules: [
    {
      actionType: 'move',
      ruleId: RULE_MOVE,
      run: (state) => {
        (state as { steps?: string[] }).steps?.push('X001-move');
        return { status: 'success', rule: RULE_MOVE };
      },
    },
  ],
  laws: [{ lawId: 'LAW-TICK', run: (state) => void (state as { steps?: string[] }).steps?.push('X001-tick') }],
  project: (state, draft) => {
    draft.scene = 'mining-field';
    (draft as { steps?: string[] }).steps = [...((state as { steps?: string[] }).steps ?? [])];
  },
};

const X002: CycleModule = {
  id: 'X002',
  dir: 'X002-second',
  title: '둘째 Cycle — Mine 추가 + Move 교체',
  rules: [
    {
      actionType: 'mine',
      ruleId: RULE_MINE,
      run: () => ({ status: 'success', rule: RULE_MINE }),
    },
    {
      // 같은 actionType 재등록 = CHANGED — 앞 Cycle 의 Move 를 덮는다
      actionType: 'move',
      ruleId: RULE_MOVE,
      run: (state) => {
        (state as { steps?: string[] }).steps?.push('X002-move');
        return { status: 'success', rule: RULE_MOVE };
      },
    },
  ],
  laws: [{ lawId: 'LAW-TICK', run: (state) => void (state as { steps?: string[] }).steps?.push('X002-tick') }],
};

const FAKE: readonly CycleModule[] = [X001, X002];
const steps = (world: ReturnType<typeof createWorld>): string[] =>
  (world.projectPlayerView() as unknown as { steps: string[] }).steps;

describe('resolveCycleScope', () => {
  it('미지정 / latest → 마지막 Cycle 까지 (현재 게임 전체)', () => {
    for (const input of [undefined, null, '', '  ', 'latest', 'LATEST']) {
      const scope = resolveCycleScope(input, FAKE);
      expect(scope.target).toBe('X002');
      expect(scope.cycles).toEqual(['X001', 'X002']);
      expect(scope.isLatest).toBe(true);
    }
  });

  it('과거 Cycle 지정 → 그 Cycle 까지만 합성한다', () => {
    const scope = resolveCycleScope('X001', FAKE);

    expect(scope.cycles).toEqual(['X001']);
    expect(scope.modules).toEqual([X001]);
    expect(scope.isLatest).toBe(false);
    expect(scope.has('X002')).toBe(false);
  });

  it('Cycle Id · 디렉터리 이름 · 대소문자를 모두 같은 Cycle 로 받는다', () => {
    for (const input of ['X001', 'x001', 'X001-first', 'x001-FIRST']) {
      expect(resolveCycleScope(input, FAKE).target).toBe('X001');
    }
  });

  it('알 수 없는 Cycle → 조용히 최신으로 넘어가지 않고 던진다', () => {
    expect(() => resolveCycleScope('C999', FAKE)).toThrow(UnknownCycleError);
    expect(() => resolveCycleScope('C999', FAKE)).toThrow(/X001, X002/);
  });
});

describe('Cycle 합성', () => {
  it('이후 Cycle 의 Rule 은 합성되지 않는다 — 처리할 Rule 이 없다', () => {
    const world = createWorld({ upToCycle: 'X001', cycleRegistry: FAKE });

    expect(world.dispatch({ type: 'mine', depositId: 'deposit-1' })).toEqual({
      status: 'failure',
      rule: NO_RULE,
      reason: 'no-rule:mine',
    });
    expect(steps(world)).toEqual([]); // 상태는 그대로
  });

  it('CHANGED — 뒤 Cycle 이 같은 Action 을 재등록하면 최신 Scope 에서는 새 Rule 이 굴러간다', () => {
    const latest = createWorld({ cycleRegistry: FAKE });
    latest.dispatch({ type: 'move', target: { x: 1, z: 0 } });
    expect(steps(latest)).toEqual(['X002-move']);
  });

  it('CHANGED — 과거 Scope 로 실행하면 그 시점의 옛 Rule 이 그대로 굴러간다', () => {
    const past = createWorld({ upToCycle: 'X001', cycleRegistry: FAKE });
    past.dispatch({ type: 'move', target: { x: 1, z: 0 } });
    expect(steps(past)).toEqual(['X001-move']); // 뒤 Cycle 이 세상에 나온 뒤에도 C001 은 C001 이다
  });

  it('같은 lawId 재등록도 덮어쓴다 — 시간 법칙이 두 번 돌지 않는다', () => {
    const latest = createWorld({ cycleRegistry: FAKE });
    latest.tick(0.1);
    expect(steps(latest)).toEqual(['X002-tick']);

    const past = createWorld({ upToCycle: 'X001', cycleRegistry: FAKE });
    past.tick(0.1);
    expect(steps(past)).toEqual(['X001-tick']);
  });

  it('Projection 도 Scope 안 모듈의 몫만 합성된다', () => {
    const past = createWorld({ upToCycle: 'X001', cycleRegistry: FAKE });
    expect(past.projectPlayerView().scene).toBe('mining-field');
    expect(past.scope.cycles).toEqual(['X001']);
  });
});

describe('실제 Cycle Registry', () => {
  it('Cycle Id 는 중복 없이 진행 순서대로이고 dir 과 짝이 맞는다', () => {
    const ids = listCycles().map((m) => m.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    for (const module of listCycles()) expect(module.dir.startsWith(`${module.id}-`)).toBe(true);
    expect(latestCycleId()).toBe(ids[ids.length - 1]);
  });

  it('등록된 Cycle 마다 world/cycles/<dir> 구현과 cycles/<dir> Artifact 가 있다', () => {
    for (const module of CYCLE_REGISTRY) {
      expect(moduleDirs).toContain(module.dir);
      expect(artifactDirs).toContain(module.dir);
    }
  });

  it('최신 Cycle 로 실행하면 현재 게임 전체가 굴러간다 (C001 Regression)', () => {
    const world = createWorld({ upToCycle: latestCycleId(), actorPosition: { x: 8, z: -5 } });

    expect(world.scope.isLatest).toBe(true);
    expect(world.dispatch({ type: 'mine', depositId: 'deposit-1' })).toEqual({
      status: 'success',
      rule: RULE_MINE,
    });
  });
});

// --- 분리가 유지되는지의 구조 가드 ---------------------------------------------------

describe('Cycle 경계', () => {
  it('앞 Cycle 은 뒤 Cycle 을 import 하지 않는다 (의존은 과거 방향으로만)', () => {
    moduleDirs.forEach((dir, index) => {
      const later = moduleDirs.slice(index + 1);
      for (const [path, source] of Object.entries(cycleSources)) {
        if (!path.includes(`/${dir}/`)) continue;
        for (const laterDir of later) {
          expect(source, `${path} 이 이후 Cycle ${laterDir} 을 참조한다`).not.toContain(laterDir);
        }
      }
    });
  });

  it('커널은 어떤 Cycle 도 알지 못한다 (게임 규칙 없는 합성 기반)', () => {
    expect(Object.keys(kernelSources).length).toBeGreaterThan(0);
    for (const [path, source] of Object.entries(kernelSources)) {
      expect(source, `${path} 이 Cycle 구현을 참조한다`).not.toMatch(/from '.*cycles\//);
    }
  });
});
