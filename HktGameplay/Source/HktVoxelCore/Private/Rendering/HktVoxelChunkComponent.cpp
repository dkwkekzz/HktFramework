// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelChunkComponent.h"
#include "Rendering/HktVoxelChunkProxy.h"
#include "RHIStaticStates.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelVertex.h"
#include "HktVoxelCoreLog.h"
#include "Materials/Material.h"

UHktVoxelChunkComponent::UHktVoxelChunkComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	CastShadow = true;

	// 선택용 Visibility 트레이스 응답 — 물리 충돌은 VM이 처리
	SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	SetCollisionResponseToAllChannels(ECR_Ignore);
	SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	// 기본 머티리얼 — 프로덕션에서는 팔레트 기반 커스텀 머티리얼로 교체
	SetMaterial(0, UMaterial::GetDefaultMaterial(MD_Surface));
}

void UHktVoxelChunkComponent::SetVoxelMaterial(UMaterialInterface* InMaterial)
{
	if (InMaterial)
	{
		SetMaterial(0, InMaterial);
		MarkRenderStateDirty();
	}
}

void UHktVoxelChunkComponent::Initialize(FHktVoxelRenderCache* Cache, const FIntVector& InChunkCoord, float InVoxelSize)
{
	RenderCache = Cache;
	ChunkCoord = InChunkCoord;
	CachedVoxelSize = (InVoxelSize > 0.f) ? InVoxelSize : FHktVoxelChunk::VOXEL_SIZE;

	// 풀 재사용 시 SceneProxy가 재생성되므로 스타일 전달 상태를 리셋.
	// (이전 수명주기의 stale 플래그로 인해 OnMeshReady가 텍스처 셋업을 스킵하는 것 방지)
	bStyleTexturesApplied = false;

	// 청크 좌표에 따른 상대 위치 설정
	const float ChunkWorldSize = FHktVoxelChunk::SIZE * CachedVoxelSize;

	SetRelativeLocation(FVector(
		ChunkCoord.X * ChunkWorldSize,
		ChunkCoord.Y * ChunkWorldSize,
		ChunkCoord.Z * ChunkWorldSize));
}

void UHktVoxelChunkComponent::OnMeshReady()
{
	if (!RenderCache)
	{
		return;
	}

	const FHktVoxelChunk* Chunk = RenderCache->GetChunk(ChunkCoord);
	if (!Chunk)
	{
		return;
	}

	// 불투명 + 반투명 메시 데이터를 합쳐서 복사
	// (프로덕션에서는 별도 렌더 패스로 분리하지만, 현재는 단일 패스)
	TArray<FHktVoxelVertex> VerticesCopy;
	TArray<uint32> IndicesCopy;

	VerticesCopy.Append(Chunk->OpaqueVertices);
	IndicesCopy.Append(Chunk->OpaqueIndices);

	// 반투명 인덱스는 오프셋 적용
	const uint32 OpaqueVertCount = Chunk->OpaqueVertices.Num();
	for (uint32 Idx : Chunk->TranslucentIndices)
	{
		IndicesCopy.Add(Idx + OpaqueVertCount);
	}
	VerticesCopy.Append(Chunk->TranslucentVertices);

	if (!SceneProxy)
	{
		MarkRenderStateDirty();
		return;
	}

	// SceneProxy를 안전하게 캡처 — 렌더 커맨드 실행 시 유효성 확인용으로
	// GetScene()에서 FPrimitiveComponentId를 통해 안전하게 접근
	FPrimitiveSceneProxy* CapturedProxy = SceneProxy;

	// 스타일 텍스처는 첫 OnMeshReady에서만 전달 (이후 Proxy가 캐싱)
	const bool bNeedStyleSetup = !bStyleTexturesApplied
		&& (CachedTileTextures.IsValid() || CachedMaterialLUT.IsValid());
	FHktVoxelTileTextureSet TileTexCopy = CachedTileTextures;
	FHktVoxelTexturePair MatLUTCopy = CachedMaterialLUT;

	ENQUEUE_RENDER_COMMAND(HktVoxelUpdateMesh)(
		[CapturedProxy, Verts = MoveTemp(VerticesCopy), Idxs = MoveTemp(IndicesCopy),
		 bNeedStyleSetup, TileTexCopy, MatLUTCopy](FRHICommandListImmediate& RHICmdList)
		{
			FHktVoxelChunkProxy* Proxy = static_cast<FHktVoxelChunkProxy*>(CapturedProxy);
			if (bNeedStyleSetup)
			{
				if (TileTexCopy.IsValid())
				{
					Proxy->SetTileTextures_RenderThread(
						TileTexCopy.TileArray.Texture, TileTexCopy.TileArray.Sampler,
						TileTexCopy.TileIndexLUT.Texture, TileTexCopy.TileIndexLUT.Sampler);
				}
				if (MatLUTCopy.IsValid())
				{
					Proxy->SetMaterialLUT_RenderThread(
						MatLUTCopy.Texture, MatLUTCopy.Sampler);
				}
			}
			Proxy->UpdateMeshData_RenderThread(Verts, Idxs);
		}
	);

	if (bNeedStyleSetup)
	{
		bStyleTexturesApplied = true;
	}
}

