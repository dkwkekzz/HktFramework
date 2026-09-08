// Presence Presentation — 그 방을 **지금 지나고 있는 것**을 화면에 세운다 (C018 ADDED · R9 · R12).
//
// 세계가 싣는 것은 둘뿐이다: 무엇이 지나는가(의미 코드)와 그것이 이 방에서 지나는 선의
// 이름(PresenceView). **시간표도 남은 시간도 다음 방도 몇 번째 지나감인지도 오지 않는다**
// (spec Observable "싣지 않는다" · Time T8). 그래서 이 표가 하는 일은 셋뿐이다.
//   ① 어느 코드가 **그늘을 드리우는가** — 하늘을 지나는 것과 땅을 지나는 것을 세계는
//      가르지 않고 코드만 싣는다. 그 갈래는 표현의 결정이다 (핵심 원칙 2).
//   ② 그늘을 **빛으로** 옮긴다 — 이미 있는 장면 원소(SceneAmbience)에서 빛을 덜어낼 뿐,
//      새 원소도 새 글자도 세우지 않는다.
//   ③ 지나는 선을 **땅의 띠로** 옮긴다 — 선은 세계가 아니라 관찰자가 자기 Description 에서
//      얻는다 (C013 의 뿌리 선을 그리는 그 방식 · 그 자리).
//
// **언제 오는지도 어디로 가는지도 그리지 않는다.** 지나고 있는 동안에만 서고 지나가면
// 없어지는 것이 화면이 말할 수 있는 전부다. 지면에는 글자도 없다 (C026 R4 —
// RULE-QUIET-GROUND-001 · spec R12: 그늘도 경로 선도 땅의 것이지 글자가 아니다).

import {
  areasOf,
  curvesOf,
  polylineStrip,
} from '../../engine/world-authoring/description';
import type { SceneAmbience, SceneGroundZone } from '../../engine/view-kernel/scene/scene-state';
import type { PresenceView } from '../protocol/gameview';
import { PRESENCE_LAYER, regionSpec } from '../regions/index';
import { CLOCK_AMBIENCES } from './terrain-presentation';

// ── 그늘 (spec Observable Result ①) ──────────────────────────────────

/**
 * **그늘을 드리우는 것들** — 코드의 표다 (세계는 이것을 싣지 않는다).
 *
 * 세계가 말하는 것은 "무엇이 여기를 지난다" 하나뿐이고, 그것이 하늘을 지나는지 땅을
 * 지나는지조차 코드에 없다 (Concept §9 는 산맥보다 거대한 것이 대륙 **위**를 지난다고
 * 하고, §11 의 것은 땅을 달린다). 그 갈래는 이 세계를 아는 표현이 정한다 (원칙 2).
 *
 * **표에 없는 코드는 그늘을 드리우지 않는다** — 모르는 것이 왔다고 화면을 어둡게 하면
 * 세계가 하지 않은 말을 하는 것이 된다 (C001 부터의 폴백 규칙).
 */
export const SHADING_PRESENCES: ReadonlySet<string> = new Set(['sky-whale']);

/**
 * 그늘이 빛에서 덜어내는 몫 — 남는 비율이다.
 *
 * 0.6 은 "덮였다" 가 한눈에 읽히면서(고요의 한낮 sun 1.1 → 0.66 · ambient 0.95 → 0.57)
 * 땅의 색이 그대로 읽히는 값이다. **하늘빛의 색상은 건드리지 않는다** — 색을 바꾸면
 * 화면이 철이 바뀐 것처럼 읽히는데, 그늘은 때가 아니라 그 위를 지나는 것이다.
 */
export const PRESENCE_SHADE_SCALE = 0.6;

/**
 * 그늘이 넘지 못하는 **바닥** — 이 세계에서 가장 어두운 때(긴 밤의 밤)의 값 그대로다.
 *
 * 밤의 어두움(C015)과 겹쳐도 화면이 검게 죽지 않아야 한다. 그것을 임의의 최소값으로
 * 막지 않고 **세계가 이미 그리고 있는 가장 어두운 화면**으로 막는 이유는 하나다:
 * 그 화면은 C015 가 이미 내보냈고 그 안에서 땅도 몸도 읽힌다는 것이 확인된 값이다.
 * 그러므로 "그늘이 아무리 겹쳐도 긴 밤의 밤보다 어두워지지 않는다" 가 곧
 * "검게 죽지 않는다" 의 보증이 된다.
 *
 * 그 결과 긴 밤에는 그늘이 한 값도 덜어내지 못한다 — 세계가 이미 가장 어두운 때에는
 * 더 덜어 갈 빛이 없다는 뜻이고, 이것은 지어낸 예외가 아니라 위 규율의 당연한 귀결이다.
 */
