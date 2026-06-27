// rule_0004 — 껍질/원자가 (전자껍질이 결합을 정한다 → 다양한 원소·정확한 분자 조성)
//
// 지금까지 결합(rule_0002)은 두 가지가 *대충*이었다:
//   ① en(전기음성도)을 시나리오가 직접 박아 seed 했고(왜 그 값인지 근거 없음),
//   ② 닿으면 무차별 병합 — 원자가 한도가 없어 "몇 개와 결합하나"가 통제되지 않았다(분자 조성이 부정확).
//
// rule_0004 는 원자가 가진 단 하나의 근본 수 — 원자번호 Z(= 중성 전자 수) — 에서 화학을 *창발*시킨다.
//   전자는 불연속 껍질에 채워진다(주기 길이 [2,8,8,18,18,32], 비활성 수 2·10·18·36·54·86).
//   바깥 껍질이 *꽉 차면* 안정(비활성 기체), 거의 비면 잃으려 하고(금속), 거의 차면 얻으려 한다(비금속).
//   여기서 *전기음성도·결합가·금속성·반응성*이 모두 따라 나오고 — Z 만 바꾸면 *주기율표*가 재현된다.
//
// 그 위에서 결합이 원자가 한도로 한정된다:
//   · 공유(비금속·share 끼리): 결합차수 = min(두 잔여 원자가) 만큼 전자쌍을 공유 → 병합. 양쪽이 그만큼 소비.
//     바깥 껍질이 다 차면(잔여 0) 더는 결합 안 함 → H₂O 가 H 를 셋째로 안 받는다(*정확한 조성*).
//   · 이온(금속+비금속): 금속이 비금속에게 전자를 *원자가 한도까지* 넘긴다 → MgCl₂(Mg 가 둘에게 하나씩).
//   · 비활성(꽉 찬 껍질): 결합가 0 → 어떤 결합도 안 함(주기적 비활성 창발).
//
// author 안 함: "산소·나트륨" 분기 0. 시나리오는 Z 라는 *근본 정수* 하나만 seed(질량을 seed 했듯).
//   en·결합가·금속성은 코드가 Z 에서 *계산*한다 — "if 산소" 가 아니라 보편 껍질 공식뿐.
// 결정론: 현재 위치·속도·Z·q 만 읽음. Math.random 금지. 같은 입력 → 같은 출력.

// ── 껍질 모형(규칙의 핵심 법칙) — Z 하나에서 화학적 정체성을 계산한다 ──
//   주기 길이(바깥 껍질 용량). 누적합이 "꽉 찬 껍질"(비활성 기체) 전자수: 2,10,18,36,54,86.
const PERIODS = [2, 8, 8, 18, 18, 32];

// Z(원자번호) → 껍질에서 창발하는 화학적 양들. 순수 함수(부수효과 없음) — 검증·뷰어가 공유.
export function shellState(Z) {
  let cum = 0, pIndex = 0, prev = 0, cap = 0, v = 0, above = 0;
  for (let p = 0; p < PERIODS.length; p++) {
    const lo = cum, hi = cum + PERIODS[p];
    if (Z <= hi) { pIndex = p; prev = lo; cap = PERIODS[p]; v = Z - lo; above = hi; break; }
    cum = hi;
    // Z 가 표를 넘으면 마지막 주기로 클램프(시나리오는 작은 Z 만 쓴다)
    if (p === PERIODS.length - 1) { pIndex = p; prev = lo; cap = PERIODS[p]; v = Math.min(Z - lo, cap); above = hi; }
  }
  const period = pIndex + 1;
  const half = cap / 2;
  const isNoble = v === cap;            // 바깥 껍질이 꽉 참 → 비활성
  // 결합가(combining valence) = 옥텟에 도달하기까지의 최소 이동 = min(가진 것, 비운 것)
  //   금속(v<half): v 개를 잃음 / 비금속(v>half): cap−v 개를 얻음 / share(v==half: H·C): v 개를 나눔
  const valence = isNoble ? 0 : Math.min(v, cap - v);
  const tendency = isNoble ? 'noble' : v < half ? 'metal' : v > half ? 'nonmetal' : 'share';
  // 전기음성도(창발) = 바깥 껍질 채움 비율(v/cap) ÷ 주기. 채움이 클수록↑(같은 주기 오른쪽), 주기가 깊을수록↓
  //   (바깥 전자가 핵에서 멀어 덜 끌림 → 아래 족일수록 작아짐, F>Cl). 금속(채움<½)은 작아 비금속에게 전자를 내줌.
  //   seed 가 아니라 Z·껍질에서 *계산된 측정 출력* — 이온 결합의 전자 이동 방향을 가른다.
  const en = (v / cap) / period;
  return { Z, period, valenceElectrons: v, shellCap: cap, nobleBelow: prev, nobleAbove: above, isNoble, tendency, valence, en };
}

