// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreDefs.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktStoryEventParams.h"
#include "NativeGameplayTags.h"

namespace HktStoryVoxelCrumble
{
	using namespace HktStoryTags;

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_VoxelCrumble, "VFX.Niagara.VoxelCrumble", "Sand/gravel voxel crumble VFX (dust particles).");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_VoxelCrumble, "Sound.VoxelCrumble", "Sand/gravel voxel crumble sound.");

	/**
	 * ================================================================
	 * 모래/자갈 복셀 붕괴 Flow (Sand, Gravel)
	 *
	 * 자연어로 읽으면:
	 * "붕괴 VFX/사운드를 재생한다. 파편 엔티티를 생성하고
	 *  지면에서 분리하여 중력으로 떨어지게 한다."
	 *
	 * InteractTerrain에서 복셀 제거 후 자동 dispatch됨.
	 * Self = 공격 주체, TargetPos = 복셀 중심, Param0 = TypeId
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Voxel_Crumble);

		// Precondition: 현재는 무조건 통과 (확장점 — 향후 "무게 >= N" 등 조건 추가 가능)
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

			// 붕괴 VFX/사운드
			.PlayVFX(pos, VFX_VoxelCrumble)
			.PlaySoundAtLocation(pos, Sound_VoxelCrumble)

			// Debris 엔티티 생성 — 중력 물리 (IsGrounded=0, JumpVelZ=0)
			.SpawnEntity(Entity_Debris_Crumble)
			.SetPosition(Spawned, pos)
			.SaveStoreEntity(Spawned, PropertyId::TerrainTypeId, typeId)
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginX, pos)
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginY, static_cast<RegisterIndex>(pos + 1))
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginZ, static_cast<RegisterIndex>(pos + 2))
			.SaveConstEntity(Spawned, PropertyId::Health, 1)
			.SaveConstEntity(Spawned, PropertyId::MaxHealth, 1)
			.SaveConstEntity(Spawned, PropertyId::IsGrounded, 0)

			// Debris Lifecycle 시작 (Spawned가 Self가 됨)
			.DispatchEventFrom(Story_Debris_Lifecycle, Spawned)

			.Halt()
			.BuildAndRegister();
	}
}
