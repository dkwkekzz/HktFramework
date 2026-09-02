# L2 — 세계 제작 도구 (기반 층 2 · 도구 절반)

상태: **확정**. 로드맵 2층 결과물의 **절반**이다 ([README.md](README.md) §2) — 2층은 도구 절반과
세계 절반으로 되어 있고, 이 문서는 도구 쪽이다. 세계 절반은 ① 세계관 컨셉
([L2-World-Concept.md](L2-World-Concept.md) — **주입됨**) 과 ② 세계 content 구성(대기)이며,
그것이 이 도구의 어느 자리에 닿는지를 §3 이 정해 둔다.

재료: [design/Design-World-Editor-Terrain-Compiler.md](../../design/Design-World-Editor-Terrain-Compiler.md) (WE) ·
[design/Plan-World-Authoring-Engine.md](../../design/Plan-World-Authoring-Engine.md) (적용 검토, 확정).
이 문서는 그 둘을 다시 적지 않는다 — **무엇이 확정되었고, 무엇이 이 절반의 것이 아니며, 다음 주입이
어디로 들어오는지**만 둔다.

---

## 1. 확정한 것

도구는 세계를 쓰는 **문법**과 그것을 땅으로 만드는 **컴파일러**다. 세계가 아니다.

| 개념 | 확정한 답 | 근거 |
|---|---|---|
| **Region** | 제작 단위. Description 하나 = `id · extent · seed · ops[]`. 1단계는 Region 하나 = 세계 하나 | Plan §3.1 · §2.2-5 |
| **네 프리미티브** | Point · Curve · Area · Field(Stamp). AI 도 사람도 이 넷만 편집한다 — vertex 는 만지지 않는다 | WE §6 · Plan §2.1 |
| **layer · tag** | 프리미티브에 붙는 이름의 공간. 기반은 뜻을 모르고 조회만 준다. 뜻은 컨텐츠 데이터가 정한다 | Plan §2.2-1 · §3.1 |
| **Height Field** | 공유 vertex grid 하나가 높이의 단일 출처. World 는 고정 해상도 격자(`TERRAIN_RESOLUTION`), View 는 chunk 로 샘플 | Plan §3.2 |
| **Compiler** | `(description, rules) → { world, view, hash }`. 순수 · 결정론 · Seed 는 컴파일의 것이지 세계 State 가 아니다 | Plan §3.5 |
| **World Data** | height · surface · traversable · areas(tagsAt) · points · connectors. 규칙이 읽는다 | Plan §3.2 |
| **View Data** | chunk mesh · surface 색 · scatter instance(billboard sprite). 그리기만 한다 | Plan §3.2 · §2.2-6 |
| **Agent API** | Description 파일에 쌓이는 op 목록 + CLI. WE §30 의 함수 하나 = op 종류 하나 | Plan §3.3 |
| **Observation** | `world:observe`(높이·표면·의미·통행 PNG + 보고) · `world:shot`(playwright). 읽기 전용 | Plan §3.4 |
| **경계** | `content/regions/` 는 world·view 가 함께 읽는 데이터 폴더. 규칙 4 — regions 는 world·view 를 import 하지 않는다 | Plan §3.6 |
| **영속** | 스냅샷에 `region { id, hash }`. hash 가 다르면 복구하지 않는다 | Plan §3.5 |

함께 확정한 결정 (Plan §6).

```text
Corner Height 는 짓지 않는다           Stamp · Curve 가 편집이다
Mesh kit · Cliff kit 은 짓지 않는다     billboard sprite instancing · 급경사 규칙
Brush · Spline UI 는 두지 않는다        lab 페이지(top view · op 목록 · 재컴파일)가 Human UI 다
경로 탐색 · Collision mesh 는 없다      traversable 격자까지
다중 Region 은 이 절반의 것이 아니다     필요해지면 기반 층의 새 행으로 올린다 (관찰자 참여·투영·영속을 건드린다)
지면 구역(SceneGroundZone) 은 이 문법의 View 쪽 프리미티브다   circle 에 polygon 을 더한다 — 뜻은 여전히 모른다
```

## 2. 정하지 않은 것

