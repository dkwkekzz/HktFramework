# RENDER-STATE — 렌더러 트랙 현재 위치 (살아있는 대시보드)

> 렌더러 트랙의 SSOT — *지금 어디까지·다음 렌즈는 무엇인가*. 척추(원칙)=[RENDER.md](RENDER.md), 규약=[CLAUDE.md](CLAUDE.md) "두 트랙".
> 시뮬 트랙 [STATE.md](STATE.md) 와 **직교** — step 번호 없음, 회귀·verify 4기둥 무관. 렌더러는 `STATE.md` 를 만지지 않는다.
> **고정 크기 대시보드**: §1~5 는 렌즈마다 덮어쓴다(rewrite). §6 INDEX 만 1줄/렌즈 append.

---

## 1. NOW — 켜진 렌즈 (`engine/hws-3d.js` `progW`)

같은 텍스처(E·R·A·G)를 활성도 `A`로 갈라 읽는 세계 해석 뷰(2분할 우측). 구현된 렌즈:
- ✅ **`A` → 발광**: 흐르는 에너지(고활성 E·A)는 안 솟고 빛난다.
- ✅ **`G` → 절차적 색**: 유전형 클론 색(나무·결정) — 황금비 색상환 해시(`hue=fract(g·φ⁻¹)` HSV→RGB), 혈통 무한 분화·고정 팔레트 캡 제거. `geneCol`/`storeCol`/`geneColP` 3곳 일관. 무유전(g=0)은 호박색 불변.
- ✅ **상(phase) 3분기**: 고체/액체/공허 이산 분기(lerp 0) + 밀도·광택·깊이 색.
- ✅ **z = 물질(R) only**: `matH = hOf(R)` — 에너지(흐르든 고이든)는 z 기여 0. 흐르는 E=발광·고인 E(물)=*재질*로만 읽고 *안 솟는다*(RENDER §2·§5). 법선도 R 기복만. 분포 재성형 0(물은 z 서 빠지되 분포 그대로 — author 아님).
- ✅ **물 = R 위 반투명 막**: 액체 셀에서 바닥 물질색(`store·dens`)을 깊이(저활성 E)로 흡광 블렌드 — `transmit=exp(-depth·absorb)`(빨강 먼저 죽음) → 얕으면 *바닥 비침*·청록, 깊으면 짙은 남. FS 프레넬(비스듬할수록 표면 반사↑·`uEye` 시선벡터)·시선기반 글린트. 고체는 `vWet=0` → 불투명·무광 불변.
- ✅ **고체 거칠기 = `∇R` 노멀 디테일**: R 라플라시안 `|∇²R|`(고주파)으로 고체 노멀 미세 변조 — 진폭=∇R 거침·방향=셀 해시(서브셀 절차적). 들쭉날쭉한 R=거친 암석, 매끈한 R=매끈. *높이 불변*(분포 재성형 0)·셰이딩 노멀만. 액체/공허는 `rough=0`.
- ✅ **`∇E` → 파생 바람 flowmap**: 흐름량 중앙차분 `∇E`로 하류 방향 위상(`vFlowPhase`)을 만들고, FS 에서 `uTime` 이류 띠로 발광 변조 — 흐르는 에너지의 *세기*에 더해 *방향*을 보인다. 코어 불변(GPU 파생·도함수 읽기)·분포 author 0. 약한 ∇E/무흐름 셀은 `flowVis=1`(발광 불변).

---

## 2. NEXT — 다음 렌즈 (한 커밋 = 한 조각)

> ⚠️ **3D 전환 ([VOXEL.md](VOXEL.md))**: 시뮬 트랙이 voxel 전환(V1~)에 들어갔다. 시뮬 V1·V2 가 닫히면 이 트랙의 다음 렌즈는 **L-V1(voxel 렌즈 — R 점유 인스턴스드 큐브 + E 밝기)**로 교체되고, 아래 하이트필드 기반 렌즈(물 막·∇R 거칠기)는 L-V 사다리로 승계/대체된다. 그 전까지는 현행 로드맵 유효.

**FSM → 이산 재질**(kindling/burning/ash) — A 채널 FSM 상태(점화/연소/재)를 *이산 재질 분기*로 읽는다(lerp 0). 지금은 A 발광 세기가 대신 비출 뿐 — `kindling`(어두운 응결핵)→`burning`(고강도 emissive + 상승 입자)→`ash`(식어 가라앉음·회색 무광)로 갈라 *상전이*를 보인다. A 텍스처 채널(또는 FSM 플래그)을 읽어 분기만 더한다 — 분포 author 0(RENDER §5 "빛: FSM 이산 분기").

---

## 3. OPEN GAPS — 설계(RENDER.md) vs 코드 격차

