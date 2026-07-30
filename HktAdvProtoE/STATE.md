# STATE.md

> 이 문서는 **현재 핵심 상태와 TODO** 만 담는다. 완료 작업의 상세는 큰 단계별 진행 기록으로 분리한다.

## 구현 현황 (핵심)

설계 문서화 단계. 코드 구현은 아직 시작하지 않았다.

| 문서 | 상태 |
|---|---|
| [design/Design-MMO.md](design/Design-MMO.md) — 세계 설계도 39장 | 작성 완료 |
| [design/Design-Modules.md](design/Design-Modules.md) — 모듈 분할 총론 + 라우터 | 작성 완료 |
| [design/modules/](design/modules/) — 공통 계약 2 + 페이즈 12 + 통합·운영 4 | 작성 완료 |

다음 작업: **V0 (module-contract)** 부터 [40-Agent-Protocol.md](design/modules/40-Agent-Protocol.md) 의 프로토콜대로 진행한다.

## 모듈 상태 보드 (52개)

상태 정의는 [00-Module-Contract.md](design/modules/00-Module-Contract.md) 4절 참조.
`BLOCKED` = 선행 미검증 · `SPECIFIED` = 계약 작성 완료 · `VERIFIED` = 증거 저장 완료.

현재 모든 모듈은 설계 문서상 목적·입출력·대표 검증이 정의되어 있으나 `MODULE.yaml` 과 코드가 없으므로 **`BLOCKED`** 다. V0 만 선행이 없어 즉시 착수 가능하다.

| 페이즈 | 모듈 | 상태 | 문서 |
|---|---|---|---|
| V 검증 기반 | V0 V1 V2 V3 V4 | BLOCKED (V0 착수 가능) | [10](design/modules/10-Phase-V-Verification.md) |
| K 세계 커널 | K0 K1 K2 K3 | BLOCKED | [11](design/modules/11-Phase-K-Kernel.md) |
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

전부 미착수. 정의는 [30-Vertical-Slices.md](design/modules/30-Vertical-Slices.md).

```text
VS0  VS1  VS2  VS3  VS4  VS5  VS6  VS7  VS8  VS9  VS10  VS11
 ─    ─    ─    ─    ─    ─    ─    ─    ─    ─    ─     ─
```

## TODO

### 1차 목표 — 최소 인과 경로 (15개 모듈 + VS0, VS1)

> 브라우저 Lab에서 주체 하나가 현상을 감지하고, 자기 믿음과 목적에 따라 행동을 선택하며,
> 그 행동이 세계 규칙에 의해 사건으로 처리되고, 동일한 사건을 완전히 재생할 수 있게 한다.

- [ ] 모노레포 스캐폴드 (pnpm workspace, Vite, `apps/lab`) — [50-Project-Layout.md](design/modules/50-Project-Layout.md)
- [ ] V0 module-contract
- [ ] V1 schema
- [ ] V2 determinism
- [ ] V3 scenario-runner
- [ ] V4 evidence-gate
- [ ] K0 entity-state
- [ ] K1 predicate-query
- [ ] K2 rule-transaction
- [ ] K3 event-replay
- [ ] **VS0** 결정적 세계 변화
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
