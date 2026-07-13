# FLESH-PLAN — SDF 살 스타일링 설계 (v5 트랙)

> 상태: **F1~F4 구현 완료 + stylized-f 튜닝** (2026-07-13, 설계 2026-07-12).
> `src/fleshdna.js`·`mcflesh.js`·`fleshbake.js`·`main.js`·`index.html`·`tools/flesh-verify.mjs`·
> `tools/flesh-capture.mjs` 참조. 검증: `npm run verify`(Node §10.1 #1~#8 + F4 ALL PASS) +
> `npm run capture`(headless 실제 렌더 → `docs/flesh-stylized-f.png` 5각도 몽타주 — 시각
> 검증은 **우리가 직접**, 육안을 사용자에게 요청하지 않는다). 남은 것: F5(살아있는 살)·UE5 경로.
> 선행 맥락: [ARCHITECTURE.md](ARCHITECTURE.md) §9, `legacy/LOFT-PLAN.md`·`legacy/VERTEX-PLAN.md`
> (v1 교훈 — **코드 import 금지, 사상만 참조**).

---

## 0. 목표와 비전

현재 `src/mcflesh.js` 의 SDF 살(뼈당 캡슐 → Wyvill 가산 → MarchingCubes)을 확장해,

1. **사람처럼** — 직선 테이퍼 원기둥의 로봇 실루엣을 곡선 프로파일·타원 단면·감산 연산으로
   사람이 읽히는 실루엣으로 끌어올린다.
2. **특색 있게** — 살 형태 전체를 작은 JSON("살 DNA")으로 파라미터화해 프리셋·보간·변이로
   개성 있는 캐릭터를 무한 생성한다 (프로젝트 목표인 창발 + AI-only 파이프라인의 접점).
3. **게임에 쓸 수 있게** — SDF 를 런타임 렌더러가 아니라 **모델링 언어**로 쓴다: 레스트
   포즈에서 한 번 굽고(bake) 캡슐 가중치로 자동 스키닝 → 일반 스킨드 메시. 시간적
   앨리어싱(알려진 한계)이 구성상 소멸하고 UE5 내보내기 경로가 열린다.

**비목표 (v1 교훈)**: 레퍼런스 시트 정밀 재현은 하지 않는다 — legacy 가 시트 피팅 정밀도를
좇다 복잡도가 폭발했고("시트 자체의 모순이 잔차의 지배 항"), 이 트랙의 목표는 *읽히는
실루엣 + 파라미터 다양성*이다. 얼굴/손가락 디테일도 범위 밖 (→ §9).

---

## 1. 현재 기반 — 정확한 접점

구현 세션은 아래 실물 코드를 먼저 읽을 것.

| 위치 | 내용 | 이번 설계와의 관계 |
|---|---|---|
| `src/mcflesh.js` | `McFlesh` 클래스 전부 (~100줄). `RES=64`, `HALF=1.15`, `CENTER_Y=0.9`, `BLEND=2.5`, `ISO=(1-1/BLEND²)³≈0.593`. `RADII` 정규식 테이블 → `radiusFor`. `update(bones, simpleName, offsetX)` 가 매 프레임 세그먼트 bbox 안 복셀만 Wyvill `(1-d²/R²)³` 가산 후 `mc.update()` | F1 에서 `RADII`/`radiusFor` 를 DNA 평가로 교체, 필드 채우기를 순수 함수로 추출 |
| `src/main.js` | `simpleName`(83), `PROP_GROUPS`(90)·`applyProps`(233)·`refreshPropSliders`(592) — 슬라이더 패턴, `ch` 구조(`makeCh` 186: `bones`(구동), `allBones`, `boneMap`, `bindWorldQ`, `bindLocalQ/P`, `props`…), `measureClipRootY`(401) — **저장→측정→복구** 패턴, `ui`/`btnSdf`(718), 루프의 `mcFlesh.update(sel.bones, simpleName, sel.slotX)`(741), `window.__hkt`(752) | UI·수명주기·bake 포즈 복구 전부 여기 패턴을 따른다 |
| `index.html` | 패널 CSS/DOM — `#props` 슬라이더 행 구조 | "살" 섹션을 같은 마크업으로 추가 |
| `legacy/` | v1 전체. **import 금지.** | §12 리스크 표에 교훈 매핑 |

**기존 불변 원칙과의 관계** (CLAUDE.md): 리타깃 순수성·채널 분리·사전 접지에 이 트랙은
일절 손대지 않는다. 새 채널 불변을 하나 추가한다:

> **살 채널 분리** — 뼈 `scale`(본 비율)은 길이·골격만, 살 DNA 는 두께·형태만 소유한다.
> DNA 는 뼈 상태를 읽기만 하고(월드 위치·회전) 절대 쓰지 않는다 — 살은 (뼈 포즈, DNA) 의
> 순수 함수다.

이 불변이 STATE.md "본 비율 개선" 항목(그룹 균등 scale 이 두께까지 키우는 문제)의 답이기도
하다: 길이는 뼈, 두께는 살.

### 1.1 스켈레톤 전제 — 골격은 로드하는 것이지 만드는 것이 아니다 (MUST)

과거 구현 시도에서 세션이 자체 골격을 절차 생성해 작업하는 사고가 있었다. 아래는 협상
불가 규칙이다:

- **유일한 골격 소스**: `public/assets/character/X Bot.fbx` · `Y Bot.fbx`(기본은
  `bootstrap()` 이 세우는 X Bot) 또는 사용자가 임포트한 with-skin FBX 를 `makeCh` 가
  로드해 만든 **`ch.bones`(구동 뼈)·`ch.allBones`** 뿐이다. 살 시스템의 모든 코드는 이
  뼈들을 **읽기만** 한다.
- **금지**: `new THREE.Bone()` 등 자체 골격 생성, 뼈 계층 변경(추가·삭제·재부모), 뼈
  이름 변경, 바인드 포즈 재정의, "테스트용 임시 리그"를 뷰어/런타임 코드에 심는 것.
  뼈가 마음에 안 들면 골격을 고치는 게 아니라 **DNA(살 데이터)를 고친다**.
- **이미 풀린 문제를 다시 풀지 말 것**: Mixamo with-skin FBX 의 트윈 리그(Surface+Joints
  교차 배치), 구동 뼈 선정(DFS-첫 뼈), 이름 정규화는 전부 `makeCh`·`simpleName` 이 처리
  완료 상태다 ([ARCHITECTURE.md](ARCHITECTURE.md) §3). 살 코드는 그 결과만 소비한다.
- **이름 기준**: 세그먼트 `match` 정규식은 Mixamo 표준 계층의 `simpleName` 결과를
  기준으로 작성한다 — `hips → spine → spine1 → spine2 → neck → head(+end)`,
  `(left|right)shoulder → arm → forearm → hand(+손가락)`,
  `(left|right)upleg → leg → foot → toe(+end)`. 접두어(`mixamorig:` 유무)는 `simpleName`
  이 흡수하므로 정규식에 넣지 않는다.
- **유일한 예외**: Node 검증(§10.1 #1·#4)의 "합성 2-뼈 리그"는 필드 수학의 단위검증
  픽스처로만 허용 — `tools/` 밖(뷰어·`src/`)으로 나오면 안 된다. 실루엣·스키닝 등
  골격 형상이 결과에 개입하는 검증(#7·#8)은 실제 FBX 골격 치수를 덤프한 픽스처를 쓴다
  (임의 치수 발명 금지).
- **완료 판정도 실물 골격으로**: 어느 Phase 든 X Bot·Y Bot **양쪽**에서 동작해야 완료다
  (둘은 등뼈가 다른 트윈 쪽이라 좋은 회귀쌍이다). 임포트 FBX 는 best-effort — 매칭 안
  되는 뼈는 fallback 반지름으로 두꺼워지지 않게 r=0 처리 여부를 상태줄에 보고한다.

---

## 2. 전체 로드맵

| Phase | 이름 | 산출물 | 의존 |
|---|---|---|---|
| F1 | 살 DNA 채널 + 두께 슬라이더 | `src/fleshdna.js`, mcflesh 개조, UI "살" 섹션 | — |
| F2 | 형태 어휘 — 프로파일 곡선·flatten·cut | fleshdna 스키마 확장, 필드 수학, 기본 인간형 DNA | F1 |
| F3 | bake & 자동 스키닝 | `src/fleshbake.js`, 표시 3-상태, 재굽기 정책 | F1 (F2 권장) |
| F4 | 프리셋 · 보간 · 변이 · 입출력 | 프리셋 배열, lerp/mutate, JSON 입출력 UI | F1~F2 |
| F5 (선택) | 살아있는 살 — 근육 팽창·호흡 | modulation 스키마 (실시간 모드 한정) | F2 |

커밋 단위 = Phase 하나 (F2 는 곡선/flatten/cut 세 커밋로 쪼개도 좋다). 각 Phase 마다
STATE.md 갱신 + §11 검증 수행. F1→F2→F3 순서 고정, F4·F5 는 이후 자유.

---

## 3. 데이터 모델 — 살 DNA 스키마

새 파일 `src/fleshdna.js` 가 소유. 직렬화 가능한 순수 데이터 + 순수 함수만 둔다
(three.js import 금지 — Node 검증을 렌더러 없이 돌리기 위함).

```js
// 살 DNA v1 — 전부 JSON 직렬화 가능해야 한다 (정규식은 문자열 소스로 보관)
{
  version: 1,
  name: 'humanlike',            // 프리셋/파일 표시명
  // 세그먼트 규칙 — simpleName 첫 매칭 (현 RADII 와 같은 우선순위 규약, 위에서부터)
  segments: [
    { match: 'thumb|index|middle|ring|pinky', profile: [[0, 0]] },   // r=0 → 살 생략
    { match: 'end$',    profile: [[0, 0.02]] },
    { match: 'head',    profile: [[0, 0.055], [0.35, 0.09], [0.8, 0.088], [1, 0.06]],
                        flatten: { dir: [0, 0, 1], f: 0.9 }, group: 'head' },
    { match: 'neck',    profile: [[0, 0.05], [1, 0.042]], blend: 1.4, group: 'head' },
    // …(§5.4 기본 인간형 테이블 전체)
  ],
  // 구 가산/감산 — 축 바깥 볼륨(가슴·둔부·종아리 뒤)과 "깎기"(턱밑·허리 옆).
  // 같은 수학, 부호만 다르다 (§5.3). V1 은 구(sphere)만.
  bumps: [
    // { match: 'spine2', t: 0.6, offset: [0.055, 0.045, 0], r: 0.045, strength: 0.9, mirror: true }
  ],
  cuts: [
    // { match: 'spine1', t: 0.5, offset: [0.0, 0.09, 0.0], r: 0.05, strength: 0.6 }
  ],
  // UI 그룹 두께 배율 — 세그먼트의 group 키로 묶인다. 값 1 = DNA 원본.
  groups: { head: 1, torso: 1, arm: 1, hand: 1, leg: 1, foot: 1 },
}
```

필드 의미 (전 좌표·길이 단위는 **미터**, 키 1.7m 정규화 후 월드 기준):

- `segments[].match` — `simpleName`(콜론·mixamorig 접두 제거 소문자)에 대한 정규식 **소스
  문자열**. 자식 뼈 이름으로 매칭한다(세그먼트 = 부모→자식). 첫 매칭 승. 매칭 없으면
  fallback `[[0, 0.04]]` (현 `radiusFor` 기본값과 동일).
- `profile` — `[t, r]` 제어점 배열, `t∈[0,1]` 은 부모(0)→자식(1) 축 위치, `r` 은 그 지점의
  살 반지름(m). 점 1개면 상수. **주의: 현 코드의 테이퍼(부모 반지름→자기 반지름 보간)를
  대체한다** — 프로파일이 세그먼트 양 끝을 모두 정의하므로 부모 반지름 참조는 삭제.
  관절 연속성은 인접 세그먼트의 끝 제어점 r 을 같게 맞추는 것으로 데이터에서 보장한다.
- `flatten` — 타원 단면. `dir` = **바인드 포즈 월드 기준** 단위벡터(캐릭터 전방 +z, 좌우 x,
  상하 y — 뷰어의 Mixamo 바인드가 +z 를 본다), `f∈(0,1]` = 그 방향 반경 배율 (0.7 = 앞뒤로
  30% 납작). 생략 시 원형.
- `blend` — 세그먼트별 블렌드 폭 배율. 필드 반경 `R_field = BLEND × blend × r`. 기본 1.
  legacy 교훈 "목은 넓은 fold 필요" 를 데이터로 흡수하는 노브.
- `group` — `groups` 두께 배율 키. 최종 반지름 = `profile 평가값 × groups[group]`.
- `bumps[]` / `cuts[]` — `match`+`t` 로 세그먼트 위 기준점을 잡고, 세그먼트 로컬
  프레임(§5.3)에서 `offset`(m) 만큼 이동한 중심의 구를 강도 `strength` 로 **가산(bump)** /
  **감산(cut)** 한다. `r` = 구 반지름(m). `mirror: true` 면 `offset[1]`(side) 부호를 반전한
  쌍둥이를 자동 추가 — 한 세그먼트에 좌우 대칭 쌍(가슴 등)을 만들 때 쓴다. 사지처럼
  match 가 좌우 뼈 양쪽에 걸리는 경우(예: `upleg`)는 세그먼트마다 적용되므로 mirror 불필요.
  legacy v1 의 "볼륨 헬퍼" 개념의 v5 판이다.

`fleshdna.js` 가 export 할 순수 함수:

| 함수 | 역할 |
|---|---|
| `defaultDna()` | §5.4 기본 인간형 DNA 깊은 복사 |
| `compileDna(dna)` | 정규식 컴파일 + simpleName→세그먼트 스펙 메모이즈 캐시를 가진 평가기 반환. `resolve(simpleKey)` → `{ lut: Float32Array(33), rMax, flatten, blend, group, cuts[] }` 또는 `null`(r=0). LUT 는 PCHIP 평가(§5.1)를 33 지점 사전 샘플한 것 — 핫루프는 LUT 선형 보간만 한다. `groups` 배율은 resolve 시점에 곱해 LUT 에 반영하고, groups 변경 시 캐시 무효화(`invalidate()`). |
| `lerpDna(a, b, t)` | 숫자 리프 전체 선형 보간 (F4). 세그먼트는 match 문자열 기준 짝짓기 — 불일치 항목은 t<0.5 면 a, 아니면 b 것 유지. |
| `mutateDna(dna, seed, amount)` | 시드 PRNG(mulberry32) + Box-Muller 가우시안으로 profile r·flatten f 를 `×(1 + N(0,amount))` 변이, r 은 `[0.5, 1.8]×원본` 클램프 (F4). |
| `serializeDna(dna)` / `parseDna(json)` | JSON 입출력 + `version`/스키마 검증 (F4). |

---

## 4. Phase F1 — DNA 채널 + 두께 슬라이더

**목표**: `RADII` 하드코딩을 DNA 로 대체하고, 그룹 두께를 UI 에서 실시간 조절.
이 단계에서 profile 은 전부 상수 1점(현 RADII 값 그대로)이라 **화면 결과는 기존과 동일**해야
한다 (회귀 기준).

### 4.1 mcflesh.js 개조

1. 필드 채우기를 순수 함수로 추출 — **단일 진실 원천** (실시간·bake·Node 검증 공유):

   ```js
   // segs: [{ ax,ay,az, bx,by,bz, lut, rMax, flatten?, uNow?, blend }] — 그리드 공간 사전 변환 완료
   // dims: { size, yd, zd, halfGrid }  field: Float32Array
   export function fillField(field, dims, segs, spheres) // spheres = bump/cut 통합(부호 strength)
   ```

   현 `update()` 의 복셀 루프를 그대로 옮기되 `R = Ra+(Rb-Ra)*t` 를 LUT 보간으로 교체:
   `const s = t*32, i = s|0, R = lut[i] + (lut[i+1]-lut[i])*(s-i)` (lut 길이 33, 마지막 인덱스
   가드). bbox 는 `rMax`(LUT 최대 × BLEND × blend) 기준 — 기존과 동일하게 보수적.

2. `McFlesh.update(ch, simpleName)` 로 시그니처 변경 (flatten 의 회전 추적에 `ch.bindWorldQ`
   가 필요 — §5.2). 내부에서 `ch.bones`, `ch.slotX`, `ch.dna`(컴파일 캐시) 를 읽는다.
   main.js 루프 호출부(741)도 `mcFlesh.update(sel, simpleName)` 로.

3. `RADII`·`radiusFor` 삭제 → `compileDna(ch.dna).resolve(key)`. 리그 2벌 중복 스킵(`seen`),
   `offsetX` 정렬, 성능 최적화(세그먼트 bbox 순회)는 전부 유지.

### 4.2 main.js 통합

- `makeCh` 에서 `ch.dna = defaultDna()`, `ch.dnaCompiled = compileDna(ch.dna)` — 캐릭터별
  상태 (`ch.props` 와 같은 수명).
- UI: `index.html` 패널에 `#props` 와 동일 마크업으로 **"살" 섹션** 추가 —
  `#fleshWho`(캐릭터명) + `#fleshSliders` + 리셋 버튼. 슬라이더 = `groups` 6개
  (머리·몸통·팔·손·다리·발), 범위 `[0.6, 1.6]` step 0.01. `refreshPropSliders` 를 본떠
  `refreshFleshSliders()` — input 마다 `ch.dna.groups[k] = v; ch.dnaCompiled.invalidate()`.
  SDF 살이 꺼져 있으면 섹션은 보이되 비활성(disabled) — 켜는 법을 사용자가 발견하게.
- `__hkt` 에 `get dna()`, `setDnaGroup(k, v)`, `setDna(json)` 추가 (Node/콘솔 검증용).

### 4.3 완료 기준

- 기본 DNA 상태에서 v4.2 와 실루엣 동일 (Node: 동일 포즈 필드 iso 폭 비교, §11).
- 팔 그룹 1.3 → 팔 세그먼트 LUT 만 ×1.3, 다른 그룹 불변.
- 본 비율 슬라이더(길이)와 살 슬라이더(두께)가 서로 간섭하지 않음을 눈으로 확인.

---

## 5. Phase F2 — 형태 어휘

### 5.1 프로파일 곡선 — PCHIP (Fritsch–Carlson)

제어점 `[t,r]` 을 **단조 큐빅 Hermite(PCHIP)** 로 보간한다. 선택 이유: 제어점을 정확히
통과(튜닝 직관적), C¹ 연속(RES 160 bake 에서도 접힘 없음), **오버슈트 없음**(Catmull-Rom 은
급변 구간에서 r 이 음수/융기 가능 — legacy "round-cone 볼록 껍질" 계열 사고 방지).

구현 (fleshdna.js, ~30줄): 구간 기울기 `dₖ=(rₖ₊₁-rₖ)/(tₖ₊₁-tₖ)`, 접선 `mₖ` = 인접 기울기
부호가 다르거나 0 이면 0, 아니면 조화평균 기반 F-C 공식, 끝점은 단측 기울기 클램프. 평가는
Hermite 기저. `compileDna` 가 33-지점 LUT 로 굽는다 — 핫루프 비용은 F1 과 동일.

### 5.2 flatten — 타원 단면

- **정의**: `dir`(바인드 월드 단위벡터) 방향 반경을 `f` 배. 단면 반타원축 = `(f·R, R)`.
- **애니메이션 추적**: 매 프레임 세그먼트(자식 뼈 `b`)마다
  `dNow = qWorld(b) · qBindWorld(b)⁻¹ · dir` — `ch.bindWorldQ` 는 로드 시 캐시돼 있다
  (main.js 205). 몸통이 돌면 납작한 방향도 같이 돈다.
- **축 직교화**: 세그먼트 축 단위벡터 `â` 에 대해 `u = normalize(dNow − (dNow·â)â)`.
  퇴화 가드: `|dNow − (dNow·â)â| < 0.2` 면 이 프레임은 flatten 생략(축과 거의 평행 —
  단면상 의미 없음).
- **복셀 수학**: 기존 루프가 구한 수직 오프셋 `q=(qx,qy,qz)`, `d² = |q|²` 에서
  `s = q·u` 를 추가로 구해 `d²_eff = s²/f² + (d² − s²)` 로 교체. 이후 `d²_eff` vs `R²`
  비교·Wyvill 은 동일. 추가 비용 = 복셀당 내적 1회 — flatten 없는 세그먼트는 분기로 스킵.
- bbox 는 비-flatten `rMax` 그대로 (보수적, 정확성 무관).
- `u` 는 **세그먼트당 프레임당 1회** 계산해 `segs[]` 에 실어 `fillField` 에 넘긴다
  (그리드 공간 변환도 같은 곳에서) — 순수 함수 유지.

### 5.3 bump·cut — 구 가산/감산

- 세그먼트 로컬 프레임: `â` = 축 방향, `u` = flatten 의 u 와 동일 규약(dir 없으면 월드 +z
  투영, 퇴화 시 +x), `v = â × u`.
- 구 중심 `c = lerp(a, b, t) + offset[0]·u + offset[1]·v + offset[2]·â` (offset 미터).
- 필드: `field[idx] += s × strength × (1 − d²/R_c²)³` (d < R_c, `R_c = BLEND × r`,
  bump `s=+1` / cut `s=−1`). 가산 필드라 순서 무관, 음수 허용(MC 는 iso 교차만 본다).
  bbox 순회는 캡슐과 동일 패턴 — 구현은 bump/cut 을 부호 붙은 `strength` 하나의 구
  리스트로 컴파일해 한 루프로 처리한다 (`fillField(field, dims, segs, spheres)`).
- **bump 가 필요한 이유**: 캡슐+프로파일은 축대칭이라 뼈 축 위의 볼륨만 그린다. 가슴·둔부·
  종아리 뒤 볼록·아랫배처럼 **축에서 벗어난 볼륨**은 bump 없이는 표현 불가 (§5.7 예시).
- bump 의 스키닝 귀속(F3)은 자동 — 가중치가 필드 기여도에서 나오므로 bump 정점은 그
  세그먼트의 뼈를 따른다.
- V1 은 구만. 캡슐 컷·평면 컷은 필요해지면 확장.

### 5.4 기본 인간형 DNA (초기값 — 육안 튜닝 출발점)

현 RADII 를 기준으로 한 시작값. **수치는 규범이 아니라 출발점** — 구현 후 `npm run capture`
캡처 판정 + §11 폭 측정으로 우리가 직접 다듬고, 최종값이 코드의 `defaultDna()` 가 된다.
(실제 튜닝 경위: 두개골은 `head→HeadTop_End` 세그먼트가 본체라는 걸 캡처로 확인해 그쪽에
프로파일을 얹었다 — `neck→head` 는 턱·상부 목. 발끝·정수리 `end$` 첨탑도 캡처로 잡아 완화.)

| match | profile `[t,r]` | flatten | blend | group | 의도 |
|---|---|---|---|---|---|
| `thumb\|index\|middle\|ring\|pinky` | `[[0,0]]` | — | — | — | 손가락 생략 (현행 유지) |
| `end$` | `[[0,0.02]]` | — | — | — | 리프 가늘게 (현행 유지) |
| `head` | `[[0,0.055],[0.35,0.09],[0.8,0.088],[1,0.06]]` | `[0,0,1]`, 0.9 | 1 | head | 턱→두개골 팽창→정수리 수렴 |
| `neck` | `[[0,0.05],[1,0.042]]` | — | 1.4 | head | 목—승모근 완만 fold (legacy 교훈) |
| `spine2` | `[[0,0.095],[0.6,0.105],[1,0.09]]` | `[0,0,1]`, 0.75 | 1 | torso | 흉곽 — 가장 납작 |
| `spine1` | `[[0,0.08],[0.5,0.075],[1,0.09]]` | `[0,0,1]`, 0.8 | 1 | torso | **허리 S커브 잘록** |
| `spine` | `[[0,0.105],[1,0.085]]` | `[0,0,1]`, 0.8 | 1 | torso | 골반 중심(t=0)→하복부 |
| `shoulder` | `[[0,0.045],[1,0.05]]` | — | 1.2 | arm | 어깨 웹 |
| `forearm` | `[[0,0.045],[0.3,0.048],[1,0.03]]` | — | 1 | arm | 전완 볼록→손목 수렴 |
| `arm` | `[[0,0.042],[0.4,0.05],[1,0.042]]` | — | 1 | arm | 상완 이두 볼록 |
| `hand` | `[[0,0.03],[0.5,0.038],[1,0.025]]` | `[0,0,1]`, 0.55 | 1 | hand | 손바닥 패들 (손가락 생략 보상) |
| `upleg` | `[[0,0.085],[0.4,0.075],[1,0.055]]` | — | 1 | leg | 허벅지 테이퍼 |
| `leg` | `[[0,0.055],[0.35,0.062],[1,0.035]]` | — | 1 | leg | **종아리 볼록**→발목 수렴 |
| `foot` | `[[0,0.035],[1,0.03]]` | `[0,1,0]`, 0.6 | 1 | foot | 발등 납작 (상하) |
| `toe` | `[[0,0.028],[1,0.02]]` | `[0,1,0]`, 0.6 | 1 | foot | 발끝 |

matching 순서는 표 순서 그대로 (RADII 규약: 위에서부터 첫 매칭 — `forearm` 이 `arm` 보다
먼저, `upleg` 이 `leg` 보다 먼저). `bumps`/`cuts` 기본은 빈 배열 — 턱밑·겨드랑이 정의가
아쉬우면 그때 추가.

**주의 — `hips` 행은 없다**: 세그먼트는 부모→자식이고 match 는 자식 이름인데, hips 의
부모는 뼈가 아닌 정적 노드라 hips 를 자식으로 하는 세그먼트가 존재하지 않는다 (mcflesh 의
`if (!b.parent?.isBone) continue` — 기존 `RADII` 의 hips 항목은 폐기되는 부모-테이퍼
조회용이었다). 골반 볼륨은 **`spine` 세그먼트의 t=0**(골반 중심 굵기)과 **`upleg`
세그먼트의 t=0**(고관절 좌우 폭)이 나눠 소유한다.

### 5.5 성능 예산

RES 64 실시간 목표 **프레임당 ≤ 10ms** (현재 ~7ms). LUT 보간 + 조건부 내적 1회는 여유
안. 초과 시 완화 순서: flatten 세그먼트 수 축소 → LUT 17지점 → RES 유지(낮추지 말 것 —
화질 회귀).

### 5.6 알려진 물리 특성 — 관절 융기

Wyvill **가산**이라 두 세그먼트가 겹치는 관절에서 필드 합이 iso 를 초과해 살짝 부푼다
(메타볼 고유 특성 — legacy round-cone 껍질 문제와는 다른 현상). 대응은 데이터로: 관절 쪽
끝 제어점 r 을 한 단계 낮춰 상쇄한다 (위 표의 팔꿈치·무릎 끝값이 이미 그렇게 잡혀 있다).
max-블렌드 전환은 하지 않는다 — 부드러운 붙음이 사라진다.

### 5.7 스타일라이즈드 여성 체형 재현 예시 (`stylized-f` 프리셋)

F2 어휘가 실제 목표 체형을 커버하는지의 리트머스. 기준: 무안면 여성 전신 레퍼런스
시트(정면/측면/후면, ~6.5등신, 잘록한 허리·넓은 골반·긴 다리). **부위 → 어휘 매핑**:

| 시트의 특징 | 담당 어휘 | 구체 값 (출발점) |
|---|---|---|
| 어깨 좁고 골반 넓은 역삼각 반전 | 본 비율 `shoulder` 0.85 + `upleg` t=0 r 0.09 | 길이/골격은 뼈, 폭은 살 |
| 잘록한 허리 (정면) | `spine1` profile 저점 | `[[0,0.075],[0.5,0.058],[1,0.082]]` |
| 몸통 전체 앞뒤로 얇음 (측면) | torso flatten 강화 | spine2 f 0.68 · spine1 f 0.7 · spine f 0.75 |
| 가슴 (측면·3/4) | **bump** ×2 (mirror) | `{match:'spine2', t:0.55, offset:[0.055,0.045,0], r:0.045, strength:0.9, mirror:true}` |
| 둔부 (후면·측면) | **bump** — upleg 좌우 세그먼트에 각각 | `{match:'upleg', t:0.1, offset:[-0.055,0,0], r:0.055, strength:0.9}` |
| 허리→둔부 S커브 (측면) | spine 바인드 만곡(공짜) + 둔부 bump + 아랫배 낮은 r | spine t=1 r 0.08 |
| 허벅지 굵고 무릎 가늘게 | `upleg` profile | `[[0,0.09],[0.35,0.078],[1,0.05]]` |
| 종아리 뒤 볼록 (측면 비대칭) | `leg` profile(대칭 근사) + 선택 bump | `{match:'leg', t:0.3, offset:[-0.018,0,0], r:0.028, strength:0.5}` |
| 가는 발목·손목 | profile 끝 제어점 | leg t=1 0.03 · forearm t=1 0.028 |
| 가늘고 긴 목 | `neck` r 하향 + blend 유지 | `[[0,0.045],[1,0.036]]`, blend 1.4 |
| 큰 두개골·작은 턱 (무안면) | `head` profile — §9 기본 노선과 일치 | `[[0,0.048],[0.4,0.092],[0.75,0.09],[1,0.055]]` |
| 6.5등신 | 본 비율 `height`·`head`·`leg` | 살 아님 — 길이 채널 |

교훈 형식으로 남기는 결론: **캡슐+프로파일은 축대칭이라 "축 위" 볼륨만 그린다** — 이
체형의 정체성(가슴·둔부·종아리 뒤)은 전부 축 바깥에 있고, bump 가 그 간극을 메운다
(legacy "볼륨 헬퍼"가 필수였던 것과 같은 이유). 시트 정밀 재현은 여전히 비목표 —
위 값으로 튜닝해 "읽히면" 합격이고, 최종값이 `stylized-f` 프리셋이 된다(§5.7 값은 출발점 —
실제 튜닝 후 `presetDna('stylized-f')` 가 규범). **판정은 baked 캡처(`npm run capture`,
`docs/flesh-stylized-f.png`)로 우리가 직접** 한다 — 참조 시트(정면/3q/측면/후면)와
나란히 놓고 갸름한 두상·좁은 어깨·잘록 허리·넓은 골반·가슴/둔부 bump·긴 다리가 읽히면 합격.

---

## 6. Phase F3 — bake & 자동 스키닝

**목표**: 레스트(바인드) 포즈에서 고해상 1회 폴리곤화 → 정점 용접·스무딩 → 캡슐 기여도
가중치로 자동 스키닝 → `THREE.SkinnedMesh`. 재생 중 필드 계산 0, 앨리어싱 0.

새 파일 `src/fleshbake.js`: `bakeFleshMesh(ch, { res = 160 }) → THREE.SkinnedMesh`.

### 6.1 파이프라인

1. **포즈 저장→바인드 복원**: `measureClipRootY`(main.js 401) 패턴 그대로 —
   `ch.allBones` 의 `quaternion/position` 저장 → `bindLocalQ/P` 로 복원 →
   `updateMatrixWorld(true)` → bake → 저장분 원복. 렌더 사이 동기 실행이라 화면 불변.
   root(접지·스케일·본 비율)는 현재 값 유지 — 구운 메시가 그대로 따라온다.
2. **고해상 필드**: `fillField` 재사용, res 160 (복셀 ≈1.4cm), 같은 `HALF/CENTER_Y` 볼륨.
   메모리 160³ Float32 ≈ 16MB — 1회용, bake 후 해제.
3. **폴리곤화**: 임시 `MarchingCubes(160, dummyMat, false, false, 400000)` 에 필드 복사 후
   `update()` → `position/normal` attribute 를 실제 `count` 만큼 잘라 복사. **오버플로
   가드**: 생성 삼각형이 maxPolyCount 에 닿았으면 상태 메시지로 실패 보고 (조용한 절단
   금지 — "No silent caps").
4. **정점 용접**: 위치를 0.5mm(×2000 반올림) 키로 해시 → 인덱스드 지오메트리.
   MC 출력은 비인덱스드 중복 정점이라 용접 없이는 스무딩·스키닝이 이음새를 만든다.
5. **스무딩**: Taubin (λ=0.5, μ=−0.53, 10회, uniform weight) — 순 Laplacian 은 수축해
   실루엣(=DNA 의 약속)이 얇아지므로 금지. 후 `computeVertexNormals()`.
6. **스키닝 가중치**: 정점 월드 위치에서 **필드와 동일한 수식**(LUT·flatten 포함, blend
   포함)으로 세그먼트별 Wyvill 기여도를 평가 → 상위 4개 정규화 → `skinIndex/skinWeight`.
   세그먼트의 뼈 = 자식 뼈(구동 뼈, `ch.bones` 소속). 기여 0 인 정점(이론상 없음, cut
   근처 방어)은 최근접 세그먼트 가중치 1. 관절 이중 바인딩은 필드 겹침에서 **자동으로**
   나온다 (legacy VERTEX-PLAN "관절 경계 이중 바인딩" 교훈의 공짜 버전).
7. **바인딩**: 정점을 볼륨→월드 공간으로 변환해 지오메트리에 기록, `skeleton = new
   THREE.Skeleton(ch.bones)` (구동 뼈는 씬 그래프 안 — makeCh 참조), `mesh.bind(skeleton,
   identity)` — `boneInverses` 는 바인드 복원 상태의 `bone.matrixWorld⁻¹`. 메시는 씬
   루트에 identity 로 추가. root 이동(클립별 접지 y 포함)은 뼈 matrixWorld 에 포함되므로
   자동 추종.

### 6.2 수명주기·표시 모드

- `ui.sdf: boolean` → `ui.flesh: 'off' | 'live' | 'baked'` 로 교체. `#btnSdf` 버튼이 3-상태
  순환, 라벨 갱신 (`SDF 살 · off / live / baked`). `live` = 기존 실시간 MC, `baked` = 구운
  스킨드 메시 표시 (+MC 숨김).
- `ch.fleshBaked`(메시)·`ch.fleshDirty`(bool) 를 ch 에 둔다. `disposeCh` 가 메시
  제거·지오메트리 dispose (기존 패턴).
- **재굽기 트리거**: DNA 변경(슬라이더·프리셋·변이)과 본 비율 변경(`applyProps`) 은
  `fleshDirty = true`. `baked` 모드에서 dirty 면 슬라이더 입력 종료 후 **400ms 디바운스**로
  재굽기 (bake 는 동기 수백 ms 예상 — 상태줄에 "살 굽는 중…" 표시). `live` 모드는 즉시
  반영이므로 튜닝은 live 에서, 확인은 baked 에서 하는 흐름.
- FBX 원본 메시 표시는 기존 `메시` 토글이 계속 소유 — 살 모드가 건드리지 않는다.

### 6.3 완료 기준

- baked 모드에서 6클립 재생: 관절 찢어짐 없음(무릎·팔꿈치 굽힘 연속), 발 접지 유지,
  표면 떨림(앨리어싱) 부재 — live 모드와 나란히 비교.
- Node: 용접 후 정점 중복 0, `skinWeight` 행 합 ≈1 (±1e-3), 전완 뼈 90° 회전 시 전완
  귀속 정점이 강체 추종 (CPU 로 boneMatrices 적용해 검산).

---

## 7. Phase F4 — 프리셋 · 보간 · 변이 · 입출력

- **프리셋**: `fleshdna.js` 에 `PRESETS = [{ name, dna }]` — `humanlike`(§5.4 기본),
  `stylized-f`(§5.7 레퍼런스 체형), `slim`(전 그룹 0.85 + 허리 잘록 강화),
  `bulk`(torso/arm 1.25 + 어깨 blend↑), `robot`(전부 상수 profile = F1 회귀형).
  UI: 살 섹션에 드롭다운.
- **보간**: 프리셋 A→B 슬라이더 (`lerpDna`) — 체형 모핑 데모 겸 창발 재료.
- **변이**: "변이" 버튼 = `mutateDna(현재, seed 증가, 0.12)` — 누를 때마다 다른 개체.
  seed 는 UI 상태로 표시(재현 가능).
- **입출력**: DNA JSON 내보내기(다운로드)·가져오기(파일 선택/드롭 — 확장자 `.dna.json`
  이면 드롭존이 DNA 로 처리, FBX 분기와 공존). `parseDna` 검증 실패 시 상태줄 보고.
- **UE5 경로 메모** (이 Phase 범위 밖, 방향만): baked SkinnedMesh + 스켈레톤을
  `GLTFExporter` 로 .glb 저장 → UE5 임포트. 리타깃 클립도 같은 뼈 이름이므로 UE 리타기터
  연결 가능. 별도 Phase 로 논의 후 진행.
- **LLM 파이프라인 메모**: DNA 는 의미 있는 키의 작은 JSON 이라 "어깨 넓고 다리 짧은
  드워프" → LLM 이 DNA 생성 → 뷰어 드롭 검증이 그대로 성립. 자동화(생성→스크린샷→평가
  루프)는 HktGameplayGenerator 트랙과 접점이 생길 때 설계.

---

## 8. Phase F5 (선택) — 살아있는 살

실시간(live) 모드 한정 — baked 메시는 정적 스키닝이므로 제외 (모프 번역은 미래 과제).

```js
modulation: {
  breath: { group: 'torso', amp: 0.015, period: 4.0 },          // 흉곽 사인 호흡
  muscles: [ { match: 'arm', joint: 'forearm', gain: 0.25 } ],  // 팔꿈치 굽힘 → 이두 팽창
}
```

- 호흡: 해당 그룹 LUT 배율 `×(1 + amp·sin(2πt/period))` — resolve 캐시를 건드리지 않고
  `fillField` 에 프레임 배율로 전달.
- 근육: 관절 뼈(`joint` 매칭 자식)의 현재 로컬 회전과 바인드 로컬 회전(`bindLocalQ`) 사이
  각도 θ → 해당 세그먼트 배율 `×(1 + gain·θ/π)`. 읽기 전용 — 살 채널 불변 유지.

---

## 9. 머리·얼굴 정책 (범위 밖 — 결정만 기록)

복셀 1.4cm(bake)로도 얼굴은 불가능하다. V1 은 **두상 실루엣까지만** 책임진다 (§5.4 head
프로파일 + flatten). 이후 선택지 (논의 후 별도 설계):

1. 스타일라이즈드 무안면(가면/투구) — MMO 군중용, 추가 작업 0. **기본 노선.**
2. 머리 전용 고해상 서브 그리드 (res 등가 ~0.4cm) — 코·턱 실루엣까지.
3. 별도 제작(또는 생성) 머리 메시를 head 뼈 소켓에 부착 — 살은 목까지.

---

## 10. 검증 계획

CLAUDE.md 작업 방식 준수: 수치 + **한눈에 판정 가능한 캡처**. 시각 검증은 **우리가 직접**
수행한다 — headless Chromium(SwiftShader/ANGLE)로 WebGL2 가 돌아가므로 Playwright 로 실제
렌더해 캡처한다. 순수 계산은 Node(`npm run verify`), 렌더 결과는 캡처(`npm run capture`)
이원화. 육안을 사용자에게 요청하지 않는다.

### 10.1 Node 검증 — `tools/flesh-verify.mjs` (신규)

루트 `eval/` 는 legacy 잔재(권한 문제로 미삭제)이므로 **`tools/` 디렉터리를 새로 판다**.
`fillField`·`fleshdna` 가 순수 함수라 DOM/WebGL 없이 임포트 가능 (three 는 수학용만).

| # | Phase | 검사 | 판정 |
|---|---|---|---|
| 1 | F1 | 기본 DNA vs v4.2 RADII: 동일 합성 2-뼈 리그에서 필드 iso 교차 폭 비교 | 차이 ≤ 복셀 1칸 (회귀 없음) |
| 2 | F1 | `groups.arm=1.3` → arm 세그먼트 LUT ×1.3, 타 그룹 불변 | 정확 일치 |
| 3 | F2 | PCHIP: 제어점 통과·구간 내 min/max 가 제어점 범위 안(오버슈트 0) | 수치 |
| 4 | F2 | 종아리 프로파일: t=0.35 수직 레이의 iso 폭 ≈ 2×0.062 | ±복셀 1칸 |
| 5 | F2 | flatten: u 방향 폭 / v 방향 폭 ≈ f | ±10% |
| 6 | F2 | bump/cut: 구 중심 필드값이 무적용 대비 증가/감소, 원거리 불변, mirror 쌍 대칭 | 수치 |
| 7 | F3 | 용접 후 중복 정점 0 · skinWeight 행 합 1±1e-3 · Taubin 후 bbox 변화 ≤1% | 수치 |
| 8 | F3 | 전완 90° 회전 CPU 스키닝 검산 — 전완 귀속 정점 강체 추종 | 오차 ≤ 1mm |

### 10.2 캡처 체크리스트 (`npm run capture` 로 우리가 렌더·판정 — 사용자에게 요청 금지)

`tools/flesh-capture.mjs` 가 dist 를 헤드리스로 띄워 baked 살을 5각도로 찍어 몽타주 PNG 로
낸다(`docs/flesh-stylized-f.png`). 커밋된 이미지를 열어 아래를 우리가 직접 판정한다.

- F1: 기본 화면이 이전과 동일 / 살 슬라이더로 팔·다리 두께만 변함 / 본 비율과 독립.
- F2: T-포즈에서 허리 잘록·종아리 볼록·흉곽 납작이 읽히는지, 관절 융기 과다 여부.
- F3: baked 표면 매끄러움, 관절 연속, 실루엣이 DNA 약속과 일치.
- stylized-f: 갸름한 두상·좁은 어깨·잘록 허리·넓은 골반·가슴/둔부 bump·긴 다리가
  참조 시트처럼 읽히는지(§5.7). 현재 결과 → `docs/flesh-stylized-f.png`.
- F4: 프리셋 전환·보간 슬라이더·변이 연타 — 개체 다양성이 "캐릭터"로 읽히는가.

---

## 11. 파일 맵 변경 요약

| 파일 | 변경 |
|---|---|
| `src/fleshdna.js` | **신규** — DNA 스키마·PCHIP·compile/lerp/mutate/serialize (three 비의존) |
| `src/mcflesh.js` | `RADII` 삭제, `fillField` 추출·export, `update(ch, simpleName)` 로 변경 |
| `src/fleshbake.js` | **신규** (F3) — bake 파이프라인 |
| `src/main.js` | `ch.dna` 수명, 살 UI 섹션, `ui.flesh` 3-상태, 재굽기 트리거, `__hkt` 확장 |
| `index.html` | 살 섹션 DOM (props 마크업 복제) |
| `tools/flesh-verify.mjs` | **신규** — §10.1 Node 검증 (`npm run verify`) |
| `tools/flesh-capture.mjs` | **신규** — headless 실제 렌더 캡처 (`npm run capture` → `docs/flesh-stylized-f.png`) |
| `docs/ARCHITECTURE.md` · `STATE.md` | Phase 마다 갱신 (§9 실험 딱지 제거는 F3 완료 시) |

---

## 12. 리스크와 완화 (legacy 교훈 매핑)

| 리스크 | 근거(legacy) | 이번 설계의 완화 |
|---|---|---|
| 프로파일 급변 → 형태 사고 | "round-cone 은 구의 볼록 껍질" — 반지름 급감 시 돌출 | 가산 Wyvill 은 껍질 방출이 없고, PCHIP 이 오버슈트를 봉쇄 (§5.1) |
| 관절 융기(메타볼 팽창) | — (가산 고유) | 관절 끝 제어점 r 하향으로 데이터 상쇄, max-블렌드 금지 (§5.6) |
| 목 앙상/승모근 소실 | "목은 넓은 fold k 필요" | 세그먼트별 `blend` 노브, neck 기본 1.4 (§3) |
| 관절 스킨 찢어짐 | "관절 경계 이중 바인딩" | 필드 겹침 기반 가중치가 자동 이중 바인딩 (§6.1-6) |
| 시트 피팅 복잡도 폭발 | "시트 모순이 잔차 지배 항" | 시트 재현 비목표 선언 (§0) — 평가 기준은 폭 지표+육안 |
| 스무딩 수축으로 실루엣 얇아짐 | (일반) | Taubin(λ\|μ) 고정, bbox 변화 ≤1% 검증 (§6.1-5, §10-7) |
| bake 폴리곤 한도 초과 | — | maxPolyCount 400k + 오버플로 명시 보고 (§6.1-3) |
| 성능 회귀 | 실시간 ~7ms | 예산 10ms, LUT/분기 설계, 완화 순서 명시 (§5.5) |
