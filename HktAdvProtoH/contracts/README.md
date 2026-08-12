# Contracts

Frozen Contract 저장소 — World 와 GameView 사이의 유일한 공식 경계 (Rule 7).

| 디렉토리 | 내용 |
|---|---|
| `commands/` | Command Contract (`CMD-*-V#`) — Client 의도 전달 형식 |
| `observable/` | Observable Contract (`OBS-*-V#`) — Observer 별 Projection 의미 |
| `gameview-spec/` | GameView Specification (`VIEW-*-###`) — Observable → Visual Meaning |

## 규칙

- 이 디렉토리의 파일은 `contract-verify` PASS 후 Orchestrator 의 FREEZE_CONTRACT 로만 추가된다.
- Freeze 시 `registry/contracts.yaml` 에 `status: FROZEN` + `sha256` 으로 등록되며,
  이후 `scripts/validation/verify.mjs frozen` 이 매 Gate 마다 불변을 강제한다.
- Frozen Contract 는 수정하지 않는다. 변경은 새 버전 발급(VERSION_CONTRACT) → 재검증 → Re-Freeze.
- GameView 가 필요한 Observable 이 없으면 Contract Gap Proposal 로 처리한다 (§29).

현재 비어 있다 — 첫 실제 Cycle 의 Freeze 에서 채워진다.
(Mining C001 Dry Run 의 계약은 `cycles/C001/artifacts/contracts/frozen/` 에 격리되어 있다.)
