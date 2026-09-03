// 키가 지금 뜻하는 interaction 고르기 (범용 기구).
//
// 한 키에 여럿이 걸릴 수 있다 — 한 자리에 대상이 여럿이면 그 수만큼 같은 키가 실린다.
// 그때 "이 키가 지금 무엇을 뜻하는가" 를 정하는 것은 **몸과 대상 사이의 거리**다:
// 눈앞의 것이 그 키의 뜻이다. 이 층은 그것이 문인지 광맥인지 모르고 자리만 잰다
// (design/Design-System-Content-Separation.md 반전 ⑤).
//
// 고르는 자리가 둘이라 여기 함께 둔다 — 조립이 **보내는** 것과 HUD 가 **말하는** 것이
// 어긋나면, 화면이 가리킨 것과 키가 한 일이 달라진다.

import type { SceneInteraction, SceneState } from './scene-state';

/** 관찰자 자신의 몸 — 카메라가 따르는 것이 자기 몸이다 */
export function selfPosition(scene: SceneState): { x: number; z: number } | undefined {
  return scene.entities.find((entity) => entity.cameraFollow)?.position;
}

/**
 * 대상까지의 거리. 대상이 없는 것(늘 쓸 수 있는 재주)은 자리와 무관하므로 잴 수 없다 —
 * 무한대로 두어 자리가 있는 것들 뒤에 선다.
 */
export function targetDistance(scene: SceneState, interaction: SceneInteraction): number {
  const me = selfPosition(scene);
  const target = interaction.targetEntityId
    ? scene.entities.find((entity) => entity.id === interaction.targetEntityId)
    : undefined;
  if (!me || !target) return Number.POSITIVE_INFINITY;
  return Math.hypot(target.position.x - me.x, target.position.z - me.z);
}

// 가까운 것부터. 같은 거리면 실려 온 순서 그대로다 (결정론 — 세계가 정한 순서를 뒤집지 않는다).
function nearestFirst(scene: SceneState, list: readonly SceneInteraction[]): SceneInteraction[] {
  return list
    .map((interaction, order) => ({ interaction, order, at: targetDistance(scene, interaction) }))
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .map((entry) => entry.interaction);
}

/**
 * 이 키가 지금 뜻하는 하나 — 가용한 것이 먼저, 그 다음은 몸에 가까운 대상이다.
 *
 * 실려 온 첫 번째를 고르면 **눈앞의 것이 아닌 것**에 요청이 간다: 출구 다섯인 방에서
 * 닫힌 문 앞에 서서 눌러도 목록 맨 앞의 먼 출구로 가고, 돌아오는 대답은 "잠겼다" 가
 * 아니라 "멀다" 다. 자리가 뜻을 정해야 한다.
 */
export function chooseByKey(scene: SceneState, code: string): SceneInteraction | undefined {
  const keyed = scene.interactions.filter((interaction) => interaction.key === code);
  const available = keyed.filter((interaction) => interaction.available);
  return nearestFirst(scene, available)[0] ?? nearestFirst(scene, keyed)[0];
}

/**
 * 프롬프트 한 줄이 말할 것 — **자리의 일이 재주보다 먼저다.**
 *
 * 대상이 있는 것(지금 여기 이것)과 없는 것(늘 쓸 수 있는 재주)을 같은 줄에서 다투게
 * 두면, 언제나 가용인 재주가 늘 이겨 한 줄을 독차지한다. 그러면 눈앞에 무엇이 있는지를
 * 화면이 한 번도 말하지 못한다.
 */
export function choosePrompt(scene: SceneState): SceneInteraction | undefined {
  const keyed = scene.interactions.filter((interaction) => interaction.key);
  const targeted = keyed.filter((interaction) => interaction.targetEntityId);
  const plain = keyed.filter((interaction) => !interaction.targetEntityId);
  const say = (list: readonly SceneInteraction[]) => list.filter((i) => i.unavailableText);
  return (
    nearestFirst(scene, targeted.filter((i) => i.available))[0] ??
    plain.find((i) => i.available) ??
    nearestFirst(scene, say(targeted))[0] ??
    say(plain)[0]
  );
}
