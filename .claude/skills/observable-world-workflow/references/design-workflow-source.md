# design-workflow-source — 절 지도

대상: `HktAdvProtoH/design/Design-Workflow.md` (1257줄)

이 파일은 원문 사본이 아니라 **줄 범위 지도**다. 필요한 절만 `Read(offset, limit)` 으로 읽는다.

| 절 | 제목 | 줄 |
|---|---|---|
| §1 | 기본 구조 (전체 파이프라인 다이어그램) | 5–53 |
| §2 | 역할을 명확하게 분리한다 | 54–72 |
| §3 | Stage 1 — Human Design | 73–130 |
| §4 | Stage 2 — Intent Extraction | 131–194 |
| §5 | Intent 는 구현 요구사항이 아니다 | 195–222 |
| §6 | Stage 3 — Intent 에서 World State 를 도출한다 | 223–301 |
| §7 | World State 의 기준 | 302–338 |
| §8 | Decision Semantic State | 339–360 |
| §9 | Stage 4 — World Rule 정의 | 361–416 |
| §10 | 세계 상태는 Rule 을 통해서만 의미 있게 변경된다 | 417–455 |
| §11 | Rule 에는 설계 추적 정보가 존재한다 | 456–490 |
| §12 | Stage 5 — Observable World State 설계 | 491–502 |
| §13 | Observable World State (Semantic Lossless Projection) | 503–529 |
| §14 | Mining Intent 의 Observable Definition | 530–578 |
| §15 | State 뿐만 아니라 Transition 도 Observable 해야 한다 | 579–624 |
| §16 | Stage 6 — View 는 Observable World State 만 본다 | 625–666 |
| §17 | Rendering 자체가 검증 수단이 된다 | 667–705 |
| §18 | Goal/Possibility 실행도 Observable 해야 한다 | 706–759 |
| §19 | 하나의 Agent 작업 단위 (Implementation Package 구조) | 760–788 |
| §20 | 실제 Package 예제 (WORLD-MINING-001) | 789–874 |
| §21 | Agent 가 할 수 있는 것 | 875–890 |
| §22 | Agent 가 할 수 없는 것 | 891–915 |
| §23 | Agent 가 설계상 부족함을 발견한 경우 (Design Gap) | 916–949 |
| §24 | 구현 완료의 정의 | 950–995 |
| §25 | Semantic Closure 검사 | 996–1040 |
| §26 | Observable Closure 검사 | 1041–1090 |
| §27 | Design → Runtime 전체 Traceability | 1091–1124 |
| §28 | Agent Workflow (원형 다이어그램) | 1125–1170 |
| §29 | 인간의 Review 지점 | 1171–1208 |
| §30 | 최종 원칙 (Rule 1–8) | 1209–1244 |
| §31 | 한 문장으로 정의 | 1245–1257 |

## Stage 별 1순위 fallback

```
Stage 1 Intent          → §4, §5
Stage 2 World Model     → §6, §7, §8, §9, §11, §12–§15, §19, §20
Stage 3 Review          → §29, §30
Stage 4 Implementation  → §10, §16, §17, §21, §22, §23
Stage 5 Verification    → §24, §25, §26, §27
```

> 줄 범위는 문서 수정 시 어긋날 수 있다. 어긋나면 제목으로 `Grep` 해 갱신한다.
