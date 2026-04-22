# 스프라이트 데이터 세팅 & 에디터 사용 가이드

**2D 스프라이트 파츠(`UHktSpritePartTemplate`) 하나를 만들어 런타임에 렌더시키기까지의 전체 과정**을 설명합니다.

두 가지 경로를 지원합니다:

| 방법 | 진입점 | 언제 |
|------|--------|------|
| **에디터 단독 (B)** | `HktSprite.Builder` 콘솔 명령 → Slate 패널 | 수동으로 아트를 넣고 바로 확인 |
| **MCP 툴 (A)** | AI 에이전트가 `build_sprite_part` 호출 | 자동화 파이프라인 / LLM 오케스트레이션 |

두 경로 모두 최종 산출물은 같습니다:

- `T_SpriteAtlas_{tag}.uasset` — 균일 셀 그리드로 패킹된 아틀라스 `UTexture2D`
- `DA_SpritePart_{tag}.uasset` — `UHktSpritePartTemplate` DataAsset. `IdentifierTag`로 런타임에서 태그 조회되어 `AHktSpriteCrowdHost`가 HISM에 렌더.

---

## 공통: 입력 텍스처 준비

### 파일명 규칙 (플랫)

```
{action}[_{direction}][_{frame_idx}].{png|tga|jpg|bmp|webp}
```

- `action` — 임의 이름(알파벳 시작). 예: `idle`, `walk`, `attack1`
- `direction` — 8방향 중 하나 (생략 가능): `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`
- `frame_idx` — 숫자 (생략 시 0)

**예시**

```
idle.png                  → 모든 방향 1프레임 (방향 미지정 → 빠진 방향에 폴백)
idle_S.png                → South 1프레임
walk_S_0.png              → South 프레임 0
walk_S_1.png              → South 프레임 1
walk_NE_0.png
attack1_E_0.png
```

### 파일명 규칙 (서브폴더)

파일 수가 많을 때는 디렉터리 구조로 대체할 수 있습니다.

```
MyInputDir/
  walk/
    S/
      0.png
      1.png
      2.png
    NE/
      0.png
      1.png
  idle/
    S.png               # 방향별 1프레임 플랫
    N.png
```

규칙:

- `{action}/{direction}/{idx}.{ext}` — 가장 명확
- `{action}/{direction}.{ext}` — 방향별 1프레임
- `{action}/{아무파일}.{ext}` — direction 추정 불가 시 방향 미지정 폴백
- **같은 액션에 서브폴더가 존재하면 플랫 파일은 무시** (서브폴더 우선)

### 셀 크기는 자동

모든 입력 이미지의 `max(width, height)`가 아틀라스 셀 크기(`AtlasCellSize`)가 됩니다. 크기가 다른 프레임이 섞여 있어도 OK — 작은 이미지는 알파 투명으로 패딩됩니다. 단, **프레임 내 콘텐츠는 좌상단 정렬** 가정(pivot 해석이 좌상단 기준).

### 방향 폴백

- 방향 미지정 파일(`idle.png`)은 **명시 방향이 없는 방향에만** 폴백으로 복제됩니다. `idle.png` + `idle_S.png`가 섞여 있으면 S는 `idle_S.png`가, 나머지 7방향은 `idle.png`가 담당.
- `mirror_west_from_east=true`(기본): W/SW/NW는 E/SE/NE의 좌우 flip으로 런타임에서 처리되므로 **5방향만 준비**하면 됩니다.

### 아트 팁

- **픽셀아트**: Nearest 필터 + NoMipmap으로 자동 임포트됩니다. 콘텐츠 바깥은 알파 0으로.
- **콘텐츠 여백**: 균일 셀 크기라, 프레임이 제각각이면 가장 큰 프레임에 맞춰 모두 확장됩니다. 여백이 아깝다면 미리 크롭해서 넣으세요.
- **pivot**: 기본값은 셀 하단 중앙 `(cellW/2, cellH)`(캐릭터 발 기준 관습). 필요 시 JSON 경로로 override.

---

## 경로 B: 에디터 단독 사용 — `HktSprite.Builder`

MCP / AI 에이전트 없이 에디터만으로 빌드합니다.

### 1단계 — 패널 열기

둘 중 하나:

