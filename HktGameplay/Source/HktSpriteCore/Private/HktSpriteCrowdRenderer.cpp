// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdRenderer.h"
#include "HktSpriteCharacterTemplate.h"
#include "HktSpriteFrameResolver.h"
#include "HktSpriteBillboardMaterial.h"
#include "HktSpriteCoreLog.h"
#include "HktAssetSubsystem.h"
#include "HktCoreEventLog.h"
#include "Components/InstancedStaticMeshComponent.h"
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
	State->LastUpdateStatus = EHktSpriteUpdateStatus::OK;

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
	UInstancedStaticMeshComponent** HPtr = AtlasHISMs.Find(AtlasPath);
	if (!HPtr || !*HPtr) return;
	UInstancedStaticMeshComponent* HISM = *HPtr;

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
		if (State->LastUpdateStatus != EHktSpriteUpdateStatus::CharacterTagInvalid)
		{
			State->LastUpdateStatus = EHktSpriteUpdateStatus::CharacterTagInvalid;
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
		if (State->LastUpdateStatus != EHktSpriteUpdateStatus::TemplateMissing)
		{
			State->LastUpdateStatus = EHktSpriteUpdateStatus::TemplateMissing;
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

UInstancedStaticMeshComponent* UHktSpriteCrowdRenderer::GetOrCreateHISM(
	const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex)
{
	if (UInstancedStaticMeshComponent** Existing = AtlasHISMs.Find(AtlasPath))
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

	UInstancedStaticMeshComponent* HISM = NewObject<UInstancedStaticMeshComponent>(
		Owner, UInstancedStaticMeshComponent::StaticClass(), *Name, RF_Transient);
	if (!HISM) return nullptr;

	HISM->SetStaticMesh(QuadMesh);
	HISM->NumCustomDataFloats = kNumCpdSlots;

	// 동적 크라우드(매 프레임 트랜스폼 갱신) 전용 — 컴포넌트 bounds 가 인스턴스 이동을
	// 따라가지 못하면 frustum 컬링되어 통째로 사라진다. 큰 BoundsScale 로 안전 마진 확보.
	// (HISM 의 cluster tree 컬링 이슈를 회피하기 위해 ISM 사용.)
	HISM->BoundsScale = 1000.f;

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
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::AnimationNull)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::AnimationNull;
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
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::AtlasNull)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::AtlasNull;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: Atlas 텍스처 로드 실패 (char=%s, anim=%s) — Animation.Atlas/Template.Atlas 모두 비어있거나 LoadSynchronous 실패"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}
	if (CellSize.X <= 0.f || CellSize.Y <= 0.f)
	{
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::InvalidCellSize)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::InvalidCellSize;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: AtlasCellSize 유효하지 않음 (%.1f x %.1f) char=%s anim=%s"),
					CellSize.X, CellSize.Y, *State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}

	// --- 2. 프레임 해석 (마이그레이션 보다 먼저) ---
	// 첫 PIE 시 "atlas 통째 / 벌집" 증상의 근본 원인:
	//   기존 흐름이 AddInstance(Identity) → 검증 → UpdateInstanceTransform/CPD 순서였기 때문에,
	//   검증 실패로 early-return 되거나 첫 렌더 프레임이 CPD/transform 채우기 전에 잡히면
	//   GPU 가 (Identity 위치, CPD 미설정) 인스턴스를 그렸다. CPD 가 미바인딩이면 텍스처 샘플러가
	//   Custom UV 대신 InTexCoord(0..1) 를 사용해 quad 마다 atlas 통째로 출력 → 다수 인스턴스가
	//   벌집처럼 보였다. 두 번째 PIE 부터는 PSO/CPD 캐시가 채워져 정상화.
	// 해결: 모든 검증을 마이그레이션 이전에 수행 + AddInstance 시점에 실제 WorldXform 와
	//       16 슬롯 CPD 를 한 번에 채운다 (markDirty=true 한 번 묶음).
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
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::InvalidFrame)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::InvalidFrame;
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
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::InvalidDir)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::InvalidDir;
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
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::InvalidFrame)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::InvalidFrame;
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
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::ZeroQuadSize)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::ZeroQuadSize;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: 쿼드 크기 0 — Frame.Scale=(%.3f, %.3f), PxToWorld=%.3f (PixelToWorld=%.3f, GlobalScale=%.3f), Cell=(%.1f, %.1f) [char=%s, anim=%s, dir=%d, frame=%d]"),
					Frame.Scale.X, Frame.Scale.Y, PxToWorld, Template->PixelToWorld, GlobalWorldScale,
					CellSize.X, CellSize.Y,
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString(), DirIdx, Res.FrameIndex),
				Id, Update.AnimTag);
		}
		return;
	}

	// --- 3. 트랜스폼 + CPD 값 미리 계산 (마이그레이션/일반 경로 공용) ---
	FTransform WorldXform = FTransform::Identity;
	WorldXform.SetLocation(Update.WorldLocation);

	const FVector2f Pivot = Frame.PivotOffset.IsNearlyZero()
		? Animation->PivotOffset
		: Frame.PivotOffset;

	const float AtlasIndexF = static_cast<float>(Frame.AtlasIndex);
	const float CellW = CellSize.X;
	const float CellH = CellSize.Y;
	// PivotOffset 은 셀 좌상단 기준 픽셀 좌표(예: (CellW/2, CellH) = 하단-중앙).
	// 셰이더 Quad 는 이미 하단-중앙이 (0,0) 이도록 구성되어 있으므로,
	// 셀 중심/하단을 기준점으로 변환한 뒤 PxToWorld 와 Frame.Scale 을 곱해야
	// pivot 픽셀이 정확히 entity 위치(WorldLocation)에 놓인다.
	const FVector2f Offset(
		(CellW * 0.5f - Pivot.X) * PxToWorld * Frame.Scale.X,
		(CellH        - Pivot.Y) * PxToWorld * Frame.Scale.Y);
	const FLinearColor Tint = Frame.Tint * Update.TintOverride;
	const float FlipValue = Res.bFlipX ? 1.f : 0.f;
	const float HalfWWorld = Frame.Scale.X * PxToWorld * CellW * 0.5f;
	const float HalfHWorld = Frame.Scale.Y * PxToWorld * CellH * 0.5f;
	const float RotRad     = FMath::DegreesToRadians(Frame.Rotation);
	// CPD slot 15 = ZBias (cm, 카메라 쪽으로 밀어내기). 3 source 합산:
	//   Frame.ZBias        — 애니메이션 정의 (캐릭터 내 프레임 간 z-fighting 해소)
	//   Update.ZBias       — 호출자 인스턴스 단위 (특정 엔터티만 미세 조정)
	//   ComponentZBias     — 컴포넌트 단위 일괄 (Crowd ↔ Terrain 등 그룹 정렬)
	const float CombinedZBias = static_cast<float>(Frame.ZBias) + Update.ZBias + ComponentZBias;

	auto FillCpd = [&](UInstancedStaticMeshComponent* Target, int32 Idx)
	{
		Target->SetCustomDataValue(Idx, 0, AtlasIndexF, false);
		Target->SetCustomDataValue(Idx, 1, CellW, false);
		Target->SetCustomDataValue(Idx, 2, CellH, false);
		Target->SetCustomDataValue(Idx, 3, 0.f, false);
		Target->SetCustomDataValue(Idx, 4, Offset.X, false);
		Target->SetCustomDataValue(Idx, 5, Offset.Y, false);
		Target->SetCustomDataValue(Idx, 6, RotRad, false);
		Target->SetCustomDataValue(Idx, 7, HalfWWorld, false);
		Target->SetCustomDataValue(Idx, 8, HalfHWorld, false);
		Target->SetCustomDataValue(Idx, 9,  Tint.R, false);
		Target->SetCustomDataValue(Idx, 10, Tint.G, false);
		Target->SetCustomDataValue(Idx, 11, Tint.B, false);
		Target->SetCustomDataValue(Idx, 12, Tint.A, false);
		Target->SetCustomDataValue(Idx, 13, static_cast<float>(Update.PaletteIndex), false);
		Target->SetCustomDataValue(Idx, 14, FlipValue, false);
		Target->SetCustomDataValue(Idx, 15, CombinedZBias, /*bMarkRenderStateDirty=*/true);
	};

	// --- 4. 아틀라스 마이그레이션 (검증/CPD 계산이 모두 끝난 뒤) ---
	if (State.CurrentAtlasPath != AtlasPath)
	{
		const FSoftObjectPath OldPath = State.CurrentAtlasPath;
		if (State.InstanceIndex != INDEX_NONE)
		{
			RemoveInstanceAndRemap(State.CurrentAtlasPath, State.InstanceIndex);
			State.InstanceIndex = INDEX_NONE;
		}
		UInstancedStaticMeshComponent* NewHISM = GetOrCreateHISM(AtlasPath, AtlasTex);
		if (!NewHISM)
		{
			if (State.LastUpdateStatus != EHktSpriteUpdateStatus::HISMCreateFailed)
			{
				State.LastUpdateStatus = EHktSpriteUpdateStatus::HISMCreateFailed;
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
					FString::Printf(TEXT("Sprite|CrowdRenderer: HISM 생성 실패 (atlas=%s) — QuadMesh/Owner 누락 의심"),
						*AtlasPath.ToString()),
					Id);
			}
			return;
		}
		// 실제 WorldXform 으로 AddInstance — Identity 중간 상태 제거.
		// 첫 GPU 업로드 시점에 트랜스폼/CPD 가 모두 유효해 atlas-honeycomb 회피.
		State.InstanceIndex    = NewHISM->AddInstance(WorldXform, /*bWorldSpace=*/true);
		State.CurrentAtlasPath = AtlasPath;

		if (State.InstanceIndex == INDEX_NONE)
		{
			// AddInstance가 INDEX_NONE을 반환 — HISM 내부 자원 부족/엔진 이슈로 매우 드물지만
			// 다음 프레임부터 마이그레이션 가드(CurrentAtlasPath==AtlasPath)로 조용히 스킵되므로
			// 반드시 한 번은 EventLog에 남긴다.
			if (State.LastUpdateStatus != EHktSpriteUpdateStatus::AddInstanceFailed)
			{
				State.LastUpdateStatus = EHktSpriteUpdateStatus::AddInstanceFailed;
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
					FString::Printf(TEXT("Sprite|CrowdRenderer: HISM AddInstance 실패 (atlas=%s, anim=%s) — 인스턴스 미생성"),
						*AtlasPath.ToString(), *Update.AnimTag.ToString()),
					Id);
			}
			return;
		}

		// 신규 인스턴스 — 16 슬롯 CPD 를 한 번에 채운다 (마지막에 markDirty=true).
		// AddInstance 와 같은 호출 안에서 끝내, 다음 렌더 프레임에 미완성 인스턴스가 노출되지 않도록.
		FillCpd(NewHISM, State.InstanceIndex);

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

	UInstancedStaticMeshComponent** HPtr = AtlasHISMs.Find(State.CurrentAtlasPath);
	if (!HPtr || !*HPtr)
	{
		// AtlasHISMs 룩업이 프레임 중간에 사라진 케이스 — RemoveInstanceAndRemap 등에서 외부 변경 가능성.
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::HISMLookupLost)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::HISMLookupLost;
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|CrowdRenderer: HISM 룩업 손실 (atlas=%s) — AtlasHISMs 맵에서 제거됨"),
					*State.CurrentAtlasPath.ToString()),
				Id);
		}
		return;
	}
	UInstancedStaticMeshComponent* HISM = *HPtr;

	// 정상 경로 — 이전 실패 상태 클리어 + 복구 로그(전이 시 1회).
	// 비대칭 로깅(실패만 emit)을 제거해 EventLog에서 "정상화 시점"을 직접 추적할 수 있게 한다.
	const EHktSpriteUpdateStatus PrevStatus = State.LastUpdateStatus;
	State.LastUpdateStatus = EHktSpriteUpdateStatus::OK;
	if (PrevStatus != EHktSpriteUpdateStatus::OK)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|CrowdRenderer: 렌더 정상화 (prev=%s, anim=%s, dir=%d, frame=%d, atlasIdx=%d, cell=(%.1f,%.1f), atlasPx=(%d,%d), numDir=%d, FPD=%d, atlas=%s)"),
				*StaticEnum<EHktSpriteUpdateStatus>()->GetNameStringByValue(static_cast<int64>(PrevStatus)),
				*Update.AnimTag.ToString(), DirIdx, Res.FrameIndex,
				Frame.AtlasIndex, CellSize.X, CellSize.Y,
				AtlasTex->GetSizeX(), AtlasTex->GetSizeY(),
				Animation->NumDirections, Animation->FramesPerDirection,
				*State.CurrentAtlasPath.ToString()),
			Id);
	}

	// --- 5. 매 프레임 트랜스폼 + CPD 갱신 (일반 경로) ---
	// UE5.7 ISM: bMarkRenderStateDirty=false 시 트랜스폼 업데이트가 별도 cmd buffer로
	// 큐잉되어 CPD 의 MarkRenderStateDirty 와 같이 flush되지 않는 케이스가 있다.
	// 인스턴스가 매 프레임 이동하므로 여기서 직접 dirty 를 마크해 GPU 업로드 보장.
	HISM->UpdateInstanceTransform(State.InstanceIndex, WorldXform, /*bWorldSpace=*/true,
		/*bMarkRenderStateDirty=*/true, /*bTeleport=*/true);
	FillCpd(HISM, State.InstanceIndex);
}