export const PRESENCE_SHADE_FLOOR: SceneAmbience = CLOCK_AMBIENCES['LONG_NIGHT:NIGHT'];

/** 색 하나를 비율만큼 덜어내되 바닥 색의 각 성분 아래로는 내려가지 않는다 */
function darken(color: number, floor: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const c = (color >> shift) & 0xff;
    const f = (floor >> shift) & 0xff;
    out |= Math.max(f, Math.round(c * PRESENCE_SHADE_SCALE)) << shift;
  }
  return out >>> 0;
}

/** 빛의 세기 하나 — 같은 규율이다 (바닥 아래로 내려가지 않는다) */
function dim(intensity: number, floor: number): number {
  return Math.max(floor, intensity * PRESENCE_SHADE_SCALE);
}

/**
 * 지나는 것이 드리우는 그늘 → **이미 있는 분위기에서 빛을 덜어낸 분위기** (spec Observable
 * Result ①).
 *
 * 새 장면 원소를 세우지 않는다 — 그늘은 SceneAmbience 하나로 서고, 그래서 밤의 어두움과
 * 겹치는 자리가 **한 자리**다 (두 자리에서 각각 어둡게 하면 어느 쪽이 얼마나 어둡게
 * 했는지 아무도 모른다).
 *
 * 때를 모르는 봉투(분위기가 없는 화면)에서는 **그늘도 없다** — 없는 빛에서 빛을 덜어낼
 * 수 없고, 여기서 분위기를 지어내면 화면이 세계에 없는 때를 그리게 된다.
 *
 * 그늘을 드리우는 것이 **여럿이어도 한 번만** 어두워진다 — 세계는 그림자가 얼마나 큰지도
 * 몇 겹인지도 싣지 않으므로, 화면이 셈해서 더 어둡게 하면 그것이 지어낸 사실이다.
 */
export function shadedAmbience(
  base: SceneAmbience | undefined,
  presences: readonly PresenceView[] | undefined,
): SceneAmbience | undefined {
  if (!base) return undefined;
  if (!presences || !presences.some((p) => SHADING_PRESENCES.has(p.presence))) return base;
  const floor = PRESENCE_SHADE_FLOOR;
  return {
    background: darken(base.background, floor.background),
    ambient: {
      // 빛의 색은 그대로다 — 그늘은 빛을 덜어낼 뿐 다른 빛으로 갈아 끼우지 않는다
      color: base.ambient.color,
      intensity: dim(base.ambient.intensity, floor.ambient.intensity),
    },
    sun: {
      color: base.sun.color,
      intensity: dim(base.sun.intensity, floor.sun.intensity),
    },
  };
}

// ── 경로 선 (spec Observable Result ③) ───────────────────────────────
//
// 세계가 싣는 것은 **선의 이름**뿐이다. 그 선이 어디를 어떻게 지나는지는 관찰자가 자기
// Description 의 presence layer 에서 그 tag 의 곡선을 찾아 얻는다 — 땅 · 흔적 · 붕괴 ·
// 뿌리 선과 **같은 규율**이다 (C005~C013).
//
// **뿌리 선과 갈려야 한다** (STATE 의 열린 부채: 뿌리 선이 흔적 구역과 가깝다). 같은
// layer 에 눕는 두 띠이므로 갈리는 축을 셋 둔다.
//   색    뿌리는 흙 위에 드러난 나무빛(0x523c26)이고, 이쪽은 그 위를 지나는 것의 자락이라
//         차갑고 옅은 무채-청색이다. 따뜻함/차가움으로 먼저 갈린다
//   짙기  뿌리(0.5)보다 옅다(0.34) — 뿌리는 땅에 박힌 것이고 이것은 스쳐 지나는 것이다
//   굵기  데이터가 폭을 밝히지 않았을 때 뿌리(0.6)보다 훨씬 넓다(1.8) — 실 같은 뿌리와
//         넓게 쓸고 가는 자락
// 굵기는 데이터가 밝히면 그 값이 이긴다(세계의 사실이다). 그때도 색과 짙기는 그대로
// 갈리므로, 두 선이 같은 폭이어도 서로를 잡아먹지 않는다.

