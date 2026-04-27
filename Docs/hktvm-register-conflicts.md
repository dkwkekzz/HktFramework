PR-1 Agent 프롬프트 — 내부 IR + Linear-Scan 할당기
## 배경
HktFramework UE5 플러그인 (`/home/user/HktFramework`)의 HktCore VM은 16개 물리 레지스터(R0~R15)에서 바이트코드를 실행한다. 현재 `FHktStoryBuilder`는 사용자가 지정한 `RegisterIndex`를 직접 받아 `FInstruction`을 emit한다. 이 방식은 묵시 출력 슬롯(`Reg::Flag/Hit/Iter/Spawned`) 충돌과 호출자/콜리 레지스터 충돌을 유발한다.

근본 해결을 위해 **SSA-스타일 가상 레지스터 + Build-time linear-scan 할당기**를 도입한다. 이 PR(단계 1)은 그 **스캐폴딩만** 작성한다. **공개 API와 외부 행동은 100% 동일**해야 한다.

## 먼저 읽을 파일
- `/home/user/HktFramework/HktGameplay/CLAUDE.md` (HktCore 제약사항)
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Public/HktStoryTypes.h` (Reg 정의, FHktRegAllocator, FInstruction, HKT_OPCODE_LIST)
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Public/HktStoryBuilder.h` (공개 API, FHktScopedReg/FHktScopedRegBlock, FCodeSection)
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Private/HktStoryBuilder.cpp` (Emit, Repeat/EndRepeat, ForEach/EndForEach, ApplyDamage 등 합성연산)
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Private/VM/HktVMInterpreter.cpp` (실행 의미 — 변경하지 말 것)
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Tests/HktRegAllocatorTest.cpp` (기존 테스트)

## 작업 내용

### 1. 가상 인스트럭션 타입 신설
새 헤더 `HktCore/Private/HktVRegIR.h`에:
```cpp
using FHktVRegId = int32;            // 가상 레지스터 ID (-1 = 미할당)
constexpr FHktVRegId InvalidVReg = -1;

