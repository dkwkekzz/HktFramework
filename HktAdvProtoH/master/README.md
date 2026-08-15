# master/ — Master Intent Graph

Cycle 이전의 층이다. **무엇을 만들 것인가** 를 다루고, Cycle 층은 **그것을 어떻게 닫을 것인가** 를 다룬다.

```text
MASTER 층    master/            M1 · M2 · M3      무엇을 만들 것인가
─────────────────────────── CYCLE BOUNDARY ───────────────────────────
CYCLE 층     cycles/<CycleId>/  Stage 1 ~ 8       그것을 어떻게 닫을 것인가
```

두 층은 **Cycle Goal 한 문장** 으로만 연결된다.
정책 전문은 [design/Master-Intent-Graph-Policy.md](../design/Master-Intent-Graph-Policy.md).

## 파일

| 경로 | 내용 | 누가 갱신하는가 |
|---|---|---|
| `graph/00-root.yaml` | World Premise · Root Goal · Design Constraint · 최상위 World Cause | Human (Agent 는 제안만) |
| `graph/capabilities.yaml` | Capability Registry — 전역 재사용 · 구현 상태 · 근거 | M1 이 추가, Cycle 완료가 상태를 갱신 |
| `graph/R0xx-<name>.yaml` | Region — worldstate · actor · knowledge · belief · goal · possibility | M1 (아직 없다) |
| `frontier.md` | Frontier 후보 — Human 이 다음 Cycle Goal 을 고르는 목록 | M2 |

Capability 는 Region 을 가로질러 재사용되므로 `capabilities.yaml` 한 곳에만 정의한다.
Region 파일에서 Capability 를 정의하면 `master:check` 가 실패한다 (Policy §32).

## 단계

| Step | Guide | 입력 | 출력 |
|---|---|---|---|
| M1 Graph Expansion | [guides/master-expand.md](../guides/master-expand.md) | Root 또는 확장 대상 Region | `graph/*.yaml` |
| M2 Overlay & Frontier | [guides/master-frontier.md](../guides/master-frontier.md) | `graph/` + 현재 `world/` `view/` | `frontier.md` |
| M3 Human Selection | Human | `frontier.md` | Cycle Goal 한 문장 |

실행은 **`advprotoh-master` 스킬** 이 담당한다.

## 관찰과 검사

```text
npm run master          Capability Overlay + 그래프 · 충돌 · 믿음 · Frontier 재료를 출력한다
npm run master:check    참조 무결성과 Quality Gate 만 검사한다 — 위반이 있으면 종료 코드 1
```

`IMPLEMENTED` / `PARTIAL` 은 주장이 아니라 근거다 — 그것을 만든 Cycle ID 와 구현 위치를 인용해야
검사를 통과한다. `확장 여지` 경고는 실패가 아니라 다음에 넓힐 곳의 신호다.

## Cycle 층과의 연결 — 정확히 두 지점

```text
들어가는 방향   01-cycle.md 의 MASTER TRACE      선택 항목. 없어도 Cycle 은 성립한다
나오는 방향     Cycle COMPLETE 후 capabilities.yaml 의 status 갱신
```

이 둘 말고 Master 층이 Cycle 층에 요구하는 것은 없다.
Stage 2~8 의 Guide 는 Master Graph 를 읽지 않는다 (Policy §48).

## 지금 상태

```text
Graph         비어 있다 — 형태만 있다 (00-root.yaml · capabilities.yaml 골격)
Region        없다
Capability    없다 — 기존 Cycle(C001~C009)이 만든 것도 아직 등록하지 않았다
Frontier      없다
열린 GAP      Root Goal · World Premise 가 비어 있다 — Human 확정 대기 (frontier.md 끝)
```

첫 작업은 M1 이다. Human 에게서 Root Goal / World Premise 또는 확장할 Region 주제를 받아
`00-root.yaml` 부터 채운다. 기존 Cycle 의 Capability 등록도 M1·M2 의 일이다 —
Possibility 가 그것을 요구하기 전에 미리 채워 두지 않는다.