/**
 * 경로 선의 색 — **차갑고 옅은 무채-청색**.
 *
 * 이 세계의 지면 색들(초록 · 갈색 · 무채색 · 청록)과 뿌리(따뜻한 갈색) · 흔적(붉은 사다리) ·
 * 자국(어두운 무채 갈색) · 무너진 자리(거의 검정)는 전부 어둡거나 따뜻하다. 밝고 차가운
 * 쪽은 지목 표식의 흰색 하나뿐인데 그것은 점이고 이것은 띠이므로 서로 가려지지 않는다.
 */
export const PRESENCE_LINE_COLOR = 0x8fa0b8;

/** 짙기 — 뿌리 선(0.5)보다 옅다. 스쳐 지나는 것이지 땅에 박힌 것이 아니다 */
export const PRESENCE_LINE_OPACITY = 0.34;

/**
 * 곡선이 폭을 밝히지 않았을 때 눕히는 띠의 폭 (뿌리 선의 ROOT_LINE_WIDTH 와 같은 자리).
 *
 * 데이터의 width 가 세계의 사실이고, 그것이 없을 때 얼마나 넓게 그릴지는 표현의 결정이다.
 * 1.8 은 방(40×40)에서 "무엇이 이만큼을 쓸고 간다" 로 읽히면서 그 위에 선 몸(3.4)을
 * 덮지 않는 값이다.
 */
export const PRESENCE_LINE_WIDTH = 1.8;

/**
 * 지금 지나는 것들의 선 → 지면의 띠 (spec Observable Result ③).
 *
 * **지나가고 있지 않으면 하나도 서지 않는다** — 목록이 비면 화면은 C017 과 한 픽셀도
 * 다르지 않다. 모르는 선 이름(내 Description 에 없는 tag)도 마찬가지로 그려지지 않는다:
 * 없는 선을 지어내지 않는다 (C001 부터의 폴백 규칙).
 *
 * 맥동(intensity)을 걸지 않는다 — "지금 작용 중" 은 이미 **서 있다는 것 자체**가 말한다
 * (지나가면 사라진다). 맥동까지 걸면 땅이 화면에서 가장 시끄러운 것이 된다.
 */
export function presenceLineZones(
  regionId: string,
  presences: readonly PresenceView[] | undefined,
): SceneGroundZone[] {
  if (!presences || presences.length === 0) return [];
  const spec = regionSpec(regionId);
  // 모르는 방이면 선도 없다 — 게임은 그대로 돌고 그 띠만 서지 않는다
  if (!spec) return [];
  const zones: SceneGroundZone[] = [];
  for (const presence of presences) {
    // **선이 없는 줄은 조용히 지나간다** (C023 CHANGED) — 같은 자리에 서 있는 떼가 실리기
    // 시작했고 그것은 선이 아니라 자락이다 (아래 presenceAreaZones 가 그 줄을 진다).
    // 여기서 그 줄에 걸려 깨지면 지나는 것의 선까지 함께 사라진다
    if (presence.curve === undefined) continue;
    for (const curve of curvesOf(spec.space, PRESENCE_LAYER, presence.curve)) {
      const points = polylineStrip(
        curve.points,
        curve.width > 0 ? curve.width : PRESENCE_LINE_WIDTH,
      );
      // 부풀릴 것이 없는 곡선(점 하나)은 그리지 않는다 (뿌리 선과 같은 규율)
      if (points.length < 3) continue;
      zones.push({
        // 무엇이 어느 선을 지나는가가 그 띠의 이름이다 — 둘이 같은 선을 지나도 각각의
        // 띠로 이어진다 (목록에서의 차례를 쓰지 않는 것은 앞의 것이 사라지면 뒤의 것이
        // 전부 다른 띠로 읽히기 때문이다)
        id: `presence:${regionId}:${presence.presence}:${curve.id}`,
        shape: { kind: 'polygon', points },
        fill: { color: PRESENCE_LINE_COLOR, opacity: PRESENCE_LINE_OPACITY },
        // 테두리도 이름표도 없다 — 뿌리 선과 같다. 사람이 그은 선이 아니고,
        // 지면에는 글자가 없다 (C026 R4 · spec R12)
      });
    }
  }
  return zones;
}