| 무엇을 | 어디가 답하는가 |
|---|---|
| 지역 지도 · 이름 목록 · 세계의 이름 | **2층 세계 절반** — ① 이 주지 않았다 (`L2-World-Concept.md` §3.3·§3.4·§6) |
| 어느 Region 에 무엇이 어디에 있는가 (지형·물길·바이옴·랜드마크·자원 자리) | **2층 세계 절반** — 세계 content 구성 주입 (§3.2) |
| layer 의 목록과 tag 의 어휘 | ① 이 `hazard` 일곱과 `depth` 다섯을 주었다 (`L2-World-Concept.md` §3.1·§3.2). 나머지는 ② 가 준다 — 도구는 여전히 뜻을 모른다 |
| 높이·경사·구역이 몸에 무엇을 하는가 | 2층 Play 의 02-world (traversable 하나부터) · 3층 |
| Biome 이 무엇을 낳는가 (surface · scatter 규칙) | 컨텐츠 데이터 (`content/view/biome-rules.ts` 자리) — 세계 content 구성이 준다 |
| 땅이 시간에 따라 바뀌는가 | 땅이 State 가 되는 층 — 이 도구는 정적 땅을 만든다 |

## 3. 연결 계약 — 다음 주입이 들어오는 자리

앞으로 올 두 주입이 이 도구에 **번역으로** 닿도록 자리를 미리 판다. 주입물이 이 양식을 따를
필요는 없다 — 다만 아래 항목에 답이 있으면 Description 으로 옮기는 일이 기계적이 된다.
답이 없는 항목은 지어내지 않고 Human 질문으로 남긴다 (공정 §8.5).

### 3.1 세계관 컨셉 → 세계의 어휘와 지도

**주입됨** — [L2-World-Concept.md](L2-World-Concept.md). 아래 표의 1·2 는 답이 왔고(§3.1·§3.2),
3·4·5 는 오지 않았다(§3.3·§3.4) — ② 가 주거나 §6 의 질문으로 답한다.

| 주입이 주는 것 | 도구의 어느 자리로 | 형태 |
|---|---|---|
| 세계의 법칙 — 무엇이 위험과 재료를 낳는가 | 문법이 아니라 **tag 의 뜻**. `layer = hazard` 의 어휘가 되고, 몸에 닿는 규칙은 Play 가 세운다 | ✔ `hazard` 일곱 갈래 (Concept §5 · §3.1) |
| 안전권 · 깊이 단계 | `area(layer: 'depth', tag: <단계 이름>)` — 깊이는 구역의 태그, 경계는 polygon | ✔ `civil · outer · wild · deep · abyss` (Concept §13 · §3.2). 안전권은 별도 layer 가 아니라 `settlement` + 안전 조건의 자리다 |
| 지역 지도 — 어떤 Region 이 있고 무엇이 무엇과 닿는가 | Region `id` 목록 + `connector(tag, border, to)` — Region Graph 는 이 둘의 합이다 | ✗ 아직 없다 (Concept §3.3) |
| 이름 목록 — 지역 · 랜드마크 · 자원 · 세력 | tag 어휘의 카탈로그 (`character-catalog` 선례 — 한 항목 = 이름 + 종류 + 세계 사실) | △ 원문에 여덟이 나왔으나 삽화/정본 판정 대기 (Concept §3.4) |
| 각 Region 의 정체 한 문장 | `RegionDescription.id` 옆 identity 주석 — 컴파일러는 읽지 않는다 | 한 문장 |

이 주입이 오면 `L2-World-*.md`(세계 절반) 가 되고, tag 어휘는 `content/` 의 카탈로그 파일로
옮겨진다. **도구는 바뀌지 않는다** — 채워질 뿐이다.

### 3.2 세계 content 구성 → Region Description

Region 하나의 구성은 op 로 1:1 번역된다. 한 항목의 답이 곧 op 하나다.

