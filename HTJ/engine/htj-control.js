// htj-control.js — HTJ 행위성(agency) 층: 외부 입력이 *지정 개체*에 명령 힘을 준다.
//
//   design/playable-world.md (PW) 마일스톤 A — "선 캐릭터를 방향키로 굴린다". CLAUDE.md §4 / 절대 원칙:
//   세계 물리는 *창발*(법칙만 author)이지만, **행위성(캐릭터의 의지)은 최상층 author** — 입력은 세계가
//   스스로 만들지 않는다. 이 파일이 그 *유일한* 통로다: 호출자가 준 (개체, 힘 벡터)를 개체 운동량에 더한다.
//
//   ⛔ 절대 원칙 준수 — engine 은 "캐릭터" 타입을 **모른다**. applyControl 은 특정 타입을 아는 분기·필터가
//   없다: 그냥 호출자가 명령한 개체에 generic 외력을 적용할 뿐(누가·왜·어느 방향인지는 *호출자=author* 의 몫).
//   "지면"·"플레이어" 같은 타입코드는 어디에도 없다.
//
//   applyControl(entities, dt, opts):
//     opts.commands = [{ i, fx, fy, fz, impulse? }]  — i=대상 개체 인덱스. 각 명령을 그 개체에 더한다:
//        · 기본(연속 힘): Δp = F·dt  (방향키를 누르는 동안 미는 힘)
//        · impulse:true : Δp = F      (한 번에 주는 충격량 — 점프·발구르기 같은 1회 입력)
//     **운동량은 *주입*된다(외력)** — 보존되지 않는 게 핵심이다: 행위성이 세계에 운동량·일을 *넣는다*
//        (근육이 에너지를 쓰듯). 그 일은 KE 로 나타난다 → KEcm·energy 재계산(internalE 불변·자기일관).
//     commands 없음/빈 배열 → early-return(세계 불변·회귀 0). 개체를 제자리 변형해 반환.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJControl = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const EPS = 1e-12;

  function applyControl(entities, dt, opts) {
    opts = opts || {};
    const cmds = opts.commands;
    if (!cmds || cmds.length === 0) return entities;          // 명령 없음 → early-return(회귀 0)
    const touched = new Set();
    for (let c = 0; c < cmds.length; c++) {
      const cmd = cmds[c];
      const i = cmd.i;
      if (i == null || i < 0 || i >= entities.length) continue;
      const e = entities[i];
      const s = cmd.impulse ? 1 : dt;                          // impulse=충격량 그대로·연속=F·dt
      e.px += (cmd.fx || 0) * s;                               // 운동량 *주입*(외력·보존 안 됨)
      e.py += (cmd.fy || 0) * s;
      e.pz += (cmd.fz || 0) * s;
      touched.add(i);
    }
    // 명령 받은 개체만 KEcm·energy 재계산(자기일관: energy=KEcm+internalE·internalE 불변).
    for (const i of touched) {
      const e = entities[i];
      if (e.internalE == null) {
        const ke = e.KEcm != null ? e.KEcm : (e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0);
        e.internalE = (e.energy != null ? e.energy : ke) - ke;
      }
      e.KEcm = e.mass > EPS ? 0.5 * (e.px * e.px + e.py * e.py + e.pz * e.pz) / e.mass : 0;
      e.energy = e.KEcm + e.internalE;
    }
    return entities;
  }

  // 접지 판정(편의 — 행위성 게이트 공유). 개체가 *앵커(지면)* 와 접촉 중인가(겹침>0)? generic — 특정
  //   지면 타입을 모르고, "겹친 앵커가 있는가"만 본다. 점프 같은 입력을 *접지일 때만* 내보내는 데 쓴다
  //   (결정은 호출자=author). 반환: 접촉한 앵커 인덱스(없으면 -1).
  function groundContact(entity, anchors, pad) {
    pad = pad != null ? pad : 0;
    for (let a = 0; a < anchors.length; a++) {
      const g = anchors[a];
      const dx = g.cx - entity.cx, dy = g.cy - entity.cy, dz = g.cz - entity.cz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if ((entity.radius + g.radius + pad) - d > 0) return a;   // 겹침 → 접지
    }
    return -1;
  }

  return { applyControl, groundContact, VERSION: 1 };
});
