# 50. 프로젝트 디렉터리 구조

> 상위: [Design-Modules.md](../Design-Modules.md) · 원문 대응: 설계 원문 「25. 프로젝트 디렉터리 구조」
>
> **아래 「원문」 절은 설계 원문을 그대로 옮긴 것이다.** 원문에 없는 보조 정보는 맨 끝 「파생 메모」에만 둔다.

---

## 원문

# 25. 프로젝트 디렉터리 구조

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

---

## 파생 메모 (원문에 없음 — 작업 편의용)

### 모듈 ID ↔ 페이즈 문서

원문 「25」의 패키지 그룹과 페이즈 문서의 대응. 각 모듈의 개별 패키지 경로는 해당 페이즈 문서의 파생 메모에도 있다.

| ID | 패키지 그룹 | 페이즈 문서 |
|---|---|---|
| V0~V4 | `/packages/verification` | [10](10-Phase-V-Verification.md) |
| K0~K3 | `/packages/kernel` | [11](11-Phase-K-Kernel.md) |
| S0~S3 | `/packages/world-state` | [12](12-Phase-S-World-State.md) |
| U0~U3 | `/packages/subject` | [13](13-Phase-U-Subject.md) |
| G0~G3 | `/packages/possibility` | [14](14-Phase-G-Possibility.md) |
| I0~I3 | `/packages/interaction` | [15](15-Phase-I-Interaction.md) |
| R0~R4 | `/packages/progression` | [16](16-Phase-R-Progression.md) |
| C0~C3 | `/packages/complex-subjects` | [17](17-Phase-C-Complex-Subjects.md) |
| W0~W3 | `/packages/world-compiler` | [18](18-Phase-W-World-Compiler.md) |
| X0~X3 | `/packages/spatial-client` | [19](19-Phase-X-Spatial-Client.md) |
| N0~N3 | `/packages/runtime` | [20](20-Phase-N-Runtime.md) |
| A0~A5 | `/packages/authoring` | [21](21-Phase-A-Authoring.md) |

원문 「27. 전체 완성 판정」이 “52개 모듈”이라고 명시하며, 위 합계와 일치한다.

### 앱과 모듈의 대응

원문 「25」는 `/apps` 하위 5개 앱만 열거하고 담당 모듈을 지정하지 않는다. 아래는 각 앱이 어느 모듈의 산출물을 실행하는지 정리한 색인이다.

| 앱 | 관련 모듈 | 근거 |
|---|---|---|
| `/apps/lab` | V4 | 원문 「8」의 V4 산출물이 “Lab UI”이고, V 단계 완료 결과가 `/lab` 페이지다 |
| `/apps/server` | N0~N3 | 원문 「18」 Phase N |
| `/apps/client` | X2, X3 | 원문 「17」 X2·X3 |
| `/apps/world-editor` | A0 | 원문 「19」 A0 의 각종 Editor |
| `/apps/simulation-dashboard` | A5 | 원문 「19」 A5 의 Debugger·Viewer·Dashboard |

### 모듈 내부 구조

각 패키지 내부 파일 구성(`MODULE.yaml` · `src/` · `schemas/` · `tests/{unit,property,integration}` · `scenarios/` · `lab/` · `evidence/latest.json`)은 원문 「3」에 있다 → [00-Module-Contract.md](00-Module-Contract.md)

### 콘텐츠 디렉터리 (세계 설계 원본 출처)

원문 「25」에는 콘텐츠 트리가 없다. 아래는 **세계 설계 원본** [Design-MMO.md](../Design-MMO.md) 27장의 `/content` 구성이며, 코드가 아니라 데이터로 관리한다.

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

### 기술 선택 (세계 설계 원본 출처)

원문 「25」에는 기술 스택 규정이 없다. 아래는 [Design-MMO.md](../Design-MMO.md) 27장의 선택이다 — TypeScript 모노레포, Three.js `WebGPURenderer`(WebGPU 미지원 시 WebGL 2), Rapier(JS 바인딩 + WebAssembly), Colyseus(권위 서버·상태 동기화·매치메이킹), Vite(빌드). 서버를 초기에 하나의 Node 프로세스로 실행하되 인터페이스를 분리한다는 규정은 같은 문서 28장에 있다.