// 원소의 이번-틱 잔여 원자가(결합에 쓸 수 있는 손) — 원자는 Z·전하에서, 분자는 합성 시 기록된 값에서.
//   원자: 결합가 − |전하|(이미 이온으로 쓴 만큼 차감). 분자(Z 없음): 병합 때 엔진이 계산해 둔 freeValence.
function refresh(e) {
  if (e.Z != null) {
    const s = shellState(e.Z);
    e.en = s.en;                                   // 창발한 전기음성도(엔진의 전자 이동 방향·뷰어가 읽음)
    e.valence = s.valence;                          // 결합가(관찰용)
    e.tendency = s.tendency;                        // 금속/비금속/share/noble(관찰용)
    // 골격 결합(rule_0008): 이미 맺은 지속 링크가 쓴 손(Σ결합차수)을 뺀다 → 남은 손만 새 결합에 쓴다.
    //   링크가 끊기면(분해) 이 합이 줄어 손이 자동 복원 = 가역. 링크 없는 세계는 used=0 → 옛 거동 동일.
    const used = Array.isArray(e.bonds) ? e.bonds.reduce((a, b) => a + (b.order || 0), 0) : 0;
    e.freeValence = Math.max(0, s.valence - Math.abs(e.q || 0) - used);
  }
  // 분자는 freeValence 가 이미 설정돼 있다(엔진 병합이 계산) — 그대로 둔다.
  return e.freeValence != null ? e.freeValence : 0;
}

// 이번 틱의 잔여 손(_vleft) 을 한 번만 초기화한다(틱 번호로 1회 보장 — 규칙 순서·마커 무관).
//   같은 틱에 여러 결합이 같은 원자를 물어도 손이 모자라면 더 못 묾 → 과결합(OH₃ 등) 방지.
function ensureTick(e, world) {
  if (e._vtick !== world.tick) { e._vtick = world.tick; e._vleft = refresh(e); }
}

const isShell = e => e.Z != null || e.freeValence != null;   // rule_0004 가 관장하는 원소
const radius = (m, bondK) => bondK * Math.sqrt(m > 0 ? m : 1); // 질량→접촉 반경(rule_0002 와 동일)