void UHktVoxelChunkComponent::SetTileTextures(const FHktVoxelTileTextureSet& InTileTextures)
{
	CachedTileTextures = InTileTextures;
	bStyleTexturesApplied = false;
}

void UHktVoxelChunkComponent::SetMaterialLUT(const FHktVoxelTexturePair& InMaterialLUT)
{
	CachedMaterialLUT = InMaterialLUT;
	bStyleTexturesApplied = false;
}

void UHktVoxelChunkComponent::PushStyleTexturesToProxy()
{
	// SceneProxy가 아직 없으면 다음 Pump 틱에서 재시도.
	if (!SceneProxy)
	{
		return;
	}

	// 캐시된 것이 하나도 없으면 의미 없음.
	if (!CachedTileTextures.IsValid() && !CachedMaterialLUT.IsValid())
	{
		return;
	}

	FPrimitiveSceneProxy* CapturedProxy = SceneProxy;
	FHktVoxelTileTextureSet TileTexCopy = CachedTileTextures;
	FHktVoxelTexturePair MatLUTCopy = CachedMaterialLUT;

	ENQUEUE_RENDER_COMMAND(HktVoxelPushStyleTextures)(
		[CapturedProxy, TileTexCopy, MatLUTCopy](FRHICommandListImmediate& RHICmdList)
		{
			FHktVoxelChunkProxy* Proxy = static_cast<FHktVoxelChunkProxy*>(CapturedProxy);
			if (TileTexCopy.IsValid())
			{
				Proxy->SetTileTextures_RenderThread(
					TileTexCopy.TileArray.Texture, TileTexCopy.TileArray.Sampler,
					TileTexCopy.TileIndexLUT.Texture, TileTexCopy.TileIndexLUT.Sampler);
			}
			if (MatLUTCopy.IsValid())
			{
				Proxy->SetMaterialLUT_RenderThread(
					MatLUTCopy.Texture, MatLUTCopy.Sampler);
			}
		}
	);

	bStyleTexturesApplied = true;
}

void UHktVoxelChunkComponent::UpdateBoneTransforms(const TArray<FVector4f>& BoneMatrixRows)
{
	if (!SceneProxy || BoneMatrixRows.Num() == 0)
	{
		return;
	}

	// 데이터 복사 후 렌더 스레드로 전달
	FPrimitiveSceneProxy* CapturedProxy = SceneProxy;

	ENQUEUE_RENDER_COMMAND(HktVoxelUpdateBones)(
		[CapturedProxy, Rows = BoneMatrixRows](FRHICommandListImmediate& RHICmdList)
		{
			static_cast<FHktVoxelChunkProxy*>(CapturedProxy)->UpdateBoneTransforms_RenderThread(Rows);
		}
	);
}

FPrimitiveSceneProxy* UHktVoxelChunkComponent::CreateSceneProxy()
{
	return new FHktVoxelChunkProxy(this);
}

FBoxSphereBounds UHktVoxelChunkComponent::CalcBounds(const FTransform& LocalToWorld) const
{
	const float ChunkWorldSize = FHktVoxelChunk::SIZE * CachedVoxelSize;

	// 복셀은 로컬 (0,0,0)~(ChunkWorldSize,ChunkWorldSize,ChunkWorldSize) 범위에 배치됨
	const FBox Box(FVector::ZeroVector, FVector(ChunkWorldSize, ChunkWorldSize, ChunkWorldSize));
	return FBoxSphereBounds(Box).TransformBy(LocalToWorld);
}
