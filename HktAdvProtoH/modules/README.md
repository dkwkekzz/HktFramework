# Modules

검증 통과 후 FROZEN 된 Capability 저장소 (Rule 10·§34).

| 디렉토리 | 내용 |
|---|---|
| `world/<name>/v<N>/` | World Capability Module — requires / provides (possibilities·rules·observables) |
| `gameview/<name>/v<N>/` | GameView Module — consumes / implements |

## 규칙

- `module-package` Skill 이 Playable Cycle Complete 후에만 여기에 포장한다.
- 등록 시 `registry/modules.yaml` 에 `status: FROZEN` + `sha256` — 이후 직접 수정 금지.
- 후속 Cycle 은 Requires / Provides 만 사용한다. 재구현 금지.
- 의미 변경이 필요하면 Extension Module 우선, 최후에만 `migration_request` 로 v(N+1) Migration.

현재 비어 있다 — 첫 실제 Cycle 완료 시 채워진다.
(Mining C001 Dry Run 의 모듈 포장은 `cycles/C001/artifacts/packaging/` 에 격리되어 있다.)