struct FHktVInst {
    EOpCode Op;
    FHktVRegId Dst = InvalidVReg;
    FHktVRegId Src1 = InvalidVReg;
    FHktVRegId Src2 = InvalidVReg;
    int32 Imm = 0;                   // Imm12 또는 Imm20 (인코딩은 emit 단계에서 결정)
    bool bUsesImm20 = false;         // LoadConst 등
    // 라벨/픽스업 메타데이터 (현재 FCodeSection의 Fixups/IntFixups를 VInst 단위로 흡수)
    int32 LabelKey = 0;              // 0이면 라벨 아님
    bool bIsLabel = false;
    bool bIsJumpFixup = false;       // jump가 라벨 키를 imm으로 대체할 위치
};
```

각 VReg에 메타데이터:
```cpp
struct FHktVRegMeta {
    int32 PinnedPhysical = -1;       // pre-colored이면 0..15, 아니면 -1
    bool bIsBlockBase = false;       // 연속 블록의 base
    int32 BlockSize = 1;             // 블록 크기 (1=단일)
    int32 FirstDef = INT32_MAX;      // VInst index
    int32 LastUse = -1;
};
```

### 2. Builder 내부 IR 전환
- `FCodeSection::Code: TArray<FInstruction>` → `TArray<FHktVInst>`로 교체.
- `Emit(FInstruction)` 헬퍼는 그대로 두되, **내부에서 FHktVInst로 변환**하여 push. 이때 `RegisterIndex`(uint8)는 "pre-colored VReg"로 매핑.
- pre-coloring 매핑 정책: `RegisterIndex` 0~15가 들어오면 그 인덱스에 pinned된 VReg를 할당기에서 만들어 사용. 동일 호출 내 같은 RegisterIndex는 **같은 VReg를 재사용**해야 한다 (현재의 fluent 코드가 R0를 여러 번 쓰는 패턴 지원).
- `FHktScopedReg::Alloc()` 결과인 GP reg 0~9도 동일하게 pre-colored로 처리. (단계 2에서 anonymous로 풀릴 예정.)
- `Reg::Self/Target/Spawned/Hit/Iter/Flag` (10~15)는 builder가 lazy하게 한 번만 만드는 영구 pre-colored VReg에 매핑.

### 3. Build() 끝에서 `FInstruction[]` emit
`FHktStoryBuilder::Build()` 종료 직전에 새 함수 `FinalizeAndEmitBytecode()`를 호출:
1. **할당 패스**: 모든 VReg가 pre-colored이므로 단순 매핑. (anonymous reg는 단계 2에서 처리.)
2. **검증**: 모든 VReg.Pinned가 0~15 범위 내인지 확인. 16 초과 시 `ValidationErrors`에 추가.
3. **emit**: VInst → FInstruction 변환. 라벨 위치(`bIsLabel`)는 emit 시 PC를 기록, jump fixup은 라벨 PC로 imm을 채움. (즉 기존 `ResolveLabels` 로직을 VInst 기반으로 옮긴다.)
4. `FHktVMProgram::Code`에 결과를 저장.

### 4. 기존 테스트 통과
`HktRegAllocatorTest.cpp`는 `FHktRegAllocator` 직접 호출 테스트라 그대로 통과해야 한다. `FHktRegAllocator` 자체는 단계 2에서 anonymous VReg 할당에 사용될 것이라 **삭제하지 말 것**.

### 5. 결정론
동일 빌더 호출 시퀀스 → 동일 바이트코드. Map iteration 순서 의존이 없도록 `TArray`만 사용. 모든 정렬 키 명시.

## 절대 변경하지 말 것
- 공개 API (`HktStoryBuilder.h`의 시그니처, `HktStoryTypes.h`의 enum/struct)
- VM 측 (`HktVMInterpreter.cpp`, `HktVMRuntime.h`)
- 인스트럭션 인코딩 (`FInstruction`)
- 모든 기존 스토리/스니펫 (`HktStory/`)
- `HktStoryJsonParser`

## 완료 기준
- 풀 빌드 성공 (UE5 5.6, `HktCore` 모듈)
- `HktRegAllocatorTest.cpp`의 모든 테스트 통과
- 모든 기존 스토리(`HktStory/Private/Definitions/*.cpp`)가 빌드되고 등록됨
- 빌드된 `FHktVMProgram::Code`의 raw bytes가 변경 전과 **byte-identical** (이를 검증하는 임시 테스트를 추가할 것 — 단계 1 완료 후 삭제 가능)

## Git
- 브랜치: `claude/fix-hktvm-register-conflicts-ONaZm` (이미 존재)
- 커밋 메시지: `HktCore: 가상 레지스터 IR 도입 (단계 1/3)` + 본문에 변경 요약
- 푸시 후 PR 생성하지 말 것 (사용자가 통합 후 결정)

PR-2 Agent 프롬프트 (수정판) — 새 FHktVar API 병행 추가
## 배경
PR-1에서 `FHktStoryBuilder`가 내부적으로 `FHktVInst`를 누적하고, `Build()` 시 pre-colored VReg를 그대로 물리 레지스터에 매핑하는 구조가 마련되었다.

이 PR에서는:
1. **liveness + linear-scan 할당기**를 구현하여 anonymous VReg를 자동 배정
2. **`FHktVar` 기반 새 공개 API를 추가**. 구 `RegisterIndex` API는 모두 `[[deprecated]]`로 표시한 채 **그대로 유지**한다
3. JSON 파서가 신·구 스키마를 모두 받게 확장

**이 PR은 cpp 스토리(`HktStory/Private/Definitions/*.cpp` 32개)나 스니펫(3개)을 마이그레이션하지 않는다.** 그들은 deprecated API를 통해 PR 이전과 동일하게 빌드·동작해야 한다. 마이그레이션은 PR-3에서 strangler-fig 방식으로 진행된다.

신·구 API 공존이 명시적인 설계 결정이다. 각 deprecated 메서드의 doxygen 주석에 "PR-3에서 새 API 기반 JSON으로 대체 예정" 명시.

## 먼저 읽을 파일
- PR-1 결과물: `HktVRegIR.h`, 갱신된 `HktStoryBuilder.cpp/h`
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Public/HktStoryTypes.h`
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Public/HktStoryBuilder.h`
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Public/HktStoryJsonParser.h`
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Private/HktStoryJsonParser.cpp`
- `/home/user/HktFramework/HktGameplay/Source/HktStory/Private/Definitions/HktStoryFireball.cpp` (가장 복잡 — 새 API가 이 패턴을 모두 표현 가능한지 검증)

## 작업 내용

### 1. Liveness 분석 + Linear-Scan 할당기 (`HktVRegAllocator.cpp` 신규)

**1-a. CFG 구성**
- `FHktVInst[]`를 라벨 경계로 basic block 분할
- `Jump`, `JumpIf`, `JumpIfNot`, `Halt`, `Fail`, `Yield`, `WaitCollision` 등의 successor 계산
- 각 VInst의 R/W 역할은 `GetOpRegInfo`(`HktStoryTypes.h:425`)로 조회

**1-b. Liveness (backward iterative)**
- `live_out[B] = ∪ live_in[succ]`, `live_in[B] = use[B] ∪ (live_out[B] - def[B])`
- 안정될 때까지 반복

**1-c. Linear-Scan 할당**
- Live interval을 시작 PC 기준 정렬 (tie-break는 VReg ID — 결정론)
- pre-colored VReg는 무조건 그 reg 사용. 충돌 시 anonymous를 다른 reg로 회피
- 블록 VReg(`bIsBlockBase`)는 N개 연속 reg를 best-fit
- 동시 활성 GP > 10이면 빌드 실패 + `ValidationErrors`에 충돌 PC + live VReg 집합(이름 포함) 기록

**1-d. 결정론**
- Map iteration 금지. `TArray`/정렬된 `TSet`만 사용

**1-e. 단위 테스트** (`HktVRegAllocatorTest.cpp` 신규)
- 직선 / 분기 / 루프 / pre-colored 회피 / 고갈 시나리오 5개 이상

**중요**: pre-colored VReg만 있는 입력(= 모든 기존 cpp 스토리)에 대해서는 결과가 PR-1과 byte-identical 해야 함. 임시 확인 테스트 추가.

### 2. `FHktVar` 공개 API 추가 (구 API 보존)

`HktStoryBuilder.h`에 신규 추가:
```cpp
class HKTCORE_API FHktVar {
public:
    FHktVar() = default;
    FHktVar(const FHktVar&) = default;
    bool IsValid() const { return VRegId >= 0; }
private:
    friend class FHktStoryBuilder;
    explicit FHktVar(FHktVRegId Id) : VRegId(Id) {}
    FHktVRegId VRegId = -1;
};

class HKTCORE_API FHktVarBlock {
public:
    FHktVar Element(int32 i) const;
    int32 Num() const;
};
```

`FHktStoryBuilder`에 신규 메서드:
```cpp
FHktVar NewVar(const TCHAR* DebugName = nullptr);
FHktVarBlock NewVarBlock(int32 Count, const TCHAR* DebugName = nullptr);
FHktVar Self();
FHktVar Target();

// 묵시 출력 → 명시 반환 (구 API의 Reg::Spawned/Hit/Iter에 의존하던 패턴 대체)
FHktVar SpawnEntity(const FGameplayTag& ClassTag);                  // 새 오버로드
FHktVar WaitCollision(FHktVar Watch);                                // 새 오버로드
FHktVarBlock GetPosition(FHktVar Entity);                            // 새 오버로드

// ForEach: 콜백 형태 — Iter VReg를 Body에 전달
template<typename F>
FHktStoryBuilder& ForEachInRadius(FHktVar Center, int32 RadiusCm, F&& Body);

// 모든 산술/비교/Property 메서드의 FHktVar 오버로드
FHktStoryBuilder& Add(FHktVar Dst, FHktVar Src1, FHktVar Src2);
FHktStoryBuilder& LoadConst(FHktVar Dst, int32 Value);
// ... 약 60+ 신규 오버로드
```

**모든 기존 `RegisterIndex` 받는 메서드에는 `[[deprecated("Use FHktVar overload — migrate to JSON in PR-3")]]` 부착**. 시그니처/구현은 변경 금지.

`Reg::Self/Target/Spawned/Hit/Iter/Flag` 네임스페이스, `FHktScopedReg`, `FHktScopedRegBlock`, `FHktRegAllocator`, `FHktRegReserve` 모두 그대로 유지 (deprecation 마킹만 추가).

내부 구현: 구 `RegisterIndex` 메서드는 인자를 pre-colored VReg로 변환해 신 구현으로 위임하거나, 기존 emit 로직 유지. 두 경로의 출력 바이트코드가 동일해야 함.

### 3. JSON 파서 신·구 스키마 동시 지원

`HktStoryJsonParser.cpp/h`:
- 기존 `ParseRegister(const FString&)` → `RegisterIndex` 유지 (deprecated)
- 기존 `FHktStoryCmdArgs::GetReg/GetRegOpt` 유지 (deprecated)

**신규 추가**:
```cpp
FHktVar  FHktStoryCmdArgs::GetVar(FHktStoryBuilder& B, const FString& Key) const;
FHktVarBlock FHktStoryCmdArgs::GetVarBlock(FHktStoryBuilder& B, const FString& Key, int32 Count) const;
```

VarRef JSON 형식 (4종):
- `{"var": "name"}` — 변수명 해석. 같은 빌더 내 같은 이름은 같은 VReg.
- `{"self": true}` / `{"target": true}` — 특수 reg
- `{"const": N}` — 즉석 상수 (자동 NewVar + LoadConst)
- `{"block": "name", "index": i}` — 블록 element

**스토리 메타에 스키마 버전 표기**:
```json
{"schema": 2, "tag": "...", "body": [...]}
```
- `schema: 1`(기본): 구 표기 (`"R3"`, `"R0..R2"`) 사용. 기존 JSON 호환.
- `schema: 2`: VarRef 객체만 허용. PR-3에서 새 JSON 파일은 모두 `schema: 2`로 작성.

파서 디스패치에서 schema 버전에 따라 인자 해석 분기.

### 4. 스니펫 새 API 오버로드 추가 (구 시그니처 유지)

`HktSnippetCombat.h/cpp`, `HktSnippetItem.h/cpp`, `HktSnippetNPC.h/cpp`:
- 모든 기존 함수에 `[[deprecated]]` 부착
- 동일 이름의 `FHktVar` 받는 새 오버로드 추가
- 새 오버로드의 구현은 새 API만 사용 (`B.NewVar()` 등)

### 5. 검증
- 새 API만 사용하는 미니 스토리(`HktVarBuilderTest.cpp`)로 Fireball 스토리의 동등 코드 작성 → 빌드 성공 + 실행 결과 검증
- 기존 cpp 스토리 32개는 수정 없이 빌드되고 등록되어야 함
- byte-identical 검증: 기존 cpp 스토리들의 `FHktVMProgram::Code`가 PR 이전과 동일 (PR-1에서 도입한 검증 테스트 그대로 통과)

### 6. 문서 갱신
- `/home/user/HktFramework/HktGameplay/CLAUDE.md`의 "HktStory" 섹션에 한 줄 추가:
  - "새 코드는 `FHktVar` API를 사용할 것. 구 `RegisterIndex` 기반 API는 PR-3에서 strangler-fig 방식으로 JSON 마이그레이션 예정."
- `HktStoryBuilder.h` 상단 주석에 신·구 API 사용 가이드

## 절대 변경하지 말 것
- VM, 인스트럭션 인코딩
- 기존 cpp 스토리 (`HktStory/Private/Definitions/*.cpp`)
- 기존 스니펫 본문 (오버로드 추가만, 기존 함수 수정 금지)
- `HktStoryRegistry` 등록 메커니즘

## 완료 기준
- 풀 빌드 성공
- `HktVRegAllocatorTest` 통과
- `HktVarBuilderTest` 통과
- 기존 32개 cpp 스토리가 deprecation warning은 발생시키되 빌드 성공
- byte-identical 검증 통과 (기존 스토리들의 컴파일 결과 동일)

## Git
- 브랜치: `claude/fix-hktvm-register-conflicts-ONaZm`
- 커밋 분할 권장: (1) 할당기, (2) FHktVar API 추가, (3) JSON schema 2 지원, (4) 스니펫 새 오버로드
- 커밋 메시지: `HktCore: FHktVar API 및 linear-scan 할당기 추가 (단계 2/3)`
PR-3 Agent 프롬프트 (수정판) — Strangler Fig: 새 JSON 작성 + cpp 스토리 tag rename
## 배경
PR-2에서 `FHktVar` 기반 새 공개 API와 `schema: 2` JSON 스키마, linear-scan 할당기가 추가되었다. 구 `RegisterIndex` API와 cpp 스토리들은 모두 deprecated 상태로 정상 동작 중이다.

이 PR은 **strangler-fig 마이그레이션**을 수행한다:
1. 각 cpp 스토리에 대응하는 **새 JSON 파일을 새 API/schema로 작성**
2. 새 JSON이 원본 GameplayTag (e.g., `Story.Event.Skill.Fireball`)를 차지
3. 원본 cpp 스토리의 GameplayTag를 **`.Legacy` suffix로 rename** (e.g., `Story.Event.Skill.Fireball.Legacy`)
4. cpp 등록은 유지 — 비교/안전망 용도. gameplay는 자동으로 새 JSON 버전을 사용
5. 각 마이그레이션은 **하나의 스토리 단위로 atomic** — 문제 발생 시 tag만 swap하면 즉시 rollback

cpp 정의 자체의 삭제는 **이 PR에서 하지 않는다**. 후속 정리 PR에서 처리.

## 먼저 읽을 파일
- PR-2 결과: `FHktVar` API, schema 2 파서
- `/home/user/HktFramework/HktGameplay/Source/HktStory/Private/Definitions/` 32개 cpp 파일
- `/home/user/HktFramework/HktGameplay/Source/HktCore/Public/HktStoryJsonParser.h`
- `HktStoryRegistry`의 등록 우선순위 메커니즘 — 동일 tag에 두 스토리가 등록되면 어떻게 되는지 확인 (덮어쓰기 / 에러 / 우선순위)

## 작업 내용

### 0. 등록 우선순위 처리 확인

`HktStoryRegistry`가 동일 tag 충돌 시 어떻게 동작하는지 먼저 확인. 만약 에러로 처리하면 **본 PR 진행 불가** — 그 경우 작업을 멈추고 다음을 보고:
- 현재 등록 동작 요약
- "JSON 우선" 정책을 적용하기 위해 필요한 변경 (예: `RegisterStory(Source=Json, ...)`가 cpp 등록을 덮어쓰도록)

이 정책 변경이 사소하면 본 PR에 포함. 큰 변경이면 별도 작업으로 분리하고 사용자에게 보고.

### 1. JSON 디렉터리 구조

```
HktGameplay/Source/HktStory/Stories/
    Combat/
        Fireball.json, Lightning.json, Heal.json, BasicAttack.json,
        CombatUseSkill.json, Buff.json
    Item/
        ItemActivate.json, ItemDeactivate.json, ItemPickup.json,
        ItemDrop.json, ItemTrade.json
        Spawners/
            AncientStaff.json, Bandage.json, ThunderHammer.json,
            TreeDrop.json, WingsOfFreedom.json
    NPC/
        NPCLifecycle.json
        Spawners/
            GoblinCamp.json, Wave.json, Proximity.json
    Movement/
        MoveTo.json, MoveStop.json, MoveForward.json, Jump.json
    Voxel/
        VoxelBreak.json, VoxelCrack.json, VoxelCrumble.json, VoxelShatter.json
    Lifecycle/
        CharacterSpawn.json, DebrisLifecycle.json, PlayerInWorld.json,
        TargetDefault.json
```

`HktStoryJsonLoader`가 모듈 시작 시 위 트리 재귀 로드. cpp 등록보다 **나중에** 실행되도록 보장 (덮어쓰기 우선).

### 2. JSON 스키마 명세 작성

`/home/user/HktFramework/HktGameplay/Source/HktStory/Stories/SCHEMA.md`:
- `schema: 2` 메타 필드 (`tag`, `archetype`, `cancelOnDuplicate`, `requiresTrait`, `precondition`, `body`, `flowMode`)
- VarRef 4종 (`var` / `self`,`target` / `const` / `block`)
- 모든 op의 인자 키 — 빌더 메서드명과 1:1
- 라벨/제어흐름: `if`, `else`, `endIf`, `repeat`, `endRepeat`, `forEachInRadius`, `endForEach`, `label`, `jump`

### 3. 파일럿 마이그레이션 (5개 — 사용자 검토 필수)

다음 5개를 먼저 변환하고 **사용자 검토를 명시적으로 요청**:
- `HktStoryFireball` (가장 복잡 — ForEach + WaitCollision + 합성연산 + 스니펫 호출)
- `HktStoryHeal` (단순 케이스)
- `HktStoryItemActivate` (스니펫 다수 호출)
- `HktStoryNPCLifecycle` (긴 시퀀스)
- `HktStoryVoxelBreak` (Flow 모드)

각 파일럿별 단계:
1. JSON을 손으로 작성 (cpp 본문을 op-by-op으로 번역). 변수는 의미 있는 이름으로 (`hitTarget`, `explosionPos` 등)
2. cpp 본문의 GameplayTag를 `.Legacy` suffix로 rename
   - 예: `UE_DEFINE_GAMEPLAY_TAG_COMMENT(Story_Fireball, "Story.Event.Skill.Fireball", ...)` → `"Story.Event.Skill.Fireball.Legacy"`
3. JSON과 cpp(.Legacy) 모두 빌드/등록되는지 확인
4. **byte-identical 비교**: JSON의 `FHktVMProgram::Code` ↔ cpp(.Legacy)의 `FHktVMProgram::Code`. 일치하지 않으면 JSON을 수정해서 일치시킴 (의미 차이 발견 시 사용자에게 보고)
5. PIE 또는 자동화 테스트로 gameplay 동작 확인 (gameplay는 이제 JSON 버전 사용)

5개 파일럿 작업 후 보고 형식:
- 각 스토리의 cpp / JSON 라인 수
- byte-identical 여부
- 발견된 이슈 (예: 스키마 표현 부족, 파서 버그, 의미 차이)
- 사용자 승인 시 나머지 27개 진행

### 4. 나머지 27개 일괄 마이그레이션

파일럿이 검증된 패턴으로 진행. 각 스토리별:
- JSON 작성 → cpp tag rename → byte-identical 검증
- 검증 실패 시 해당 스토리는 skip하고 보고

스니펫(`HktSnippetCombat`, `HktSnippetItem`, `HktSnippetNPC`)은 **이번 PR에서 마이그레이션하지 않는다**. JSON에서 스니펫 호출이 필요하면 다음 두 옵션 중 선택:
- **Option A**: JSON op으로 스니펫 노출 (`{"op": "Snippet.CooldownUpdateConst", "frame": 45}`). 파서가 cpp 스니펫 함수에 위임.
- **Option B**: 스니펫이 emit하는 op들을 JSON에 inline으로 풀어서 작성.

파일럿에서 어느 쪽이 자연스러운지 결정 후 사용자에게 보고. 기본 권장은 **Option A** (스니펫은 재사용 단위).

### 5. CLAUDE.md 갱신

- `HktStory` 섹션:
  - "새 스토리는 `Stories/` 디렉터리의 JSON으로 작성. cpp 정의는 deprecated, 점진 제거 예정"
  - JSON 스키마 위치 (`Stories/SCHEMA.md`) 링크
  - `.Legacy` 태그 컨벤션 설명

## 절대 변경하지 말 것
- VM, 인스트럭션 인코딩
- PR-2의 신·구 API 양쪽
- 스니펫 cpp 본문 (호출만, 수정 금지)
- cpp 스토리 본문 (tag rename만, 본문 수정 금지)

## 완료 기준
- 32개 cpp 스토리 → 32개 JSON 파일 + 32개 cpp의 tag가 `.Legacy`로 rename
- 모든 JSON이 등록되고 gameplay가 새 버전을 사용
- byte-identical 검증 모두 통과 (또는 차이가 의도적임이 사용자 승인됨)
- 풀 빌드 + 자동화 테스트 통과

## Git
- 브랜치: `claude/fix-hktvm-register-conflicts-ONaZm`
- 커밋 분할 권장: (1) 디렉터리 + 스키마 문서 + 로더 우선순위, (2) 파일럿 5개 (별도 커밋 5개), (3) 나머지 27개 (카테고리별 묶음)
- 커밋 메시지: `HktStory: <스토리명> JSON 마이그레이션 (cpp tag → .Legacy)`
세 prompt 모두 자기-완결적입니다. PR-1은 이전 응답 그대로 사용하시고, PR-2/PR-3은 위 수정판으로 교체해서 차례로 agent에게 전달하시면 됩니다.

추가 운영 권고:

PR-2 검증의 핵심은 기존 cpp 스토리들의 컴파일 결과가 byte-identical인지입니다. 이 테스트가 통과하지 않으면 PR-3 시작하지 말 것.
PR-3 파일럿 5개에서 스니펫 노출 방식 (Option A vs B) 결정이 가장 중요합니다. 결정 후에야 나머지 27개를 의미 있는 속도로 변환 가능.
.Legacy cpp들의 최종 삭제는 별도 PR-4로 분리 권장 (충분한 production 검증 후).