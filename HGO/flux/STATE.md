# STATE — 살아있는 현재 (flux 트랙)

> 이 문서는 flux 트랙의 *지금 어디까지·다음 무엇*의 SSOT 다. 설계·철학의 권위는 [SPINE.md](SPINE.md)(단일 규칙 설계도), 실행 절차는 `.claude/skills/hgo-flux-step/SKILL.md`. **step 작업 전 SPINE · 이 STATE 필독.**
>
> flux 트랙은 atom 트랙과 **직교·평행**이다 — 같은 세계를 *단일 국소 규칙*으로 다시 짓는 가설 검증 트랙. 렌더러·뷰어는 atom 자산을 *그대로* 재사용(SPINE §7).

## 1. NOW

- **상태: ✅ step-0001 닫힘 — 부트스트랩 완료.** 공용 하네스(kernel·laws·sim·scenes·verify·golden)가 섰고, 세계의 *유일한 법칙*이 처음 돈다.
- 단일 규칙(SPINE §3) 코딩·고정: `F(i→j)=κ·sign(d)·max(0,|d|−θ)^α`. `engine/flux-laws.js` 의 `rule()` 한 함수 — 이후 법칙 추가 0.
- **기질은 3D**: 셀 위치 = `(rx,ry,rz)`, 이웃 위상 = **3D von Neumann 6-이웃 토러스**(kernel `gridEdges(cols,rows,depth)`). step-0001 = 12×12×12 격자(1728 셀)·중앙 3×3×3 블롭. rz 는 z=0 중심 대칭 → render.js 가 깊이로 읽어 입체 구름으로 그림(렌더 불변·읽기만).
- 검증 4기둥 PASS: Σq **비트 정확** 보존(정수 Δ=0)·결정론(hash 0e7503ec)·골든 회귀 0·확산 평형화(spread 10.01→0.0036). θ=0 순수 확산 국면 확인. κ=0.1(3D 안정 조건 κ·Z<1: 0.1×6=0.6 충족 — 2D κ=0.2×4=0.8 와 같은 안정역).
- **고정소수점 정수 정련(결정론 강화, SPINE §9.3)**: q 를 `qfix=round(q·SCALE)`(SCALE=2¹⁶, kernel) 정수로 저장. 규칙은 정수 `+,−,×,floor` 만(Math.pow 제거) → 크로스플랫폼 비트 결정론(net 트랙 lockstep 전제). 정수 −F/+F 쌍이 Σq 를 *정확* 보존(머신 정밀도보다 강함). `a.x=q/SCALE` 는 렌더 밝기용 파생 실수(읽기 전용·규칙 환류 0). 규칙 *형태* 불변, 표현·연산만 정수화.
- 렌더: 공유 `../viewer.html?track=flux` 가 flux 엔진을 동적 load(브라우저 경로 스모크 통과 — `HGO.kernel/laws/sim/scenes` 등록·렌더 계약 스냅샷 모양 일치). render.js 불변.

## 2. NEXT

### step-0002 가설 (▶ 즉시 다음 step — arc B 임계 진입)

**한 조각**: 같은 규칙·같은 격자에서 **θ 를 올린다**(노브만 — 새 법칙 0). 문턱 아래는 동결, 넘으면 사태.

- 장면 1항: 경사진(또는 무작위 적재) 초기 q + θ>0. 동결↔사태 전이를 띄운다.
- 측정 1개: **사태 크기 분포**(한 tick 에 움직인 셀 수/총 플럭스) — 멱법칙 지수를 잰다. `sim.fluxLast` 가 토대.
- 가설(assert): θ 임계점 부근에서 사태가 척도 불변(멱법칙). SPINE §4 "단일 규칙 + 척도 분리 → 창발 층"의 첫 진짜 시험.

### 이후 (arc, SPINE §8)

- C(구조): 임계 근처 도메인·전선 창발(상관 길이). D(척도 분리): 빠른 국소 평형 + 느린 전역 흐름. E(다채널 촉매): 둘째 보존량.

## 3. OPEN GAPS — 열린 격차 (척추 용어, 매 step 하나씩 메움)

- **🔴 §4 가설 미검증(핵심)**: "단일 규칙 + 척도 분리 → 창발 층"은 아직 확산 한 국면만 봤다 — 동결·임계·구조 층은 *측정으로* 안 나왔다. arc B(step-0002 θ>0)가 첫 시험.
- **🟡 q→렌더 채널 사상 잠정**: x=q 직결(연속). 큰 q 밝기 포화 가능 — 정규화는 render 트랙 눈 검증이 정함(author 금지). 뷰어 실제 화면 미확인(헤드리스·스모크만).
- **🟡 이웃 위상 격자 고정**: 3D von Neumann 6-이웃 토러스. 반경/장거리는 필요해질 때(척도 분리 arc D).
- **⚪ 둘째 보존량(진짜 촉매)**: arc E 까지 보류. 단일 스칼라 q 로 진행.

## 4. DURABLE CONSTRAINTS — 모든 step 이 지킬 정전(canonical) 사실

- **법칙은 1개**: 규칙 함수는 step-0001 에 고정. 이후 step 은 *법칙을 추가하지 않는다*(장면+측정만, SPINE §5). 규칙 정련은 §4 검증이 강제할 때만·회귀 0 의무.
- **Σq 불변(비트 정확)**: 규칙의 반대칭(`F(i→j)=−F(j→i)`)이 보존을 강제 — author 한 회계 아님(SPINE §2). q 가 고정소수점 정수라 같은 정수 F 가 ±로 가 **정확** 상쇄(머신 정밀도가 아니라 비트 0). float 누적 금지.
- **결정론(정수 전용)**: rng 는 초기 배치만. 규칙·tick 은 정수 `+,−,×,floor` 만 — `Math.pow`·float 누적 금지(libm·반올림 비결정 차단, 크로스플랫폼 lockstep). q 표현은 kernel `SCALE`(2¹⁶) 단일 출처.
- **author 0**: 층(고체·유체·전선)은 *측정*으로 드러난다 — 종류 라벨/분기 박기 금지(SPINE §4·§9).
- **트랙 직교**: flux step 은 `../atom/`·`../render/` 를 만지지 않는다. 공유 셸(`../viewer.html`) 매니페스트 한 줄만 부트스트랩이 더함.
- **렌더 불변 재사용**: render.js 한 줄 안 고침 — flux 는 RENDER.md §2 계약 스냅샷만 내보냄(SPINE §7).

## 5. 빠른 참조

- 단일 규칙: `F=κ·sign(d)·max(0,|d|−θ)^α`, `d=qᵢ−qⱼ` (SPINE §3).
- 작업 디렉토리: `HGO/flux/`. 엔진: `engine/`. 장면: `engine/scenes.js`. 뷰어: `../viewer.html?track=flux`.
- 검증: `node engine/verify.js step-NNNN` (4기둥 + 장면 assert). 풀 골든: `engine/validate/`.
- 한 step = 장면 1항 + 측정 1개 + `steps/step-NNNN.md` 1개. 복사 0.

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, **literal 1줄/step**)

- step-0001 ✅ 부트스트랩: 하네스 + 단일 규칙 + 3D 확산 장면(12³ 격자·6-이웃 토러스·κ=0.1) · 4기둥 PASS(Σq 비트 Δ=0·hash 0e7503ec·spread 10.01→0.0036) · 고정소수점 정수 정련(SCALE=2¹⁶·Math.pow 제거·정수 결정론) · render:위치 rx,ry,rz(깊이)·밝기=q/SCALE(L-glow 잠정)
