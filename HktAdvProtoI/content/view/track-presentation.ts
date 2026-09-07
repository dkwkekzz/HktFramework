// Track Presentation — 땅에 남은 **자국**을 지면 표식으로 그린다 (C017 ADDED · R5 · R8).
//
// 세계가 싣는 것은 셋뿐이다: 자리 · 그 몸이 가던 방향 · 난 세계 시각 (protocol 의 TrackView).
// **누가 남겼는지도, 몇 사람이 지나갔는지도, 나이도 오지 않는다** (Play 확정 11 · spec
// Observable "싣지 않는다"). 그래서 이 표가 하는 일은 둘뿐이다.
//   ① 방향을 **모양으로** 옮긴다 — 기반에는 발자국이라는 원소가 없고 닫힌 바닥
//      하나(SceneGroundZone.polygon)가 있을 뿐이므로, 삼각형의 꼭짓점을 여기서 셈한다.
//      기반은 방향도 나이도 모른다 (spec Reuse: Engine 없음).
//   ② 나이를 **짙기로** 옮긴다 — since 와 세계 시각으로 재고 두 단계로 가른다
//      (strikes.since · rearrangedAt 이 나이를 재는 그 값과 같은 어법).
//
// **이름표를 붙이지 않는다** (C026 R4 — RULE-QUIET-GROUND-001). 자국은 글자가 아니라
// 땅의 표식이고, 갓 난 것과 오래된 것은 짙기로 갈린다 (spec R12 · Observable Result ⑥).

import type { SceneGroundZone } from '../../engine/view-kernel/scene/scene-state';
import type { TrackView } from '../protocol/gameview';

/**
 * 갓 난 것과 오래된 것을 가르는 나이 (초) — **View 의 값이다** (세계의 상수가 아니다).
 *
 * 세계는 자국을 나이로 지우지만 **그 상한을 싣지 않는다** — 오는 것은 난 시각 하나뿐이다.
 * 그래서 이 경계는 세계의 상한을 반으로 가른 값이 아니라 **관찰자가 좇을 수 있는가**로
 * 잡는다: 이 세계의 걸음은 초당 6 남짓이고 기본 방은 40×40 이므로 20 초면 방 하나를
 * 가로지르고도 남는다. 그 안의 자국이면 남긴 몸이 **아직 이 방에 있을 수 있고**, 그보다
 * 오래면 이미 떠났다고 읽는 것이 맞다 — '갓 난 것' 과 '오래된 것' 이 실제로 가르는 사실이
 * 그것이다 (Playable Goal: 자기가 없던 사이에 누가 지나갔는지를 본다).
 */
export const TRACK_FRESH_SECONDS = 20;

/** 두 단계의 이름 — 문구는 code-text 의 같은 코드가 옮긴다 (지면에는 글자가 없다) */
export type TrackStage = 'track-fresh' | 'track-old';

/**
 * 자국의 색 — **눌린 흙의 그늘** 하나다.
 *
 * 흔적(흙의 변색 · 0x6b3524)과 갈려야 한다: 그쪽은 무엇이 났는지를 말하는 붉은 사다리이고
 * 이쪽은 몸이 눌러 놓은 자리다. 그래서 색상을 버리고 어두운 무채 갈색 하나만 쓴다 —
 * 뿌리 선(0x523c26)보다 어둡고 무너진 자리(0x14100e)보다는 밝아, 셋이 한 화면에 서도
 * 서로를 잡아먹지 않는다.
 *
 * **두 단계가 이 한 색을 함께 쓴다.** 갈리는 것은 짙기뿐인데, 그 이유는 흔적 사다리와
 * 같다 (C011 의 주석): 단계마다 색을 바꾸면 어느 쪽이 갓 난 것인지가 눈에서 사라진다.
 */
export const TRACK_COLOR = 0x2e2b26;

/**
 * 단계 → 불투명도. 둘뿐이고 **갓 난 쪽이 짙다**.
 *
 * 갓 난 것(0.55)은 흔적 사다리의 가장 짙은 마디(0.42)보다 짙어 흙의 변색과 갈리고,
 * 오래된 것(0.22)은 가장 옅은 마디(0.10)보다는 짙되 갓 난 것의 절반이 되지 않아
 * 한 화면에 둘이 섰을 때 어느 쪽이 방금인지가 즉시 읽힌다.
 */
export const TRACK_OPACITIES: Readonly<Record<TrackStage, number>> = {
  'track-fresh': 0.55,
  'track-old': 0.22,
};

/**
 * 삼각형의 크기 (세계 단위) — 앞 꼭짓점까지 · 뒤 밑변까지 · 밑변의 반폭.
 *
 * 자국은 걸은 거리 4.0 마다 하나씩 나므로(세계의 표본 간격) 길이 1.6 은 이웃과 두 배
 * 넘게 벌어져 **하나하나가 따로 읽히고**, 그 줄이 어느 쪽으로 이어지는지도 보인다.
 * 지목 표식(반지름 1.5)보다 작고 몸(3.4)보다 훨씬 작아 사람을 가리지 않는다.
 *
 * 앞이 길고 뒤가 짧은 것은 **방향이 모양에서 읽혀야** 하기 때문이다 — 정삼각형이면
 * 어느 쪽이 앞인지 갈리지 않는다.
 */
