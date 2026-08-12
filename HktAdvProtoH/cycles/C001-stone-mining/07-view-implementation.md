# CYCLE C001 — View Implementation

## SPEC CONSUMED
    entities.player (role/state/position)      view/gameview/interpret.ts → view/sprites/billboard.ts
    entities.deposit (state/remaining/id)      view/gameview/interpret.ts → view/sprites/billboard.ts
    interactions.move                          view/input/input.ts (지형 클릭 → Move 요청)
    interactions.mine (+unavailableReason)     view/input/input.ts · view/hud/hud.ts
    hud.inventory.stone                        view/hud/hud.ts
    hud.tool.hasMiningTool                     view/hud/hud.ts
    hud.mineHint (available/reason)            view/hud/hud.ts + view/hud/reason-text.ts
    scene: mining-field                        view/terrain/terrain.ts (평지 + 지형)

## ASSET MAPPING
    절차 생성 Canvas 스프라이트 (외부 이미지 파일 없음) — view/assets/registry.ts
    player-character:idle       곡괭이 든 캐릭터 (직립)
    player-character:moving     곡괭이 든 캐릭터 (다리 벌림)
    resource-deposit:available  광맥 바위 + 밝은 광점
    resource-deposit:depleted   어두운 바위 + 균열

## INPUT → ACTION REQUEST
    지형 클릭 (Raycast → ground)     → { type: 'move', target: {x, z} }
    광맥 스프라이트 클릭             → { type: 'mine', depositId }
    View 는 판정하지 않는다 — 요청만 보내고 World Rule 의 결과가 Snapshot 으로 돌아온다.

## FIXTURE TESTS
    view/tests/interpret.spec.ts + fixtures 3종 (World 미기동)
        mining-available.fixture.json  → 채굴 가능 상태·스프라이트 매핑 확인
        out-of-range.fixture.json      → moving 스프라이트 + 사유 문구 확인
        deposit-depleted.fixture.json  → depleted 스프라이트 + 고갈 사유 확인
    실행: `npx vitest run` → 12 passed (world 9 + view 3, 2026-08-12)

## NOTES
    기술: Web / TypeScript · three.js — 3D Terrain(평면+그리드) · Sprite Billboard ·
    Web HUD(DOM 오버레이) · 쿼터뷰 팔로우 카메라 (Camera 는 View 책임).
    조립 루트 app/main.ts 만 world 와 view 양쪽을 import 한다 —
    view/ 는 protocol/ 만 참조하며 world/ 를 import 하지 않는다 (경계 준수).
    실행: `npm install && npm run dev` → http://localhost:5173

    헤드리스 플레이 스모크 (chromium): 시작 시 "광맥이 너무 멀다" →
    지형 클릭 이동 → "광맥을 클릭해 캐자!" → 광맥 클릭 →
    HUD Stone: 1 · 광맥 잔량: 4. 콘솔 에러 없음. (Human Play 확인은 Stage 8 이후)
