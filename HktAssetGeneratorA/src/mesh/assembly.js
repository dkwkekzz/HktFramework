// 소켓 조립 (04-phase2 §2.5, 원본 §11).
// MVP: 직선검 — 소켓은 회전 없는 평행이동 Transform ({position}) 만.
// (회전이 필요해지면 Transform 에 quaternion 을 추가 — API 형태는 유지)

import { add3, sub3 } from "../core/math.js";

/**
 * 부모 체인으로 자식 배치: T_child = T_parent + parentSocketLocal - childSocketLocal.
 */
export function alignSocket(parentTransform, parentSocketLocal, childSocketLocal) {
  return add3(parentTransform, sub3(parentSocketLocal, childSocketLocal));
}

/**
 * @param parts {{ blade, guard, grip, pommel }} — 각 { mesh, sockets: {name: [x,y,z]} }
 * @returns {{ name, partId, mesh, transform:[x,y,z] }[]} — blade 기준(identity)
 */
export function assembleSword(parts) {
  const bladeT = [0, 0, 0];
  const guardT = alignSocket(bladeT, parts.blade.sockets.guardSocket, parts.guard.sockets.bladeSocket);
  const gripT = alignSocket(guardT, parts.guard.sockets.gripSocket, parts.grip.sockets.guardSocket);
  const pommelT = alignSocket(gripT, parts.grip.sockets.pommelSocket, parts.pommel.sockets.gripSocket);
  return [
    { name: "Blade", partId: 0, mesh: parts.blade.mesh, transform: bladeT },
    { name: "Guard", partId: 1, mesh: parts.guard.mesh, transform: guardT },
    { name: "Grip", partId: 2, mesh: parts.grip.mesh, transform: gripT },
    { name: "Pommel", partId: 3, mesh: parts.pommel.mesh, transform: pommelT },
  ];
}
