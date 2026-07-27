# Phase 5 — 세계 생성 컴파일러

> 근거: §42-5, §4(입력), §5(컴파일 15단계), §6~§18(단계별 생성물), §33(생성 AI의 역할), §2.1(AI 는 정의만 작성, 진행은 코드).

## 목표

`WorldSeedInput`(§4) 몇 문장 → 검증 가능한 `WorldDefinition`(§5) 전체를 생성한다. 출력 포맷은 새로 설계하지 않는다 — **Phase 1~4 가 이미 실행하고 있는 데이터 포맷이 곧 출력 계약**이다. §41 의 첫 세계 입력으로 §40 규모의 세계가 나와야 한다.

## 산출 모듈 (§37 `generation/`)

§37 트리 그대로: `WorldSeedNormalizer` / `AxiomGenerator` / `SchemaGenerator` / `RuleGenerator` / `SpeciesGenerator` / `FactionGenerator` / `AgentGenerator` / `GoalGraphGenerator` (+ 보조: `PressureGenerator`, `SpaceGenerator`, `ResourceGenerator`, `AbilityGenerator`, `ActionGenerator`, `EventPatternGenerator`, `BootstrapGenerator` — §5 의 15단계와 1:1). `WorldValidator` 는 Phase 6.

공통 기반:
- `TextGenerationPort` — LLM 어댑터 인터페이스: `generate(taskId, systemPrompt, input, outputSchema) → 검증된 JSON`. 구현체는 Claude API 등 교체 가능. 코어·시뮬레이션은 이 포트를 전혀 모른다(§2.1).
- `CompilerPipeline` — 15단계(§5 목록 그대로)를 순차 실행하는 오케스트레이터. 각 단계의 입출력을 `generation-artifacts/<step>.json` 으로 저장 — 단계별 재시도·검토(§36.1 "생성 단계 진행 상태") 가능.

## 상세 설계

### 5.1 단계 구성 — §5 의 15단계 매핑

| §5 단계 | 생성기 | 출력(계약 스키마) | AI/코드 |
|---|---|---|---|
| 1 주제 정규화 | WorldSeedNormalizer | `NormalizedTheme[]`(§6) | AI |
| 2 핵심 명제 | AxiomGenerator | `WorldAxiom[]`(§7) | AI |
| 3 생존 압력 | PressureGenerator | `SurvivalPressureDefinition[]`(§8) | AI |
| 4 상태 스키마 | SchemaGenerator | `StateSchema[]`(§9) | AI |
| 5 세계 규칙 | RuleGenerator | `RuleDefinition[]`(§11, Phase 2 RuleSchema) | AI |
| 6 자원·공간 | ResourceGenerator·SpaceGenerator | §13·§14 구조 | AI+코드* |
| 7 종족 | SpeciesGenerator | `SpeciesDefinition[]`(§15) | AI |
| 8 조직 | FactionGenerator | `FactionDefinition[]`(§17) | AI |
| 9 능력 체계 | AbilityGenerator | `AbilityDefinition[]`(§16) | AI |
| 10 목적 그래프 | GoalGraphGenerator | `GoalGraph`/`GoalTemplate[]`(§19) | AI |
| 11 행동 정의 | ActionGenerator | `ActionDefinition[]`(§21) | AI |
| 12 사건 패턴 | EventPatternGenerator | `EventPattern[]`(§28, Phase 4 스키마) | AI |
| 13 초기 배치 | BootstrapGenerator | `BootstrapDefinition` | AI+코드* |
| 14 정합성 검증 | (Phase 6 WorldValidator) | `ValidationIssue[]`(§34) | 코드+AI보조 |
| 15 실행 데이터 저장 | WorldRepository(Phase 0) | `WorldDefinition` | 코드 |

*코드 병행: §13 의 `calculateResourceRarity` 같은 파생 계산(위험도→희귀도)은 AI 가 아니라 코드가 수행 — AI 는 조건·프로필만 생성하고 배치 수치는 결정론 함수가 계산한다. 초기 배치의 좌표 산출도 시드 RNG 코드 몫.

### 5.2 생성 호출 설계 (§33.1, §33 말미)