export const TRACK_FORWARD = 1.0;
export const TRACK_BACK = 0.6;
export const TRACK_HALF_WIDTH = 0.5;

/**
 * 그 자국이 어느 단계인가 — 나이는 **관찰자가 잰다** (세계는 난 시각만 싣는다).
 *
 * 때를 모르는 봉투(worldTime 이 없다)에서는 나이를 잴 수 없으므로 **갓 난 쪽**으로 선다:
 * 자국이 실려 왔다는 것 자체가 세계가 아직 지우지 않았다는 뜻이고, 그 안에서 더 옅게
 * 그리면 화면이 세계가 하지 않은 "오래됐다" 를 말하게 된다 (옅게 그리는 쪽이 더 강한
 * 주장이다). 아직 오지 않은 시각(음수 나이)도 같다.
 */
export function trackStage(since: number, worldTime: number | undefined): TrackStage {
  if (worldTime === undefined || !Number.isFinite(worldTime) || !Number.isFinite(since)) {
    return 'track-fresh';
  }
  const age = worldTime - since;
  if (age < 0) return 'track-fresh';
  return age < TRACK_FRESH_SECONDS ? 'track-fresh' : 'track-old';
}

/**
 * 자국 하나의 꼭짓점 셋 — 가던 방향으로 뾰족한 삼각형.
 *
 * **방향은 여기서 모양이 된다.** 기반은 닫힌 바닥 하나를 그릴 뿐 방향을 알지 못하므로
 * (spec Reuse: Engine 없음) heading 을 단위 벡터로 되돌리고 그 수직으로 밑변을 벌린다.
 *
 * 길이가 0 인 방향은 **그리지 않는다**(undefined) — 없는 방향을 지어내지 않는다
 * (C001 부터의 폴백 규칙: 모르는 것은 자리째 없다).
 */
export function trackPolygon(track: TrackView): { x: number; z: number }[] | undefined {
  const h = track.heading;
  const length = Math.hypot(h.x, h.z);
  if (!Number.isFinite(length) || length <= 0) return undefined;
  const fx = h.x / length;
  const fz = h.z / length;
  // 수직 — 방향을 90° 돌린 것. 어느 쪽으로 도는지는 상관없다 (밑변의 두 끝이 바뀔 뿐)
  const px = -fz;
  const pz = fx;
  const { x, z } = track.at;
  // 밑변의 한가운데 — 여기서 수직으로 반폭씩 벌린 둘이 나머지 두 꼭짓점이다
  const bx = x - fx * TRACK_BACK;
  const bz = z - fz * TRACK_BACK;
  return [
    { x: x + fx * TRACK_FORWARD, z: z + fz * TRACK_FORWARD },
    { x: bx + px * TRACK_HALF_WIDTH, z: bz + pz * TRACK_HALF_WIDTH },
    { x: bx - px * TRACK_HALF_WIDTH, z: bz - pz * TRACK_HALF_WIDTH },
  ];
}

/**
 * 그 방에 남은 자국들 → 지면 표식 (spec Observable Result ⑥ · ⑦).
 *
 * 실려 온 차례 그대로 세운다 — **다시 정렬하지 않는다**. 세계가 난 순서로 싣고 있고
 * (결정론), 화면이 그 차례를 바꾸면 겹친 자국의 위아래가 세계와 달라진다.
 *
 * 목록이 비면 **아무것도 서지 않는다** — 아무도 지나가지 않은 방의 화면은 C016 과 한
 * 픽셀도 다르지 않다. 사라진 자국도 다음 봉투에 실리지 않으므로 그대로 없어진다
 * (나이로 지우는 것도 뒤척임이 묻는 것도 세계의 일이다 — R6 · R7).
 */
export function trackZones(
  tracks: readonly TrackView[] | undefined,
  worldTime: number | undefined,
): SceneGroundZone[] {
  if (!tracks || tracks.length === 0) return [];
  const zones: SceneGroundZone[] = [];
  for (const track of tracks) {
    const points = trackPolygon(track);
    if (!points) continue;
    const stage = trackStage(track.since, worldTime);
    zones.push({
      // 자국에는 id 가 없다 (세계가 싣지 않는다) — 난 시각과 자리가 그 이름이다.
      // 목록에서의 차례를 쓰지 않는 것은 앞의 것이 사라지면 뒤의 것이 전부 다른
      // 표식으로 읽히기 때문이다 (프레임 사이에 같은 자국으로 이어져야 한다)
      id: `track:${track.since.toFixed(3)}:${track.at.x.toFixed(2)},${track.at.z.toFixed(2)}`,
      shape: { kind: 'polygon', points },
      fill: { color: TRACK_COLOR, opacity: TRACK_OPACITIES[stage] },
      // 테두리도 이름표도 없다 — 한 칸 남짓한 표식에 선을 두르면 삼각형의 방향이
      // 뭉개지고, 지면에는 글자가 없다 (C026 R4 · spec R12)
    });
  }
  return zones;
}
