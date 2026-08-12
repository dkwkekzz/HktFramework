# Source

게임 런타임 소스. 스택은 C002 (첫 실제 Cycle) 에서 확정: **Web / TypeScript**.

- `world/` — Authoritative World (State / Rule / Command 처리 / Observer Projection). 순수 TS — 렌더러/DOM 무의존.
- `gameview/` — GameView 렌더러 (three.js). 스프라이트 빌보드 + 3D 하이트필드 지형 + DOM HUD.
  `binding.ts` 는 Observable → RenderState 순수 층으로, fixture 만으로 단독 테스트 가능.
- `main.ts` — Integration 로컬 런타임 (§21): 입력 → Command → World → Projection → Binding → Render.
- `tests/` — vitest (world rule / projection / gameview binding / e2e trace) + `playable.driver.mjs` (실제 브라우저 Playable 검증).

## 명령

```bash
npm install
npm run dev        # 개발 서버 (플레이: WASD 이동, E 채굴)
npm run build      # tsc + vite build → dist/
npm test           # vitest 전체
node tests/playable.driver.mjs   # 빌드 후 브라우저 Playable 검증 (스크린샷 포함)
```

루트 스크립트: `scripts/build/build.sh`, `scripts/test/test.sh`.

## 경계 (강제됨)

- `world/` 는 `gameview/` 를 import 하지 않는다. 역방향도 금지 —
  GameView 는 Observable Contract(`contracts/observable/OBS-MINING-V1.yaml`)의 미러 타입
  (`gameview/observable.ts`)으로만 세계를 본다 (Rule 7·8).
- World State 변경은 Rule 을 통해서만 (Rule 3). Client 는 Command 만 보낸다 (Rule 4) —
  prohibited_fields 는 `world/commands.ts` 가 입구에서 거부한다.
- FROZEN Module (`registry/modules.yaml` 의 mining-world-v1 / mining-view-v1) 에 속한 파일은
  직접 수정 금지 — 변경은 Extension Module 또는 Version Migration 으로만 (§34).
