# STATE — 살아있는 현재 (flux 트랙)

> 이 문서는 flux 트랙의 *지금 어디까지·다음 무엇*의 SSOT 다. 설계·철학의 권위는 [SPINE.md](SPINE.md)(단일 규칙 설계도), 실행 절차는 `.claude/skills/hgo-flux-step/SKILL.md`. **step 작업 전 SPINE · 이 STATE 필독.**
>
> flux 트랙은 atom 트랙과 **직교·평행**이다 — 같은 세계를 *단일 국소 규칙*으로 다시 짓는 가설 검증 트랙. 렌더러·뷰어는 atom 자산을 *그대로* 재사용(SPINE §7).

## 1. NOW

- **상태: 🌱 스캐폴딩 완료 · 부트스트랩(step-0001) 대기.** 트랙 골격(SPINE·STATE·SKILL·디렉토리)만 섰고, 엔진(`engine/*`)은 아직 0줄이다.
- 단일 규칙(SPINE §3)은 *설계로 고정*: `F(i→j)=κ·sign(d)·max(0,|d|−θ)^α`, `d=qᵢ−qⱼ`. 보존·촉매·임계.
- 렌더 배선(SPINE §7): 공유 `../viewer.html` 가 `?track=flux` 로 이 트랙 엔진을 load 하도록 트랙 매니페스트 추가됨. flux 엔진 파일은 step-0001 이 만들 때까지 미존재(그때 뷰어가 실제로 굴러감).

## 2. NEXT

### step-0001 가설 (▶ 즉시 다음 step — 부트스트랩)

**한 조각**: 공용 하네스 + 단일 규칙 + 첫 장면을 *한 번* 세운다(SPINE §6 부트스트랩).

- `engine/flux-kernel.js` — 이웃 위상(격자 또는 반경) + 수학 유틸. `HGO.kernel` 등록.
- `engine/flux-laws.js` — **단일 규칙 함수 1개**(SPINE §3 그대로). `HGO.laws` 등록. *이것이 트랙의 전부 — 이후 법칙 추가 0.*
- `engine/flux-sim.js` — 셀 상태 `{q,rx,ry}` + tick(동기 갱신) + RENDER.md §2 계약 스냅샷(`atoms`·빈 `photons/bonds/escaped`) 노출. `HGO.sim` 등록.
- `engine/scenes.js` — 레지스트리 + step-0001 장면 1항(균일+섭동 초기 q → 확산). `HGO.scenes` 등록.
- `engine/verify.js` + `engine/validate/` — 공용 헤드리스 검증(4기둥) + 골든 해시.
- 가설(assert): Σq 머신 정밀도 불변 · 같은 시드 재현 · θ=0 이면 순수 확산(평형화).

### 이후 (arc, SPINE §8)

- B(임계): θ 게이트로 동결↔사태, SOC 멱법칙 측정.
- C(구조)·D(척도 분리)·E(다채널 촉매)는 SPINE §8 로드맵 참조.

## 3. OPEN GAPS — 열린 격차 (척추 용어, 매 step 하나씩 메움)

- **🔴 부트스트랩 미완**: 엔진 0줄. step-0001 이 하네스를 세워야 뷰어가 굴러간다.
- **🟡 q→렌더 채널 사상 미정**: 렌더가 읽는 어느 스칼라 채널에 q 를 실을지(밝기 우선) step-0001 에서 확정. RENDER.md §2 계약 준수, author 0.
- **🟡 이웃 위상 미정**: 격자(고정 이웃) vs 반경(공간 질의). step-0001 선택 — 가장 단순한 쪽(격자)부터.
- **⚪ 둘째 보존량(진짜 촉매)**: arc E 까지 보류. 단일 스칼라 q 로 시작.
- **⚪ §4 가설 미검증**: "단일 규칙 + 척도 분리 → 창발 층"은 arc B~D 가 증명/반증.

## 4. DURABLE CONSTRAINTS — 모든 step 이 지킬 정전(canonical) 사실

- **법칙은 1개**: 규칙 함수는 step-0001 에 고정. 이후 step 은 *법칙을 추가하지 않는다*(장면+측정만, SPINE §5). 규칙 정련은 §4 검증이 강제할 때만·회귀 0 의무.
- **Σq 불변**: 규칙의 반대칭(`F(i→j)=−F(j→i)`)이 보존을 강제 — author 한 회계 아님(SPINE §2).
- **결정론**: rng 는 초기 배치만. 규칙·tick 은 결정론(같은 시드 → 같은 해시).
- **author 0**: 층(고체·유체·전선)은 *측정*으로 드러난다 — 종류 라벨/분기 박기 금지(SPINE §4·§9).
- **트랙 직교**: flux step 은 `../atom/`·`../render/` 를 만지지 않는다. 공유 셸(`../viewer.html`) 매니페스트 한 줄만 부트스트랩이 더함.
- **렌더 불변 재사용**: render.js 한 줄 안 고침 — flux 는 RENDER.md §2 계약 스냅샷만 내보냄(SPINE §7).

## 5. 빠른 참조

- 단일 규칙: `F=κ·sign(d)·max(0,|d|−θ)^α`, `d=qᵢ−qⱼ` (SPINE §3).
- 작업 디렉토리: `HGO/flux/`. 엔진: `engine/`. 장면: `engine/scenes.js`. 뷰어: `../viewer.html?track=flux`.
- 검증: `node engine/verify.js step-NNNN` (4기둥 + 장면 assert). 풀 골든: `engine/validate/`.
- 한 step = 장면 1항 + 측정 1개 + `steps/step-NNNN.md` 1개. 복사 0.

## 7. INDEX — 시리즈 검증 현황 (유일하게 append, **literal 1줄/step**)

(아직 없음 — step-0001 부트스트랩이 첫 줄을 더한다.)
