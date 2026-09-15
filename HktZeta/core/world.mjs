// 세계 = 궤적. 객체들의 집합이 아니라, 오라클 Ω 이 만들어내는 값들이 쌓인 것.
//
//   세계 상태 = { tick, beings[] }. 각 being 은 최소한의 국소 상태만 든다:
//     addr    — 산술 주소(정체성이자 "유전자". 성장하면 더 풍부한 소인수 영역으로 이동)
//     x, y    — 누적된 궤적의 현재 위치(결정의 결합 = 이동의 적분)
//     heading — 8방위 진행 방향
//     energy  — 성장의 척도. FEED 로 쌓이고 SPLIT 로 소모/분배된다.
//
//   step(state) 은 순수 함수다: 같은 seed → 같은 궤적(결정론). 이것이 검증의 뿌리.

import { decide, stepMotion, ACT } from './oracle.mjs';

export const SPLIT_COST = 8;   // 이 에너지 이상이면 분열한다
export const FEED_GAIN = 1;    // FEED 결정 1회당 얻는 에너지
// 시드 단계의 *안전 상한*이다 — 아직 진짜 항상성(homeostasis)이 아니다.
// 개체수가 이 값을 넘으면 결정론적으로 잘라낸다(뒤쪽 = 갓 태어난 자식부터).
// 자기조절 생태(성장⇄사멸 균형)는 SPINE 로드맵의 별도 step 이다.
export const MAX_BEINGS = 512;

// 시드로부터 초기 세계를 만든다. 초기 존재들의 주소는 시드에서 결정론적으로 파생.
export function seedWorld(seed, count = 8) {
  const beings = [];
  for (let i = 0; i < count; i++) {
    beings.push({
      addr: (seed + i * 2654435761) >>> 0 || 1,
      x: 0, y: 0, heading: i % 8, energy: 0,
    });
  }
  return { tick: 0, beings };
}

// 한 틱: 모든 존재가 오라클을 읽어 다음 결정을 내리고, 궤적이 한 칸 자란다.
export function step(state) {
  const tick = state.tick + 1;
  const next = [];
  for (const b of state.beings) {
    const d = decide(b.addr, state.tick);
    const m = stepMotion(b.heading, d);
    const nb = {
      addr: b.addr,
      x: b.x + m.dx,
      y: b.y + m.dy,
      heading: m.heading,
      energy: b.energy,
    };

    if (d.act === ACT.FEED) {
      nb.energy += FEED_GAIN * d.mag;
    }

    // 성장: 에너지가 쌓이면 주소가 전진해 더 풍부한 산술 영역으로 이동한다.
    if (nb.energy > 0 && nb.energy % SPLIT_COST !== 0) {
      nb.addr = (nb.addr + d.mag) >>> 0 || 1;
    }

    next.push(nb);

    // 분열: 임계 에너지를 넘으면 자식 존재가 결정론적으로 파생된다.
    if (d.act === ACT.SPLIT && nb.energy >= SPLIT_COST) {
      nb.energy -= SPLIT_COST;
      next.push({
        addr: (nb.addr * 2 + d.n) >>> 0 || 1, // 자식 주소 = 부모에서 파생
        x: nb.x, y: nb.y,
        heading: (nb.heading + 4) % 8,
        energy: 0,
      });
    }
  }
  // 하드 상한 — 결정론적으로 잘라낸다(항상성은 아직 없다, SPINE 로드맵 참조).
  return { tick, beings: next.length > MAX_BEINGS ? next.slice(0, MAX_BEINGS) : next };
}

// N 틱을 굴려 최종 상태를 반환한다(편의 함수).
export function run(seed, ticks, count = 8) {
  let s = seedWorld(seed, count);
  for (let i = 0; i < ticks; i++) s = step(s);
  return s;
}

// 결정론 검증용 궤적 해시 — 상태를 하나의 문자열 지문으로 접는다.
export function hashState(state) {
  let h = 2166136261 >>> 0; // FNV-1a
  const feed = (v) => { h = (h ^ (v >>> 0)) >>> 0; h = Math.imul(h, 16777619) >>> 0; };
  feed(state.tick);
  feed(state.beings.length);
  for (const b of state.beings) {
    feed(b.addr); feed(b.x); feed(b.y); feed(b.heading); feed(b.energy);
  }
  return h >>> 0;
}
