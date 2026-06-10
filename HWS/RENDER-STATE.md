# RENDER-STATE — 렌더러 트랙 현재 위치 (살아있는 대시보드)

> 렌더러 트랙의 SSOT — *지금 어디까지·다음 렌즈는 무엇인가*. 척추(원칙)=[RENDER.md](RENDER.md), 규약=[CLAUDE.md](CLAUDE.md) "두 트랙".
> 시뮬 트랙 [STATE.md](STATE.md) 와 **직교** — step 번호 없음, 회귀·verify 4기둥 무관. 렌더러는 `STATE.md` 를 만지지 않는다.
> **고정 크기 대시보드**: §1~5 는 렌즈마다 덮어쓴다(rewrite). §6 INDEX 만 1줄/렌즈 append.

---

## 1. NOW — 켜진 렌즈 (`engine/hws-3d.js` `progW`)

같은 텍스처(E·R·A·G)를 활성도 `A`로 갈라 읽는 세계 해석 뷰(2분할 우측). 구현된 렌즈:
- ✅ **`A` → 발광**: 흐르는 에너지(고활성 E·A)는 안 솟고 빛난다.
- ✅ **`G` → 색 분기**: 유전형 클론 색(나무·결정) — *단 고정 팔레트, 4혈통에서 캡*(§3 격차).
- ✅ **상(phase) 3분기**: 고체/액체/공허 이산 분기(lerp 0) + 밀도·광택·깊이 색.
- 🟡 **높이=물질**: `h = hOf(R + 저활성E)` — *흐르는* 에너지만 z에서 뺐다. **고인 E는 아직 z에 솟는다** = RENDER.md §2 미반영(§3 최우선 격차).

---

## 2. NEXT — 다음 렌즈 (한 커밋 = 한 조각)

**z = 물질(R) only** — `matH`/`hAtXY` 에서 `저활성E`(liquidE)를 제거해 `h = hOf(R)`. 에너지(흐르든 고이든)는 z를 안 만든다(RENDER.md §2·§5). 물은 z에서 빠지되 분포는 안 건드린다(§4 author 금지 — 평탄화 아님, 그냥 *안 든다*).

---

## 3. OPEN GAPS — 설계(RENDER.md) vs 코드 격차

| 마커 | 격차 | 설계 근거 |
|---|---|---|
| 🔴 | z 가 아직 `R + 저활성E` — 물이 솟는다. 에너지 고도와 공간 z축이 안 갈림 | RENDER §2·§5 |
| 🔴 | 물 렌즈 = R 위 반투명 막(z 0·투과·바닥 R 비침) 미구현 — 현재 색·광택 근사뿐 | RENDER §5 |
| 🔴 | 고체 거칠기 = `∇R` 노멀 디테일 미구현 — 현재 무광은 광택0일 뿐 기하 거침 아님 | RENDER §5 |
| 🔴 | `geneCol` 고정 팔레트 4혈통 캡 → 자기복제로 굴러간 혈통이 한 색으로 뭉갬. 절차적 해시 필요 | RENDER §4 |
| 🟡 | FSM 이산 재질(kindling/burning/ash)을 텍스처 채널에 안 실음 — A 발광이 대신 비춤 | RENDER §5 |
| ⬜ | `∇E` 파생 바람·`∇²E` 안개 미구현 | RENDER §5 |

---

## 4. DURABLE — 렌더러 트랙 불변

- **형태 author 0** — 필드가 만든 것만 비춘다. *어느 양이 z·색·빛이 되는가*는 읽기(허용), *양의 분포 재성형*은 author(금지). 도함수·필터(∇R·∇E)는 읽기.
- **소유 파일**: `engine/hws-3d.js`(+ 프레젠테이션 한정 `hws-ui.css`/`hws-ui.js`) · `RENDER.md` · `RENDER-STATE.md`. **불가침**(시뮬 소유): `hws-laws.js`·`hws-kernel.js`·`hws-sim.js`·`golden-sim.json`·`step-NNNN/*`·`STATE.md`·`SPINE.md`.
- **검증 3종**: ① `node engine/validate/verify-sim-engine.js` 골든 해시 불변(=시뮬 안 건드린 알리바이) ② `node engine/validate/smoke-dom-3d.js` 3D 스모크 ③ **눈 검증**(화면이 권위) + 척추 한 항(형태 author 0).
- **필드 있으면 읽고 없으면 no-op** — 시뮬 step 진행과 독립. 필드에 형태가 실리면 렌즈가 코드 0으로 받는다.

---

## 5. ROADMAP — 렌즈 순서 (위에서부터 하나씩)

| 순서 | 렌즈 | 상태 |
|---|---|---|
| 1 | **z = 물질(R) only** — 고인 E도 z에서 뺀다 | ⬜ NEXT |
| 2 | **물 = R 위 반투명 막** — E→깊이·투과·색, 바닥 R 비침 | ⬜ |
| 3 | **고체 거칠기 = `∇R` 노멀 디테일** | ⬜ |
| 4 | **`G` → 절차적 색**(해시 — 혈통 무한 분화, 팔레트 캡 제거) | ⬜ |
| 5 | **`∇E` → 파생 바람** flowmap | ⬜ |
| 6 | **FSM → 이산 재질**(kindling/burning/ash) | ⬜ |

---

## 6. INDEX — 1줄/렌즈 (append-only)

| 렌즈 | 더한 조각 | 검증 |
|---|---|---|
| — | (RENDER.md 척추 정립 + RENDER-STATE 신설) | 첫 렌즈 대기 |
