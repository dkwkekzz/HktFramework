# Master Graph 파일 규격

`master/graph/*.yaml` 의 단일 출처. 검사기는 `tools/master/print.ts` 이며
`npm run master:check` 가 이 규격을 강제한다.

---

## 파일 골격

모든 그래프 파일은 `kind` 와 `nodes` 를 가진다.

```yaml
kind: root | region | capabilities
region: R001            # kind: region 일 때만
title: 돌과 도구         # kind: region 일 때만
summary: >-             # kind: region 일 때만
  이 Region 이 무엇에 대한 것인가.
nodes:
  - id: ...
    type: ...
```

`kind: root` 는 추가로 `premise` (세계의 전제) 와 `constraints` (Design Constraint 목록) 를 가진다.

---

## Id 접두 — type 과 어긋나면 검사 실패

```text
W-   worldstate      W-R001-DEPOSIT-DRAIN
A-   actor           A-R001-ARIN
K-   knowledge       K-R002-COLD-CAUSE
B-   belief          B-R002-DAN-BLAMES-GREYFANG
G-   goal            G-R001-PLAYER-STONE
P-   possibility     P-R002-TRACK-PACK
C_   capability      C_TRACK
```

Region 노드는 `<접두>-<Region>-<이름>` 을 쓴다. Region 을 넘어 공유되는 것(A-PLAYER · Capability)은
Region 조각을 넣지 않는다. Id 는 전역 유일하다.

---

## Node type 별 필드

### worldstate

```yaml
- id: W-R001-NEAR-EXHAUSTED
  type: worldstate
  text: 사람이 모여 사는 곳 가까운 광맥이 먼저 마른다.     # 필수
  causes:     [W-...]        # 이 상태가 일으키는 다른 상태
  motivates:  [G-...]        # 이 상태가 만드는 Goal
  note: ...                  # 세계에 아직 없는 상태면 그 사실을 여기 적는다
```

### actor

```yaml
- id: A-R001-ARIN
  type: actor
  text: 아린 — 이 근처 광맥을 캐서 먹고사는 광부.          # 필수
  wants:    [G-...]
  believes: [B-...]
  knows:    [K-...]
```

집단·세력도 Actor 다. 짐승도 자기 목적을 가지면 Actor 다.

### knowledge / belief

```yaml
- id: B-R002-DAN-BLAMES-GREYFANG
  type: belief
  text: 단은 회색엄니가 가축을 흩어 놓았다고 믿는다.        # 필수
  holder: A-R002-DAN
  true_in_world: false          # true | false | unknown
  creates_goal: [G-...]
  reframes:     [G-...]
  note: ...
```

`belief` 는 틀릴 수 있는 것, `knowledge` 는 참인 것이다.
`true_in_world: false` 인 belief 가 조사·오해·반전이 걸리는 자리다.

### goal

```yaml
- id: G-R001-PLAYER-STONE
  type: goal
  owner: A-PLAYER                     # 필수 — actor
  desired_state: 지금 필요한 만큼의 돌을 자기 소지로 가진다.   # 필수
  motivation:                          # 필수 — 하나 이상
    - 도구를 만들거나 값을 치르려면 먼저 재료가 있어야 한다
  belief_context: [K-... | B-...]
  stakes:
    - 돌이 없으면 도구가 없고, 도구가 없으면 캐지도 못한다
  provisional: true                    # Human 확정 대기 (Root Goal 등)
  note: ...
```

셋 중 하나라도 못 쓰면 그것은 Goal 이 아니라 Capability 이거나 미완성 Goal 이다.

### possibility

```yaml
- id: P-R001-BUY-FROM-MINER
  type: possibility
  name: 캐는 사람에게서 산다             # 필수 — 사람이 읽는 이름
  achieves: [G-...]                     # 필수 — 하나 이상
  requires:                             # 필수 — 네 갈래 중 하나 이상
    capabilities: [C_...]
    knowledge:    [K-... | B-...]
    world:        [W-...]
    goals:        [G-...]
  supports: [G-...]                     # 누구의 목적을 돕는가
  opposes:  [G-...]                     # 누구의 목적을 막는가
  changes:                              # 필수 — 세계가 무엇이 달라지는가
    - W-R001-DEPOSIT-DRAIN              # 노드 Id 또는 자유 문장
    - 아린과의 관계가 좋아진다
  reveals:      [K-... | B-...]
  creates_goal: [G-...]
  note: ...
```

`achieves` 는 OR (여러 길 중 하나), `requires` 는 AND (모두 필요) 다.
`changes` 안의 자유 문장에 Id 처럼 생긴 토큰이 있으면 그것도 실재해야 한다.

### capability — `capabilities.yaml` 에만

```yaml
- id: C_TRACK
  type: capability
  semantic: 세계에 남은 흔적을 살펴 무엇이 언제 어디로 지나갔는지를 알아낸다.   # 필수
  platform: true          # 선택 — 바탕 능력. requires 로 나타나지 않아도 경고하지 않는다
  status: MISSING         # IMPLEMENTED | PARTIAL | MISSING
  cycles: [C001, C002]    # IMPLEMENTED/PARTIAL 이면 필수. MISSING 이면 비운다
  where:                  # IMPLEMENTED/PARTIAL 이면 필수
    - world/rules/mine.ts
  note: ...               # PARTIAL 이면 필수 — 무엇이 아직 아닌가
```

`semantic` 은 모듈 이름이 아니라 **플레이 가능한 의미** 로 쓴다.

```text
BAD   TrackingSystem 을 제공한다
GOOD  세계에 남은 흔적을 살펴 무엇이 어디로 지나갔는지 알아낸다
```

---

## 검사 규칙 요약

```text
Id            중복 없음 · type 과 접두 일치
참조 무결성    모든 참조가 실재하는 노드를 가리키고 허용된 type 이다
Goal Gate     owner · desired_state · motivation
Possibility   achieves · requires(하나 이상) · changes
Capability    status 3종 · IMPLEMENTED/PARTIAL 은 cycles + where · PARTIAL 은 note
Reuse Gate    Capability 는 capabilities.yaml 에만
확장 여지(경고) 길이 1개 이하인 Goal · 아무도 요구하지 않는 Capability(platform 제외)
```

경고는 실패가 아니다 — 다음에 넓힐 곳의 신호다.

---

## 흔한 실수

```text
저수준 능력을 Goal 로 만든다          걷는다 · 줍는다 → Capability 다
Region 마다 같은 Capability 를 새로 만든다   → capabilities.yaml 을 먼저 찾는다
Possibility 에 changes 가 없다        → 세계가 안 변하면 선택이 아니다
동의어를 별도 Possibility 로 만든다    → 방식·비용·위험·관계·결과 중 하나는 달라야 한다
근거 없이 IMPLEMENTED 로 적는다        → 검사 실패다
이야기를 note 에만 적는다             → 원인·믿음·충돌·결과를 노드와 관계로 적는다
```