| 마커 | 격차 | 설계 근거 |
|---|---|---|
| 🟡 | FSM 이산 재질(kindling/burning/ash)을 텍스처 채널에 안 실음 — A 발광이 대신 비춤 (다음 렌즈) | RENDER §5 |
| ⬜ | `∇²E` 안개·응결(볼류메트릭) 미구현 | RENDER §5 |
| ✅ | ~~`∇E` 파생 바람 미구현~~ → 중앙차분 ∇E flowmap 위상 + uTime 이류 띠로 발광에 *방향* 부여(무흐름 flowVis=1) | RENDER §5 |
| ✅ | ~~`geneCol` 고정 팔레트 4혈통 캡~~ → 황금비 색상환 해시로 교체(3곳 일관), 혈통 무한 분화·무유전 호박색 불변 | RENDER §4 |
| ✅ | ~~고체 거칠기 = `∇R` 노멀~~ → R 라플라시안으로 고체 노멀 변조(높이 불변); ~~물 렌즈~~ → 바닥 흡광+프레넬+글린트; ~~z=R+저활성E~~ → `matH=hOf(R)` only | RENDER §2·§5 |

---

## 4. DURABLE — 렌더러 트랙 불변

- **형태 author 0** — 필드가 만든 것만 비춘다. *어느 양이 z·색·빛이 되는가*는 읽기(허용), *양의 분포 재성형*은 author(금지). 도함수·필터(∇R·∇E)는 읽기.
- **z = 물질(R) only** — 에너지(E)는 흐르든 고이든 z 를 안 만든다(응축상 R 만 공간 점유). 물은 z 서 빠지되 *분포는 안 건드린다*(평탄화 아님 — 그냥 안 든다). RENDER §2·§5.
- **소유 파일**: `engine/hws-3d.js`(+ 프레젠테이션 한정 `hws-ui.css`/`hws-ui.js`) · `RENDER.md` · `RENDER-STATE.md`. **불가침**(시뮬 소유): `hws-laws.js`·`hws-kernel.js`·`hws-sim.js`·`golden-sim.json`·`step-NNNN/*`·`STATE.md`·`SPINE.md`.
- **검증 3종**: ① `node engine/validate/verify-sim-engine.js` 골든 해시 불변(=시뮬 안 건드린 알리바이) ② `node engine/validate/smoke-dom-3d.js` 3D 스모크 ③ **눈 검증**(화면이 권위) + 척추 한 항(형태 author 0).
- **필드 있으면 읽고 없으면 no-op** — 시뮬 step 진행과 독립. 필드에 형태가 실리면 렌즈가 코드 0으로 받는다.

---

## 5. ROADMAP — 렌즈 순서 (위에서부터 하나씩)

| 순서 | 렌즈 | 상태 |
|---|---|---|
| 1 | **z = 물질(R) only** — 고인 E도 z에서 뺀다 | ✅ DONE |
| 2 | **물 = R 위 반투명 막** — E→깊이·투과·색, 바닥 R 비침 | ✅ DONE |
| 3 | **고체 거칠기 = `∇R` 노멀 디테일** | ✅ DONE |
| 4 | **`G` → 절차적 색**(해시 — 혈통 무한 분화, 팔레트 캡 제거) | ✅ DONE |
| 5 | **`∇E` → 파생 바람** flowmap | ✅ DONE |
| 6 | **FSM → 이산 재질**(kindling/burning/ash) | ⬜ NEXT |

---

## 6. INDEX — 1줄/렌즈 (append-only)

| 렌즈 | 더한 조각 | 검증 |
|---|---|---|
| — | (RENDER.md 척추 정립 + RENDER-STATE 신설) | 첫 렌즈 대기 |
| z = 물질(R) only | `matH = hOf(R)` — 저활성E(물) z 기여 제거, 법선도 R 만. 물은 z 서 빠지되 재질(파랑·투과)로만 읽음 | eq PASS · golden PASS · 3D 스모크 PASS |
| 물 = R 위 반투명 막 | 액체 셀 = 바닥 물질색 `transmit=exp(-depth·absorb)` 흡광 블렌드(얕음=바닥 비침·청록/깊음=짙은 남) + 프레넬(`uEye`)·시선 글린트, 고체 `vWet=0` 불변 | golden PASS · 3D 스모크 PASS · 눈 검증(브라우저) |
| 고체 거칠기 = ∇R 노멀 | R 라플라시안 `|∇²R|` 진폭 + 셀 해시 방향으로 고체 노멀 미세 변조(들쭉날쭉 R=거친 암석). 높이 불변·셰이딩만, 액체/공허 rough=0 | golden PASS · 3D 스모크 PASS · 눈 검증(브라우저) |
| G → 절차적 색 | geneCol/storeCol/geneColP 고정 4색 → 황금비 색상환 해시(`hue=fract(g·φ⁻¹)` HSV→RGB) 3곳 일관, 혈통 무한 분화·무유전 호박색 불변 | golden PASS · 3D 스모크 PASS · 눈 검증(브라우저) |
| ∇E → 파생 바람 | 중앙차분 ∇E 하류 방향 flowmap 위상 + `uTime` 이류 띠로 발광 변조(세기에 더해 방향). 무흐름/약한 ∇E 는 flowVis=1, 코어 불변 | golden PASS · 3D 스모크 PASS · 눈 검증(브라우저) |
