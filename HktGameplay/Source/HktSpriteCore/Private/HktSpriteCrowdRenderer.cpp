// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdRenderer.h"
#include "HktSpriteCharacterTemplate.h"
#include "HktSpriteFrameResolver.h"
#include "HktSpriteBillboardMaterial.h"
#include "HktSpriteCoreLog.h"
#include "HktAssetSubsystem.h"
#include "HktCoreEventLog.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/World.h"

namespace
{
	constexpr int32 kNumCpdSlots = 16;
	// CPD 레이아웃: 0=AtlasIndex, 1=CellW, 2=CellH, 3=reserved,
	// 4~5=Pivot(world), 6=Rot(rad), 7~8=Scale(halfWidth/Height world),
	// 9~12=Tint RGBA, 13=Palette, 14=FlipX, 15=ZBias
}

UHktSpriteCrowdRenderer::UHktSpriteCrowdRenderer()
{
	PrimaryComponentTick.bCanEverTick = false;
	bAutoActivate = true;
}

// ============================================================================
// Register / Unregister / SetCharacter
// ============================================================================

void UHktSpriteCrowdRenderer::RegisterEntity(FHktEntityId Id)
{
	if (Id < 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: RegisterEntity rejected invalid id=%d"), Id));
		return;
	}
	FEntityState& State = Entities.FindOrAdd(Id);
	State.bActive = true;
	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		TEXT("Sprite|CrowdRenderer: RegisterEntity"), Id);
}

void UHktSpriteCrowdRenderer::UnregisterEntity(FHktEntityId Id)
{
	FEntityState* State = Entities.Find(Id);
	if (!State) return;

	if (State->InstanceIndex != INDEX_NONE)
	{
		RemoveInstanceAndRemap(State->CurrentAtlasPath, State->InstanceIndex);
	}
	Entities.Remove(Id);
	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		TEXT("Sprite|CrowdRenderer: UnregisterEntity"), Id);
}

void UHktSpriteCrowdRenderer::SetCharacter(FHktEntityId Id, FGameplayTag CharacterTag)
{
	FEntityState* State = Entities.Find(Id);
	if (!State)
	{
		RegisterEntity(Id);
		State = Entities.Find(Id);
		if (!State) return;
	}

	if (State->CharacterTag == CharacterTag) return;

	const FGameplayTag OldTag = State->CharacterTag;

	// 캐릭터 변경 — 기존 HISM 인스턴스 제거. 실제 HISM 배정은 첫 UpdateEntity에서.
	if (State->InstanceIndex != INDEX_NONE)
	{
		RemoveInstanceAndRemap(State->CurrentAtlasPath, State->InstanceIndex);
	}
	State->CharacterTag     = CharacterTag;
	State->CurrentAtlasPath = FSoftObjectPath();
	State->InstanceIndex    = INDEX_NONE;
	State->LastUpdateStatus = 0;

	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("Sprite|CrowdRenderer: SetCharacter %s → %s"),
			*OldTag.ToString(), *CharacterTag.ToString()),
		Id);

	if (CharacterTag.IsValid() && !TemplateCache.Contains(CharacterTag))
	{
		RequestTemplateLoad(CharacterTag);
	}
}

// ============================================================================
// RemoveInstanceAndRemap — HISM swap-and-pop + 엔터티 InstanceIndex remap
// ============================================================================

void UHktSpriteCrowdRenderer::RemoveInstanceAndRemap(const FSoftObjectPath& AtlasPath, int32 InstanceIndex)
{
	UHierarchicalInstancedStaticMeshComponent** HPtr = AtlasHISMs.Find(AtlasPath);
	if (!HPtr || !*HPtr) return;
	UHierarchicalInstancedStaticMeshComponent* HISM = *HPtr;

	const int32 InstanceCount = HISM->GetInstanceCount();
	if (InstanceCount <= 0) return;
	const int32 LastIdx = InstanceCount - 1;

	if (!HISM->RemoveInstance(InstanceIndex)) return;
	if (InstanceIndex == LastIdx) return;

	for (auto& Pair : Entities)
	{
		FEntityState& ES = Pair.Value;
		if (ES.CurrentAtlasPath == AtlasPath && ES.InstanceIndex == LastIdx)
		{
			ES.InstanceIndex = InstanceIndex;
			return;
		}
	}
}

