# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

설계 문서 작성 완료. **V 페이즈(V0~V4)** 와 **K 페이즈(K0~K3)** 구현 완료, 원문 「20」의
**VS0(결정적 세계 변화)** 통과 — 원문 「28」의 1·2단계(검증 기반 · 세계 커널)가 닫혔다.
아홉 모듈 모두 G0~G8 전부 통과로 **`VERIFIED`** 다
(상세: [progress/](progress/) — [01 스캐폴드+V0](progress/01-scaffold-and-V0.md) ·
[02 V1](progress/02-V1-schema.md) · [03 규약 경화](progress/03-convention-hardening.md) ·
[04 V2](progress/04-V2-determinism.md) · [05 V3](progress/05-V3-scenario-runner.md) ·
[06 V4](progress/06-V4-evidence-gate.md) · [07 V 페이즈 목적 도달 감사](progress/07-V-phase-completion-audit.md) ·
[08 K 페이즈 + VS0](progress/08-K-phase-kernel.md)).

원문 「8」의 「V 단계 완료 결과」(브라우저 `/lab` 여섯 구획: 모든 모듈 상태 · 실패한 검증 · 의존성 그래프 ·
최신 코드 해시 · 리플레이 해시 · 자동 검증 결과)까지 확인했다 — 화면은 저장소의 실제 `MODULE.yaml` 과
`evidence/latest.json` 을 V4 에 넣어 얻은 결과만 그리고, 여섯 구획의 존재와 내용은 `tools/lab-shot.mjs` 가
매 `pnpm verify` 마다 검사한다. 지금 그 화면의 「실패한 검증」은 **“막힌 게이트 없음”** 이다.

| 문서 | 상태 |
|---|---|
| [design/Design-MMO.md](design/Design-MMO.md) — 세계 설계도 39장 | 작성 완료 |
| [design/Design-Modules.md](design/Design-Modules.md) — 모듈 분할 총론 + 라우터 | 작성 완료 |
| [design/modules/](design/modules/) — 공통 계약 2 + 페이즈 12 + 통합·운영 4 | 작성 완료 |

| 코드 | 상태 |
|---|---|
| 모노레포 스캐폴드 (pnpm workspace · Vite · `apps/lab` · `tools/{verify,lab-shot,typecheck,load-ts}.mjs`) | 완료 |
| `packages/verification/V0-module-contract` | `VERIFIED` (증거: [evidence/latest.json](packages/verification/V0-module-contract/evidence/latest.json)) |
| `packages/verification/V1-schema` | `VERIFIED` (증거: [evidence/latest.json](packages/verification/V1-schema/evidence/latest.json)) |
| `packages/verification/V2-determinism` | `VERIFIED` (증거: [evidence/latest.json](packages/verification/V2-determinism/evidence/latest.json)) |
| `packages/verification/V3-scenario-runner` | `VERIFIED` (증거: [evidence/latest.json](packages/verification/V3-scenario-runner/evidence/latest.json)) |
| `packages/verification/V4-evidence-gate` | `VERIFIED` (증거: [evidence/latest.json](packages/verification/V4-evidence-gate/evidence/latest.json)) |
| `packages/kernel/K0-entity-state` | `VERIFIED` (증거: [evidence/latest.json](packages/kernel/K0-entity-state/evidence/latest.json)) |
| `packages/kernel/K1-predicate-query` | `VERIFIED` (증거: [evidence/latest.json](packages/kernel/K1-predicate-query/evidence/latest.json)) |
| `packages/kernel/K2-rule-transaction` | `VERIFIED` (증거: [evidence/latest.json](packages/kernel/K2-rule-transaction/evidence/latest.json)) |
| `packages/kernel/K3-event-replay` | `VERIFIED` (증거: [evidence/latest.json](packages/kernel/K3-event-replay/evidence/latest.json)) |
| `apps/lab` — 원문 「8」 V 단계 완료 화면 (여섯 구획, 저장소 실제 증거) + 모듈 탭 9개 | 동작 중 |
| `tests/conventions.test.ts` — 저장소 규약 검사 (증거·상태 판정은 V4 에 위임) | 동작 중 |
| `tests/slices/vs0.ts` — **VS0 수직 통합 슬라이스** (아홉 모듈, 어느 패키지의 소유도 아니다) | 통과 |

실행 명령:

```bash
pnpm install
pnpm run typecheck              # 타입 검사
pnpm test                       # 전 모듈 + 저장소 규약 + VS0 슬라이스
pnpm lab                        # 브라우저 Lab (원문 「24」 공통 화면 · 모듈 탭)
pnpm verify <ID> --lab          # 증거 발급 → evidence/latest.json  (V0 … V4 · K0 … K3)
pnpm verify <ID> --lab --regression   # G7 회귀 게이트까지 측정 — VERIFIED 에는 이것이 필요하다
```

### 지금 열려 있는 것 · 아직 닫혀 있는 것

아홉 모듈 모두 아홉 게이트를 통과했다.

```text
status=VERIFIED
  막힌 게이트 없음
```

`pnpm verify <ID> --lab` 만 돌리면 G7 이 **미측정**으로 남아 `SLICE_PASS` 에서 멈춘다 —
미측정은 통과가 아니다(원문 「23」). `--regression` 을 함께 켜야 `VERIFIED` 가 나온다.

원문 「27」의 전체 완성 판정은 아직 `false` 다. 남은 것은 **다른 슬라이스와 지표의 측정 주체**이며,
Lab 의 「자동 검증 결과」가 그 목록(측정 주체가 없는 지표 7개)을 그대로 보여 준다.

