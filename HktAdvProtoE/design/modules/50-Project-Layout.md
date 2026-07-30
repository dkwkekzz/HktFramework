# 50. 프로젝트 디렉터리 구조

> 상위: [Design-Modules.md](../Design-Modules.md) · 함께 읽기: [00-Module-Contract.md](00-Module-Contract.md)

---

## 1. 전체 구조

```text
/apps
  /client
  /server
  /lab
  /world-editor
  /simulation-dashboard
/packages
  /verification
    /V0-module-contract
    /V1-schema
    /V2-determinism
    /V3-scenario-runner
    /V4-evidence-gate
  /kernel
    /K0-entity-state
    /K1-predicate-query
    /K2-rule-transaction
    /K3-event-replay
  /world-state
    /S0-spatial-affordance
    /S1-natural-state
    /S2-social-economic-state
    /S3-information-aura-state
  /subject
    /U0-subject-core
    /U1-perception
    /U2-belief
    /U3-memory-interpretation
  /possibility
    /G0-action-ontology
    /G1-possibility-grammar
    /G2-graph-activation
    /G3-goal-planner
  /interaction
    /I0-pressure-situation
    /I1-social-strategy
    /I2-commitment-transaction
    /I3-conflict-event-chain
  /progression
    /R0-growth-graph
    /R1-identity-mastery
    /R2-ability-definition
    /R3-ability-runtime
    /R4-ability-audit
  /complex-subjects
    /C0-species-ecology
    /C1-giant-beast
    /C2-organization-nation
    /C3-rule-bearing-god
  /world-compiler
    /W0-requirement-extraction
    /W1-requirement-clustering
    /W2-realization
    /W3-canon-provenance
  /spatial-client
    /X0-region-topology
    /X1-spatial-compiler
    /X2-web-client
    /X3-world-ui
  /runtime
    /N0-authority-server
    /N1-sync-interest
    /N2-simulation-lod
    /N3-persistence
  /authoring
    /A0-content-editor
    /A1-ai-generation
    /A2-static-validation
    /A3-simulation-repair
    /A4-dialogue-assets
    /A5-observability
```

각 패키지 내부 구조는 [00-Module-Contract.md](00-Module-Contract.md) 1절을 따른다.

---

## 2. 앱

| 앱 | 역할 | 의존 |
|---|---|---|
| `apps/lab` | 모듈별 검증 페이지 (`/lab/<module-id>-<name>`) 와 전체 상태 보드 `/lab` | V4 |
| `apps/server` | 권위 서버 프로세스 | N0~N3 |
| `apps/client` | 3D 웹 클라이언트 | X2, X3 |
| `apps/world-editor` | 콘텐츠 작성 편집기 | A0 |
| `apps/simulation-dashboard` | 인과·믿음·생성 근거·커버리지 감사 | A5 |

**`apps/lab` 은 V 페이즈에서 가장 먼저 살아 있어야 한다.** 이후 모든 모듈이 여기에 페이지를 추가한다.

---

## 3. 콘텐츠 데이터

원설계 27장의 콘텐츠 트리는 코드가 아니라 **데이터**로 관리한다.

```text
/content
  /worldviews
  /species
  /cultures
  /organizations
  /rule-families
  /possibility-grammars
  /ability-primitives
  /region-generators
```

| 디렉터리 | 소유 모듈 | 검증 |
|---|---|---|
| `worldviews` | A0, W2 | 세계관 공리 일관성 |
| `species` / `cultures` | G1, C0 | 가능성 문법 스키마 |
| `organizations` | C2 | 조직 검증 체크리스트 |
| `rule-families` | K2 | `RuleSpec` AST 스키마 |
| `possibility-grammars` | G1 | 도달 가능성 |
| `ability-primitives` | R2 | 비용·징후·대응 필수 필드 |
| `region-generators` | X0, X1 | 공간 요구 충족 |

모든 콘텐츠 JSON 은 V1 스키마 게이트를 통과하지 않으면 로드되지 않는다. 콘텐츠에 실행 코드를 넣는 것은 금지한다 ([40-Agent-Protocol.md](40-Agent-Protocol.md) 2절).

---

## 4. 모듈 ID ↔ 패키지 빠른 참조

| ID | 패키지 | 페이즈 문서 |
|---|---|---|
| V0~V4 | `verification/*` | [10](10-Phase-V-Verification.md) |
| K0~K3 | `kernel/*` | [11](11-Phase-K-Kernel.md) |
| S0~S3 | `world-state/*` | [12](12-Phase-S-World-State.md) |
| U0~U3 | `subject/*` | [13](13-Phase-U-Subject.md) |
| G0~G3 | `possibility/*` | [14](14-Phase-G-Possibility.md) |
| I0~I3 | `interaction/*` | [15](15-Phase-I-Interaction.md) |
| R0~R4 | `progression/*` | [16](16-Phase-R-Progression.md) |
| C0~C3 | `complex-subjects/*` | [17](17-Phase-C-Complex-Subjects.md) |
| W0~W3 | `world-compiler/*` | [18](18-Phase-W-World-Compiler.md) |
| X0~X3 | `spatial-client/*` | [19](19-Phase-X-Spatial-Client.md) |
| N0~N3 | `runtime/*` | [20](20-Phase-N-Runtime.md) |
| A0~A5 | `authoring/*` | [21](21-Phase-A-Authoring.md) |

총 52개 모듈.

---

## 5. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 언어 | TypeScript | 모노레포 |
| 빌드 | Vite | TS·Worker·WebAssembly 지원 |
| 렌더링 | Three.js `WebGPURenderer` | 미지원 시 WebGL 2 폴백 |
| 물리·충돌 | Rapier | JS 바인딩 + WASM |
| 서버 동기화 | Colyseus | 권위 서버·매치메이킹 |
| 실행 | Node 단일 프로세스 (초기) | 인터페이스는 N0 구조대로 분리 |
