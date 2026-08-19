// viewer/scenes/step_0119.js — (RG1) 강체 분자 골격: 합쳐진 *분자 하나*가 DNA 구조를 충돌 껍질로 쓴다.
//   design/rigid-ground.md §4·§5 RG1. 수박게임 합치기(0036/0061)로 뭉친 원소는 *분자처럼 고정된 내부 구조*를
//   가지며(shapeHash) 끝까지 *한 엔티티(강체)* 로 움직인다 — 절대 안 쪼갠다. 그 DNA 구조를 body-frame 충돌
//   껍질로 읽어(reconstructShape·0063), 캐릭터가 닿으면 접촉 반작용을 *분자 하나에 합력+토크*로 합산한다
//   (applyShellContact). 접촉점 equal-opposite → Σp·ΣL 정확 보존(고정/핀 0 = 진짜 자유 강체). off-center 타격은
//   강체 회전(θ·B안 게이트)을 부른다. 무게가 곧 부동성(무거운 분자는 거의 안 움직이되 *free*). top-down(중력 0).
//   UMD(브라우저·Node).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require);
  else { root.HTJScenes = root.HTJScenes || {}; root.HTJScenes['0119'] = factory(null); }
})(typeof self !== 'undefined' ? self : this, function (require) {
  const En = require ? require('../../engine/htj-entity.js') : self.HTJEntity;
  const DNA = require ? require('../../engine/htj-shapedna.js') : self.HTJShapeDNA;

  const N = 48, DT = 0.05, CX = 24, CY = 24;                    // 분자 중심(화면 중앙)
  const COPT = { k: 60, cDamp: 8 };

  // 분자 하나 + 그 DNA 구조에서 body-frame 충돌 껍질(안 쪼갬·껍질은 분자 표면 오프셋).
  function build(w) {
    const dict = {};
    const members = [{ cx: 0, cy: 0, cz: 0, radius: 1 }, { cx: 1.4, cy: 0, cz: 0, radius: 1 }, { cx: 0.7, cy: 1.3, cz: 0, radius: 1 }, { cx: -0.6, cy: 0.9, cz: 0, radius: 1 }];
    const hash = DNA.registerShape(dict, members, { quantum: 0.25 });
    const body = { cx: CX, cy: CY, cz: 0, radius: 2.4, shapeHash: hash, mass: 2000, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, theta: 0, internalE: 0, energy: 0 };
    const pts = DNA.reconstructShape(body, dict, { quantum: 0.25, spread: 1.5, subScale: 1.5 });
    const m = body.mass / pts.length; let I = 0;
    const shell = pts.map(p => { const ox = p.cx - body.cx, oy = p.cy - body.cy; I += m * (ox * ox + oy * oy); return { ox, oy, r: p.r }; });
    body.inertia = I;
    // 캐릭터: 왼쪽서 +x 로, off-center(cy=CY+0.5) → 스핀 유도
    const me = 1, R = 1;
    const ch = { cx: CX - 8, cy: CY + 0.5, cz: 0, radius: R, mass: me, px: me * 4, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, inertia: 0.4 * me * R * R, internalE: 0, energy: 0 };
    w.__body = body; w.__shell = shell; w.__ch = ch;
  }

  return {
    label: 'step_0119 — (RG1) 강체 분자 골격: 합쳐진 분자 하나가 DNA 구조를 충돌 껍질로 쓰고 반작용을 분자 하나로 합산',
    title: 'HTJ — 강체 분자(수박게임 합친 한 엔티티)가 자기 DNA 구조를 충돌 껍질로: 캐릭터가 실제 형태에 막히고 분자는 거의 안 움직이며 살짝 돈다',
    sub: 'RG1·새 법칙 applyShellContact + θ 적분(B안). 분자는 *안 쪼갬*(한 엔티티)·DNA 구조=충돌 껍질(reconstructShape). 접촉 반작용을 분자 하나에 합력+토크 합산→접촉점 equal-opposite→Σp·ΣL 정확 보존(고정/핀 0=진짜 자유 강체). off-center 타격→강체 회전(θ). 무게=부동성(무거우나 free). top-down·중력 0.',
    mode: 'energy', dynamics: true, render: 'points',
    defaults: {},

    init(w) { build(w); },
    advance(w) { En.applyShellContact([w.__ch], w.__body, w.__shell, DT, COPT); En.stepEntities([w.__body, w.__ch], DT); },

    makeWorld() { return { N }; },
    frames: [5, 22, 55, 180],                                  // 접근 → 접촉 → 되튐 → 분자 약간 회전한 정착
    captureOpts: {
      N, color: (v) => {
        if (v >= 0.97) return [235, 70, 60];                    // 캐릭터=빨강
        if (v >= 0.88) return [120, 125, 135];                  // DNA 구조 껍질=회색(분자 표면)
        if (v >= 0.80) return [70, 75, 85];                     // 분자 중심 마커=짙은 회색
        return [22, 24, 30];                                    // 배경
      }
    },
    toFrame(w) {
      const b = w.__body, cs = Math.cos(b.theta), sn = Math.sin(b.theta), pts = [];
      // 분자 중심 마커(자세 추적용)
      pts.push({ cx: b.cx, cy: b.cy, r: 0.8, v: 0.83 });
      // DNA 구조 껍질(현재 자세 theta 로 회전된 오프셋) = 분자의 충돌 표면
      for (const s of w.__shell) pts.push({ cx: b.cx + cs * s.ox - sn * s.oy, cy: b.cy + sn * s.ox + cs * s.oy, r: s.r * 0.85, v: 0.9 });
      // 캐릭터
      pts.push({ cx: w.__ch.cx, cy: w.__ch.cy, r: 1.2, v: 1.0 });
      return { pts };
    },

    note: '<b>합쳐진 것은 *하나의 분자*다 — 그 내부 구조가 곧 DNA 이고, 분자는 끝까지 *한 강체*로 움직이며 절대 쪼개지지 않는다.</b> 수박게임 합치기(0036/0061)로 닿고 느린 원소들이 뭉치면 한 원소가 되고, 그 합쳐진 원소는 *분자처럼 고정된 내부 구조*(shapeHash·0062)를 가진다. RG1 은 그 구조를 *물리적으로 의미 있게* 만든다 — 지금까지 합쳐진 분자는 매끈한 구(<code>equivalentRadius</code>)로만 충돌했고 DNA 구조는 *기록만* 됐다(렌더·LOD 용). 여기서 그 구조를 분자의 *충돌 껍질*로 읽는다: <code>reconstructShape</code>(0063)가 주는 구조 점들을 *물리 개체가 아니라*(안 쪼갬) 분자 자세(위치 + 회전 θ)에 놓인 *읽기 전용 충돌 표면*으로 질의한다. <b>새 법칙</b>(<code>applyShellContact</code>): 캐릭터가 껍질에 닿으면 반발(Hooke)+감쇠 충격량 J 를 *접촉점*에서 잡아 — 분자엔 +J(병진)+토크 (p−CoM)×J(스핀 Lz), 캐릭터엔 −J(병진)+토크 (p−중심)×(−J). 같은 접촉점·equal-opposite 라 <b>원점 기준 계 총 운동량·각운동량이 *구성적으로 정확 보존*</b>된다 — 이게 "진짜 자유 강체"의 증거다(고정 앵커·매 틱 운동량 0 지우기·−mg 같은 편법이 하나라도 있으면 외력이라 보존이 깨진다). <b>방향 θ</b>(B안·게이트): 엔티티가 각운동량 Lz 는 들지만 *각도*는 없었다 → <code>stepEntity</code>에 ω=Lz/I → θ 적분을 더했다(<code>theta</code> 있는 개체에만 → 기존 모든 step byte 동일·회귀 0). 그래서 off-center 타격이 분자를 *강체로 돌리고* 껍질도 같이 돈다(2D 라 θ 는 스칼라 하나). <b>무게가 곧 부동성</b>: 분자 질량 2000 ≫ 캐릭터 1 → 충격에 거의 안 움직이되(변위 0.04) *고정이 아니라 free*(Σp 보존이 증명). <b>측정(verify·10/10)</b>: ① 캐릭터가 DNA 구조 껍질에 막힘(min gap −0.20·되튐 vx<0)·분자 중심 침투 0 ② <b>제어 없이 Σp_x 4→4·ΣL_origin −2→−2(rel 7e-15) 정확 보존</b>(편법 부재의 급소) ③ 분자 free(변위 0.04>0=free·<0.5=무게로 거의 부동) ④ θ 반응(theta −0.0052·Lz −5.8·강체 회전) ⑤ 항등(k=0·c=0→껍질 접촉 no-op→캐릭터 자유 직진·분자 불변·회귀 0) ⑥ 결정론. <b>흐름</b>(capture·top-down): 빨간 캐릭터가 왼쪽서 다가와 회색 *DNA 구조*(매끈한 구가 아닌 4 구성원 윤곽)에 막혀 튕기고, 무거운 분자는 제자리서 *살짝 돈다*(θ). <b>큰 그림</b>: 이 한 가지 규칙(닿고 느리면 합쳐 *강체 분자*가 된다 + 그 분자가 DNA 구조로 충돌한다)이 층층이 반복되며 복잡도를 낳는다 — 원소→분자→더 큰 구조. RG2(비구형 바위 블로커·0118 교정)·RG3(강체 지형 굴곡·0113)·RG4(경사 한계·0114)가 이 골격 위에 쌓인다(design/rigid-ground.md §5). <b>원칙 준수</b>: engine 에 "바위·지형" 타입 0 — 분자는 generic 무거운 엔티티 + shapeHash, 껍질은 generic 오프셋, 접촉은 generic 강체 반작용. <b>정직한 한계</b>: 껍질은 분자 구조의 *구 근사*(연속 메시 아님)·이 step 은 *블로커 안정 + 보존*까지만(캐릭터가 *서는*·굴곡 추종·경사는 RG2~4)·θ 적분은 2D 스칼라(3D quaternion 은 필요 시 후속).'
  };
});