다음 작업: **S0 (spatial-affordance)** — [12-Phase-S-World-State.md](design/modules/12-Phase-S-World-State.md) 의 계약대로,
[40-Agent-Protocol.md](design/modules/40-Agent-Protocol.md) 의 프로토콜을 따른다.
착수 전에 [progress/00-Module-Checklist.md](progress/00-Module-Checklist.md) 를 읽는다 (만들 파일 · 절차 · 금지 · 자동 검사 목록).

## 모듈 상태 보드 (52개)

상태 정의는 [00-Module-Contract.md](design/modules/00-Module-Contract.md) 4절 참조.
`BLOCKED` = 선행 미검증 · `SPECIFIED` = 계약 작성 완료 · `LAB_PASS` = 브라우저 대표 장면 확인 · `VERIFIED` = 증거 저장 완료.

V0~V4 와 K0~K3 을 제외한 모든 모듈은 설계 문서상 목적·입출력·대표 검증이 정의되어 있으나 `MODULE.yaml` 과 코드가 없으므로 **`BLOCKED`** 다.

아홉 모듈은 `VERIFIED` 다. 원문 「28」의 고정 순서(V0~V4 → K0~K3 → VS0)대로 V 페이즈를 먼저 마치고,
K 페이즈를 얹은 뒤 VS0 에서 아홉 모듈을 함께 승격시켰다. 이 판정은 사람이 적는 값이 아니라
V4 의 감사 결과이며, `pnpm test` 가 저장소의 증거 파일을 V4 에 넣어 매번 다시 확인한다.

| 페이즈 | 모듈 | 상태 | 문서 |
|---|---|---|---|
| V 검증 기반 | **V0 V1 V2 V3 V4** | 다섯 모듈 모두 VERIFIED | [10](design/modules/10-Phase-V-Verification.md) |
| K 세계 커널 | **K0 K1 K2 K3** | 네 모듈 모두 VERIFIED | [11](design/modules/11-Phase-K-Kernel.md) |
| S 공간·상태 | S0 S1 S2 S3 | BLOCKED | [12](design/modules/12-Phase-S-World-State.md) |
| U 주체 인지 | U0 U1 U2 U3 | BLOCKED | [13](design/modules/13-Phase-U-Subject.md) |
| G 가능성·목적 | G0 G1 G2 G3 | BLOCKED | [14](design/modules/14-Phase-G-Possibility.md) |
| I 상호작용·사건 | I0 I1 I2 I3 | BLOCKED | [15](design/modules/15-Phase-I-Interaction.md) |
| R 성장·능력 | R0 R1 R2 R3 R4 | BLOCKED | [16](design/modules/16-Phase-R-Progression.md) |
| C 복합 주체 | C0 C1 C2 C3 | BLOCKED | [17](design/modules/17-Phase-C-Complex-Subjects.md) |
| W 세계 컴파일러 | W0 W1 W2 W3 | BLOCKED | [18](design/modules/18-Phase-W-World-Compiler.md) |
| X 3D·클라이언트 | X0 X1 X2 X3 | BLOCKED | [19](design/modules/19-Phase-X-Spatial-Client.md) |
| N 서버·영속화 | N0 N1 N2 N3 | BLOCKED | [20](design/modules/20-Phase-N-Runtime.md) |
| A 제작·감사 | A0 A1 A2 A3 A4 A5 | BLOCKED | [21](design/modules/21-Phase-A-Authoring.md) |

## 수직 통합 슬라이스 (12개)

**VS0 통과**, 나머지는 미착수. 정의는 [30-Vertical-Slices.md](design/modules/30-Vertical-Slices.md),
실행은 [tests/slices/vs0.ts](tests/slices/vs0.ts) (`pnpm test` 와 `pnpm verify` 가 모두 돌린다).

```text
VS0  VS1  VS2  VS3  VS4  VS5  VS6  VS7  VS8  VS9  VS10  VS11
 ✓    ─    ─    ─    ─    ─    ─    ─    ─    ─    ─     ─
```

VS0 완료 조건 네 줄이 그대로 확인된다 — 에너지 결과 1 · 네 번째 행동은 상태를 전혀 변경하지 않음 ·
모든 변화가 사건 로그에 남음 · 재생 결과 동일.

## TODO

### 1차 목표 — 최소 인과 경로 (15개 모듈 + VS0, VS1)

> 브라우저 Lab에서 주체 하나가 현상을 감지하고, 자기 믿음과 목적에 따라 행동을 선택하며,
> 그 행동이 세계 규칙에 의해 사건으로 처리되고, 동일한 사건을 완전히 재생할 수 있게 한다.

- [x] 모노레포 스캐폴드 (pnpm workspace, Vite, `apps/lab`) — [50-Project-Layout.md](design/modules/50-Project-Layout.md)
- [x] V0 module-contract — `VERIFIED`
- [x] V1 schema — `VERIFIED`
- [x] V2 determinism — `VERIFIED`
- [x] V3 scenario-runner — `VERIFIED`
- [x] V4 evidence-gate — `VERIFIED`
- [x] K0 entity-state — `VERIFIED`
- [x] K1 predicate-query — `VERIFIED`
- [x] K2 rule-transaction — `VERIFIED`
- [x] K3 event-replay — `VERIFIED`
- [x] **VS0** 결정적 세계 변화 — 통과
- [ ] S0 spatial-affordance
- [ ] S1 natural-state
- [ ] U0 subject-core
- [ ] U1 perception
- [ ] G0 action-ontology
- [ ] G1 possibility-grammar
- [ ] G2 graph-activation
- [ ] G3 goal-planner
- [ ] **VS1** 한 주체의 생존 행동

### 이후

순서는 [60-Traceability-And-Completion.md](design/modules/60-Traceability-And-Completion.md) 3절 고정. 1차 목표 완료 전에는 C·W·X·N·A 페이즈로 확장하지 않는다.
