# codemap — 코드에 있는 것

코드를 **구조와 계약으로만** 적는다. 서사("어느 Cycle 이 무엇을 세웠다")는 두지 않는다 — 그것은 git history 와 `cycles/*/spec.md` 가 소유한다.
살아 있는 문서 — 현재 상태만 (CLAUDE.md 원칙 10).

```text
ENGINE.md    기반 모듈 다섯(world-kernel · physics · view-kernel · protocol-core · world-authoring)의 API 명세 — export · 계약 · content 가 채우는 것 · 미사용
CONTENT.md   컨텐츠 코드 구조 — 계약 파일 · world/(State · Rule id · 시스템) · view/ · protocol/ · regions/ · authoring/ · 조립 · tools/ · 검증 손잡이
```

```text
쓰는 이     advprotoi-spec — Existing 판정(이미 있는 기구 · State · 표)은 여기 + 기존 cycles/*/spec.md 의 ADDED 로 한다. 코드는 보지 않는다.
           Cycle 을 자를 때 — 첫 spec 의 Reuse(Existing / Added)를 가를 때. advprotoi-cycle 의 동결 · 실현도 같은 자리를 읽는다.
갱신       Cycle 을 main 에 합친 직후, **API 나 구조가 바뀐 것만** 그 자리에 고친다 (E 가 새 기구를 더했다 → ENGINE.md 표에 한 줄 ·
           W 가 State · Rule · 방을 더했다 → CONTENT.md 표에 한 줄). Cycle 번호를 적지 않는다.
없는 것     코드에 아직 없는 축(전투 · 장비 · 스킬 · 성장 …)은 plan/DESIGN.md §6.
```

## 실행

```text
npm run dev · npm test · npm run build · npm run boundary:check
npm run cycle:shot cycles/C###/shots.json     마감 촬영 (CHROMIUM_PATH 로 브라우저 지정 가능)
npm run world:check [-- --pretty]             검사 마흔셋을 JSON 으로 (fail 이 있으면 종료 코드 1)
npm run world:author -- <brief.json> [--write] brief 하나에서 방 하나의 뼈대를 낸다
npm run world:observe -- <방> --report        방 하나의 땅을 읽는다 (읽기 전용) · 방 없이 --report 는 세계의 보고
npm run world:run -- --cycles 2               관찰자 0 으로 세계를 돌려 개체군 궤적을 낸다
```

전체 스크립트 목록과 도구 폴더 대응은 [CONTENT.md §tools/](CONTENT.md), 검증 손잡이(`HKT_*`)는 [CONTENT.md §검증 손잡이](CONTENT.md).