// ============================================================================
// UpdateEntity — 프레임 갱신 (아틀라스 마이그레이션 포함)
// ============================================================================

void UHktSpriteCrowdRenderer::UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update)
{
	FEntityState* State = Entities.Find(Id);
	if (!State || !State->bActive) return;
	if (!State->CharacterTag.IsValid()) return;

	TObjectPtr<UHktSpriteCharacterTemplate>* Found = TemplateCache.Find(State->CharacterTag);
	UHktSpriteCharacterTemplate* Template = Found ? Found->Get() : nullptr;
	if (!Template)
	{
		// 템플릿 아직 로딩 중 — 전이 시 1회만 경고(PendingTemplateLoads에 없으면 비정상).
		if (State->LastUpdateStatus != 1)
		{
			State->LastUpdateStatus = 1;
			const bool bPending = PendingTemplateLoads.Contains(State->CharacterTag);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation,
				bPending ? EHktLogLevel::Verbose : EHktLogLevel::Warning,
				EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: UpdateEntity — Template 미준비 (tag=%s, pending=%d)"),
					*State->CharacterTag.ToString(), bPending ? 1 : 0),
				Id);
		}
		return;
	}

	ApplyEntityInstanceTransform(Id, Update, Template, *State);
}

void UHktSpriteCrowdRenderer::ClearAll()
{
	Entities.Empty();
	for (auto& [Path, H] : AtlasHISMs)
	{
		if (H) H->ClearInstances();
	}
}

// ============================================================================
// 아틀라스 해석
// ============================================================================

UTexture2D* UHktSpriteCrowdRenderer::ResolveAtlas(const FHktSpriteAnimation& Anim,
	UHktSpriteCharacterTemplate* Template, FSoftObjectPath& OutPath, FVector2f& OutCellSize)
{
	const TSoftObjectPtr<UTexture2D>& Ref = Anim.Atlas.IsNull() ? Template->Atlas : Anim.Atlas;
	if (Ref.IsNull()) return nullptr;

	OutPath = Ref.ToSoftObjectPath();
	OutCellSize = (Anim.AtlasCellSize.X > 0.f && Anim.AtlasCellSize.Y > 0.f)
		? Anim.AtlasCellSize
		: Template->AtlasCellSize;

	UTexture2D* Tex = Ref.LoadSynchronous();
	if (!Tex) return nullptr;

	// RHI 리소스가 실제로 초기화될 때까지 대기. HISM 생성 시점에 머티리얼 텍스처
	// 파라미터를 한 번 굳히기 때문에, 여기서 RHI 미준비 상태로 진행하면 렌더 스레드가
	// 초기화되지 않은 FRHITexture 핸들을 잡고 D3D12 RHISetShaderParameters에서 크래시.
	const FTextureResource* Resource = Tex->GetResource();
	if (!Resource || !Resource->TextureRHI.IsValid())
	{
		return nullptr;
	}

	return Tex;
}

// ============================================================================
// HISM Get-or-Create (atlas 단위)
// ============================================================================

