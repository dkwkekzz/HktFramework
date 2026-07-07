// ============================================================================
// 필드 확산 — A1 (설계 §7 단계 4)
//
// 노드 재충전을 `세계→노드` 마법 주입에서 이웃 셀 간 zero-sum 정수 이체로 바꾸기
// 위한 결정론 코어. 필드는 원장 안의 셀 격자 풀(id `F:cx_cy`)이고, 확산은 인접
// 셀 간 이체다 — 별도 동기화 채널 없이 tx 스트림에 공짜로 편입된다.
//
// 보존은 여기서 검증하지 않는다: 모든 흐름이 ledger.transfer() 를 통과하므로
// 자료구조(이체 클램프)가 강제한다. 흐름량을 기울기의 절반 이하로 두어 오버슛·
// 진동 없이 평형으로 단조 수렴한다.
//
// 서버·클라 공용 순수 모듈 (Node/DOM API 의존 0).
// ============================================================================

import {
  POOL, CAUSE, FIELD_GRID, FIELD_CELL_MAX,
  FIELD_DIFFUSE_NUM, FIELD_DIFFUSE_DEN,
} from './constants.js';
import { relaxGradient } from './entropy.js';

export function fieldCellId(cx, cy) { return `${POOL.CELL}${cx}_${cy}`; }

// 픽셀 좌표 → 셀 인덱스 (격자 경계 클램프)
export function fieldCellOf(x, y, size) {
  const grid = FIELD_GRID;
  const cx = Math.min(grid - 1, Math.max(0, Math.floor(x / size)));
  const cy = Math.min(grid - 1, Math.max(0, Math.floor(y / size)));
  return { cx, cy };
}

// 셀 격자 풀 생성. seed(cx,cy) 는 셀 초기 잔고를 유도한다 (기본 0).
export function createField(ledger, { grid = FIELD_GRID, max = FIELD_CELL_MAX, seed } = {}) {
  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      const balance = seed ? seed(cx, cy) : 0;
      ledger.createPool(fieldCellId(cx, cy), balance, max);
    }
  }
}

// 확산 1틱 — 각 인접 간선(오른쪽·아래 이웃)을 정확히 한 번 순회하며 높은 셀에서
// 낮은 셀로 flow = floor(기울기 * NUM/DEN) 를 이체한다. 이체 순서·정수 연산이
// 결정론적이므로 서버·클라가 같은 결과를 얻는다. 반환: 이동한 총 에너지량.
export function diffuseTick(ledger, {
  grid = FIELD_GRID, num = FIELD_DIFFUSE_NUM, den = FIELD_DIFFUSE_DEN,
} = {}) {
  let moved = 0;
  for (let cy = 0; cy < grid; cy++) {
    for (let cx = 0; cx < grid; cx++) {
      if (cx + 1 < grid) moved += flow(ledger, cx, cy, cx + 1, cy, num, den);
      if (cy + 1 < grid) moved += flow(ledger, cx, cy, cx, cy + 1, num, den);
    }
  }
  return moved;
}

// 간선 하나의 흐름 — 높은 셀 → 낮은 셀. A9: 엔트로픽 이완 커널(relaxGradient)의 특수해다.
// 필드 확산은 "흐름=엔트로피" 공리의 최초 원시함수였고, 이제 그 커널을 공유한다(한 법칙).
function flow(ledger, ax, ay, bx, by, num, den) {
  return relaxGradient(ledger, fieldCellId(ax, ay), fieldCellId(bx, by), num, den, CAUSE.DIFFUSE);
}
