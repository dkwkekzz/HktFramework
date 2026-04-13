// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelChunkComponent.h"
#include "Rendering/HktVoxelChunkProxy.h"
#include "RHIStaticStates.h"
#include "Data/HktVoxelRenderCache.h"
#include "Data/HktVoxelTypes.h"
#include "Meshing/HktVoxelVertex.h"
#include "HktVoxelCoreLog.h"
#include "Materials/Material.h"
#include "PhysicsEngine/BodySetup.h"

#if WITH_EDITORONLY_DATA
#include "Materials/MaterialExpressionVertexColor.h"
#include "Materials/MaterialExpressionConstant.h"
#endif

// ============================================================================
// 기본 VertexColor 머티리얼 — 자동 생성
// ============================================================================
//
// HktVoxelVertexFactory.ush의 GetMaterialPixelParameters에서
// 타일 텍스처 / 팔레트 색상을 Result.VertexColor에 기록한다.
// 따라서 머티리얼이 VertexColor.RGB를 BaseColor로 사용해야
// 복셀 텍스처가 화면에 올바르게 나타난다.
//
// 엔진 기본 머티리얼(WorldGridMaterial)은 VertexColor를 사용하지 않으므로,
// TerrainMaterial이 미할당 시 회색으로 렌더링되는 문제가 발생한다.
// 이 함수가 VertexColor → BaseColor 연결된 최소 머티리얼을 자동 생성하여
// 별도 에셋 할당 없이도 복셀 텍스처가 정상 렌더링되도록 보장한다.
//
static UMaterialInterface* GetDefaultVoxelMaterial()
{
	static TWeakObjectPtr<UMaterialInterface> CachedMaterial;
	if (CachedMaterial.IsValid())
	{
		return CachedMaterial.Get();
	}

#if WITH_EDITORONLY_DATA
	UMaterial* Mat = NewObject<UMaterial>(
		GetTransientPackage(), TEXT("M_HktVoxelVertexColor"), RF_Transient);
	Mat->AddToRoot();

	// VertexColor.RGB → BaseColor
	UMaterialExpressionVertexColor* VCExpr =
		NewObject<UMaterialExpressionVertexColor>(Mat);
	Mat->GetExpressionCollection().AddExpression(VCExpr);
	Mat->GetEditorOnlyData()->BaseColor.Connect(0, VCExpr);

	// Roughness = 0.8 (복셀 지형에 적합한 비금속 마감)
	UMaterialExpressionConstant* RoughExpr =
		NewObject<UMaterialExpressionConstant>(Mat);
	RoughExpr->R = 0.8f;
	Mat->GetExpressionCollection().AddExpression(RoughExpr);
	Mat->GetEditorOnlyData()->Roughness.Connect(0, RoughExpr);

	Mat->TwoSided = false;
	Mat->PostEditChange();

	UE_LOG(LogHktVoxelCore, Log,
		TEXT("[DefaultMaterial] VertexColor → BaseColor 기본 머티리얼 자동 생성 완료 (M_HktVoxelVertexColor)"));

	CachedMaterial = Mat;
	return Mat;
#else
	// Shipping 빌드 — 프로덕션에서는 TerrainMaterial을 명시적으로 할당해야 한다
	return UMaterial::GetDefaultMaterial(MD_Surface);
#endif
}

