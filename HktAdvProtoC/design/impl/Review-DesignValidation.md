# 1차 구현 ↔ 기획서 전수 재검증 (2026-07-28)

> 목적: Phase 8 완료 후, [Design-MMO.md](../Design-MMO.md) 목차 §1부터 차례대로 **실제 코드와 대조**해 기획 내용이 충분히 반영됐는지 판정하고, 세계 상태의 각 요소가 ViewModel 을 통해 시각적으로 표현되는지 검토한다.
> 방법: 기존 검증 스크립트의 주장(Coverage.md, verify 출력)을 그대로 믿지 않고, 기획서의 인터페이스 필드·수식·목록을 항목 단위로 소스에서 재확인했다. 아래 모든 판정에는 file:line 근거가 있다.

## 0. 실행 근거 (한 번의 명령으로 재현)

```
cd proto && npm run verify   → 합계 70/70 통과 (Phase 1~8 완료 조건 + §44 게이트 13/13)
cd proto && npm test         → Test Files 22 passed · Tests 216 passed
cd proto && npm run smoke    → (본 검증 시점 실행 결과는 §0.1 참조)
```

verify 의 최종 표: §36 네 화면 29/29 · rendering/ 10파일 격리 위반 0 · 같은 SceneViewModel → Canvas 185회 그리기 + 텍스트 294줄 · 표현 누출 0건(금지 사실 6,106개 / 검사 문장 166개) · §44 게이트 13/13.

### 0.1 smoke

(실행 중 — 완료 시 본 절에 출력 원문을 갱신한다)

## 1. 목차 순서 전수 판정 (§1~§45)

판정 기준 — **충분**: 기획 필드·수식·절차가 코드에 실재하고 소비된다 / **부분**: 구조는 있으나 기획 항목 일부가 없거나, 있어도 소비되지 않는다(사문) / **누락**: 해당 없음.

