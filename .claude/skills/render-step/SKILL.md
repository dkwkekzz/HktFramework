---
name: render-step
description: HWS 렌더러 트랙 렌즈 한 바퀴(읽기→계획→구현→검증 3종→갱신)를 토큰·시간 효율적으로 실행한다. 시뮬 step 과 직교 — 한 커밋 = 한 렌즈. 사용자가 "render step 진행/다음 렌즈/렌즈 작업"을 요청하면 사용.
---

# Render step(렌즈) 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HWS/RENDER.md`(렌더 척추·author 금지선)와 `HWS/RENDER-STATE.md`(§8 진행법 런북·다음 렌즈·격차)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HWS/`.

> **핵심 불변**: 렌더 트랙은 시뮬과 **직교**다 — step 번호 없음, 회귀·verify 4기둥 무관. **한 커밋 = 한 렌즈.** 렌더러는 *읽기만* 한다(형태·질 author 0).

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 2종**: `HWS/RENDER.md`(척추·§3 입력 계약 채널·§6 author 금지선·§8 에너지 질 렌즈) · `HWS/RENDER-STATE.md`(§1 NOW·§2 다음 렌즈·§3 격차·§7 voxel 원칙·§8 소유/불가침·다음 렌즈) — 전체.

**조건부** (해당 작업 시에만): `engine/DESIGN-3D.md`(GL 배관·픽킹·업로드층 변경 시 — 셰이더 색/빛 변조만이면 불필요).

**읽기 금지** (절대 — 시뮬 트랙·직교): `STATE.md` · `SPINE.md` · `CLAUDE.md`(시뮬 step 규칙) · `engine/hws-laws.js`·`hws-kernel.js`·`hws-sim.js` · `step-NNNN.md`/`step-NNNN/*` · `VOXEL.md`(보관됨 — standing 원칙은 RENDER-STATE §7 에 흡수) · `concepts/` · `VISION.md`.

**큰 코드 파일은 부분 읽기만**:
- `engine/hws-3d.js`(~95KB) 전체 읽기 금지 — Grep 으로 고칠 셰이더/빌드 함수(예: `progV`·`FS_*`·인스턴스 빌드 루프·`uploadField`)만 찾아 해당 구간을 offset/limit 로 읽는다. 직전 렌즈의 형식(varying 추가·인스턴스 float 슬롯 가법)을 따른다.

## 2. 계획 — 한 렌즈만

`RENDER-STATE.md` §2 NEXT 가 지정한 *한 렌즈*만 이번 커밋으로. 더 떠올라도 다음으로 전가.

- **⛔ 시뮬 선행 렌즈는 시작 불가** — `L-Q`(흑체 색온도)는 시뮬이 `q`(에너지 질), `L-I`(조명)는 transport 를 *내보내야* 켜진다(§3 blocked 표). 시뮬이 그 양을 안 내보내면 이 렌즈는 *시작하지 마라* — §2 의 성능/정제 칸(greedy meshing·안개 raymarch·물 정렬)만 진행 가능.
- 스캐폴드 없음 — `new-step.js` 는 시뮬 전용. 렌더는 `hws-3d.js` 를 Edit 로 직접 손댄다.

## 3. 구현 — `engine/hws-3d.js` 만 (+ 프레젠테이션 한정 `hws-ui`)

- **분포 재성형 0** — 도함수·필터로 *읽기*만(어느 양이 z·색·빛이 되는가만 고름). 위치=sim `(x,y,z)` 그대로.
- 이웃 필요 양(`∇R`·`∇E`·`∇²E`)은 **CPU 빌드가 6-이웃에서 사전계산**해 인스턴스 float 슬롯에 실어 보낸다(셰이더는 셀별 인스턴스라 이웃을 못 봄).
- **author 금지선(한 항)**: *어느 양*이 색·빛이 되는가 = 읽기(허용) / 분포 재성형·필드에 없는 실루엣·**질을 손으로 박기** = author(금지). 색온도는 시뮬 `q` 발현 전엔 비워 둔다.

## 4. 검증 3종 — 풀 골든 런은 백그라운드로

1. **골든 해시 불변(시뮬 알리바이)**: `node engine/validate/verify-sim-engine.js` — **~2.5분**. `run_in_background` 로 돌려놓고 그동안 RENDER-STATE·구현을 진행하라. 렌더는 시뮬 코드를 안 건드리므로 IDENTICAL 이어야 정상(아니면 실수로 시뮬 파일을 만진 것 — 되돌려라).
2. **3D 스모크**: `node engine/validate/smoke-dom-3d.js` — 셰이더 컴파일·렌즈 표시 헤드리스 확인.
3. **눈 검증(화면이 권위)**: 헤드리스로는 못 본다 — *사용자 브라우저 확인*이 권위다. 스모크 PASS 후 사용자에게 "브라우저에서 확인" 요청하고, 확인 결과를 INDEX 에 기록(예: "눈 검증 PASS(사용자 브라우저 확인)"). + 척추 한 항(형태·질 author 0).

## 5. 갱신 — `RENDER-STATE.md` 만 Edit 로

- **`STATE.md`·`SPINE.md` 절대 안 만진다**(시뮬 소유). `RENDER.md` 척추는 *설계가 바뀔 때만*.
- RENDER-STATE: §1 NOW·§2 NEXT 덮어쓰기 · §3 격차 갱신(해소=✅) · **§6 INDEX 1줄 append**. §7~8 은 고정(거의 불변).
- 전체 Write 금지 — 바뀐 절만 개별 Edit.

## 6. 닫기 체크리스트

1. 골든 해시 IDENTICAL (시뮬 안 건드린 알리바이)
2. 3D 스모크 PASS + 눈 검증(사용자 확인)
3. 척추 한 항(형태·질 author 0) 통과
4. RENDER-STATE §1~5 Edit + §6 INDEX 1줄 append
5. 커밋 1개 = 렌즈 1개 (시뮬 파일 diff 0 확인 후 커밋)

## 금지 사항 (비용·정합 함정)

- **시뮬 파일을 만지지 않는다** — `hws-laws`·`hws-sim`·`hws-kernel`·`STATE.md`·`SPINE.md`·`step-NNNN/*`·`golden-sim.json` 은 불가침. 커밋 전 `git status` 로 diff 가 `hws-3d.js`(+`hws-ui`·`RENDER*.md`)에만 있는지 확인.
- 보관된 `VOXEL.md`·옛 step 문서·concepts 를 "참고로" 읽지 않는다 — RENDER-STATE 가 현재의 SSOT(voxel 원칙은 §7 에 흡수).
- 같은 파일을 반복해서 통째로 다시 읽지 않는다(이미 컨텍스트에 있다). `hws-3d.js` 는 부분 읽기만.
- 골든 풀 런을 포그라운드로 기다리며 놀지 않는다 — 백그라운드.
- ⛔ blocked 렌즈(L-Q·L-I)를 시뮬 선행 없이 *근사로 author* 하지 않는다(연성 author — RENDER §8).
- 빌드(UE5)는 이 트랙과 무관 — 실행하지 않는다.
