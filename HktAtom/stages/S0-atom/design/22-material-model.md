# ㉒ MaterialModel ⇧ — 상세 설계 (실제 S1 입력)

> 앵커: 물 V′ 의 방향·밀도 의존이 모델에 담기고 S1 이 소비 가능 · 전제: ⑬~⑯ (형상·극성·수소결합·분산) 이후 · DESIGN §6 · KERNEL §3.3

## 목적

S0 의 **진짜 출력**: ⑪ 임시 스키마 (쌍 테이블) 가 잃는 방향성·밀도 의존·협동 효과를 담은 MaterialModel 을 **굴려서 측정**으로 산출한다. 이것이 원자 시뮬과 MMORPG 런타임을 잇는 핵심 산출물이며, 손 튜닝 금지·오차 한계 명기가 계약이다.

## 더하는 것

### 스키마 (output.json v1 — 필드별 산출법)

```
MaterialModel {
  id, schema:"s0-material-v1", provenance:{scenes, runs, commit},
  stateVariables: [T, rho, composition],          // S1 이 굴릴 상태 축
  freeEnergyModel: { form:'table', P(T,rho) 표, U(T,rho) 표 },   // EOS — NVT 그리드 굴림
  transportCoefficients: { D(T,rho), eta(T,rho), kappa(T,rho) },
  reactionNetwork: [ { reactants, products, k:{A, Ea} } ],       // 행별 측정 k(T) 피팅
  phaseTransitions: [ { indicator, T_range(rho), latent, hysteresis } ],
  surfaceRules: { surfaceEnergy, adsorptionAffinity },
  fractureRules: { bondBreakThreshold(정성) },
  interactionModel: { pairPMF(r) + 방향 보정항 h(각도) + 밀도 보정 g(rho) },  // 물의 요점
  refinementConditions: [ { trigger, action:'S0 재해동' } ],
  validRange: { T, rho, composition }, errorBounds: { 관측량별 ε }
}
```

### 측정 캠페인 (전부 측정 — author 0)

- **EOS**: T×ρ 그리드 NVT 굴림 → P (비리얼)·U 표. 그리드 해상도·평형 판정 기준 명세.
- **수송**: D = MSD 기울기 · η = 전단 운동량 플럭스 (박스 반부 반대 방향 미소 드리프트의 이완 — 간이법 명세) · κ = 온도 구배 정상 상태의 열유속 (⑨ s09-gradient 확장).
- **반응망**: 활성 카탈로그 행별 k(T) 측정 (⑱ 방식) → 아레니우스 피팅 {A, Ea} — *측정값이며 카탈로그 author 값과의 차가 곧 매질 효과*(기록).
- **상전이**: 배위수·확산 계수의 T 스캔 불연속·이력 (히스테리시스) 창 — **상 라벨 author 0** (지표와 창만 기록, 라벨은 S1 몫).
- **방향·밀도 의존 (물 앵커)**: pairPMF 를 각도 빈 (H-결합 정합각) × 주변 밀도 빈으로 확장 측정 — ⑯의 방향 선택성이 표에 담기는지가 닫는 기준.
- **refinementConditions**: validRange 이탈·반응 플럭스 문턱·상전이 창 진입·파괴 문턱 — "언제 원자 해상도로 내려올지" (CLAUDE 세계와 엔진의 관계). 각 트리거의 근거 = 해당 관측량의 errorBounds 초과 예측 지점.
- **errorBounds**: 각 표 항목에 R런 표준오차 + 그리드 보간 오차 — S1 이 오차 전파에 쓴다.

## 검증

1. **스키마 계약**: 검증기 (스키마 valid + 전 필드 provenance 있음 — 손 튜닝 0 증빙).
2. **자기 일관**: EOS 표에서 재유도한 C_v ≈ ⑦ 측정 · 반응망 k ≈ ⑱ 직접 측정 (교차 검증).
3. **물 앵커**: interactionModel 의 방향 보정항이 등방 대비 유의 (⑯ 선택성 반영) · 밀도 보정이 저밀도/고밀도에서 유의차.
4. **소비 리허설**: 최소 S1 스텁 (표 보간으로 P·D 를 조회하는 수십 줄 스크립트 — S1 코드 아님, S0 의 출력 검사기) 가 validRange 내 임의 (T,ρ) 질의에 오차 한계 내 응답.
5. **왕복 (관측량 계약)**: MaterialModel 예측 vs 같은 조건 S0 전해상도 굴림 — errorBounds 내 (승격 검증의 본 형태, KERNEL §3.3).
6. **눈**: EOS 히트맵·상전이 창 표시·refinement 트리거 맵 패널.

## 경계

S1 의 실제 소비·규모 정합은 S1-①·④ 몫 (KERNEL §5). 다성분 혼합물 일반화는 필요 조성만 (물 우선). fractureRules 는 정성 (고체 역학은 S2 재료 — S0 은 결합 파단 문턱만).
