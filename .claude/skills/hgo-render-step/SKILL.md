---
name: hgo-render-step
description: HGO render(시각화) 트랙 렌즈 한 바퀴(읽기→계획→번역→검증 3종→갱신)를 토큰·시간 효율적으로 실행한다. atom 시뮬 트랙과 직교 — 렌즈 번호로 세고 한 커밋 = 한 렌즈. 렌더는 atom 스냅샷을 *읽기만* 한다. 사용자가 "HGO render step 진행/다음 렌즈/렌즈 작업"을 요청하면 사용.
---

# HGO render step(렌즈) 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HGO/render/RENDER.md`(렌즈 척추·입력 계약·author 금지선)와 `HGO/render/STATE.md`(§1 NOW·§2 다음 렌즈·§3 격차). 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HGO/render/`.

> **핵심 불변**: render 트랙은 atom(시뮬)과 **직교**다 — step 번호 없음, 회귀·장부·결정론 4기둥은 시뮬 소유. **한 커밋 = 한 렌즈.** 렌더러는 *읽기만* 한다(형태·질 author 0).

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 2종**: `HGO/render/RENDER.md`(§2 입력 계약 채널·§3 author 금지선·§4 렌즈 로스터·§5 검증) · `HGO/render/STATE.md`(§1 NOW·§2 NEXT·§3 격차·§4 정전·§6 INDEX) — 전체.

**조건부 게이트 확인**: blocked 렌즈(⛔)를 켜려면 시뮬 선행 양이 실렸는지만 확인 — `HGO/atom/STATE.md` §2·§5 의 *해당 양 한 줄*만(전문 금지). 광자 계약 자체는 RENDER §2 에 이미 있다.

**읽기 금지** (atom 시뮬 트랙·직교): `../SPINE.md` 전문 · `../CLAUDE.md` · `../atom/engine/hgo-laws.js`·`hgo-sim.js`·`hgo-kernel.js` 전체 · `../atom/steps/step-NNNN.md` · `golden-sim.json`. 입력 계약(RENDER §2)이 곧 시뮬과의 인터페이스다 — 시뮬 내부를 읽을 필요 없다.

**큰 파일은 부분 읽기**: `engine/render.js`·`engine/spectral.js` 는 이미 작다(통째 OK). 직전 렌즈의 형식(λ→색 번역, 측정 정규화)을 따른다.

## 2. 계획 — 계약 감사로 다음 한 렌즈 고르기

**먼저 계약 감사(audit) — render 가 atom 에 뒤처지지 않게.** `STATE.md` §2 NEXT 가 비어 있거나 오래됐으면, RENDER §2 입력 계약의 **모든 채널·필드**를 한 줄씩 훑어 *각 양이 읽히는 렌즈가 있는가, 없으면 ⛔blocked 사유가 명시됐는가*를 본다(atom STATE §7 INDEX 의 `render:<후보>` 구절이 보조 입력 — 시뮬이 표시한 부채). 빠진 양 = **render 부채**다. 가장 오래된(낮은 atom step) *즉시 가능한* 부채부터 한 렌즈로 연다. *함정 주의*: "위치·질량 채널로 이미 보인다" 류 *가정*을 코드/문서에서 발견하면 그 주장을 믿지 말고 — 눈 검증으로 확인하라(거짓이면 그게 부채다. 예: β붕괴는 Z+N 보존이라 크기로 *안* 보였는데 "이미 보인다"고 적혀 Z→색 렌즈가 8 step 누락됐다).

그 다음 *한 렌즈*만 이번 커밋으로. 더 떠올라도 다음으로 전가.

- **⛔ 시뮬 선행 렌즈는 시작 불가** — `L-T`(온도색)·`L-nuc`(변환 *순간* 섬광)은 시뮬이 그 양/이벤트 신호를 *내보낸 뒤*에만(§4 게이트). 시뮬이 안 내보내면 *시작하지 마라* — 즉시 가능 부채(스냅샷에 *늘 있는* 양: Z·N·e 등)만 진행. 근사로 author 금지(연성 author).
- **즉시 가능 vs blocked 가르기**: 양이 *모든 스냅샷에 늘 실려 있으면*(atoms.{Z,N,e,x,r,v}·photons.{…}·bonds[…]) 즉시 가능 — 연속 정규화 사상으로 읽는다. *이벤트/순간*(붕괴·융합 타임스탬프)·*아직 의미 없는 양*(정적 온도)은 blocked.
- 스캐폴드 없음 — `engine/render.js`(그리기)·`engine/spectral.js`(번역)을 직접 Edit. **render 는 자기 viewer.html 을 두지 않는다** — 공용 단일 뷰어 `HGO/viewer.html`(트랙 밖 공유 셸)이 render 모듈을 load 해 위임(SPINE §6.1). 새 렌즈가 새 채널을 쓰면 공유 셸 배선 한 줄만 추가 가능(atom/ 은 안 건드림).

