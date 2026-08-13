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

    [범용 엔진 리팩터링 — Human 피드백 반영: "같은 것을 그리는 View 코드는 Cycle 간 불변"]
    protocol Snapshot 을 범용 구조(entities[]/interactions[]/hud[] 배열)로 전환.
    View 엔진(gameview/renderer/hud/input)은 배열을 순회할 뿐 특정 role·id 를 모른다.
    Cycle 별 표현은 view/engine/ 의 Registry 데이터로만 존재:
        role-registry         role → 스케일·카메라 추적·트레일·라벨 형식
        interaction-registry  interaction role → 키 바인딩·프롬프트·지형 대상
        hud-registry          hud id → 라벨·아이콘·획득 토스트
        assets/registry       role:state → 픽셀 스프라이트 (미등록은 placeholder)
        hud/reason-text       사유 코드 → 문구 (미등록은 코드 그대로)
    다음 Cycle 부터 View 작업 = Registry 항목 추가 (+ 새 표현 패턴 시에만 엔진 확장).
    미등록 role 도 기본 특성·placeholder 로 그려짐 — 테스트로 고정 (14 passed).
    검증: tsc·build 통과, 키보드 스모크 재현 (Stone: 1 · 잔량 4 · 토스트 · 콘솔 에러 0).

    [표현 업그레이드 — Human 피드백 반영]
    구릉 3D 지형(시각 높이 — 게임 판정은 평면 x,z 그대로) · 픽셀아트 스프라이트
    (16x16 그리드 + Nearest 필터) · WASD/방향키 연속 이동 + E 채굴 ·
    광맥 머리 위 "돌 N" 잔량 라벨(worldToScreen 투영) · "+N Stone 획득!" 토스트
    (Snapshot 의 Stone 증가 감지 — View 는 판정하지 않음) · 이동 트레일 ·
    지평선 보이는 로우앵글 팔로우 카메라. World/protocol 변경 없음.
    키보드 스모크 재검증: WASD 접근 → "[E] 채굴" 표시 → E → Stone: 1 · 잔량 4.