UHierarchicalInstancedStaticMeshComponent* UHktSpriteCrowdRenderer::GetOrCreateHISM(
	const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex)
{
	if (UHierarchicalInstancedStaticMeshComponent** Existing = AtlasHISMs.Find(AtlasPath))
	{
		return *Existing;
	}
	if (!QuadMesh || !AtlasTex)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: GetOrCreateHISM 실패 — QuadMesh=%s, AtlasTex=%s (atlas=%s)"),
				QuadMesh ? TEXT("ok") : TEXT("null"),
				AtlasTex ? TEXT("ok") : TEXT("null"),
				*AtlasPath.ToString()));
		return nullptr;
	}

	AActor* Owner = GetOwner();
	if (!Owner)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			TEXT("Sprite|CrowdRenderer: GetOrCreateHISM 실패 — Owner 없음"));
		return nullptr;
	}

	const FString Name = FString::Printf(TEXT("HktSpriteHISM_%s"),
		*AtlasPath.GetAssetName().Replace(TEXT("."), TEXT("_")));

	UHierarchicalInstancedStaticMeshComponent* HISM = NewObject<UHierarchicalInstancedStaticMeshComponent>(
		Owner, UHierarchicalInstancedStaticMeshComponent::StaticClass(), *Name, RF_Transient);
	if (!HISM) return nullptr;

	HISM->SetStaticMesh(QuadMesh);
	HISM->NumCustomDataFloats = kNumCpdSlots;

	UMaterialInterface* BaseMat = SpriteMaterialTemplate
		? static_cast<UMaterialInterface*>(SpriteMaterialTemplate)
		: HktSpriteBillboardMaterial::GetDefault();
	if (BaseMat)
	{
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(BaseMat, HISM);
		if (MID)
		{
			MID->SetTextureParameterValue(HktSpriteBillboardMaterial::AtlasParamName, AtlasTex);
			MID->SetVectorParameterValue(
				HktSpriteBillboardMaterial::AtlasSizeParamName,
				FLinearColor(static_cast<float>(AtlasTex->GetSizeX()),
							 static_cast<float>(AtlasTex->GetSizeY()),
							 0.f, 0.f));
			HISM->SetMaterial(0, MID);
		}
	}

	HISM->SetupAttachment(Owner->GetRootComponent());
	HISM->SetMobility(EComponentMobility::Movable);
	HISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HISM->SetCastShadow(false);
	HISM->RegisterComponent();

	AtlasHISMs.Add(AtlasPath, HISM);
	AllHISMs.Add(HISM);
	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("Sprite|CrowdRenderer: HISM 신규 생성 (atlas=%s, %dx%d px)"),
			*AtlasPath.ToString(), AtlasTex->GetSizeX(), AtlasTex->GetSizeY()));
	return HISM;
}

// ============================================================================
// 비동기 템플릿 로드
// ============================================================================

void UHktSpriteCrowdRenderer::RequestTemplateLoad(FGameplayTag Tag)
{
	if (!Tag.IsValid()) return;
	if (PendingTemplateLoads.Contains(Tag)) return;
	if (TemplateCache.Contains(Tag)) return;

	UWorld* World = GetWorld();
	UHktAssetSubsystem* AssetSub = World ? UHktAssetSubsystem::Get(World) : nullptr;
	if (!AssetSub)
	{
		UE_LOG(LogHktSpriteCore, Warning, TEXT("RequestTemplateLoad: UHktAssetSubsystem unavailable (tag=%s)"),
			*Tag.ToString());
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: RequestTemplateLoad 실패 — AssetSubsystem 없음 (tag=%s)"),
				*Tag.ToString()));
		return;
	}

	PendingTemplateLoads.Add(Tag);

	TWeakObjectPtr<UHktSpriteCrowdRenderer> WeakThis(this);
	AssetSub->LoadAssetAsync(Tag, [WeakThis, Tag](UHktTagDataAsset* Loaded)
	{
		UHktSpriteCrowdRenderer* Self = WeakThis.Get();
		if (!Self) return;

		Self->PendingTemplateLoads.Remove(Tag);

		UHktSpriteCharacterTemplate* Template = Cast<UHktSpriteCharacterTemplate>(Loaded);
		if (!Template)
		{
			UE_LOG(LogHktSpriteCore, Warning, TEXT("CharacterTemplate 로드 실패 또는 타입 불일치 tag=%s"), *Tag.ToString());
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: CharacterTemplate 로드 실패/타입 불일치 (tag=%s, loaded=%s)"),
					*Tag.ToString(), Loaded ? *Loaded->GetName() : TEXT("null")));
			return;
		}
		Self->TemplateCache.Add(Tag, Template);
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: CharacterTemplate 로드 완료 (tag=%s)"), *Tag.ToString()));
	});
}

