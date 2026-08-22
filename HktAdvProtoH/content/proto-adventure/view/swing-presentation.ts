// Swing Presentation — 휘두름의 끝점을 **평시 화면에** 어떻게 그릴지 결정한다
// (C024, 결정 Layer 데이터).
//
// 지금까지 칼끝은 실려 오기만 하고 그려지지 않았다. 충돌체 관찰(C)을 켜야만 보였고,
// 그럴 만했다 — **모든 기술이 같은 궤적이라 그릴 값어치가 없었기 때문이다.**
// C024 이 그것을 바꿨다. 기술마다 다른 모양이 닿는 것을 가르므로, 칼끝이 어디를
// 지났는지가 보이지 않으면 "왜 저 사람은 맞고 이 사람은 안 맞았는가" 가 화면에
// 존재하지 않는다 (04 VIEW NOTE ①).
//
// **그리는 것은 세계가 보낸 원이다.** `swing.center` 에 `swing.radius` 로 그린다.
// profile 의 각·길이로 부채꼴을 계산하지 않는다 — 그 부채꼴은 세계가 실제로 판정한
// 원의 궤적과 미세하게 어긋나고, 그러면 "닿을 것처럼 보였는데 안 맞았다" 가
// 화면의 거짓말이 된다 (04 entities.character.swing 의 판단).
//
// 그리는 능력은 엔진의 것이다 (SceneColliderDebug 의 구체). 이 파일이 정하는 것은
// **무엇을 언제 어떤 색으로** 그릴지뿐이다.

import type {
  SceneColliderDebug,
  SceneDebugSphere,
} from '../../../engine/view-kernel/scene/scene-state';
import type { GameViewSnapshot } from '../protocol/gameview';

// 활성 칼끝 — 지금 닿으면 맞는다. 평시 화면이므로 디버그보다 옅게 둔다:
// 이것은 진단 표시가 아니라 **장면의 일부**다.
const ACTIVE_COLOR = 0xff6b4a;
const ACTIVE_OPACITY = 0.5;
// 예비/여운 자세 — 아직 나가지 않았거나 이미 거두는 중이다. 더 옅다.
// 선딜 동안 이 자리가 보이는 것이 곧 "칼이 어디서부터 돌 것인가" 의 예고다 (C019 와 나란하다).
const IDLE_COLOR = 0xf0c33c;
const IDLE_OPACITY = 0.14;
// 칼끝이 도는 높이 = 그 몸 키의 비율 (허리~가슴께). 디버그 표현과 같은 자리에 둔다 —
// 같은 것을 두 높이로 그리면 켜고 끌 때 물체가 뛴다.
const ELEVATION_RATIO = 0.55;
const FALLBACK_HEIGHT = 1.7;

/**
 * 평시 화면의 칼끝 — 몸 캡슐도 속도 화살표도 맞은 몸 표시도 담지 않는다.
 *
 * 그 셋은 진단이며 충돌체 관찰(C)이 소유한다. 여기 담는 것은 이 Cycle 이
 * 플레이에 필요로 하는 하나뿐이다: **칼끝이 지금 어디를 지나는가.**
 */
export function swingTrail(snapshot: GameViewSnapshot): SceneColliderDebug {
  const spheres: SceneDebugSphere[] = [];

  for (const entity of snapshot.entities) {
    const swing = entity.swing;
    if (!swing) continue;
    spheres.push({
      id: `swing:${entity.id}`,
      center: swing.center,
      // 세계가 보낸 굵기 그대로다 — 이제 기술마다 다르다 (04 delta.changed)
      radius: swing.radius,
      elevation: (entity.body?.height ?? FALLBACK_HEIGHT) * ELEVATION_RATIO,
      color: swing.active ? ACTIVE_COLOR : IDLE_COLOR,
      opacity: swing.active ? ACTIVE_OPACITY : IDLE_OPACITY,
    });
  }

  return { capsules: [], spheres, vectors: [] };
}