| 주입이 주는 것 | op | 필요한 답 |
|---|---|---|
| 지형의 큰 형태 — 분지 · 능선 · 협곡 · 고원 | `stamp` | 종류 · 중심 · 반경 · 높이 (수치는 "크다/작다" 여도 된다 — AI 가 op 로 옮기고 Human 이 그림으로 승인) |
| 물길 · 길 · 절벽 · 경계선 | `curve` (layer=`feature`) | 지나는 자리 몇 점 · 폭 · 파는가/올리는가 |
| 바이옴 · 위험 · 자원 · 안전 · 출현 구역 | `area` (layer=`biome` / `semantic` / `spawn` …) | 구역 이름(태그) · 대략의 범위 |
| 랜드마크 · POI · 자원 자리 · 존재의 자리 | `point` (layer=`landmark` / `poi` / `deposit` / `actor`) | 무엇(태그) · 어디 — 지금의 `SPAWN_POINTS` · `DEFAULT_NPCS` · deposit 자리가 여기로 옮겨진다 |
| 드나드는 곳 — 다른 Region 과의 접점 | `connector` | 어느 변 · 어디쯤 · 무엇으로(길·강·고개) · 어느 Region 으로 |
| 자연물의 규칙 — 무엇이 어디에 얼마나 나는가 | op 가 아니라 **규칙 표** (`biome-rules`) | 바이옴별 surface 규칙 · scatter 종류와 밀도 |

② 를 쓰는 **순서**는 Concept §17 의 일곱 단계가 정한다 (이곳은 무엇이 특별한가 → 왜 이런
환경이 되었는가 → 무엇이 살아가는가 → 무엇이 위험한가 → 무엇이 귀해지는가 → 무엇을 발견하는가
→ 어떤 가능성이 열리는가). 그 순서로 적으면 위 표의 op 순서가 그대로 나온다.

Region 하나의 주입은 WE §32 의 순서(정체 → 접점 → 랜드마크 → 게임 구조 → 길·물길 → 지형 →
바이옴 → POI → 장식 → 의미)로 적으면 op 순서가 그대로 나온다.

받지 않는 것 — **몸에 닿는 수치**(경사 몇 도부터 못 가는가 · 깊이가 무엇을 깎는가). 그것은
Play 의 02-world 가 정한다. 주입물에 있으면 그리로 넘긴다.

### 3.3 이 세계에 이미 있는 것과의 이음

```text
광맥(DepositState) · 자율 존재(DEFAULT_NPCS) · 관찰자 자리(SPAWN_POINTS)
    → Description 의 point 로 옮겨진다. 종류는 tag, 개체 값은 지금처럼 카탈로그가 준다.
WORLD_BOUNDS
    → RegionDescription.extent 가 대신한다.
자원의 세계 인과 (README §4 의 여섯 질문)
    → ①③ 은 area·point 의 자리(어디서 · 무엇이 고정했나)로, ②④⑤⑥ 은 Play 의 Goal·Required 로.
```

## 4. 코드 대응 — 설 자리

아직 코드에 없다. ENGINE 레인이 세울 자리다 (Plan §5 A · 파일 지도는 Plan §3).

```text
engine/world-authoring/           description · primitives · ops · height-field · surface · semantic · scatter · random · compile · observe
engine/view-kernel/terrain/       createTerrain(compiledView, palette) — sine heightAt 은 사라진다
engine/view-kernel/scene/         SceneGroundZone.shape 에 polygon
engine/protocol-core/gameview.ts  region { id, hash }
content/regions/                  이 세계의 Region Description (데이터) + compiled *.generated.ts
content/world/semantic/terrain.ts WorldState.terrain · heightAt / traversable / tagsAt
content/view/terrain-presentation.ts · biome-rules.ts   태그 → 색·sprite · 규칙 표 (빈 자리 — 주입이 채운다)
tools/world-editor/               world:edit · world:compile · world:observe · world:shot · lab
tools/boundary/check.ts           규칙 4
```

## 5. 다음

```text
ENGINE 레인 A     위 자리를 게임 명사 없이 세운다. 완료 조건은 Plan §4 의 1~3.
세계 절반 ① 컨셉   주입됨 — L2-World-Concept.md.
세계 절반 ② 구성   대기 — Region 하나가 무엇이고 무엇이 어디에 있는가 (§3.2 · Concept §17 순서).
2층 Play          첫 Region 을 §3.2 로 Description 에 쓰고, "안전권을 나서 깊이가 달라지는 것을 본다".
                  깊이 단계는 이미 있다 (Concept §3.2) — 두 단계가 맞닿은 자리를 ② 가 준다.
                  Plan §4 의 완료 조건 4 가 여기서 닫히고, 그때 2층이 닫힌다.
```
