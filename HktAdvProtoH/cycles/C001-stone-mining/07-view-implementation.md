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
    WASD / 방향키 (연속 이동)        → 매 프레임 진행 방향 1.6 unit 앞 지점을
                                       { type: 'move', target } 로 요청 (키 해제 시 현재 위치로 정지)
    E 키                             → { type: 'mine', depositId }
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

    [최종 구조 — View 2-Layer 확정: Human 피드백 반영]
    World 는 semantic(role/state/값/사유 코드)만 투영한다 (protocol 은 Semantic Snapshot).
    View 는 두 Layer 로 분리된다:
        결정 Layer     view/presentation/ — role/state/값 → "어떻게 그릴지" 결정
                       role-presentation (sprite·크기·카메라·트레일·라벨 형식)
                       interaction-presentation (키·프롬프트·지형 대상)
                       hud-presentation (라벨·아이콘·토스트) · reason-text (문구)
                       resolve.ts 가 Semantic Snapshot → Render Plan 으로 해석
        Capability Layer  renderer/hud/input — 그리기 능력만 제공, 게임 의미를 모른다
    같은 종류 대상의 결정은 role/id 당 단일 항목 — 모든 Cycle 이 공유·발전,
    Cycle 별 결정 코드 분리·중복 금지 (가이드 MUST NOT 로 명문화).
    새 Cycle 의 View 작업 = 결정 항목·Asset 추가 (+ 표현 고도화 시에만 capability 추가,
    기존 capability 코드는 불변).
    미등록 role/HUD id/사유 코드는 기본 결정·placeholder 로 소화 — 테스트로 고정 (14 passed).
    검증: tsc·build 통과, 키보드 스모크 재현 (Stone: 1 · 잔량 4 · 토스트 · 콘솔 에러 0).

    [표현 업그레이드 — Human 피드백 반영]
    구릉 3D 지형(시각 높이 — 게임 판정은 평면 x,z 그대로) · 픽셀아트 스프라이트
    (16x16 그리드 + Nearest 필터) · WASD/방향키 연속 이동 + E 채굴 ·
    광맥 머리 위 "돌 N" 잔량 라벨(worldToScreen 투영) · "+N Stone 획득!" 토스트
    (Snapshot 의 Stone 증가 감지 — View 는 판정하지 않음) · 이동 트레일 ·
    지평선 보이는 로우앵글 팔로우 카메라. World/protocol 변경 없음.
    키보드 스모크 재검증: WASD 접근 → "[E] 채굴" 표시 → E → Stone: 1 · 잔량 4.