| § | 내용 | 판정 | 핵심 근거 · 발견 사항 |
|---|---|---|---|
| 1 | 목표·생성 요소 16항 | 충분 | 16항 전부 담당 코드 존재. "경제"는 자원·거래·조직 통제의 창발로 구현(§43 이 완성된 시장을 명시 제외 — 정합) |
| 2 | AI/코드 분리 3계층 | 충분 | `TextGenerationPort` 격리(`generation/TextGenerationPort.ts:33-85` 바이트 상한+런타임 키 금지), `presentation/` 은 `shared/narration` 만 import — AI 가 상태를 변경하는 경로 없음 |
| 3 | 아키텍처 7블록 | 충분 | Seed Editor=`WorldSeedPage`, Compiler=`CompilerPipeline`(15단계), Validator=`WorldValidator`, Bootstrapper=`BootstrapGenerator`+`WorldBootstrap`, Runtime=`core/`, Interpreter=`presentation/EventInterpreter`, Viewer=`app/`+`rendering/` |
| 4 | WorldSeedInput | 충분* | 4필드 전부(`generation/GenerationTypes.ts:11-16`). *단 `title` 은 컴파일러가 무시하고 `"제약의 대륙"` 하드코딩(`CompilerPipeline.ts:416`), `desiredExperiences`/`prohibitedElements` 는 1~2단계 프롬프트로만 흘러가고 결과 검증이 없다 → G-11 |
| 5 | WorldDefinition·15단계 | 충분 | 14필드+15단계 기획 순서 그대로(`core/world/types.ts:479-497`, `CompilerPipeline.ts:157-412`). 형태 편차: `spaces` 단수 객체, `goalTemplates`→`GoalGraph[]`. 15단계(저장)는 step 밖에서 수행되는 형식적 단계 |
| 6 | 주제 정규화 | 충분 | `NormalizedTheme`+scope enum 그대로(`GenerationTypes.ts:19-29`), "설정 과잉 추가 금지" 강제(`WorldSeedNormalizer.ts:33-42`) |
| 7 | 핵심 명제 | 충분* | `WorldAxiom` 7카테고리 그대로(`types.ts:401-408`). *`immutable` 필드는 어디서도 읽지 않는 사문 필드 — 명제 위반 탐지는 §33.2 AI 보조 경고(`AiAudit.ts:83-184`)뿐, 하드 검증 없음 → G-12 |
| 8 | 생존 압력 | 충분* | 5필드+기본 압력 10종 그대로(`PressureGenerator.ts:10-21`), 런타임 소비(`GoalSystem.ts:77-118`). *`relatedResources` 는 생성 필수인데 소비자 없음(사문) |
| 9 | 상태 스키마 | 충분 | ownerType 8·dataType 6·updatePolicy 3 전부(`types.ts:17-37`), `derived` 쓰기 금지·`observable`↔신호 계약 강제(`StateSchema.ts:45-145`) |
| 10 | 실제/믿음 분리 | 충분 | `BeliefRecord` 필드 정확(`shared/beliefs.ts:4-11`). **판단의 세계 접근이 `BeliefView` 단일 관문**(`BeliefView.ts:154-177` — observable·감각 범위·지역 존중), 소스 레벨 가드 테스트 존재. 이 분리가 구현 전체에서 가장 강한 부분 |
| 11 | 규칙 구조 | 충분 | 트리거 5종·효과 6종+2(§12/§32 요구분)·관찰·쿨다운·derivedFromAxioms 전부(`RuleTypes.ts`, `RuleEngine.ts`, `EffectExecutor.ts`). §11.4 예시 규칙 실물 로드 |
| 12 | 규칙 DSL | **부분** | 10능력 전부 실행 증명(`capabilities.ts:57-203`), §12 축약형 로더 존재. **그러나 "확률은 5용도로 제한" 이 전혀 미구현** — `chance` 가 모든 효과에 무제한 부착 가능, 용도 라벨·검증기 부재, 5용도 중 엔진이 실현한 것은 2개(softmax 성향 차·행동 선택)뿐이고 관찰 실패는 결정론적 → G-1 |
| 13 | 세계 공간 | **부분** | **3D 는 진짜 3D** — `distance3d`(`shared/state.ts:20-25`)가 규칙·관찰·이벤트·행동 전 경로의 유일한 거리 원시함수, 2D 투영은 뷰 계층에만 격리, z 미탈락 회귀 테스트 존재. `calculateResourceRarity` 가중치 0.55/0.3/0.15 정확. **그러나** `RegionDefinition.resourceProfiles`/`speciesSuitability` 는 생성 중간물(`RegionProfile`)로만 쓰이고 정의에 미보존 — 런타임은 "이 지역에 무엇이 나는가"를 답할 수 없다. `SpaceConnection.requirements` 부재 + 생성 스키마가 `additionalProperties:false` 로 **금지** — "능력이 있어야 건너는 길" 표현 불가 → G-5 |
| 14 | 자원 | **부분** | 구조·desiredBy·생산/소비/변환 규칙 참조 전부 존재. **자원 6대 질문 중 "과도 사용 시 무엇이 발생하는가" 는 필드·규칙·검증 어디에도 없음**(생성 프롬프트도 5개만 나열), `sourceRegions` 는 명시적으로 버려져 rarity 수치로 붕괴 → G-6 |
| 15 | 종족 | **부분** | 생존 전략 7종 기획 문구 그대로+강제, 2단계 생성. **`reproduction`/`socialStructure` 는 생성 후 폐기**(recorded/species.json 에 데이터가 있는데 `toSpeciesDefinition` 이 버림), `abilityAccess` 는 표현 자체가 없음. 정의 8필드 중 런타임이 읽는 것은 `senses` 뿐 — `survivalUnit`·`requiredResources`·`instincts`·`adaptationRules`·`growthRules` 사문 → G-4 |
| 16 | 능력 체계 | 충분 | 13필드+생성 컨텍스트 7필드+10절차 전부 추적 가능. 출력 범위는 AI 가 아니라 코드가 계산(`derivations.ts:21-31` — LLM 자기 평가 차단), §34 "제약↑=출력↑" 단조성 검사 실재. 편차: `failureEffects` 가 actor 한정(타인 피해 반동 불가) |
| 17 | 조직 | **부분** | **조직=주체는 강함** — 전용 AI 없이 동일 판단 파이프라인, collapseConditions 매 tick 감시, 위임 행동, "이름표 조직" 생성 시 예외. **그러나** `structures`/`policies` 타입 자체가 없고(제도 = 자유문 `institution` 1개, 그마저 폐기), `externalRivals` 생성 후 폐기, **`hiddenPurposes` 는 core 어디서도 소비되지 않는 선언 문자열** → G-3 |
| 18 | 개인 | **부분** | 판단 변수 9종 이름까지 정확+비수치 거부. 조직-개인 갈등은 위임 목적 주입으로 실행. **`memories`(초기 기억)·`inventory` 부재**(repo 전체 0건), `values`/`fears` 는 구조체가 아닌 문자열, 절차 1(종족 본능 복사)·7(핵심 관계 필수)은 기계적으로 미강제 → G-7 |
| 19 | 목적 그래프 | **부분** | 노드·엣지 6관계 타입 전부 존재. **`completionEffects` 는 타입·스키마·콘텐츠 어디에도 없음**(대체: creates/reveals 해금+중요도 +8). **`supports`(콘텐츠에 16개 저작됨)와 `alternative` 는 런타임 소비자가 없는 죽은 의미** — 생성물이 존재하지 않는 의미론으로 검증되고 있다 → G-2 |
| 20 | 목적 활성도 | 충분* | 11항 전부 명명된 함수로 존재, 부호 정확, breakdown 화면 노출. 세계 접근은 BeliefView 만. *약점: `feasibility` 가 자기 요구 조건만 세어 믿음 민감도가 낮음(오신념→오판 경로는 expectedUtility 가 담당), conflict 는 한 층 위(`rankGoals`)에서 합산 |
| 21 | 행동 정의 | **부분** | 10필드 전부+NPC/플레이어 동일 체계(분기 1줄뿐) 확인. **행동 예시 21종 중 구현 ~11종 — 협상·설득·거짓말·협박·고용·동맹·계약·증거 은닉·제작·연구 10종 부재**(사회적 조작 계열 전체). **선언된 `visibleSignals` 14종 중 10종은 발신 규칙이 없어 침묵** — 거래·보고·위임·능력 사용이 제3자에게 관찰 흔적을 남기지 않아 §23~§28 을 조용히 굶긴다 → G-2 |
| 22 | 행동 후보·선택 | 충분* | 후보 구조·흐름·softmax 계수(충동 0.01+스트레스 0.005) 정확. *점수식 편차: risk ×0.25 추가 스케일, cost 에 duration/거리 항 추가, 상위 4개 풀 제한, randomness≤0.02 면 결정론적 argmax |
| 23 | 인식 | **부분** | `canObserve` 식 형태·임계 50 정확, 신호→기억 대조→원인 후보→편견→믿음의 5단 파이프라인 완전, 전문 채널 신뢰 감쇠 존재. **관찰 채널 12종 중 8종만** — 촉각·열·문서 부재, 소문은 talk+relayBelief 로 부분 대체 |
| 24 | 기억 | 충분 | 8유형·가중치 0.4/0.3/0.2/0.4 정확, 상인 예시(≥3건→요약 믿음) 문자 그대로 구현, 감쇠·망각·용량 상한. 주의: trauma/betrayal 유형은 선언만 되고 생산 경로 없음 |
| 25 | 관계 | **부분** | 9축+약속(만기·파기 상태) 구현, 변화 4규칙 전부 DSL 콘텐츠로 존재. **`knownSecrets` 는 쓰는 코드가 없고, `affection` 을 변경하는 규칙이 어느 세계에도 0개** — 10필드 중 2개가 장식 → G-8 |
| 26 | 런타임 | 충분 | 스케줄러 필드 정확·결정론 정렬, 루프 7단계 순서 그대로(`SimulationLoop.ts:62-78`), 재판단 조건 7항 중 6항 매핑+관계 변화 트리거는 기획보다 확장. 미세 갭: "목적 긴급도 임계" 트리거는 없음(기획서 자체 스니펫도 동일하게 누락) |
| 27 | 주체 실행 12단계 | 충분 | 12단계 전부 file:line 매핑 가능, idle/무행동 폴백 실재. 편차: 선택 목적 하나가 아니라 순위 전체를 순회하며 쿨다운, 절박도 기반 수용 하한(기획에 없는 게이트) |
| 28 | 사건 자동 탐지 | 충분 | RawWorldChange 6필드·EventPattern 7필드 정확, seed→timeWindow→locationRadius→minParticipants 군집화, 병합·진행·종결 상태 |
| 29 | 사건 중요도 | **부분** | 6항 계수(×8·×12·×0.5·×0.7) 정확, 흡수 시 재계산. **"모든 변화를 보여줄 필요는 없다" 의 필터는 미작동** — 임계 200 은 보고용 수치일 뿐 어떤 화면도 중요도로 숨기지 않음(정렬·색만) → G-9 |
| 30 | 개입 기회 | 충분* | 구조 정확, possibleInteractions 는 고정 목록이 아니라 행동 체계에서 역산, 방관 1급 지원. *참여 모드 예시 8종 중 6종(밀행·기록 절도 행동 없음 — §21 갭의 여파) |
| 31 | 플레이어 | 충분 | 동일 데이터 구조, NPC/플레이어 분기는 `shouldReplan` 1줄뿐, 실행 가능 행동만 표시+실행 시 재검증, 지식 필터는 코어에서. verify: 특권 코드 0건·노출 0종 |
| 32 | 성장 | **부분** | 출처 사건 필수(만료 시 폐기)·수치+선택 구조·능력 예시("이름 붙인 대상…") 문자 그대로 콘텐츠에 실재. **성장 조건 7종 중 6종 — "기존 능력을 다른 방식으로 사용" 규칙 부재**, 능력 성장 트리거가 기획 서사(반복 실패)가 아닌 fear>55 프록시 |
| 33 | 생성 AI 역할 | 충분 | 33.1 8용도=파이프라인 단계, 33.2 5탐지=`AiAudit`(경고 전용), 33.3 6종 표현+구조화 입력 계약+누출 자동 폐기. AI 출력이 세계를 바꾸는 경로 없음 |
| 34 | 생성 검증 | 충분 | ValidationIssue 정확, 10규칙 각각 코드명 붙은 검사기+위반 픽스처로 생존 증명 |
| 35 | 자동 시뮬 테스트 | 충분* | 결과 필드·30일 무개입·8판정·다양성 0.2/0.3/0.3/0.2·깊이 0.25/0.25/0.2/0.3 전부 정확. *자원 "무한 증가" 검사는 스키마 max 가 있어야만 작동, 다양성/깊이 점수는 산출만 하고 합격선 없음(기획도 임계 미제시) |
| 36 | 네 화면 | 충분 | 29항 전수 표시(verify 29/29), 개발자/플레이어 모드는 렌더러 분기가 아닌 빌더 입력, 실제 원인 7줄↔0줄 분리 실증 |
| 37 | 클라이언트 구조 | 충분* | 4페이지·생성 9모듈·렌더러 4+α·저장소 3 전부 존재. 편차는 분할/개명/가산(`viewmodel/`·`presentation/`·`shared/`) — 분해 원칙 5로 문서화된 확장 |
| 38 | Worker 실행 | 충분* | 실제 Worker 구동, §38 메시지 8종 전부+확장, patch 전달은 테스트가 "전량 미전달"을 직접 단언. *`scene_view` 응답은 patch 가 아니라 매 요청 전체 재구성(사용자 조작 단위라 실해 없음) |
| 39 | 저장 구조 | 충분 | 3분리·스냅샷+로그 재실행 해시 일치 테스트·`RandomContext` 문서 그대로 |
| 40 | 초기 규모 11항 | 충분 | 실측(recorded/*.json): 지역 3·장소 12·종족 4·조직 5·개인 20·일반 개체 85·자원 15·행동 20·규칙 59·패턴 10·능력자 5 — 11/11 |
| 41 | 첫 번째 세계 | **부분** | 입력 5문장·자동 생성 10항 전수 검사기 통과. **초기 상태 6개 중 2개(밀렵 동기·지도자 은폐)는 상태가 아니라 `hiddenPurposes` 문자열이고 이 필드는 core 가 소비하지 않는다**; 6항을 검사하는 코드도 없음 → G-3 연동 |
| 42 | 구현 순서 8단계 | 충분 | Phase 0~8 문서+verify 단계별 섹션이 1:1 |
| 43 | 제외 목록 8항 | 충분 | 위반 0(멀티플레이·물리·시장 grep 0건, 이벤트 점프 루프). 주의: three.js 3D 뷰 430줄은 목록 위반은 아니나 "시각 완성도는 첫 목표 아님" 대비 선행 투자 |
| 44 | 완료 조건 13항 | 충분* | 게이트는 하드코딩 없이 런타임 수치로 계산. *§44-10 판정식에 항진 항 1개(`>= 0` — `> 0` 의도로 보임), §44-4 의 "브라우저" 실물 판정은 verify 가 아닌 smoke 소관(증거 문자열도 자백) → G-10 |
| 45 | 최종 5 생성 대상 | 충분* | 5대상 전부 실물 생성·소비. *§45 이름으로 묶은 전용 게이트는 없음(코드·문서에 §45 참조 0건) |

**집계: 충분 33 · 부분 12 · 누락 0** (섹션 단위. 하위 항목 단위의 누락은 아래 갭 목록).

## 2. 갭 목록 (영향 순)

시뮬레이션이 "깊이 있는 세계관·특색 있는 캐릭터"(트랙 목표)로 가는 길을 실제로 막는 순서로 정렬했다.

| # | 갭 | 근거 | 영향 |
|---|---|---|---|
| G-1 | **§12 확률 5용도 제한 미구현.** `chance` 가 모든 효과에 무제한, 용도 라벨·검증기 없음. 5용도 중 엔진 실현 2개, 관찰 실패는 결정론 | `RuleTypes.ts:98-103`, `EffectExecutor.ts:200-238`, `WorldValidation.ts:148-150`(범위 검사뿐) | 생성 AI 가 "확률로 인과를 대체한 규칙"을 내도 걸러지지 않는다 — 기획이 명시한 유일한 확률 원칙이 무방비 |
| G-2 | **§21 사회 행동 10종 부재 + `visibleSignals` 14중 10종 침묵 + §19 `completionEffects`/`supports`/`alternative` 사문.** | actions.json 전수 대조, `ObservationEmitter.ts:11-17`(emit_signal 규칙 있어야만 발신), `GoalSystem.ts:391-459` | 헌터헌터급 깊이를 만들 사회적 조작·정보전 축이 통째로 없다. 거래·위임·능력 사용이 관찰 불가 → 소문·사건 연쇄가 구조적으로 빈곤 |
| G-3 | **§17 `hiddenPurposes` 미소비 → §41 초기 상태 6중 2가 선언 문자열.** `structures`/`policies` 타입 부재 | `types.ts:149`(선언), core 소비 grep 0건, `factions.json` | "지도자의 불법 채굴 은폐"·"밀렵 조직의 장기 수요" 가 목적·행동·비밀로 전개되지 않는다 — §30 의 "플레이어가 모르는 것" 절반이 실행 데이터가 아님 |
| G-4 | **§15 종족 필드 8중 5 사문**(survivalUnit·requiredResources·instincts·adaptationRules·growthRules 를 core 가 안 읽음), reproduction/socialStructure 생성 후 폐기, abilityAccess 부재 | `SpeciesGenerator.ts:131-142`, core grep | 종족은 감각+심볼일 뿐 — 생존 단위·번식·적응이 시뮬레이션에 없어 §15 의 "생존 구조 우선" 이 형식에 그침 |
| G-5 | **§13 `resourceProfiles`/`speciesSuitability` 런타임 미보존, `SpaceConnection.requirements` 스키마가 금지** | `SpaceGenerator.ts:41-50`(측면 채널), `OutputSchemas.ts:230-241` | 지역-자원-종의 생태 결합이 부트스트랩 1회로 끝나고, 조건부 통행(관문·능력 요구)이 표현 불가 |
| G-6 | **§14 "과도 사용의 결과" 무표현·무검증**, sourceRegions 폐기 | `ResourceGenerator.ts:17-23,70`, `WorldValidation.ts:322-324` | 자원 6대 질문 중 1개가 시스템 밖 — 남용 반동(의지 결정 과부하류) 서사 불가 |
| G-7 | **§18 `memories`(초기 기억)·`inventory` 부재**, values/fears 평문 | repo grep 0건, `AgentGenerator.ts` | 과거 사건이 기억 데이터로 시작되지 않아 초기 믿음-기억 연결이 얕고, 소지품 기반 행동(거래 정밀화) 불가 |
| G-8 | **§25 `knownSecrets` 무기록·`affection` 무변경** | `shared/beliefs.ts:67`, 전 세계 규칙 카운트 affection 0 | 비밀 비대칭 — §25 에서 서사적으로 가장 무거운 축 — 이 장식이다 |
| G-9 | **§29 저중요도 필터 미작동**(측정만, 게이트 없음) | `EventDetector.ts:32`, `EventViews.ts:148`(minimumSignificance=0, 프로덕션 호출자 없음) | 규모가 커지면 사소한 변화가 화면·개입 목록을 덮는다 |
| G-10 | **§44-10 게이트 항진 항**(`(detail?.followUps.length ?? 0) >= 0` 는 항상 참), §32 성장 조건 7중 6 | `phase8Checks.ts:620`, player-world/rules.json | 게이트 신뢰도 흠집(1항의 절반이 무판정) |
| G-11 | **§4 `title` 하드코딩·`desiredExperiences`/`prohibitedElements` 결과 미검증** | `CompilerPipeline.ts:416`, `WorldSeedNormalizer.ts:24` | 사용자 입력 4필드 중 3필드가 결과에 대해 책임지지 않는다 |
| G-12 | **§7 `immutable` 사문 — 명제 위반의 하드 검증 없음**(AI 경고만), §8 `relatedResources` 사문 | `AxiomGenerator.ts`, `AiAudit.ts:235-243` | "명제는 모든 콘텐츠의 상위 제약" 이 강제력 없는 선언 |

수식·계수 편차(오류가 아닌 기록): §22 점수식 risk ×0.25·cost 확장, §20 trait 중심화 불일치(GoalSystem 은 −50 중심, ActionPlanner 는 비중심), §8 urgencyGrowth ×10 관례, §27 수용 하한·재판단 쿨다운 60(기획 무근거 게이트).

## 3. ViewModel 시각 표현 검토

파이프라인 자체는 건전하다: `세계 상태 → viewmodel/ 빌더(의미 해석 완결) → rendering/(속성만 소비)` 가 린트+verify 로 상시 강제되고(위반 0), 같은 `SceneViewModel` 을 Canvas·텍스트·three.js 3D 세 렌더러가 동일하게 소비한다(표시 대상 35개 누락 0). 모드(개발자/플레이어)는 렌더러 분기가 아니라 빌더 입력이며 플레이어 시점 누출 0건이 수치로 확인된다.

§1 의 생성 요소별로 "세계 상태가 ViewModel 을 거쳐 **시각적으로**(도형·색·게이지) 표현되는가"를 판정하면:

| 요소 | ViewModel 경로 | 시각 표현 | 판정 |
|---|---|---|---|
| 세계 공간 | `SceneMapRegion`(rect·climateKey·dangerKey·elevation/Shade)·`SceneMapConnection`(width=capacity·dangerKey) | 지역 사각형+기후/위험 색, 연결선 굵기, 3D 고도판 | **시각 ✓** |
| 세계 상태 | 지역/마커 badges, marker `gauge`(체력 바)·`colorKey`(state-critical/afraid), `SceneStateRow` 실제/믿음 병렬 | 지도는 색·게이지로, 상세는 관찰 패널 표 | **시각 ✓** (상세는 표) |
| 개인 캐릭터 | `SceneMapMarker`(shape-sphere·크기 위계·그림자·고도 음영·moving 궤적) + `SceneAgentPanel` 9항 | 입체 도형+이동 궤적+게이지 | **시각 ✓** |
| 종족 | `symbolKey=symbol-species.*`·shape-pyramid(야수)·크기 | 도형·심볼로 구분 | **시각 ✓** (정의 상세는 생성 검토 JSON 만) |
| 사건 | `SceneOverlay`(참여자 평균 위치·반경 링·intensity·urgency·상태 색) + 사건 화면 8항 | 바닥 링+색, 3D 링 | **시각 ✓** |
| 인식(신호) | `SceneSignal`(channelKey·intensity·ttl 페이드) | 채널별 파문/잔광 | **시각 ✓** — 단 G-2 로 발신 자체가 4/14 뿐이라 화면에 오르는 신호 종류가 빈곤 |
| 플레이어 개입 | `emphasized` 링, 타임라인 `byPlayer`, `interventions`·`actionPanel` | 강조 링+기록 교차 | **시각 ✓** |
| 능력 | `SceneAbilityRow`(출력·제약·파생 근거) + 능력 신호 | 패널 텍스트. `ability_manifest` 신호는 미발신(G-2)이라 지도 연출 없음 | **부분** |
| 목적 그래프 | `SceneGoalNode`(activation·11항 breakdown·edges) + 마커 `topGoal` | HTML 목록 — 노드·엣지 텍스트. 그래프 도식 없음 | **부분** (표시는 완전, 시각화는 아님) |
| 조직 | `agentChoices`·사건 참여자·관찰 패널(symbol-faction) | **지도 미등장** — `shape-banner` 도형이 렌더러에 정의돼 있으나 faction 개체는 위치가 없고 `buildMapView` 도 faction 타입을 마커로 만들지 않아 도달 불가 코드 | **부분** |
| 관계 | `SceneRelationRow` 9축 배지 | 텍스트 배지 — 관계망 도식 없음 | **부분** |
| 기억 | `SceneMemoryRow` | 텍스트 목록 | **부분** |
| 성장 | `growthOffers`/`growthLog` | 텍스트 | **부분** |
| 핵심 명제·세계 규칙 | `GenerationViewModel`(단계 아티팩트 JSON·규칙 수 배지) | 생성 검토 화면의 JSON 텍스트뿐. 런타임 화면 없음 — 규칙은 결과(신호·변화)로만 간접 표출 | **부분** (§36 명세에는 요구 없음 — 기획 정합) |
| 생태 구조 | climateKey·위험 색·ecological_conflict 오버레이 | 간접 표출. speciesSuitability 폐기(G-5)로 "어느 종이 어디 사는가" 지도가 원리적으로 불가 | **부분** |
| 경제 | 자원 마커(shape-crystal·quantity/rarity 배지)·거래 타임라인 | 분포는 시각, 흐름은 없음(§43 정합) | **부분** |

요약: **공간·개체·사건·신호·개입** — 시간이 흐르며 변하는 것들 — 은 ViewModel 을 거쳐 제대로 시각화된다. **구조적인 것**(목적 그래프·관계망·조직·성장)은 ViewModel 에 속성이 실려 있으나 표현이 텍스트 목록에 머문다. 조직의 `shape-banner` 도달 불가는 코드상 명확한 미완(빌더가 faction 마커를 만들지 않음)이고, 나머지는 STATE.md "다음" 이 말한 시각 완성도 범위 밖 항목이다.

## 4. 결론

- 기획 45개 섹션 중 **33 충분 / 12 부분 / 0 누락**. 골격(3계층 분리·믿음 기반 판단·이벤트 기반 런타임·사건 탐지·생성 파이프라인·ViewModel 격리)은 기획 수식·계수 수준까지 충실하고, verify 70/70 · test 216/216 이 재현 가능한 근거다.
- "부분" 12건의 공통 패턴은 두 가지다: ① **생성은 하는데 버리거나 안 읽는 필드**(종족 5필드, hiddenPurposes, resourceProfiles, supports 엣지, knownSecrets …) — 데이터는 기획 모양대로 나오지만 시뮬레이션 의미가 없다. ② **목록의 앞쪽만 구현**(행동 21→11, 채널 12→8, 성장 조건 7→6, 확률 용도 5→2) — 특히 사회적 조작 축(G-2)이 통째로 비어 있어 트랙 목표인 "깊이"의 상한을 지금 규정하고 있다.
- ViewModel 파이프라인은 원칙(린트 강제·누출 0·3렌더러 동일 소스) 면에서 완성이며, 남은 것은 표현 어휘다: 조직 마커 도달 불가 1건(코드 결함), 목적 그래프·관계망의 도식화(범위 판단 필요).
- 후속 작업 우선순위 제안: G-2(사회 행동+신호 발신) → G-3(hiddenPurposes 소비) → G-1(확률 용도 검증) → G-4/G-5(종족·공간 필드 소비) → G-10(게이트 항진 항 1줄 수정, 즉효).
