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
- ✅ **FSM → 이산 재질**: 내생 별 `sim.stars[].state`(0 kindling·1 burning·2 ash)를 *이산 재질* 점(`VS_STAR`/`FS_STAR`)으로 — 색·크기·높이가 문턱에서 딱 갈림(lerp 0). kindling=어두운 응결핵·burning=백열 블룸·ash=식은 회색 잔불. `kIgnite=0`이면 `sim.stars` 빈 배열 → no-op(필드 없으면 안 그림).
- 🟡 **별 z = 부력 높이**: `sim.stars[].z`(step-0035 부력)를 *읽어* 별 점을 제 z 만큼 띄운다(`VS_STAR` `zlift=z·uHS·0.35`, 옛 fuel 슬롯 재사용). 하이트필드는 z=0 평면뿐이라 별이 *떠오르는* 게 안 보이고 산서 굴러떨어져 보이던 걸 교정 — 별 마커만이라도 제 z 로 올려 부력 가시화. `kStarRise=0`/z 미설정 → `zlift=0`(회귀). **L-V1 voxel 렌즈 전 첫 z-인지 렌즈**(별 *위치*만 z — 별이 뿜은 E 의 高z 분포는 아직 z=0 평면뿐, L-V1 백로그). *눈 검증 대기*(헤드리스).

---

## 2. NEXT — 다음 렌즈 (한 커밋 = 한 조각)

> ⚠️ **3D 전환 ([VOXEL.md](VOXEL.md))**: 시뮬 트랙이 voxel 전환(V1~)에 들어갔다. 시뮬 V1·V2 가 닫히면 이 트랙의 다음 렌즈는 **L-V1(voxel 렌즈 — R 점유 인스턴스드 큐브 + E 밝기)**로 교체되고, 아래 하이트필드 기반 렌즈(물 막·∇R 거칠기)는 L-V 사다리로 승계/대체된다. 그 전까지는 현행 로드맵 유효.

**ROADMAP 6렌즈 완주.** 다음 한 조각: **`∇²E` → 안개·응결**(볼류메트릭) — 흐름량 라플라시안 `∇²E`(응결/발산 지표)를 읽어 *안개 밀도*로. 모이는 자리(∇²E<0, 수렴)는 옅은 볼류메트릭 안개·흩어지는 자리는 맑음. 코어 불변(GPU 파생·도함수 읽기)·분포 author 0(RENDER §5 "파생: 안개·응결"). 이후 시뮬 voxel 전환(V1~)이 닫히면 하이트필드 렌즈군은 **L-V 사다리**(voxel 큐브 + E 밝기)로 승계(§2 경고).

---

## 3. OPEN GAPS — 설계(RENDER.md) vs 코드 격차

| 마커 | 격차 | 설계 근거 |
|---|---|---|
| 🔴 | `∇²E` 안개·응결(볼류메트릭) 미구현 — 흐름 수렴/발산을 안 비춤 (다음 렌즈) | RENDER §5 |
| ✅ | ~~FSM 이산 재질~~ → 별 `state`(kindling/burning/ash) 이산 재질 점(VS_STAR), 색·크기·높이 문턱 분기(lerp 0)·stars 없으면 no-op | RENDER §5 |
| ✅ | ~~`∇E` 파생 바람~~ → 중앙차분 ∇E flowmap + uTime 이류 띠로 발광에 *방향* 부여; ~~`geneCol` 4혈통 캡~~ → 황금비 색상환 해시(3곳) | RENDER §4·§5 |
| ✅ | ~~고체 거칠기 = `∇R` 노멀~~ → R 라플라시안 노멀 변조(높이 불변); ~~물 렌즈~~ → 바닥 흡광+프레넬+글린트; ~~z=R+저활성E~~ → `matH=hOf(R)` only | RENDER §2·§5 |

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
| 6 | **FSM → 이산 재질**(kindling/burning/ash) | ✅ DONE |
| — | **6렌즈 완주** → 다음: `∇²E` 안개·응결, 이후 voxel **L-V 사다리**(§2) | ⬜ NEXT |

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
| FSM → 이산 재질 | 별 `sim.stars[].state`(0/1/2) → 이산 재질 점(VS_STAR/FS_STAR): kindling 어두운 응결핵·burning 백열 블룸·ash 회색 잔불, 색·크기·높이 문턱 분기(lerp 0). kIgnite=0 no-op | golden PASS · 3D 스모크 PASS · 눈 검증(브라우저) |
| 별 z = 부력 높이 | `sim.stars[].z`(step-0035) 를 별 점 높이로 `zlift=z·uHS·0.35`(옛 fuel 슬롯 재사용) — 부력 상승 가시화(산서 굴러떨어짐 교정). rise=0/z 미설정 → 0(회귀). L-V1 전 첫 z-인지 렌즈(별 위치만 z) | golden PASS · 3D 스모크 PASS · 눈 검증 대기 |
