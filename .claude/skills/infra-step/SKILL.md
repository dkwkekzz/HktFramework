---
name: infra-step
description: HktInfra step 한 바퀴(읽기→스캐폴드→구현→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HktInfra step 진행/다음 step"을 요청하면 사용.
---

# HktInfra step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HktInfra/CLAUDE.md`(불변 규칙·4기둥·척추 체크 5항)와 `HktInfra/SPINE.md`(6계층 큰 그림)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HktInfra/`.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HktInfra/CLAUDE.md` · `HktInfra/SPINE.md` · `HktInfra/STATE.md` (전체).

**조건부** (해당 작업 시에만): `TOOLS.md`(박스의 도구/승격 결정 시) · `TESTBED.md`(run.js/report 구조 변경 시 — 통상 step 은 불필요).

**읽기 금지** (STATE 가 명시 지시할 때만 예외): `STATE-INDEX-ARCHIVE.md` · 옛 `step-NNNN.md`·`step-NNNN-concepts.md` 문서들.

**직전 step 코드는 부분 읽기만**: 스캐폴드가 복사를 끝내므로 직전 `net-core.js`(~80KB)·`cluster.js`·`verify.js` 를 통째로 읽을 필요 없다 — 이번 조각이 닿는 박스/모드만 Grep 으로 찾아 해당 구간을 읽는다.

## 2. 스캐폴드 — 복사 전진은 기계가

```
node engine/new-step.js        # 직전 step 전체 복사 + 자기참조·reg 경로 치환 + md/concepts 골격
```

복사 전진(anti-DRY)의 *복사*는 이 스크립트의 일이다. 생성물은 **Edit 로만 수정** — 전체 Write 로 다시 쓰지 마라(step당 ~140KB 복사를 모델이 다시 쓰면 그게 최대 비용이다). 스크립트가 출력하는 "남은 일" 체크리스트를 따른다.

## 3. 구현 — 한 조각 + OFF 플래그

이번 조각의 프로토콜/박스만 Edit 로 추가 (플래그 OFF → 직전 step 비트 동일 = 회귀 0). 한 step 의 박스가 4개를 넘으면 박스 1개=파일 1개 분할(CLAUDE.md 임계 규칙). dual-mode 노출(`module.exports` + `globalThis`) 유지.

## 4. 검증 — spine 사슬은 백그라운드로

- `node run.js` (현재 step 4기둥) — 문서의 모든 수치는 이 출력을 그대로 옮긴다.
- `node run.js spine` (전 시리즈 회귀 사슬)은 오래 걸린다 — `run_in_background` 로 돌려놓고 그동안 문서 작업.
- 시각 확인이 필요할 때만 `node run.js report` — html 손작성 금지.

## 5. 갱신 — STATE.md 는 Edit 로만

- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4 추가분·§5·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 30KB · §1 NOW 항목당 ≤ 6줄(상세는 step 문서로) · §7 은 literal 1줄. 30KB 초과 시 STATE 헤더의 "누적 함정 4가지"부터 정리.
- `step-NNNN.md` ≤ 18KB · `step-NNNN-concepts.md` ≤ 10KB — 발견/한계 전문은 step 문서에(STATE 아님).

## 6. 닫기 체크리스트

1. 4기둥(reg·결정론 전파·권위 보존+수렴·가설) + 척추 체크 5항 통과 (verify 출력 인용)
2. `node run.js` + `node run.js spine` exit 0
3. step-NNNN.md + step-NNNN-concepts.md 작성·수치=verify 출력
4. STATE.md §1~6 Edit + §7 1줄 append
5. 닫은 step 디렉토리는 이후 불변 (동결 단위)

## 금지 사항 (비용 함정)

- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT 다.
- 직전 step 코드를 통째로 읽거나 통째로 다시 쓰지 않는다 — 스캐폴드 + Grep + Edit.
- spine 사슬을 포그라운드로 기다리며 놀지 않는다.
- step-NNNN.html·SYSTEM.html 손작성 금지 (testbed 일원화 — 폐기됨).
- UE5 빌드는 이 트랙과 무관 — 실행하지 않는다.
