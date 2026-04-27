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

const TCHAR* UHktSpriteCrowdRenderer::StatusToString(EUpdateStatus S)
{
	switch (S)
	{
		case EUpdateStatus::OK:                  return TEXT("OK");
		case EUpdateStatus::TemplateMissing:     return TEXT("TemplateMissing");
		case EUpdateStatus::AnimationNull:       return TEXT("AnimationNull");
		case EUpdateStatus::AtlasNull:           return TEXT("AtlasNull");
		case EUpdateStatus::InvalidCellSize:     return TEXT("InvalidCellSize");
		case EUpdateStatus::HISMCreateFailed:    return TEXT("HISMCreateFailed");
		case EUpdateStatus::InvalidDir:          return TEXT("InvalidDir");
		case EUpdateStatus::InvalidFrame:        return TEXT("InvalidFrame");
		case EUpdateStatus::CharacterTagInvalid: return TEXT("CharacterTagInvalid");
		case EUpdateStatus::AddInstanceFailed:   return TEXT("AddInstanceFailed");
		case EUpdateStatus::HISMLookupLost:      return TEXT("HISMLookupLost");
		case EUpdateStatus::ZeroQuadSize:        return TEXT("ZeroQuadSize");
	}
	return TEXT("Unknown");
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
	State->LastUpdateStatus = EUpdateStatus::OK;

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
	if (!State->CharacterTag.IsValid())
	{
		// CrowdHost.Sync의 SetCharacter가 누락되었거나 SV.Character가 invalid인 케이스 —
		// 이전 프레임까진 정상이었더라도 이 시점부터 그려지지 않으므로 반드시 로그.
		if (State->LastUpdateStatus != EUpdateStatus::CharacterTagInvalid)
		{
			State->LastUpdateStatus = EUpdateStatus::CharacterTagInvalid;
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				TEXT("Sprite|CrowdRenderer: UpdateEntity — CharacterTag 미지정 (Sync에서 SetCharacter 누락 또는 SV.Character invalid)"),
				Id);
		}
		return;
	}

	TObjectPtr<UHktSpriteCharacterTemplate>* Found = TemplateCache.Find(State->CharacterTag);
	UHktSpriteCharacterTemplate* Template = Found ? Found->Get() : nullptr;
	if (!Template)
	{
		// 템플릿 아직 로딩 중 — 전이 시 1회만 경고(PendingTemplateLoads에 없으면 비정상).
		if (State->LastUpdateStatus != EUpdateStatus::TemplateMissing)
		{
			State->LastUpdateStatus = EUpdateStatus::TemplateMissing;
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
		if (State.LastUpdateStatus != EUpdateStatus::AnimationNull)
		{
			State.LastUpdateStatus = EUpdateStatus::AnimationNull;
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
		if (State.LastUpdateStatus != EUpdateStatus::AtlasNull)
		{
			State.LastUpdateStatus = EUpdateStatus::AtlasNull;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: Atlas 텍스처 로드 실패 (char=%s, anim=%s) — Animation.Atlas/Template.Atlas 모두 비어있거나 LoadSynchronous 실패"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}
	if (CellSize.X <= 0.f || CellSize.Y <= 0.f)
	{
		if (State.LastUpdateStatus != EUpdateStatus::InvalidCellSize)
		{
			State.LastUpdateStatus = EUpdateStatus::InvalidCellSize;
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
			if (State.LastUpdateStatus != EUpdateStatus::HISMCreateFailed)
			{
				State.LastUpdateStatus = EUpdateStatus::HISMCreateFailed;
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
					FString::Printf(TEXT("Sprite|CrowdRenderer: HISM 생성 실패 (atlas=%s) — QuadMesh/Owner 누락 의심"),
						*AtlasPath.ToString()),
					Id);
			}
			return;
		}
		State.InstanceIndex    = NewHISM->AddInstance(FTransform::Identity, /*bWorldSpace=*/true);
		State.CurrentAtlasPath = AtlasPath;

		if (State.InstanceIndex == INDEX_NONE)
		{
			// AddInstance가 INDEX_NONE을 반환 — HISM 내부 자원 부족/엔진 이슈로 매우 드물지만
			// 다음 프레임부터 마이그레이션 가드(CurrentAtlasPath==AtlasPath)로 조용히 스킵되므로
			// 반드시 한 번은 EventLog에 남긴다.
			if (State.LastUpdateStatus != EUpdateStatus::AddInstanceFailed)
			{
				State.LastUpdateStatus = EUpdateStatus::AddInstanceFailed;
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
					FString::Printf(TEXT("Sprite|CrowdRenderer: HISM AddInstance 실패 (atlas=%s, anim=%s) — 인스턴스 미생성"),
						*AtlasPath.ToString(), *Update.AnimTag.ToString()),
					Id);
			}
			return;
		}

		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: Atlas migrate %s → %s (inst=%d, anim=%s)"),
				*OldPath.ToString(), *AtlasPath.ToString(), State.InstanceIndex, *Update.AnimTag.ToString()),
			Id);
	}

	if (State.InstanceIndex == INDEX_NONE)
	{
		// 마이그레이션 분기 밖에서 InstanceIndex가 INDEX_NONE — 이전 프레임에 status=9로 진입했다가
		// CurrentAtlasPath만 갱신된 상태. 여기서는 status=9를 유지(중복 로그 방지).
		return;
	}

	UHierarchicalInstancedStaticMeshComponent** HPtr = AtlasHISMs.Find(State.CurrentAtlasPath);
	if (!HPtr || !*HPtr)
	{
		// AtlasHISMs 룩업이 프레임 중간에 사라진 케이스 — RemoveInstanceAndRemap 등에서 외부 변경 가능성.
		if (State.LastUpdateStatus != EUpdateStatus::HISMLookupLost)
		{
			State.LastUpdateStatus = EUpdateStatus::HISMLookupLost;
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: HISM 룩업 손실 (atlas=%s) — AtlasHISMs 맵에서 제거됨"),
					*State.CurrentAtlasPath.ToString()),
				Id);
		}
		return;
	}
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
		if (State.LastUpdateStatus != EUpdateStatus::InvalidFrame)
		{
			State.LastUpdateStatus = EUpdateStatus::InvalidFrame;
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
		if (State.LastUpdateStatus != EUpdateStatus::InvalidDir)
		{
			State.LastUpdateStatus = EUpdateStatus::InvalidDir;
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
		if (State.LastUpdateStatus != EUpdateStatus::InvalidFrame)
		{
			State.LastUpdateStatus = EUpdateStatus::InvalidFrame;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: FrameIndex=%d 범위 초과 (NumFrames=%d, dir=%d, anim=%s)"),
					Res.FrameIndex, NumFrames, DirIdx, *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}

	const FHktSpriteFrame Frame = Animation->MakeFrame(DirIdx, Res.FrameIndex);

	// --- 쿼드 크기 0 가드 ---
	// Frame.Scale은 UPROPERTY 디폴트(1,1)이지만 JSON 로더/Generator가 비워두면 (0,0)으로 들어올 수 있다.
	// PixelToWorld는 ClampMin=0.1, GlobalWorldScale은 ClampMin=0.01이지만 BP 비정상 설정 가능성 방어.
	// HalfW/HalfH가 0이면 머티리얼이 World Position Offset을 0배 → 쿼드 면적 0 → 보이지 않음.
	const float PxToWorld = Template->PixelToWorld * GlobalWorldScale;
	if (Frame.Scale.X <= 0.f || Frame.Scale.Y <= 0.f || PxToWorld <= 0.f)
	{
		if (State.LastUpdateStatus != EUpdateStatus::ZeroQuadSize)
		{
			State.LastUpdateStatus = EUpdateStatus::ZeroQuadSize;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: 쿼드 크기 0 — Frame.Scale=(%.3f, %.3f), PxToWorld=%.3f (PixelToWorld=%.3f, GlobalScale=%.3f), Cell=(%.1f, %.1f) [char=%s, anim=%s, dir=%d, frame=%d]"),
					Frame.Scale.X, Frame.Scale.Y, PxToWorld, Template->PixelToWorld, GlobalWorldScale,
					CellSize.X, CellSize.Y,
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString(), DirIdx, Res.FrameIndex),
				Id, Update.AnimTag);
		}
		return;
	}

	// 정상 경로 — 이전 실패 상태 클리어 + 복구 로그(전이 시 1회).
	// 비대칭 로깅(실패만 emit)을 제거해 EventLog에서 "정상화 시점"을 직접 추적할 수 있게 한다.
	const EUpdateStatus PrevStatus = State.LastUpdateStatus;
	State.LastUpdateStatus = EUpdateStatus::OK;
	if (PrevStatus != EUpdateStatus::OK)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: 렌더 정상화 (prev=%s, anim=%s, dir=%d, frame=%d, atlas=%s)"),
				StatusToString(PrevStatus), *Update.AnimTag.ToString(), DirIdx, Res.FrameIndex, *State.CurrentAtlasPath.ToString()),
			Id);
	}

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
