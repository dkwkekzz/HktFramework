# FRONTIER — 다음 Cycle 후보

> M2 산출물. Master Graph + 현재 `world/` `view/` 를 겹쳐 본 결과다.
> **Agent 는 후보를 만들 뿐 개발 우선순위를 확정하지 않는다** (Policy §25 · §28 Step 10).
> Human 이 하나를 골라 Cycle Goal 로 확정하면 그 순간 Master 단계는 끝나고
> `advprotoh-cycle` 스킬의 Stage 1 이 시작된다.

생성 기준: `npm run master` 의 Capability Overlay.
갱신 시점: Cycle 이 COMPLETE 되어 `capabilities.yaml` 이 바뀔 때마다 M2 를 다시 돈다.

**지금은 비어 있다.** Master Graph 가 아직 비어 있어 겹쳐 볼 것이 없다.
M1 으로 Graph 를 세운 뒤 M2 를 돌리면 이 문서가 채워진다.

---

## 지금 세계가 할 수 있는 것

```text
(M2 가 master/graph/capabilities.yaml 의 IMPLEMENTED / PARTIAL 을 여기 요약한다)
```

## 지금 막혀 있는 것

```text
(M2 가 막힌 Possibility 와 그것이 기다리는 Capability 를 여기 줄 세운다)
```

---

## 후보

```text
(후보 없음)
```

후보 하나의 형태는 다음과 같다.

```text
## F-0xx — <한 줄 이름> (<Capability>)

Cycle Goal 후보
    <플레이어가 게임 안에서 할 수 있는 한 문장>

Serves        <이 후보가 여는 Possibility Id 들>  (<그 Possibility 가 achieve 하는 Goal>)
Capability    <C_...>   <MISSING | PARTIAL> → 이번이 만든다 / 넓힌다
크기          <한 Cycle 안에 닫히는가. 무엇까지가 이번인가>
근거          <왜 지금 이것이 Frontier 인가 — 무엇이 이미 있고 무엇이 없어서 닿지 못하는가>
플레이 확인    <Client 에서 무엇을 보면 됐다고 할 수 있는가>
주의          <선행 조건 · 범위가 샐 위험 · 이번에 넣지 않을 것>
```

§26 다섯 조건을 모두 만족해야 후보다.

```text
1. 지금 세계에서 완전히 제공되지 않는다
2. 하나 이상의 상위 Goal / Possibility 를 실제로 전진시킨다
3. Client 에서 직접 플레이해 결과를 확인할 수 있다
4. 한 Cycle 안에서 의미적으로 닫을 수 있는 크기다
5. 단순 구현 Task 가 아니라 새로운 World / Game Capability 다
```

---

## Agent 의견 (참고 — 결정이 아니다)

```text
(없음)
```

## 열린 MASTER GAP

```text
MASTER GAP
Required   Master Graph 를 세우려면 Root Goal 과 World Premise 가 있어야 한다
Missing    master/graph/00-root.yaml 의 premise · constraints · nodes 가 비어 있다
Reason     Root Goal 과 Design Constraint 는 Human 소유다 (Policy §42-1).
           Agent 는 이것을 스스로 확정하지 않는다
Return To  Human
```