// ── 서 있는 떼의 자락 (C023 ADDED · SPEC-006) ────────────────────────
//
// 지나는 것이 **선**으로 실리는 그 자리에 서 있는 떼가 **자락**으로 실린다 (봉투에 새
// 자리가 나지 않고 PresenceView 에 항목 하나가 늘 뿐이다). 그리는 규율은 경로 선의 것
// 그대로다 — 세계가 싣는 것은 자락의 **이름**뿐이고, 그것이 어디를 얼마나 덮는지는
// 관찰자가 자기 Description 의 presence layer 에서 그 op 를 찾아 얻는다.
//
// **화면이 값을 세지 않는다.** 개체군이 몇인지는 어디에도 실리지 않으므로(spec SPEC-005
// 경계 ①) 여기서 셈해 넓히거나 짙게 하는 일이 없다 — **실려 온 줄의 수만큼 그릴 뿐**이고,
// 값이 오를수록 자락이 여럿 겹쳐 저절로 넓고 짙어 보인다. 그것이 관찰자가 "늘었다" 를
// 읽는 유일한 길이다 (수도 상한도 다음 탄생도 화면에 없다).
//
// **경로 선과 갈려야 한다** — 같은 layer 에 눕는 두 그림이므로 갈리는 축 셋을 둔다.
//   색    선은 차갑고 옅은 무채-청색(스쳐 지나는 것)이고, 이쪽은 이 세계의 붉은 계통이다 —
//         살아 있는 것이 이 방에 눌러앉은 자락이므로 흙과 알집이 쓰는 그 색 계열로 눕힌다
//   모양  선은 방을 가로지르는 좁고 긴 띠이고, 자락은 데이터가 준 넓은 면이다
//   짙기  하나로는 아주 옅다(0.12) — **겹쳐야 짙어진다.** 한 자락이 이미 짙으면 하나와
//         넷이 눈에서 갈리지 않고, 그러면 "넓어졌다" 를 읽을 수 없다
//
// 이름표도 테두리도 없다 (C026 R4 — RULE-QUIET-GROUND-001). 무엇이 여기 사는지는 물었을
// 때 판이 답하고, 몇인지는 물어도 답하지 않는다 (세계가 싣지 않는다).

/**
 * 떼의 자락 색 — 붉은 흙(TRACE_SOIL_COLOR 0x6b3524)보다 밝고 알집의 결정(C 0xf2684a)보다
 * 어둡다. 흔적 위에 겹쳐도 흔적의 사다리를 흉내 내지 않고, 그 위에 선 몸도 덮지 않는다.
 */
export const PRESENCE_AREA_COLOR = 0xb4553a;

/**
 * 하나의 자락이 지니는 짙기 — **겹치라고 옅다.** 넷이 다 겹친 자리도 0.45 를 넘지 않아
 * 그 위에 선 것(원천 · 탄생지 · 몸)을 덮지 않는다.
 */
export const PRESENCE_AREA_OPACITY = 0.12;

/**
 * 지금 이 방에 **서 있는** 떼들의 자락 → 지면의 면 (spec SPEC-006).
 *
 * 아무것도 서 있지 않으면 하나도 그리지 않는다 — 목록이 비면 화면은 C022 와 한 픽셀도
 * 다르지 않다. 내 Description 에 없는 이름도 마찬가지다 (없는 자락을 지어내지 않는다).
 *
 * **선을 실은 줄은 여기서 지나간다** — 그 줄은 presenceLineZones 의 것이고, 한 줄이
 * 두 그림으로 서면 같은 사실이 두 자리에 그려진다.
 */
export function presenceAreaZones(
  regionId: string,
  presences: readonly PresenceView[] | undefined,
): SceneGroundZone[] {
  if (!presences || presences.length === 0) return [];
  const spec = regionSpec(regionId);
  // 모르는 방이면 자락도 없다 — 게임은 그대로 돌고 그 면만 서지 않는다
  if (!spec) return [];
  const zones: SceneGroundZone[] = [];
  for (const presence of presences) {
    const areaId = presence.area;
    if (areaId === undefined) continue;
    for (const area of areasOf(spec.space, PRESENCE_LAYER)) {
      if (area.id !== areaId) continue;
      zones.push({
        // 무엇이 어느 자락에 서는가가 그 면의 이름이다 — 같은 것의 자락이 여럿이어도
        // 자락마다 이름이 갈리므로 하나가 걷히면 그 면만 사라진다 (경로 선과 같은 어법)
        id: `swarm:${regionId}:${presence.presence}:${area.id}`,
        shape: area.shape,
        fill: { color: PRESENCE_AREA_COLOR, opacity: PRESENCE_AREA_OPACITY },
        // 테두리도 이름표도 없다 — 사람이 그은 구역이 아니라 무엇이 도는 자리다
      });
    }
  }
  return zones;
}