UHktVoxelChunkComponent::UHktVoxelChunkComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	CastShadow = true;

	// 선택용 Visibility 트레이스 응답 — 물리 충돌은 VM이 처리
	SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	SetCollisionResponseToAllChannels(ECR_Ignore);
	SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

	// 기본 머티리얼 — VertexColor.RGB → BaseColor 연결된 자동 생성 머티리얼.
	// HktVoxelVertexFactory가 타일 텍스처 / 팔레트 결과를 VertexColor에 기록하므로,
	// 이 머티리얼이 별도 에셋 할당 없이도 올바른 렌더링을 보장한다.
	// 프로덕션에서는 TerrainMaterial을 명시적으로 할당하여 이 기본값을 교체할 것.
	SetMaterial(0, GetDefaultVoxelMaterial());
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

	// 풀 재사용 시 이전 수명주기의 stale collision 정리
	if (ChunkBodySetup)
	{
		ChunkBodySetup = nullptr;
		RecreatePhysicsState();
	}
	CachedAABBMin = FIntVector(-1, -1, -1);
	CachedAABBMax = FIntVector(-1, -1, -1);

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

	// 메시 재생성 시 collision도 갱신 (solid 복셀 AABB 재계산)
	RebuildCollision();

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

	// 스타일 텍스처는 캐시되어 있으면 매 OnMeshReady마다 항상 재전달한다.
	// 이유: SceneProxy가 재생성되면 새 Proxy의 Pending*/VertexFactory는 빈 상태로
	// 시작하므로, 이전 수명주기에서 bStyleTexturesApplied=true가 설정되어 있어도
	// 새 Proxy에는 텍스처가 없다. 여기서 매번 동봉해야 새 VF가 올바르게 초기화된다.
	// (4개의 RHI 포인터 복사 + 분기만 추가되므로 비용 무시 가능.)
	const bool bHasStyleTextures = CachedTileTextures.IsValid() || CachedMaterialLUT.IsValid();
	FHktVoxelTileTextureSet TileTexCopy = CachedTileTextures;
	FHktVoxelTexturePair MatLUTCopy = CachedMaterialLUT;

	ENQUEUE_RENDER_COMMAND(HktVoxelUpdateMesh)(
		[CapturedProxy, Verts = MoveTemp(VerticesCopy), Idxs = MoveTemp(IndicesCopy),
		 bHasStyleTextures, TileTexCopy, MatLUTCopy](FRHICommandListImmediate& RHICmdList)
		{
			FHktVoxelChunkProxy* Proxy = static_cast<FHktVoxelChunkProxy*>(CapturedProxy);
			if (bHasStyleTextures)
			{
				if (TileTexCopy.IsValid())
				{
					Proxy->SetTileTextures_RenderThread(
						TileTexCopy.TileArray.Texture, TileTexCopy.TileArray.Sampler,
						TileTexCopy.TileIndexLUT.Texture, TileTexCopy.TileIndexLUT.Sampler,
						TileTexCopy.DefaultPalette.Texture, TileTexCopy.DefaultPalette.Sampler);
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

	if (bHasStyleTextures)
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
					TileTexCopy.TileIndexLUT.Texture, TileTexCopy.TileIndexLUT.Sampler,
					TileTexCopy.DefaultPalette.Texture, TileTexCopy.DefaultPalette.Sampler);
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
	// Proxy 재생성 시 스타일 전달 플래그를 리셋.
	// MarkRenderStateDirty() → 기존 Proxy 파괴 → 새 Proxy 생성 과정에서
	// PumpStyleTextures가 구(old) Proxy에 텍스처를 밀어넣고 플래그를 true로 세팅했을 수 있다.
	// 새 Proxy는 텍스처가 없으므로 PumpStyleTextures가 재시도할 수 있도록 리셋한다.
	bStyleTexturesApplied = false;
	return new FHktVoxelChunkProxy(this);
}

FBoxSphereBounds UHktVoxelChunkComponent::CalcBounds(const FTransform& LocalToWorld) const
{
	const float ChunkWorldSize = FHktVoxelChunk::SIZE * CachedVoxelSize;

	// 복셀은 로컬 (0,0,0)~(ChunkWorldSize,ChunkWorldSize,ChunkWorldSize) 범위에 배치됨
	const FBox Box(FVector::ZeroVector, FVector(ChunkWorldSize, ChunkWorldSize, ChunkWorldSize));
	return FBoxSphereBounds(Box).TransformBy(LocalToWorld);
}

UBodySetup* UHktVoxelChunkComponent::GetBodySetup()
{
	return ChunkBodySetup;
}

void UHktVoxelChunkComponent::RebuildCollision()
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

	// solid 복셀의 AABB 계산
	int32 MinX = FHktVoxelChunk::SIZE, MinY = FHktVoxelChunk::SIZE, MinZ = FHktVoxelChunk::SIZE;
	int32 MaxX = -1, MaxY = -1, MaxZ = -1;
	bool bHasSolid = false;

	for (int32 Z = 0; Z < FHktVoxelChunk::SIZE; ++Z)
	{
		for (int32 Y = 0; Y < FHktVoxelChunk::SIZE; ++Y)
		{
			for (int32 X = 0; X < FHktVoxelChunk::SIZE; ++X)
			{
				if (!Chunk->At(X, Y, Z).IsEmpty())
				{
					MinX = FMath::Min(MinX, X);
					MinY = FMath::Min(MinY, Y);
					MinZ = FMath::Min(MinZ, Z);
					MaxX = FMath::Max(MaxX, X);
					MaxY = FMath::Max(MaxY, Y);
					MaxZ = FMath::Max(MaxZ, Z);
					bHasSolid = true;
				}
			}
		}
	}

	if (!bHasSolid)
	{
		// solid 복셀 없음 — collision 해제
		if (ChunkBodySetup)
		{
			ChunkBodySetup = nullptr;
			CachedAABBMin = FIntVector(-1, -1, -1);
			CachedAABBMax = FIntVector(-1, -1, -1);
			RecreatePhysicsState();
		}
		return;
	}

	const FIntVector NewMin(MinX, MinY, MinZ);
	const FIntVector NewMax(MaxX, MaxY, MaxZ);

	// AABB가 이전과 동일하면 물리 씬 재등록 스킵 (RecreatePhysicsState 비용 절감)
	if (ChunkBodySetup && NewMin == CachedAABBMin && NewMax == CachedAABBMax)
	{
		return;
	}

	CachedAABBMin = NewMin;
	CachedAABBMax = NewMax;

	// BodySetup 생성 또는 재사용
	if (!ChunkBodySetup)
	{
		ChunkBodySetup = NewObject<UBodySetup>(const_cast<UHktVoxelChunkComponent*>(this),
			NAME_None, RF_Transient);
		ChunkBodySetup->CollisionTraceFlag = CTF_UseSimpleAsComplex;
		ChunkBodySetup->DefaultInstance.SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	}

	// 기존 심플 collision 초기화
	ChunkBodySetup->AggGeom.BoxElems.Reset();

	// AABB → FKBoxElem (로컬 좌표)
	const float BoxMinX = MinX * CachedVoxelSize;
	const float BoxMinY = MinY * CachedVoxelSize;
	const float BoxMinZ = MinZ * CachedVoxelSize;
	const float BoxMaxX = (MaxX + 1) * CachedVoxelSize;
	const float BoxMaxY = (MaxY + 1) * CachedVoxelSize;
	const float BoxMaxZ = (MaxZ + 1) * CachedVoxelSize;

	FKBoxElem BoxElem;
	BoxElem.X = BoxMaxX - BoxMinX;
	BoxElem.Y = BoxMaxY - BoxMinY;
	BoxElem.Z = BoxMaxZ - BoxMinZ;
	BoxElem.Center = FVector(
		(BoxMinX + BoxMaxX) * 0.5f,
		(BoxMinY + BoxMaxY) * 0.5f,
		(BoxMinZ + BoxMaxZ) * 0.5f);

	ChunkBodySetup->AggGeom.BoxElems.Add(BoxElem);
	ChunkBodySetup->CreatePhysicsMeshes();

	RecreatePhysicsState();
}