export default {
  id: 'rule_0004',
  name: '껍질/원자가',
  //   bondK  : 질량→접촉 반경 / vStick : 결합 문턱(너무 빠르면 안 붙음) — rule_0002 와 같은 의미·값
  defaults: { bondK: 2, vStick: 2.5 },

  // 원자 i 가 j>i 와 결합 조건을 만족하면, 껍질이 정한 종류·차수로 공유 병합/이온 이동을 표시한다.
  //   상태 변경(병합·전하 이동)은 엔진이 실행. e: 원소, i: 인덱스, world: 세계, params
  apply(e, i, world, params) {
    const bondK = params && params.bondK != null ? params.bondK : 2;
    const vStick = params && params.vStick != null ? params.vStick : Infinity;
    const els = world.elements;
    const W = world.width, H = world.height, D = world.depth;
    const wrapZ = typeof D === 'number' && D > 0;
    // 골격 결합 세계: 공유 결합을 *융합(pendingMerges)* 대신 *지속 링크(pendingBonds)* 로 실현한다.
    //   결정(언제·어떤 종류·차수)은 그대로 — 실현 채널만 바뀐다(rule_0008 설계). 비-skeletal 은 옛 융합.
    const skeletal = world.skeletal === true;
    const orderCap = params && params.bondOrderCap != null ? params.bondOrderCap : Infinity;

    ensureTick(e, world);
    if (!isShell(e)) return;                         // 구형 원소는 rule_0002 소관
    const Ri = radius(e.m, bondK);

    for (let j = i + 1; j < els.length; j++) {
      const o = els[j];
      ensureTick(o, world);
      if (!isShell(o)) continue;
      // 골격 세계에서 이미 링크된 쌍은 다시 결합하지 않는다(차수 누적·재결합 방지).
      if (skeletal && Array.isArray(e.bonds) && o.id != null && e.bonds.some(x => x.other === o.id)) continue;

      // 접촉(토러스 최근접 구 거리 ≤ 반경 합) — 3D
      let dx = o.x - e.x; dx -= Math.round(dx / W) * W;
      let dy = o.y - e.y; dy -= Math.round(dy / H) * H;
      let dz = (o.z || 0) - (e.z || 0); if (wrapZ) dz -= Math.round(dz / D) * D;
      const R = Ri + radius(o.m, bondK);
      if (dx * dx + dy * dy + dz * dz > R * R) continue;

      // 접근(닫힘) + 문턱(부드러움) — rule_0002 와 같은 결합 게이트
      const dvx = (o.vx || 0) - (e.vx || 0), dvy = (o.vy || 0) - (e.vy || 0), dvz = (o.vz || 0) - (e.vz || 0);
      if (dx * dvx + dy * dvy + dz * dvz >= 0) continue;               // 멀어지는 중
      if (dvx * dvx + dvy * dvy + dvz * dvz > vStick * vStick) continue; // 너무 빠름

      // 잔여 손이 없으면(포화·비활성) 결합 안 함 — 정확한 조성·주기적 비활성의 핵심
      if (e._vleft <= 0 || o._vleft <= 0) continue;

      // 결합 종류 — 껍질의 *성향*으로 가른다(금속+비금속 → 이온, 그 외 → 공유). en 문턱 같은 마법 상수 없음.
      const ti = e.tendency, tj = o.tendency;
      // 금속+금속 → 공유 병합 안 함(금속은 분자가 아니라 전자바다 격자) → rule_0006 소관. 여기선 양보.
      if (ti === 'metal' && tj === 'metal') continue;
      const ionic = (ti === 'metal' && tj === 'nonmetal') || (ti === 'nonmetal' && tj === 'metal');

      if (ionic) {
        // 이온: 금속(전기음성도 낮음)이 비금속에게 전자를 넘긴다. 양 = min(주는 손, 받는 손)(원자가 한도).
        //   방향(누가 받나)은 엔진이 en 으로 정함. 여기선 양만 표시하고 양쪽 손을 그만큼 줄인다.
        const dq = Math.min(e._vleft, o._vleft);
        world.pendingTransfers.push({ a: i, b: j, dq });
        e._vleft -= dq; o._vleft -= dq;
      } else {
        // 공유(또는 금속끼리·share): 결합차수 = min(두 손) 만큼 전자쌍 공유. 양쪽이 그만큼 소비.
        let order = Math.min(e._vleft, o._vleft);
        if (skeletal) {
          // 골격: 차수 상한(bondOrderCap)을 적용 — 상한 1 이면 *단일 결합*만 → 손이 남아 여러 이웃과
          //   링크 → 사슬·가지(고분자)가 창발. 상한 미설정이면 옛 차수(이중·삼중 결합) 그대로.
          if (order > orderCap) order = orderCap;
          world.pendingBonds.push({ a: i, b: j, order });   // 융합 대신 지속 링크(rule_0008)
        } else {
          world.pendingMerges.push({ a: i, b: j, order });  // 옛 거동: 하나의 질점으로 융합
        }
        e._vleft -= order; o._vleft -= order;
      }
    }
  },
};
