---
name: hws-step
description: HWS 시뮬 step 한 바퀴(읽기→스캐폴드→구현→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HWS step 진행/다음 step"을 요청하면 사용.
---

# HWS step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HWS/CLAUDE.md`(불변 규칙·4기둥)와 `HWS/SPINE.md`(척추 체크 4항)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HWS/`.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HWS/CLAUDE.md` · `HWS/SPINE.md` · `HWS/STATE.md` (전체).
**현재 arc 문서**: STATE §2 가 가리키는 것만 (예: `VOXEL.md`).

**조건부** (해당 작업 시에만): `engine/PANEL.md`(패널 구조 변경 시 — 노브 행 1개 추가면 불필요) · `engine/DESIGN-3D.md`(3D 표현 변경 시).

**읽기 금지** (STATE 가 명시 지시할 때만 예외): `concepts/`(PRIMER.md 등 해설 모음) · `VISION.md` · 옛 `step-NNNN.md` 문서들 · `RENDER*.md`(렌더러 트랙 — 시뮬 step 과 직교).

**큰 코드 파일은 부분 읽기만**:
- `engine/hws-laws.js`(~160KB) 전체 읽기 금지 — Grep 으로 `LAW_ORDER`·`DEFAULTS`·직전 법칙 1개만 찾아 해당 구간을 offset/limit 로 읽는다. 새 법칙은 직전 법칙의 형식을 따른다.
- `engine/hws-kernel.js`·`engine/hws-sim.js`·`engine/validate/verify-sim-engine.js` — 필요한 함수만 Grep 후 부분 읽기.

## 2. 스캐폴드 — 손 복사 금지

```
node engine/new-step.js        # 직전 step 복사·치환 + md/html 골격 자동 생성
```

생성물(panel.js·verify.js·html·md 골격)은 **Edit 로만 수정** — 전체 Write 로 다시 쓰지 마라(복사는 이미 끝났다, 델타만 고친다). 스크립트가 출력하는 "남은 일" 체크리스트를 따른다.

## 3. 구현 — 법칙 1개 + 노브 + LAW_ORDER 한 자리

`engine/hws-laws.js` 에 Edit 로 추가 (노브=0 → early-return = 회귀 0). golden/장부 확장은 *미존재 시 no-op* 가법만.

## 4. 검증 — 풀 골든 런은 백그라운드로

- `node engine/validate/verify-sim-engine.js` 는 **~2.5분 걸린다** — `run_in_background` 로 돌려놓고 그동안 step 문서·panel 작업을 진행하라. 법칙을 고칠 때마다 풀 런을 기다리지 말 것.
- `node step-NNNN/verify.js all` (4기둥 + 가설 수치) — 문서의 모든 수치는 이 출력을 그대로 옮긴다.
- 닫기 직전에 풀 골든 런 1회 최종 PASS 확인.

## 5. 갱신 — STATE.md 는 Edit 로만

- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4 추가분·§5·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 30KB · §1 NOW 항목당 ≤ 6줄(상세는 step 문서로) · §7 은 literal 1줄. 30KB 초과 시 STATE 헤더의 "누적 함정 4가지"부터 정리.
- `step-NNNN.md` 예산 ≤ 14KB — 발견/한계 전문은 여기(STATE 아님).

## 6. 닫기 체크리스트

1. 4기둥 + 척추 체크 4항 전부 통과 (verify 출력 인용)
2. 풀 골든 런 PASS (회귀 0 알리바이)
3. step-NNNN.md "쉽게 풀어 쓴 설명" 절 포함·수치=verify 출력
4. STATE.md §1~6 Edit + §7 1줄 append
5. 닫은 step 파일은 이후 불변

## 금지 사항 (비용 함정)

- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT 다.
- 같은 파일을 반복해서 통째로 다시 읽지 않는다 (이미 컨텍스트에 있다).
- verify 풀 런을 포그라운드로 기다리며 놀지 않는다.
- 빌드(UE5)는 이 트랙과 무관 — 실행하지 않는다.
