// RULE-WORLD-GENESIS-001 (C-TERRAIN-003 ADDED) — 세계가 만들어질 때 한 번, 첫 Tick 이전.
//
// Implements  INTENT-ENERGY-COMES-FIRST-001 · INTENT-PLACES-ARE-DERIVED-001 ·
//             INTENT-THE-PAST-IS-COMPUTED-001 · INTENT-SAME-SEED-SAME-WORLD-001 ·
//             INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001
//
// 자리보다 먼저 에너지의 분포가 선다 — 씨앗에서 결정론적으로 이어지는 표본열 하나가
// 그 분포이고, 이후의 모든 선택이 이 열에서만 나온다. 입력은 넷뿐이다
// (씨앗 · 법칙의 정의 · 무대 경계 · 조용한 자리들) — 다른 입력이 없으므로
// 같은 씨앗은 같은 세계다.
//
// 이 규칙이 세운 목록을 이후 바꾸는 규칙은 없다 — C-TERRAIN-001 의 "놓이고 그대로다"
// 에서 **그대로다**(런타임 불변)는 유지되고, "놓이고" 가 "태어나고" 로 바뀌었다.
// 돌기 시작한 뒤의 시간(RULE-GROUND-LAW-APPLY-001 · RULE-GROUND-VENT-001)은
// 한 줄도 바뀌지 않는다 (INTENT-BIRTH-DOES-NOT-CHANGE-THE-TURNING-001).

import { chanceAt } from '../semantic/combat';
import { distance, type WorldBounds, type WorldPosition } from '../semantic/position';
import { GROUND_LAWS, type GroundZone } from '../semantic/terrain';

/**
 * 결속이 닿지 않는 자리 하나 — QUIET_GROUND 의 항목.
 *
 * 의미의 방향에 주의한다 (03 RATIONALE 4): 맥이 이들을 "피해 주는" 것이 아니라,
 * **이들이 선 자리가 법칙이 조용한 자리다** (BT §3 — 정착과 자원은 법칙이 안정되는
 * 지점에 있다). 목록의 실물은 조립(index.ts)이 실제 배치에서 계산한다 —
 * 붙박이의 자리를 두 번 적지 않기 위해서다.
 */
export interface QuietSpot {
  center: WorldPosition;
  radius: number;
}

/** 몸 하나가 서는 자리의 여유 — 시작 자리·순회 끝점이 맥의 가장자리에 물리지 않게 한다 */
export const QUIET_BODY_RADIUS = 1.5;

// 이웃 맥이 뻗는 네 방향 — 맥은 흩어진 점이 아니라 이어진 밭이다 (대륙 규모의 결속 · BT §1)
const CARDINALS: readonly WorldPosition[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

// 법칙 하나가 맥을 세우는 유한 시도 — 다 쓰면 그 법칙의 맥은 그만큼만 선다
// (03 Transition ②). 결정론 값이므로 헤더 상수로 고정한다.
const GENESIS_ATTEMPTS_PER_LAW = 256;

/**
 * 태어난 자리들 — World.GroundZones 의 유일한 원천.
 *
 * 법칙마다 (GROUND_LAWS 순서로):
 *   ① 분포가 먼저 선다 — 씨앗의 표본열
 *   ② 맥이 뻗는다 — 첫 중심은 경계 안(범위만큼 안쪽), 다음 중심들은 이미 선 맥의
 *      이웃 자리. QUIET_GROUND 를 품게 되는 후보는 버린다
 *   ③ 과거가 계산된다 — kept 를 표본하고, 가장 찬 맥 하나가 saturation 까지 차서
 *      뿜으며 태어난다 (오늘의 해숨구멍 — BT §5.3: 포화가 해숨구멍의 원인이다)
 */
export function bornGroundZones(
  genesisSeed: number,
  bounds: WorldBounds,
  quiet: readonly QuietSpot[],
): GroundZone[] {
  let cursor = 0;
  const next = () => chanceAt(genesisSeed, cursor++);

  const zones: GroundZone[] = [];

  for (const law of Object.values(GROUND_LAWS)) {
    const placed: GroundZone[] = [];
    const inset = law.veinRadius;
    const spanX = bounds.maxX - bounds.minX - inset * 2;
    const spanZ = bounds.maxZ - bounds.minZ - inset * 2;

    let attempts = 0;
    while (placed.length < law.veins && attempts < GENESIS_ATTEMPTS_PER_LAW) {
      attempts += 1;

      let center: WorldPosition;
      if (placed.length === 0) {
        // 첫 맥 — 결속이 짙은 자리가 어디인가를 분포가 정한다
        center = {
          x: bounds.minX + inset + next() * spanX,
          z: bounds.minZ + inset + next() * spanZ,
        };
      } else {
        // 다음 맥 — 이미 선 맥의 이웃으로 뻗는다.
        // 표본은 [0,1) 이므로 아래 색인은 언제나 범위 안이다 — ?? 는 형 검사를 위한
        // 도달 불가 가지다 (표본을 소비하지 않는다).
        const anchorZone = placed[Math.floor(next() * placed.length)] ?? placed[0];
        const dir = CARDINALS[Math.floor(next() * CARDINALS.length)] ?? CARDINALS[0];
        if (anchorZone === undefined || dir === undefined) continue;
        const anchor = anchorZone.center;
        center = { x: anchor.x + dir.x * law.veinStride, z: anchor.z + dir.z * law.veinStride };
      }

      // 경계 밖 — 버린다 (맥의 범위가 무대를 벗어나지 않는다)
      if (
        center.x < bounds.minX + inset || center.x > bounds.maxX - inset ||
        center.z < bounds.minZ + inset || center.z > bounds.maxZ - inset
      ) {
        continue;
      }
      // 조용한 자리를 품는다 — 버린다 (INTENT-THE-STAGE-IS-NOT-ALL-VEIN-001)
      if (quiet.some((q) => distance(center, q.center) <= law.veinRadius + q.radius)) continue;
      // 이미 선 맥과 같은 자리 — 버린다 (두 맥이 포개지는 것은 하나가 둘로 세어지는 일이다)
      if (placed.some((z) => distance(center, z.center) < 1e-6)) continue;

      placed.push({
        id: `zone-${law.id}-${placed.length + 1}`,
        law: law.id,
        center,
        radius: law.veinRadius,
        kept: 0,
        phase: 'binding',
      });
    }

    // ③ 과거가 계산된다 — 수천 년의 결속을 손 대신 표본이 요약한다 (03 RATIONALE 2).
    //    표본이 씨앗과 법칙에서만 나오므로 "다른 입력이 없다" 는 그대로 성립한다.
    for (const zone of placed) zone.kept = next() * law.saturation;

    // 가장 찬 맥이 오늘의 해숨구멍이다 — 수천 년 돈 세계에 뿜는 맥이 하나도 없는 것은
    // 순환이 멎어 있었다는 뜻이 된다 (03 RATIONALE 3). 같으면 앞선 것 — 순서가 결정론을
    // 소유한다 (bindingZonesAt 과 같은 규율).
    const first = placed[0];
    if (first !== undefined) {
      let fullest = first;
      for (const zone of placed) if (zone.kept > fullest.kept) fullest = zone;
      fullest.kept = law.saturation;
      fullest.phase = 'venting';
    }

    zones.push(...placed);
  }

  return zones;
}