- **월드 상태 전체를 전달하지 않는다**(§33): 각 단계의 프롬프트 입력은 (a) 이전 단계 산출물 중 해당 단계가 참조해야 하는 것만 (b) 출력 JSON Schema (c) 개수 목표(§40 규모 표). 예: SpeciesGenerator 입력 = axioms + pressures + 공간 태그 요약, 출력 = 종족 4개.
- 대량 항목(개인 20명, 규칙 40~60개)은 **항목 단위 분할 호출**: 먼저 후보 목록(이름+한 줄 전략)을 생성하고, 개별 항목을 별도 호출로 상세화. 실패한 항목만 재시도 가능.
- 모든 단계 출력은 `outputSchema` 로 즉시 JSON Schema 검증(§34 첫 문장 "그대로 저장하지 않는다"). 검증 실패 시 오류 목록을 붙여 최대 2회 재생성, 그래도 실패면 단계 중단·사람 검토.
- **참조 무결성 사전(“심볼 테이블”)**: 파이프라인이 지금까지 생성된 모든 id(상태 키·규칙·자원·태그…)를 누적 관리하고, 각 호출에 "사용 가능한 id 목록" 으로 제공 + 출력의 미지 id 참조를 기계 검출. §34 "규칙의 대상이 실제로 존재한다" 를 생성 시점에 선방어.

### 5.3 도메인 절차의 프롬프트화

기획서가 절차를 명시한 생성물은 그 절차를 프롬프트 구조로 강제한다:
- 종족: §15 의 6단계 흐름(압력→전략 후보→종족화→장단점→감각→사회 구조)과 전략 목록(§15 의 7전략)을 단계적 출력 필드로 요구.
- 조직: §17 의 7절차(희소 자원 선택→수혜/피해 내부 집단→외부 경쟁자→공개/실제 목적 분리). 조직은 반드시 어떤 자원·규칙의 이용 전략에서 파생(§17 마지막 문단).
- 개인: §18 의 10절차 + traits 는 §18 판단 변수 9종 수치로.
- 능력: §16 의 10절차, 입력은 `AbilityGenerationContext`(§16) — 개인 생성 결과에서 채운다. 제약 강도→출력 범위 계산(절차 7)은 코드 함수로.
- 정규화: §6 "최소한의 구조만 추출, 설정을 지나치게 추가하지 않는다" 를 시스템 프롬프트 제약으로.

### 5.4 결정론과 생성물

LLM 출력 자체는 비결정적이다. 재현성 경계(§39, §44-12)는 **"같은 WorldDefinition + 같은 시드 → 같은 시뮬레이션"** 이다. 따라서 생성 결과는 항상 WorldRepository 에 고정 저장하고, 시뮬레이션 재현은 저장된 정의로부터만 한다. 부트스트랩의 난수(개체 좌표 등)는 정의에 시드로 포함.

### 5.5 UI (§36.1)

세계 생성 화면: 주제/원하는 경험/제외 요소 입력(§4 필드 그대로) → 생성 버튼 → 15단계 진행 표시(단계별 성공/실패/재시도) → 생성 구조 검토(단계 산출물 JSON 뷰) → 저장.

## 구현 스텝

1. `TextGenerationPort` + 스키마 검증 래퍼 + 오프라인 목(mock) 구현(녹화된 응답 재생 — 테스트가 AI 없이 돌게).
2. 심볼 테이블 + CompilerPipeline 골격(단계 저장·재개).
3. 단계 1~4 (정규화·명제·압력·상태 스키마) + §6·§7 예시 입력의 스냅샷 테스트.
4. 단계 5~8 (규칙·자원·공간·종족) — 출력이 Phase 2 RuleEngine 에 실제 로드되는지 확인.
5. 단계 9~13 (조직·능력·목적 그래프·행동·사건 패턴·부트스트랩).
6. §41 첫 세계 전체 생성 → Phase 1~4 런타임에 로드 → 30일 실행.
7. 세계 생성 화면(§36.1).

## 완료 조건 (DoD)

- [ ] §41 의 5개 주제 입력으로 §41 "자동 생성되어야 하는 결과" 10항목이 모두 생성된다(지역 3, 흡수 생물 종, 통제 기관, 연구/밀수/보호 조직, 인간 20명, 목적 그래프, 파벌, 사건 패턴 10).
- [ ] 생성물이 §40 규모 표를 만족한다.
- [ ] 생성된 세계가 수정 없이 런타임에 로드되어 30일 실행된다(품질 판정은 Phase 6).
- [ ] 능력 5개가 각 개인의 욕망·경험·제약에서 파생되고(§16 절차, §44-11) 전부 대가·실패 반동을 가진다.
- [ ] 모든 생성 호출이 구조화 입력만 받는다(월드 상태 전체 전달 없음 — 코드 리뷰 체크).
- [ ] mock 포트로 파이프라인 전체가 오프라인 테스트된다.

## 이후 Phase 인터페이스

- 단계 산출물 아티팩트 → Phase 6 검증 대상.
- 심볼 테이블 → Phase 6 참조 검증 재사용.