## 3. 구현 — `render/` 안에서만

- **분포 재성형 0** — 시뮬 양을 *읽어* 색·밝기·크기로 번역만(어느 양이 채널이 되는가). 위치=sim `(rx,ry)` 그대로.
- **정규화는 측정** — 화면 창(λ→nm 등)은 데이터에서 *잰* 범위로. 손으로 박은 임계 금지.
- **시뮬 객체 비변경** — atoms·photons 에 렌더 필드 쓰지 않는다(섬광 등은 렌더 전용 병렬 배열).
- **author 금지선(한 항)**: *어느 양이 색·빛이 되는가* = 읽기(허용) / 분포 재성형·시뮬에 없는 실루엣·질을 손으로 박기 = author(금지).

## 4. 검증 3종 — 화면이 권위

1. **시뮬 알리바이**: 커밋 전 `git status` diff 는 `render/` · `HGO/viewer.html`(공유 셸 배선) · 스킬에만. **`atom/` 은 diff 0**(viewer 가 트랙 밖이라 진짜 disjoint). 잡히면 *실수로 시뮬을 만진 것* — 되돌려라(렌더는 읽기만 → 골든 비트 불변).
2. **헤드리스 스모크**: `node render/engine/validate/smoke.js` — 번역이 옳게 도는지 수치(광자→유효 RGB·물리 순서·스펙트럼선). 새 렌즈는 그 렌즈의 assert 한 항 가법.
3. **눈 검증(권위)**: 헤드리스로는 못 본다 — *사용자 브라우저 확인*이 권위. 공용 단일 뷰어 `HGO/viewer.html` 을 열어 확인 요청하고, 결과를 STATE §6 INDEX 에 기록(예: "눈 검증 PASS(사용자 브라우저)"). + 척추 한 항(형태·질 author 0).
   - **"보인다(covered)" 주장의 게이트**: 어떤 atom 관측 양이 *화면에 보인다*고 STATE §3 격차를 ✅로 닫으려면 **눈 검증을 통과**해야 한다 — 문서에 *적힌 가정*으로 닫지 마라(이번 Z 누락의 근본 원인 = 검증 안 된 "이미 보인다" 주장). 눈 검증 전엔 ⏳로 둔다.

## 5. 갱신 — `STATE.md` 만 Edit 로

- **`atom/` · `../SPINE.md` · `../CLAUDE.md` 절대 안 만진다**(시뮬 소유). `RENDER.md` 척추는 *렌즈 로스터/계약이 바뀔 때만*.
- STATE: §1 NOW·§2 NEXT 덮어쓰기 · §3 격차 갱신(해소=✅) · **§6 INDEX 1줄 append**. §4~5 는 거의 불변.
- 전체 Write 금지 — 바뀐 절만 개별 Edit.

## 6. 닫기 체크리스트

1. 시뮬 알리바이 — `git status` diff 가 `render/` · `HGO/viewer.html`(공유 셸) · 스킬에만 (`atom/` diff 0)
2. 헤드리스 스모크 PASS + 눈 검증(사용자 확인)
3. 척추 한 항(형태·질 author 0) 통과
4. STATE §1~3 Edit + §6 INDEX 1줄 append
5. 커밋 1개 = 렌즈 1개 (atom 파일 diff 0 확인 후 커밋)

## 금지 사항 (비용·정합 함정)

- **atom/ 을 만지지 않는다**(engine·STATE·steps·골든) — 커밋 전 `git status` 로 확인. 그리기 배선은 트랙 밖 공유 셸 `HGO/viewer.html` 에서만(장면·sim 로직·hash 금지).
- ⛔ blocked 렌즈를 시뮬 선행 없이 *근사로 author* 하지 않는다(연성 author — RENDER §3).
- 시뮬 내부(hgo-laws·sim·kernel·step 문서)를 "참고로" 읽지 않는다 — 입력 계약(RENDER §2)이 인터페이스.
- 같은 파일을 반복해서 통째로 다시 읽지 않는다(이미 작고 컨텍스트에 있다).
- 빌드(UE5)는 이 트랙과 무관 — 실행하지 않는다.
