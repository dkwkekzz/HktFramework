---
name: hktatom-step
description: HktAtom step 한 바퀴(읽기→구현·장면→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HktAtom step 진행/다음 step/원자 사다리 step"을 요청하면 사용.
---

# HktAtom step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HktAtom/CLAUDE.md`(목표)·`HktAtom/KERNEL.md`(커널 척추·커널 체크 5항·검증 5기둥·로드맵)·`HktAtom/STATE.md`(현재·다음)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. **작업 디렉토리: `HktAtom/`** — 이하 상대 경로는 이 폴더 기준. 기질: JS 결정론 샌드박스 (단일 `viewer.html` + 헤드리스 `engine/verify.js`).

## 1. 읽기 — 허용 목록만

**필독 3종**: `HktAtom/CLAUDE.md` · `HktAtom/KERNEL.md` · `HktAtom/STATE.md` (전체). 이번 조각은 STATE §2 NEXT 가 정한다 — arc(KERNEL §7) 순서가 우선.

**읽기 금지**(STATE 가 명시 지시할 때만 예외): 옛 `steps/step-NNNN.md`(STATE 가 현재의 SSOT) · HGO/HWS 등 타 트랙 파일(설계는 KERNEL 에 이미 계승돼 있다).

**큰 코드 파일은 부분 읽기만**: `engine/*.js` 전체 읽기 금지 — Grep 으로 직전 장면/파라미터 1개만 찾아 offset/limit 로 해당 구간만. 새 항은 직전 항의 형식을 따른다.

## 2. 더할 것은 둘뿐 — 복사·누적 폐기

한 step 이 더하는 것은 *append-only* 둘뿐:

1. **장면(scene)** — `engine/scenes.js` 에 한 항 (~15줄): `{ id:'step-NNNN', init(초기 배치·knobs), watch(관찰 지표), assert(가설 수치) }`. 이 한 항이 검증·골든 해시·시각화의 단일 출처(DRY).
2. **측정 1개 또는 파라미터 테이블 1항** — `engine/measure.js` 의 측정 함수, *또는* 승격 측정 step 이면 `engine/params/` 에 측정 산출 JSON 1항.

그 외 산출물은 `steps/step-NNNN.md` 하나뿐. **step 마다 html·panel·verify 복사 0개.** 커널 코드(`engine/interact.js`·`promote.js`)의 수정은 *드물고 무거운* 사건 — 노브 opt-in + 회귀 0 (과거 장면 비트 재현) 의무.

> **부트스트랩(Arc A)**: 공용 하네스가 아직 없다. 기반 step 들이 한 번 만든다 (KERNEL §6 목록). 이후 step 은 하네스를 건드리지 않는다.

## 3. 구현 — 커널 체크 5항을 설계 시점에 적용

Edit 로 최소 추가. 설계 전 자문: 규모 분기 `if(ℓ)` 0? 창발을 측정으로? 상위 V 를 손 튜닝하지 않았나? (KERNEL §5 — 하나라도 위반이면 재설계)

## 4. 검증 — 공용 헤드리스 + 단일 뷰어

- `node engine/verify.js step-NNNN` — 5기둥(회귀 0·닫힌 장부 Σc·P·E·결정론·가설 assert·[C~]규모 정합) 수치 출력. 문서의 모든 수치는 이 출력 그대로.
- 골든 풀 런은 `run_in_background` 로 — 포그라운드 대기 금지. 닫기 직전 1회 최종 PASS 확인.
- 시각화: `viewer.html#step-NNNN` — step 문서는 링크만 단다.

## 5. 갱신 — STATE.md 는 Edit 로만

- STATE 전체 Write 금지 — 바뀐 절(§1~4 덮어쓰기·§5 append)만 개별 Edit. 예산 ≤ 20KB · §5 는 literal 1줄.
- `steps/step-NNNN.md` ≤ 14KB — 발견/한계 전문은 여기. **"쉽게 풀어 쓴 설명" 절 필수** (비전문가도 따라오게).

## 6. 닫기 체크리스트

1. 검증 5기둥(KERNEL §8) + 커널 체크 5항(KERNEL §5) 전부 통과 (verify 출력 인용)
2. 골든 풀 런 PASS (회귀 0 알리바이)
3. step 문서에 "쉽게 풀어 쓴 설명" + 뷰어 링크
4. STATE §1~4 Edit + §5 1줄 append
5. 닫은 step 파일은 이후 불변 (장면은 scenes.js 에 동결로 남아 영구 재현)

## 금지 사항 (비용 함정)

- step 마다 panel·html·verify 복사 금지 — 공용 1벌.
- 옛 step 문서를 "참고로" 읽지 않는다 — STATE 가 SSOT.
- 한 step 에 두 조각 이상 금지 — 나머지는 STATE §2 로 전가.
- 커널 코드 수정을 가볍게 하지 않는다 — opt-in 노브 + 회귀 0 없이는 금지.
- 상위 규모 파라미터 손 튜닝 금지 — 측정 파이프라인 산출물만.
