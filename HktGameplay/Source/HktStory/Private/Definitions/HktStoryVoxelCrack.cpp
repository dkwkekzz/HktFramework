// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreDefs.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktStoryEventParams.h"
#include "NativeGameplayTags.h"

namespace HktStoryVoxelCrack
{
	using namespace HktStoryTags;

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_VoxelCrack, "VFX.Niagara.VoxelCrack", "Ice voxel crack VFX (frost particles).");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_VoxelCrack, "Sound.VoxelCrack", "Ice voxel crack sound.");

	/** 얼음 파편 상향 속도 (cm/s) — 살짝 튀어오르기 */
	static constexpr int32 IcePopVelZ = 150;

	/**
	 * ================================================================
	 * 얼음 복셀 균열 Flow (Ice)
	 *
	 * 자연어로 읽으면:
	 * "얼음 균열 VFX/사운드를 재생한다. 얼음 파편 엔티티를 생성하고
	 *  살짝 위로 튀어 오르게 한다."
	 *
	 * InteractTerrain에서 얼음 복셀 제거 후 자동 dispatch됨.
	 * Self = 공격 주체, TargetPos = 복셀 중심, Param0 = TypeId
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Voxel_Crack);

		// Precondition: 현재는 무조건 통과 (확장점 — 향후 "화염 속성 무기 필요" 등 조건 추가 가능)
		B.BeginPrecondition()
			.LoadConst(Flag, 1)
		.EndPrecondition();

		FHktScopedRegBlock pos(B, 3);   // 복셀 위치 (X, Y, Z)
		FHktScopedReg typeId(B);        // 원래 TypeId

		B	// 복셀 위치 및 TypeId 읽기
			.LoadStore(pos,                                     PropertyId::TargetPosX)
			.LoadStore(static_cast<RegisterIndex>(pos + 1),     PropertyId::TargetPosY)
			.LoadStore(static_cast<RegisterIndex>(pos + 2),     PropertyId::TargetPosZ)
			.LoadStore(typeId,                                  VoxelBreakParams::TypeId)

			// 균열 VFX/사운드
			.PlayVFX(pos, VFX_VoxelCrack)
			.PlaySoundAtLocation(pos, Sound_VoxelCrack)

			// Debris 엔티티 생성 — 살짝 튀어오르기 (IsGrounded=0, JumpVelZ=150)
			.SpawnEntity(Entity_Debris_Ice)
			.SetPosition(Spawned, pos)
			.SaveStoreEntity(Spawned, PropertyId::TerrainTypeId, typeId)
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginX, pos)
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginY, static_cast<RegisterIndex>(pos + 1))
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginZ, static_cast<RegisterIndex>(pos + 2))
			.SaveConstEntity(Spawned, PropertyId::Health, 1)
			.SaveConstEntity(Spawned, PropertyId::MaxHealth, 1)
			.SaveConstEntity(Spawned, PropertyId::IsGrounded, 0)
			.SaveConstEntity(Spawned, PropertyId::JumpVelZ, IcePopVelZ)

			// Debris Lifecycle 시작 (Spawned가 Self가 됨)
			.DispatchEventFrom(Story_Debris_Lifecycle, Spawned)

			.Halt()
			.BuildAndRegister();
	}
}