// ============================================================================
// CPD + 트랜스폼 적용 (+ 아틀라스 migrate)
// ============================================================================

void UHktSpriteCrowdRenderer::ApplyEntityInstanceTransform(FHktEntityId Id,
	const FHktSpriteEntityUpdate& Update, UHktSpriteCharacterTemplate* Template, FEntityState& State)
{
	if (!Template) return;

	const FHktSpriteAnimation* Animation = Template->FindAnimationOrFallback(Update.AnimTag);
	if (!Animation)
	{
		if (State.LastUpdateStatus != 2)
		{
			State.LastUpdateStatus = 2;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: Animation 못 찾음 — CharacterTemplate(%s)에 AnimTag(%s) 미등록 (fallback 실패)"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}

	// --- 1. 아틀라스 해석 + HISM 결정 (필요 시 migrate) ---
	FSoftObjectPath AtlasPath;
	FVector2f CellSize = FVector2f::ZeroVector;
	UTexture2D* AtlasTex = ResolveAtlas(*Animation, Template, AtlasPath, CellSize);
	if (!AtlasTex)
	{
		if (State.LastUpdateStatus != 3)
		{
			State.LastUpdateStatus = 3;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: Atlas 텍스처 로드 실패 (char=%s, anim=%s) — Animation.Atlas/Template.Atlas 모두 비어있거나 LoadSynchronous 실패"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}
	if (CellSize.X <= 0.f || CellSize.Y <= 0.f)
	{
		if (State.LastUpdateStatus != 4)
		{
			State.LastUpdateStatus = 4;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: AtlasCellSize 유효하지 않음 (%.1f x %.1f) char=%s anim=%s"),
					CellSize.X, CellSize.Y, *State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}

	if (State.CurrentAtlasPath != AtlasPath)
	{
		const FSoftObjectPath OldPath = State.CurrentAtlasPath;
		if (State.InstanceIndex != INDEX_NONE)
		{
			RemoveInstanceAndRemap(State.CurrentAtlasPath, State.InstanceIndex);
			State.InstanceIndex = INDEX_NONE;
		}
		UHierarchicalInstancedStaticMeshComponent* NewHISM = GetOrCreateHISM(AtlasPath, AtlasTex);
		if (!NewHISM)
		{
			if (State.LastUpdateStatus != 5)
			{
				State.LastUpdateStatus = 5;
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
					FString::Printf(TEXT("Sprite|CrowdRenderer: HISM 생성 실패 (atlas=%s) — QuadMesh/Owner 누락 의심"),
						*AtlasPath.ToString()),
					Id);
			}
			return;
		}
		State.InstanceIndex    = NewHISM->AddInstance(FTransform::Identity, /*bWorldSpace=*/true);
		State.CurrentAtlasPath = AtlasPath;

		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: Atlas migrate %s → %s (inst=%d, anim=%s)"),
				*OldPath.ToString(), *AtlasPath.ToString(), State.InstanceIndex, *Update.AnimTag.ToString()),
			Id);
	}

	if (State.InstanceIndex == INDEX_NONE) return;

	UHierarchicalInstancedStaticMeshComponent** HPtr = AtlasHISMs.Find(State.CurrentAtlasPath);
	if (!HPtr || !*HPtr) return;
	UHierarchicalInstancedStaticMeshComponent* HISM = *HPtr;

	// --- 2. 프레임 해석 ---
	FHktSpriteFrameResolveInput In;
	In.Animation      = Animation;
	In.AnimStartTick  = Update.AnimStartTick;
	In.NowTick        = Update.NowTick;
	In.TickDurationMs = Update.TickDurationMs;
	In.Facing         = Update.Facing;
	In.PlayRate       = Update.PlayRate;

	const FHktSpriteFrameResolveResult Res = HktResolveSpriteFrame(In);
	if (Res.bInvalid)
	{
		if (State.LastUpdateStatus != 7)
		{
			State.LastUpdateStatus = 7;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: FrameResolver 실패 (char=%s, anim=%s, StartTick=%lld, NowTick=%lld) — 애니 정의/타이밍 확인"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString(), Update.AnimStartTick, Update.NowTick),
				Id, Update.AnimTag);
		}
		return;
	}

	const int32 DirIdx = static_cast<int32>(Res.StoredFacing);
	if (DirIdx < 0 || DirIdx >= Animation->NumDirections)
	{
		if (State.LastUpdateStatus != 6)
		{
			State.LastUpdateStatus = 6;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: StoredFacing=%d 범위 초과 (NumDirections=%d, anim=%s)"),
					DirIdx, Animation->NumDirections, *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}
	const int32 NumFrames = Animation->GetNumFrames(DirIdx);
	if (Res.FrameIndex < 0 || Res.FrameIndex >= NumFrames)
	{
		if (State.LastUpdateStatus != 7)
		{
			State.LastUpdateStatus = 7;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: FrameIndex=%d 범위 초과 (NumFrames=%d, dir=%d, anim=%s)"),
					Res.FrameIndex, NumFrames, DirIdx, *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}

	// 정상 경로 — 이전 실패 상태 클리어
	State.LastUpdateStatus = 0;

	const FHktSpriteFrame Frame = Animation->MakeFrame(DirIdx, Res.FrameIndex);

	const FVector2f Pivot = Frame.PivotOffset.IsNearlyZero()
		? Animation->PivotOffset
		: Frame.PivotOffset;

	// --- 3. 트랜스폼 + CPD ---
	FTransform WorldXform = FTransform::Identity;
	WorldXform.SetLocation(Update.WorldLocation);
	HISM->UpdateInstanceTransform(State.InstanceIndex, WorldXform, /*bWorldSpace=*/true,
		/*bMarkRenderStateDirty=*/false, /*bTeleport=*/true);

	const float AtlasIndexF = static_cast<float>(Frame.AtlasIndex);
	const float CellW = CellSize.X;
	const float CellH = CellSize.Y;
	const float PxToWorld = Template->PixelToWorld * GlobalWorldScale;
	const FVector2f Offset = Pivot * PxToWorld;

	const FLinearColor Tint = Frame.Tint * Update.TintOverride;
	const float FlipValue = Res.bFlipX ? 1.f : 0.f;

	HISM->SetCustomDataValue(State.InstanceIndex, 0, AtlasIndexF, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 1, CellW, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 2, CellH, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 3, 0.f, false);

	HISM->SetCustomDataValue(State.InstanceIndex, 4, Offset.X, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 5, Offset.Y, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 6, FMath::DegreesToRadians(Frame.Rotation), false);
	HISM->SetCustomDataValue(State.InstanceIndex, 7, Frame.Scale.X * PxToWorld * CellW * 0.5f, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 8, Frame.Scale.Y * PxToWorld * CellH * 0.5f, false);

	HISM->SetCustomDataValue(State.InstanceIndex, 9,  Tint.R, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 10, Tint.G, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 11, Tint.B, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 12, Tint.A, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 13, static_cast<float>(Update.PaletteIndex), false);
	HISM->SetCustomDataValue(State.InstanceIndex, 14, FlipValue, false);
	HISM->SetCustomDataValue(State.InstanceIndex, 15, static_cast<float>(Frame.ZBias), true);
}
