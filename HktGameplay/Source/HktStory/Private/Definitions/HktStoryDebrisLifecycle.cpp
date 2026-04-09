// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "NativeGameplayTags.h"

namespace HktStoryDebrisLifecycle
{
	using namespace HktStoryTags;

	// State Tags
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Tag_State_Dead, "State.Dead", "Dead state tag — set by attack stories when health reaches 0.");

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_TerrainBreak, "VFX.Niagara.TerrainBreak", "Terrain destruction VFX.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_TerrainBreak, "Sound.TerrainBreak", "Terrain break sound.");

	/** Debris 최대 생존 시간 (초) — 공격 안 받아도 자동 파괴 */
	static constexpr int32 MaxLifetimeSeconds = 10;

	/**
	 * ================================================================
	 * Debris Lifecycle Flow
	 *
	 * 자연어로 읽으면:
	 * "사망 태그(State.Dead)가 부여될 때까지 1초마다 확인한다.
	 *  최대 10초까지 대기하며, 시간이 초과하면 지형을 원복하고 파괴한다.
	 *  사망이 감지되면 파괴 VFX/사운드를 재생하고
	 *  위로 살짝 튕긴 뒤 3초 후 엔티티를 제거한다."
	 *
	 * InteractTerrain opcode에서 Debris 생성 시 자동 dispatch됨.
	 * Self = Debris 엔티티
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Debris_Lifecycle);

		FHktScopedReg r0(B);              // HasTag 결과 / 시간 비교 / 나눗셈용 상수
		FHktScopedReg r1(B);              // 현재 시간
		FHktScopedReg r2(B);              // 생성 시간
		FHktScopedRegBlock voxelPos(B, 3); // 복셀 좌표 (X, Y, Z) — expire 시 지형 복원용
		FHktScopedReg typeReg(B);          // TerrainTypeId — expire 시 지형 복원용

		B	// 생성 시간 기록
			.GetWorldTime(r2)

			.Label(TEXT("check"))
				.HasTag(r0, Self, Tag_State_Dead)
				.JumpIf(r0, TEXT("die"))

				// TTL 체크: 현재 시간 - 생성 시간 > MaxLifetime (프레임 단위, 30fps)
				.GetWorldTime(r1)
				.Sub(r0, r1, r2)
				.IfGtConst(r0, MaxLifetimeSeconds * 30)
					.Jump(TEXT("expire"))
				.EndIf()

				.WaitSeconds(1.0f)
				.Jump(TEXT("check"))

			// 시간 초과 → 지형 복원 후 파괴
			.Label(TEXT("expire"))
				// 원래 복셀 위치 읽기 (cm)
				.LoadStoreEntity(voxelPos,                                     Self, PropertyId::DebrisOriginX)
				.LoadStoreEntity(static_cast<RegisterIndex>(voxelPos + 1),     Self, PropertyId::DebrisOriginY)
				.LoadStoreEntity(static_cast<RegisterIndex>(voxelPos + 2),     Self, PropertyId::DebrisOriginZ)
				// cm → 복셀 좌표 변환 (÷15)
				.LoadConst(r0, 15)
				.Div(voxelPos,                                     voxelPos,                                     r0)
				.Div(static_cast<RegisterIndex>(voxelPos + 1),     static_cast<RegisterIndex>(voxelPos + 1),     r0)
				.Div(static_cast<RegisterIndex>(voxelPos + 2),     static_cast<RegisterIndex>(voxelPos + 2),     r0)
				// 원래 TypeId 읽기
				.LoadStoreEntity(typeReg, Self, PropertyId::TerrainTypeId)
				// 복셀 복원
				.SetVoxel(voxelPos, typeReg)
				.DestroyEntity(Self)
				.Halt()

			// 전투 사망 → VFX + 물리 (지형 복원 안 함)
			.Label(TEXT("die"))
				.PlayVFXAtEntity(Self, VFX_TerrainBreak)
				.PlaySoundAtEntity(Self, Sound_TerrainBreak)
				// 위로 튕기기
				.WriteConst(PropertyId::IsGrounded, 0)
				.WriteConst(PropertyId::JumpVelZ, 200)
				.WaitSeconds(3.0f)
				.DestroyEntity(Self)
				.Halt()
			.BuildAndRegister();
	}
}
