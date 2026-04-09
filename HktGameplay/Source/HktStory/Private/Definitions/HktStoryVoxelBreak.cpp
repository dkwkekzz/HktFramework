// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "CoreMinimal.h"
#include "HktStoryBuilder.h"
#include "HktCoreDefs.h"
#include "HktCoreProperties.h"
#include "HktStoryRegistry.h"
#include "HktStoryTags.h"
#include "HktStoryEventParams.h"
#include "NativeGameplayTags.h"

namespace HktStoryVoxelBreak
{
	using namespace HktStoryTags;

	// VFX
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(VFX_VoxelBreak, "VFX.Niagara.VoxelBreak", "Standard terrain voxel break VFX.");

	// Sound
	UE_DEFINE_GAMEPLAY_TAG_COMMENT(Sound_VoxelBreak, "Sound.VoxelBreak", "Standard terrain voxel break sound.");

	/**
	 * ================================================================
	 * 복셀 파괴 Flow (Grass, Dirt, Stone, Snow, Clay)
	 *
	 * 자연어로 읽으면:
	 * "복셀 파괴 위치에서 Break VFX와 사운드를 재생한다.
	 *  Debris 엔티티를 복셀 위치에 생성하고 원래 TypeId를 기록한다.
	 *  체력을 설정하고 Debris Lifecycle Flow를 시작한다."
	 *
	 * InteractTerrain에서 복셀 제거 후 자동 dispatch됨.
	 * Self = 공격 주체, TargetPos = 복셀 중심, Param0 = TypeId
	 * ================================================================
	 */
	HKT_REGISTER_STORY_BODY()
	{
		using namespace Reg;

		auto B = Story(Story_Voxel_Break);

		// Precondition: 현재는 무조건 통과 (확장점 — 향후 무기 타입, 최소 공격력 등 조건 추가 가능)
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

			// 파괴 VFX/사운드
			.PlayVFX(pos, VFX_VoxelBreak)
			.PlaySoundAtLocation(pos, Sound_VoxelBreak)

			// Debris 엔티티 생성
			.SpawnEntity(HktArchetypeTags::Entity_Debris)
			.SetPosition(Spawned, pos)
			.SaveStoreEntity(Spawned, PropertyId::TerrainTypeId, typeId)
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginX, pos)
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginY, static_cast<RegisterIndex>(pos + 1))
			.SaveStoreEntity(Spawned, PropertyId::DebrisOriginZ, static_cast<RegisterIndex>(pos + 2))
			.SaveConstEntity(Spawned, PropertyId::Health, 1)
			.SaveConstEntity(Spawned, PropertyId::MaxHealth, 1)

			// Debris Lifecycle 시작 (Spawned가 Self가 됨)
			.DispatchEventFrom(Story_Debris_Lifecycle, Spawned)

			.Halt()
			.BuildAndRegister();
	}
}
