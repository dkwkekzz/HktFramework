// Motion Library — 주입된 모션 데이터의 색인과 조회 (C002)
//
// 04-gameview.spec.yaml 의 motion 계약을 구현한다.
//   selectedBy  (kind, state) 조합이 모션을 결정한다
//   fallback    [kind:idle, anyKind:state, placeholder]
//
// 어떤 모션이 존재하는지는 World 가 아니라 여기(주입된 데이터)가 안다.
// 데이터가 없으면 null 을 돌려주고, 그리기는 절차 생성 Asset(placeholder)이 맡는다.

import { parseMotionPath, type MotionAsset } from './motion-format';

export const FALLBACK_ACTION = 'idle';

export interface MotionLibrary {
  /** (종류, 행동) → 재생할 모션. 데이터가 없으면 null */
  resolve(characterKind: string, action: string): MotionAsset | null;
  /** 주입된 모션 전체 (진단·테스트용) */
  all(): MotionAsset[];
}

export function createMotionLibrary(sources: Record<string, string>): MotionLibrary {
  const assets: MotionAsset[] = [];
  for (const path of Object.keys(sources).sort()) {
    // 경로 순 정렬 — anyKind 폴백이 결정론적이도록
    const asset = parseMotionPath(path, sources[path] ?? '');
    if (asset) assets.push(asset);
  }

  const byKey = new Map<string, MotionAsset>();
  for (const asset of assets) {
    const key = `${asset.characterKind}/${asset.action}`;
    if (!byKey.has(key)) byKey.set(key, asset); // 같은 키가 둘이면 경로 순 첫 번째
  }

  return {
    resolve(characterKind, action) {
      return (
        byKey.get(`${characterKind}/${action}`) ??
        byKey.get(`${characterKind}/${FALLBACK_ACTION}`) ??
        assets.find((a) => a.action === action) ??
        null
      );
    },
    all: () => [...assets],
  };
}

export const EMPTY_MOTION_LIBRARY = createMotionLibrary({});