- 에디터 콘솔(`` ` ``)에 `HktSprite.Builder` 입력
- **Window → Developer Tools → Misc → HKT Sprite Builder** 탭

### 2단계 — 폼 입력

| 필드 | 값 예시 | 설명 |
|------|---------|------|
| **Tag** | `Sprite.Part.Body.Knight` | `IdentifierTag`. 런타임 태그 조회 키. |
| **Slot** | `Body` | 드롭다운. Body/Head/Weapon/Shield/HeadgearTop/Mid/Low. |
| **Input Directory** | `D:/Art/Knight/` | `Browse...` 버튼 또는 직접 입력. 위의 파일명 규칙으로 텍스처가 들어있는 폴더. |
| **Output Content Dir** | `/Game/Generated/Sprites` | UE 컨텐츠 경로. Atlas + DataAsset이 여기에 저장됨. |
| **PixelToWorld** | `2.0` | 1 pixel → world cm 환산. |
| **FrameDuration (ms)** | `100` | 액션 프레임당 기본 지속시간. |
| **Looping** | ✔︎ | 모든 액션이 루프할지. |
| **Mirror W/SW/NW from E/SE/NE** | ✔︎ | 5방향만 준비 시 체크. |

### 3단계 — **Build Sprite Part** 버튼

하단 로그 박스에 결과 JSON이 뜹니다:

```json
{
  "success": true,
  "tag": "Sprite.Part.Body.Knight",
  "atlasAssetPath": "/Game/Generated/Sprites/T_SpriteAtlas_Sprite_Part_Body_Knight.T_SpriteAtlas_Sprite_Part_Body_Knight",
  "dataAssetPath":  "/Game/Generated/Sprites/DA_SpritePart_Sprite_Part_Body_Knight.DA_SpritePart_Sprite_Part_Body_Knight"
}
```

파일은 다음 경로에 생성됩니다:

- 디스크: `{ProjectDir}/Saved/SpriteGenerator/{Tag_safe}.png` (중간 산출물)
- UE 컨텐츠: 위 Output Content Dir 하위의 `T_SpriteAtlas_*` + `DA_SpritePart_*`

실패 시 같은 박스에 `{"success": false, "error": "..."}` 형태로 원인이 뜹니다.

### 재빌드

같은 Tag로 다시 Build하면 기존 `.uasset`을 **덮어씁니다**. 입력 텍스처를 수정한 뒤 버튼 한 번만 누르면 즉시 반영.

---

## 경로 A: MCP 툴 — `build_sprite_part`

LLM 에이전트(Claude Desktop/Cursor/Claude Code)가 자연어로 호출하는 경로입니다. 사용자가 직접 JSON-RPC를 쏠 일은 없고, AI에 "이 경로의 텍스처로 `Sprite.Part.Body.Knight` Body 파츠 만들어줘" 식으로 요청하면 됩니다.

### 툴 시그니처

```json
{
  "name": "build_sprite_part",
  "arguments": {
    "tag": "Sprite.Part.Body.Knight",
    "slot": "Body",
    "input_dir": "D:/Art/Knight/",
    "output_dir": "/Game/Generated/Sprites",
    "pixel_to_world": 2.0,
    "frame_duration_ms": 100,
    "looping": true,
    "mirror_west_from_east": true
  }
}
```

`input_dir` 또는 `textures`(명시 JSON) 중 **하나를 반드시 지정**합니다. 컨벤션 기반 자동 경로 같은 폴백은 없습니다.

### `textures` JSON (고급)

폴더 규칙 대신 경로를 명시하려면:

```json
{
  "textures": "{\"idle\": \"D:/a.png\", \"walk\": {\"S\": [\"D:/w0.png\",\"D:/w1.png\"]}}"
}
```

3가지 형태 지원:
- `{"action": "path.png"}` — 단일 경로, 방향 폴백
- `{"action": {"S": ["p1.png","p2.png"], ...}}` — 방향별 프레임 배열
- `{"action": {"framesByDirection": [[...], ..., [...]]}}` — 8방향 고정 배열 (`N, NE, E, SE, S, SW, W, NW` 순)

### 파이프라인

1. **Python (`sprite_tools.py`)** — `input_dir` 스캔 또는 `textures` JSON 파싱 → Pillow로 고유 파일만 한 번씩 디코드 → 균일 셀 그리드 Atlas PNG를 `{ProjectDir}/Saved/SpriteGenerator/{tag}.png`에 저장
2. **UE5 (`McpBuildSpritePart`)** — PNG → `UTexture2D` 임포트 (Nearest / NoMipmap / TEXTUREGROUP_UI) → `UHktSpritePartTemplate` 생성 후 `IdentifierTag` / `Atlas` / `AtlasCellSize` / `PixelToWorld` / `Actions` 주입 → AssetRegistry에 등록

### 의존성

- MCP 서버(`McpServer/`)에 Pillow 설치 필요 — `pip install -e ".[dev]"` 하면 자동 설치.
- `UE_PROJECT_PATH` 환경 변수가 UE 프로젝트 루트를 가리켜야 Atlas PNG 출력 경로가 올바르게 결정됩니다.

---

## 런타임 렌더링 — `AHktSpriteCrowdHost`

DataAsset을 만들었다면 런타임에서 별도 셋업이 거의 필요 없습니다.

### 자동 스폰

- `HktSpriteCore` 모듈이 `FWorldDelegates::OnWorldBeginPlay`에 훅을 걸어 **Game / PIE 월드에만** `AHktSpriteCrowdHost`를 자동 스폰.
- Dedicated Server에선 스킵.
- 이 액터가 `UHktSpriteCrowdRenderer`(HISM) 컴포넌트를 소유하고, 자신을 `IHktPresentationProcessor`로 `UHktPresentationSubsystem`에 등록.

### 엔티티 매핑

VM 엔티티의 `FHktSpriteView`에 Tag를 설정하면 자동 렌더됩니다:

```cpp
// 예: HktCore Story / 서버 측에서
WorldState->SetSpriteTag(EntityId, EHktSpritePartSlot::Body, BodyTag);
WorldState->SetSpriteTag(EntityId, EHktSpritePartSlot::Head, HeadTag);
// ...
```

`UHktPresentationSubsystem`이 `FHktWorldView` diff를 받아 `AHktSpriteCrowdHost::Sync`를 호출 → `UHktSpriteCrowdRenderer`가 태그에서 `UHktSpritePartTemplate`을 비동기 로드 → HISM 인스턴스 등록 / 갱신.

### 단독 검증 — `AHktSpriteTestActor`

VM / Presentation 파이프라인 없이 DataAsset만 단독으로 눈으로 보고 싶을 때:

1. 레벨에 **Hkt Sprite Test Actor** 드래그 배치
2. Details에서 `BodyPart`(또는 해당 슬롯)에 방금 만든 Tag 지정
3. `QuadMesh`(예: `Engine/BasicShapes/Plane`), `SpriteMaterial` 지정
4. `ActionId`에 `idle` 등 지정
5. PIE

---

## 파일 배치 요약

| 생성물 | 경로 |
|--------|------|
| 중간 Atlas PNG (디스크) | `{ProjectDir}/Saved/SpriteGenerator/{Tag_safe}.png` |
| Atlas `UTexture2D` | `{OutputDir}/T_SpriteAtlas_{Tag_safe}.uasset` |
| `UHktSpritePartTemplate` | `{OutputDir}/DA_SpritePart_{Tag_safe}.uasset` |

`Tag_safe`는 Tag의 `.` 을 `_`로 치환한 형태. 예: `Sprite.Part.Body.Knight` → `Sprite_Part_Body_Knight`.

---

## 트러블슈팅

| 증상 | 원인 / 조치 |
|------|-------------|
| `입력 폴더 없음` | `input_dir` 경로 오타 또는 존재하지 않음. 절대 경로 권장. |
| `스프라이트 파일을 찾지 못했습니다` | 파일명 규칙에 맞지 않음. `{action}` 이 알파벳으로 시작하는지 확인. `attack_heavy` 같은 복합 액션명은 `attackHeavy` 또는 `attack1` 로 변경. |
| `이미지 디코드 실패` | 확장자와 실제 포맷 불일치, 손상된 파일. TGA는 제한적 지원. |
| PIE에선 보이는데 Shipping에서 안 보임 | `AHktSpriteCrowdHost` 자동 스폰은 Game/PIE만. 서버 빌드에서 의도적으로 비활성. |
| Atlas 셀이 이상하게 잘림 | 입력 이미지들의 크기가 제각각 → 최대 크기로 패딩됨. 콘텐츠가 좌상단에 치우쳐 있는지 확인. |
| 머티리얼이 UV를 잘못 샘플링 | `SpriteMaterialTemplate`에 `AtlasWidth/Height` 또는 `Columns/Rows` MaterialParameter 셋업 필요. CPD 슬롯 0(AtlasIndex), 1(CellW), 2(CellH)를 받아 UV Rect 계산해야 함. |

---

## 관련 코드

| 목적 | 경로 |
|------|------|
| Sprite 런타임 렌더 호스트 | `HktGameplay/Source/HktSpriteCore/Public/HktSpriteCrowdHost.h` |
| HISM 기반 Crowd 렌더러 | `HktGameplay/Source/HktSpriteCore/Public/HktSpriteCrowdRenderer.h` |
| DataAsset 타입 | `HktGameplay/Source/HktSpriteCore/Public/HktSpritePartTemplate.h` |
| 에디터 패널 | `HktGameplayGenerator/Source/HktSpriteGenerator/Private/SHktSpriteBuilderPanel.cpp` |
| C++ 패킹 + DataAsset 빌드 | `HktGameplayGenerator/Source/HktSpriteGenerator/Private/HktSpriteGeneratorFunctionLibrary.cpp` |
| Python MCP 툴 | `HktGameplayGenerator/McpServer/src/hkt_mcp/tools/sprite_tools.py` |
| Presentation Subsystem (diff 디스패처) | `HktGameplay/Source/HktPresentation/Private/HktPresentationSubsystem.cpp` |
