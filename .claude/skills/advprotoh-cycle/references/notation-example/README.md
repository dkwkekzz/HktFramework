# 명세형 표기법 — 작성 기준 예시

새 Cycle artifact 의 모방 기준이다. 규칙 원본은 [../artifact-format.md](../artifact-format.md)
의 "표기법" 절 — 여기에는 복사해 두지 않는다. 기계 검사는 `npm run cycle:lint`.

artifact 가 명세가 아니라 설득문으로 쓰이며 회당 1,400~2,100줄로 불었던 것이 배경이다.
수사 속에 하중을 받는 문장이 묻히고, 재서술이 원 소유처와 어긋날 수 있는 사본을 만들었다.
형식이 정해지면 길이는 결과로 따라온다 — 그래서 길이 상한이 아니라 표기법이 기준이다.

## 대조본

`cycles/C026-open-what-you-carry/` 의 세 파일을 이 표기법으로 재작성한 것.
원본은 History 라 손대지 않았다 — 정보 대조는 원본과 나란히 읽어 확인한다.

| 파일 | 원본 | 시안 | 비고 |
|---|---|---|---|
| 01-cycle.md | 171줄 | 96줄 (−44%) | Constraint 는 이번 Cycle 적용 한 줄씩 · "먼저인 이유"는 Frontier 필드 한 줄로 |
| 02-intent.md | 245줄 | 101줄 (−59%) | DESIGN TRACE 를 INTENT SET 인라인 Trace 로 흡수 · REUSED 재설명 제거 |
| 08-verification.md | 161줄 | 108줄 (−33%) | 실측·판정 전량 보존 — 원래 정보 밀도가 높던 파일이라 감소 폭이 작다 |

지운 것은 서두 에세이 · 굵은 재강조 · REUSED 의미 재서술 · 중복 절뿐이다.
ID · 판정 · 실측 · 경계 · 부정형 발견(EMPTY-ROOM-HAS-NO-ADDRESS)은 전량 남는다.
