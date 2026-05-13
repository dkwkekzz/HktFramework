// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteNiagaraCrowdRenderer.h"

#include "HktAssetSubsystem.h"
#include "HktCoreEventLog.h"
#include "HktSpriteCharacterTemplate.h"
#include "HktSpriteCoreLog.h"
#include "HktSpriteFrameResolver.h"

#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "TextureResource.h"
#include "UObject/ConstructorHelpers.h"

#include "NiagaraComponent.h"
#include "NiagaraDataInterfaceArrayFunctionLibrary.h"
#include "NiagaraSystem.h"

namespace
{
	// NDI Array / User Param 이름 — NS_HktSpriteAtlasCrowd 템플릿과 정확히 일치해야 함.
	// (설계 문서 §3.4 / §5.5 참조 — 자산 작성 후 PR-2 PIE 검증에서 확정)
	const FName NP_Positions   = FName(TEXT("User.Positions"));
	const FName NP_Colors      = FName(TEXT("User.Colors"));
	const FName NP_DynParam0   = FName(TEXT("User.DynParam0"));
	const FName NP_DynParam1   = FName(TEXT("User.DynParam1"));
	const FName NP_Scales      = FName(TEXT("User.Scales"));
	const FName NP_Atlas       = FName(TEXT("User.Atlas"));
	const FName NP_AtlasSizePx = FName(TEXT("User.AtlasSizePx"));
	const FName NP_WorldScale  = FName(TEXT("User.WorldScale"));
	const FName NP_ZBias       = FName(TEXT("User.ComponentZBias"));
	const FName NP_OverrideMat = FName(TEXT("User.OverrideMaterial"));

	// 옵션 A — 사전 빌드된 NS 자산 경로 (HktSpriteGenerator 가 빌드/커밋).
	const TCHAR* kDefaultNiagaraSystemPath =
		TEXT("/HktGameplay/Niagara/NS_HktSpriteAtlasCrowd.NS_HktSpriteAtlasCrowd");
	const TCHAR* kDefaultMaterialPath =
		TEXT("/HktGameplay/Materials/M_HktSpriteAtlasUVOnly.M_HktSpriteAtlasUVOnly");
}

UHktSpriteNiagaraCrowdRenderer::UHktSpriteNiagaraCrowdRenderer()
{
	// NDI Array 푸시는 매 프레임 한 번 — Tick 활성화.
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PostUpdateWork;
	bAutoActivate = true;
}

// ============================================================================
// Asset resolve helpers
// ============================================================================

UNiagaraSystem* UHktSpriteNiagaraCrowdRenderer::ResolveNiagaraSystem() const
{
	if (UNiagaraSystem* NS = NiagaraSystemTemplate.LoadSynchronous())
	{
		return NS;
	}
	return LoadObject<UNiagaraSystem>(nullptr, kDefaultNiagaraSystemPath);
}

UMaterialInterface* UHktSpriteNiagaraCrowdRenderer::ResolveBaseMaterial() const
{
	if (SpriteMaterialTemplate)
	{
		return SpriteMaterialTemplate;
	}
	return LoadObject<UMaterialInterface>(nullptr, kDefaultMaterialPath);
}

// ============================================================================
// Register / Unregister / SetCharacter / ClearAll
// ============================================================================

void UHktSpriteNiagaraCrowdRenderer::RegisterEntity(FHktEntityId Id)
{
	if (Id < 0)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|NiagaraCrowd: RegisterEntity rejected invalid id=%d"), Id));
		return;
	}
	FEntityState& State = Entities.FindOrAdd(Id);
	State.bActive = true;
	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		TEXT("Sprite|NiagaraCrowd: RegisterEntity"), Id);
}

void UHktSpriteNiagaraCrowdRenderer::UnregisterEntity(FHktEntityId Id)
{
	FEntityState* State = Entities.Find(Id);
	if (!State) return;

	if (State->ParticleIndex != INDEX_NONE)
	{
		RemoveParticleAndRemap(State->CurrentAtlasPath, State->ParticleIndex);
	}
	Entities.Remove(Id);
	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		TEXT("Sprite|NiagaraCrowd: UnregisterEntity"), Id);
}

void UHktSpriteNiagaraCrowdRenderer::SetCharacter(FHktEntityId Id, FGameplayTag CharacterTag)
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

	if (State->ParticleIndex != INDEX_NONE)
	{
		RemoveParticleAndRemap(State->CurrentAtlasPath, State->ParticleIndex);
	}
	State->CharacterTag     = CharacterTag;
	State->CurrentAtlasPath = FSoftObjectPath();
	State->ParticleIndex    = INDEX_NONE;
	State->LastUpdateStatus = EHktSpriteUpdateStatus::OK;

	HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("Sprite|NiagaraCrowd: SetCharacter %s → %s"),
			*OldTag.ToString(), *CharacterTag.ToString()),
		Id);

	if (CharacterTag.IsValid() && !TemplateCache.Contains(CharacterTag))
	{
		RequestTemplateLoad(CharacterTag);
	}
}

void UHktSpriteNiagaraCrowdRenderer::ClearAll()
{
	Entities.Empty();
	for (auto& Pair : Atlases)
	{
		FAtlasContext& Ctx = Pair.Value;
		Ctx.Arrays.Positions.Reset();
		Ctx.Arrays.Colors.Reset();
		Ctx.Arrays.DynParam0.Reset();
		Ctx.Arrays.DynParam1.Reset();
		Ctx.Arrays.Scales.Reset();
		Ctx.Arrays.bDirty = true;
	}
	PushDirtyArraysToNiagara();
}

// ============================================================================
// swap-and-pop 풀 제거
// ============================================================================

void UHktSpriteNiagaraCrowdRenderer::RemoveParticleAndRemap(const FSoftObjectPath& AtlasPath, int32 ParticleIndex)
{
	FAtlasContext* Ctx = Atlases.Find(AtlasPath);
	if (!Ctx) return;

	FAtlasParticleArrays& A = Ctx->Arrays;
	const int32 Count = A.Positions.Num();
	if (ParticleIndex < 0 || ParticleIndex >= Count) return;

	const int32 LastIdx = Count - 1;
	if (ParticleIndex != LastIdx)
	{
		A.Positions[ParticleIndex] = A.Positions[LastIdx];
		A.Colors[ParticleIndex]    = A.Colors[LastIdx];
		A.DynParam0[ParticleIndex] = A.DynParam0[LastIdx];
		A.DynParam1[ParticleIndex] = A.DynParam1[LastIdx];
		A.Scales[ParticleIndex]    = A.Scales[LastIdx];

		// 마지막 인스턴스를 가지고 있던 엔터티의 ParticleIndex remap.
		for (auto& Pair : Entities)
		{
			FEntityState& ES = Pair.Value;
			if (ES.CurrentAtlasPath == AtlasPath && ES.ParticleIndex == LastIdx)
			{
				ES.ParticleIndex = ParticleIndex;
				break;
			}
		}
	}

	A.Positions.Pop(EAllowShrinking::No);
	A.Colors.Pop(EAllowShrinking::No);
	A.DynParam0.Pop(EAllowShrinking::No);
	A.DynParam1.Pop(EAllowShrinking::No);
	A.Scales.Pop(EAllowShrinking::No);
	A.bDirty = true;
}

// ============================================================================
// Atlas context get-or-create — 1 atlas = 1 UNiagaraComponent
// ============================================================================

UHktSpriteNiagaraCrowdRenderer::FAtlasContext* UHktSpriteNiagaraCrowdRenderer::GetOrCreateAtlasContext(
	const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex)
{
	if (FAtlasContext* Existing = Atlases.Find(AtlasPath))
	{
		return Existing;
	}
	if (!AtlasTex)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|NiagaraCrowd: GetOrCreateAtlasContext 실패 — AtlasTex=null (atlas=%s)"),
				*AtlasPath.ToString()));
		return nullptr;
	}

	AActor* Owner = GetOwner();
	if (!Owner)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			TEXT("Sprite|NiagaraCrowd: GetOrCreateAtlasContext 실패 — Owner 없음"));
		return nullptr;
	}

	UNiagaraSystem* NS = ResolveNiagaraSystem();
	if (!NS)
	{
		// PR-1 단계: 자산 미작성 시 침묵하지 말고 1회 경고. PR-2에서 Generator가 빌드해 채운다.
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|NiagaraCrowd: NiagaraSystemTemplate 미설정 — 기본 경로 %s 도 로드 실패"),
				kDefaultNiagaraSystemPath));
		return nullptr;
	}

	const FString CompName = FString::Printf(TEXT("HktSpriteNC_%s"),
		*AtlasPath.GetAssetName().Replace(TEXT("."), TEXT("_")));
	UNiagaraComponent* NC = NewObject<UNiagaraComponent>(Owner, UNiagaraComponent::StaticClass(), *CompName, RF_Transient);
	if (!NC) return nullptr;

	NC->SetAsset(NS);
	NC->SetAutoActivate(true);
	NC->SetupAttachment(Owner->GetRootComponent());
	NC->SetMobility(EComponentMobility::Movable);
	NC->RegisterComponent();

	FAtlasContext NewCtx;
	NewCtx.NiagaraComp = NC;
	NewCtx.AtlasTex    = AtlasTex;

	if (UMaterialInterface* BaseMat = ResolveBaseMaterial())
	{
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(BaseMat, NC);
		if (MID)
		{
			MID->SetTextureParameterValue(FName(TEXT("Atlas")), AtlasTex);
			MID->SetVectorParameterValue(FName(TEXT("AtlasSize")),
				FLinearColor(static_cast<float>(AtlasTex->GetSizeX()),
							 static_cast<float>(AtlasTex->GetSizeY()), 0.f, 0.f));
			NewCtx.MID = MID;

			// NS 템플릿이 Mesh Renderer Material을 User.OverrideMaterial 파라미터에 바인딩한다고 가정.
			NC->SetVariableMaterial(NP_OverrideMat, MID);
		}
	}

	// User Param 입력 — 컴포넌트 단위 상수.
	NC->SetVariableVec2(NP_AtlasSizePx,
		FVector2D(static_cast<double>(AtlasTex->GetSizeX()), static_cast<double>(AtlasTex->GetSizeY())));
	NC->SetVariableFloat(NP_WorldScale, GlobalWorldScale);
	NC->SetVariableFloat(NP_ZBias, ComponentZBias);

	// HISM 경로의 HISMPrimePending 과 동일 — 다음 프레임에 텍스처 재바인딩 + Activate.
	NewCtx.bPrimePending = true;
	NewCtx.PrimeRegisteredFrame = GFrameCounter;

	NC->Activate(true);

	FAtlasContext& Inserted = Atlases.Add(AtlasPath, MoveTemp(NewCtx));

	HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
		FString::Printf(TEXT("Sprite|NiagaraCrowd: NiagaraComponent 신규 생성 (atlas=%s, %dx%d px)"),
			*AtlasPath.ToString(), AtlasTex->GetSizeX(), AtlasTex->GetSizeY()));

	return &Inserted;
}

// ============================================================================
// 비동기 템플릿 로드 — HISM 버전과 동일
// ============================================================================

void UHktSpriteNiagaraCrowdRenderer::RequestTemplateLoad(FGameplayTag Tag)
{
	if (!Tag.IsValid()) return;
	if (PendingTemplateLoads.Contains(Tag)) return;
	if (TemplateCache.Contains(Tag)) return;

	UWorld* World = GetWorld();
	UHktAssetSubsystem* AssetSub = World ? UHktAssetSubsystem::Get(World) : nullptr;
	if (!AssetSub)
	{
		HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|NiagaraCrowd: RequestTemplateLoad 실패 — AssetSubsystem 없음 (tag=%s)"),
				*Tag.ToString()));
		return;
	}

	PendingTemplateLoads.Add(Tag);

	TWeakObjectPtr<UHktSpriteNiagaraCrowdRenderer> WeakThis(this);
	AssetSub->LoadAssetAsync(Tag, [WeakThis, Tag](UHktTagDataAsset* Loaded)
	{
		UHktSpriteNiagaraCrowdRenderer* Self = WeakThis.Get();
		if (!Self) return;

		Self->PendingTemplateLoads.Remove(Tag);

		UHktSpriteCharacterTemplate* Template = Cast<UHktSpriteCharacterTemplate>(Loaded);
		if (!Template)
		{
			HKT_EVENT_LOG(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|NiagaraCrowd: CharacterTemplate 로드 실패/타입 불일치 (tag=%s)"),
					*Tag.ToString()));
			return;
		}
		Self->TemplateCache.Add(Tag, Template);
	});
}

// ============================================================================
// UpdateEntity — 프레임 갱신 (ApplyEntityParticleData 위임)
// ============================================================================

void UHktSpriteNiagaraCrowdRenderer::UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update)
{
	FEntityState* State = Entities.Find(Id);
	if (!State || !State->bActive) return;
	if (!State->CharacterTag.IsValid())
	{
		if (State->LastUpdateStatus != EHktSpriteUpdateStatus::CharacterTagInvalid)
		{
			State->LastUpdateStatus = EHktSpriteUpdateStatus::CharacterTagInvalid;
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				TEXT("Sprite|NiagaraCrowd: UpdateEntity — CharacterTag 미지정"), Id);
		}
		return;
	}

	TObjectPtr<UHktSpriteCharacterTemplate>* Found = TemplateCache.Find(State->CharacterTag);
	UHktSpriteCharacterTemplate* Template = Found ? Found->Get() : nullptr;
	if (!Template)
	{
		if (State->LastUpdateStatus != EHktSpriteUpdateStatus::TemplateMissing)
		{
			State->LastUpdateStatus = EHktSpriteUpdateStatus::TemplateMissing;
			const bool bPending = PendingTemplateLoads.Contains(State->CharacterTag);
			HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation,
				bPending ? EHktLogLevel::Verbose : EHktLogLevel::Warning,
				EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|NiagaraCrowd: Template 미준비 (tag=%s, pending=%d)"),
					*State->CharacterTag.ToString(), bPending ? 1 : 0),
				Id);
		}
		return;
	}

	ApplyEntityParticleData(Id, Update, Template, *State);
}

// ============================================================================
// ApplyEntityParticleData — Frame 해석 + 검증 + 풀 슬롯 갱신/마이그레이션
// HISM 경로 ApplyEntityInstanceTransform 를 SoA NDI 풀 형태로 옮긴 것.
// ============================================================================

void UHktSpriteNiagaraCrowdRenderer::ApplyEntityParticleData(FHktEntityId Id,
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
				FString::Printf(TEXT("Sprite|NiagaraCrowd: Animation 못 찾음 (char=%s, anim=%s)"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString()),
				Id, Update.AnimTag);
		}
		return;
	}

	// --- 1. Frame 해석 (Atlas 보다 먼저) ---
	// AtlasSlots(분할) 도입으로 atlas 는 프레임 단위로 결정된다.
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
				TEXT("Sprite|NiagaraCrowd: FrameResolver 실패"), Id, Update.AnimTag);
		}
		return;
	}

	const int32 DirIdx = static_cast<int32>(Res.StoredFacing);
	if (DirIdx < 0 || DirIdx >= Animation->NumDirections) return;
	const int32 NumFrames = Animation->GetNumFrames(DirIdx);
	if (Res.FrameIndex < 0 || Res.FrameIndex >= NumFrames) return;

	// --- 2. Atlas 해석 (dirIdx == AtlasSlotIdx 규약) ---
	TSoftObjectPtr<UTexture2D> AtlasRef;
	FVector2f CellSize = FVector2f::ZeroVector;
	Animation->ResolveAtlasForDirection(DirIdx, AtlasRef, CellSize);
	if (AtlasRef.IsNull()) AtlasRef = Template->Atlas;
	if (CellSize.X <= 0.f || CellSize.Y <= 0.f) CellSize = Template->AtlasCellSize;

	if (AtlasRef.IsNull())
	{
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::AtlasNull)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::AtlasNull;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|NiagaraCrowd: Atlas 비어있음 (char=%s, anim=%s, dir=%d)"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString(), DirIdx),
				Id, Update.AnimTag);
		}
		return;
	}
	const FSoftObjectPath AtlasPath = AtlasRef.ToSoftObjectPath();
	UTexture2D* AtlasTex = AtlasRef.LoadSynchronous();
	const FTextureResource* TexRes = AtlasTex ? AtlasTex->GetResource() : nullptr;
	if (!AtlasTex || !TexRes || !TexRes->TextureRHI.IsValid())
	{
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::AtlasNull)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::AtlasNull;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				FString::Printf(TEXT("Sprite|NiagaraCrowd: Atlas 텍스처 RHI 미준비 (char=%s, anim=%s, dir=%d)"),
					*State.CharacterTag.ToString(), *Update.AnimTag.ToString(), DirIdx),
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
				FString::Printf(TEXT("Sprite|NiagaraCrowd: AtlasCellSize 유효하지 않음 (%.1f x %.1f, dir=%d)"),
					CellSize.X, CellSize.Y, DirIdx),
				Id, Update.AnimTag);
		}
		return;
	}

	const FVector2f Scale = Animation->Scale;
	const float PxToWorld = Template->PixelToWorld * GlobalWorldScale;
	if (Scale.X <= 0.f || Scale.Y <= 0.f || PxToWorld <= 0.f)
	{
		if (State.LastUpdateStatus != EHktSpriteUpdateStatus::ZeroQuadSize)
		{
			State.LastUpdateStatus = EHktSpriteUpdateStatus::ZeroQuadSize;
			HKT_EVENT_LOG_TAG(HktLogTags::Presentation, EHktLogLevel::Warning, EHktLogSource::Client,
				TEXT("Sprite|NiagaraCrowd: 쿼드 크기 0"), Id, Update.AnimTag);
		}
		return;
	}

	// --- 3. SoA 슬롯에 기록할 값 미리 계산 ---
	// 그리드 규약: AtlasIndex=frameIdx. 그 외 속성은 Animation 공통값.
	const float AtlasIndexF = static_cast<float>(Res.FrameIndex);
	const float CellW = CellSize.X;
	const float CellH = CellSize.Y;
	const float FlipValue = Res.bFlipX ? 1.f : 0.f;
	const float HalfWWorld = Scale.X * PxToWorld * CellW * 0.5f;
	const float HalfHWorld = Scale.Y * PxToWorld * CellH * 0.5f;
	const float CombinedZBias = Update.ZBias + ComponentZBias;
	const FLinearColor Tint = Animation->Tint * Update.TintOverride;

	// MeshScale = (W, 1, H) — Niagara MeshRenderer가 quad mesh를 W×H로 스트레치.
	// NOTE(PR-2): HISM 경로의 PivotOffset(셀 좌상단 기준 픽셀)을 Niagara에서는 머티리얼 WPO로
	// 처리하지 않으므로, quad mesh가 하단-중앙 피벗이라는 가정에 의존한다. 비표준 pivot을
	// 가진 애니가 들어오면 Position 에 (CellW/2-Pivot.X, CellH-Pivot.Y) 만큼 보정해야 함 —
	// PR-2 시각 검증 단계에서 baseline drift 관측되면 추가.
	const FVector MeshScale(HalfWWorld * 2.f, 1.f, HalfHWorld * 2.f);
	const FVector4 DynParam0(AtlasIndexF, CellW, CellH, FlipValue);
	const FVector4 DynParam1(CombinedZBias, static_cast<float>(Update.PaletteIndex), 0.f, 0.f);

	// --- 4. Atlas 마이그레이션 ---
	if (State.CurrentAtlasPath != AtlasPath)
	{
		const FSoftObjectPath OldPath = State.CurrentAtlasPath;
		if (State.ParticleIndex != INDEX_NONE)
		{
			RemoveParticleAndRemap(State.CurrentAtlasPath, State.ParticleIndex);
			State.ParticleIndex = INDEX_NONE;
		}
		FAtlasContext* NewCtx = GetOrCreateAtlasContext(AtlasPath, AtlasTex);
		if (!NewCtx)
		{
			if (State.LastUpdateStatus != EHktSpriteUpdateStatus::HISMCreateFailed)
			{
				State.LastUpdateStatus = EHktSpriteUpdateStatus::HISMCreateFailed;
				HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Error, EHktLogSource::Client,
					FString::Printf(TEXT("Sprite|NiagaraCrowd: AtlasContext 생성 실패 (atlas=%s)"),
						*AtlasPath.ToString()),
					Id);
			}
			return;
		}

		FAtlasParticleArrays& A = NewCtx->Arrays;
		State.ParticleIndex = A.Positions.Add(Update.WorldLocation);
		A.Colors.Add(Tint);
		A.DynParam0.Add(DynParam0);
		A.DynParam1.Add(DynParam1);
		A.Scales.Add(MeshScale);
		A.bDirty = true;
		State.CurrentAtlasPath = AtlasPath;

		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|NiagaraCrowd: Atlas migrate %s → %s (idx=%d)"),
				*OldPath.ToString(), *AtlasPath.ToString(), State.ParticleIndex),
			Id);
	}
	else
	{
		// 일반 경로 — 기존 슬롯 갱신.
		FAtlasContext* Ctx = Atlases.Find(AtlasPath);
		if (!Ctx || State.ParticleIndex == INDEX_NONE) return;

		FAtlasParticleArrays& A = Ctx->Arrays;
		if (!A.Positions.IsValidIndex(State.ParticleIndex)) return;

		A.Positions[State.ParticleIndex] = Update.WorldLocation;
		A.Colors[State.ParticleIndex]    = Tint;
		A.DynParam0[State.ParticleIndex] = DynParam0;
		A.DynParam1[State.ParticleIndex] = DynParam1;
		A.Scales[State.ParticleIndex]    = MeshScale;
		A.bDirty = true;
	}

	// 정상 경로 — 이전 실패 상태 복구 로그.
	const EHktSpriteUpdateStatus PrevStatus = State.LastUpdateStatus;
	State.LastUpdateStatus = EHktSpriteUpdateStatus::OK;
	if (PrevStatus != EHktSpriteUpdateStatus::OK)
	{
		HKT_EVENT_LOG_ENTITY(HktLogTags::Presentation, EHktLogLevel::Info, EHktLogSource::Client,
			FString::Printf(TEXT("Sprite|NiagaraCrowd: 렌더 정상화 (prev=%s, anim=%s)"),
				*StaticEnum<EHktSpriteUpdateStatus>()->GetNameStringByValue(static_cast<int64>(PrevStatus)),
				*Update.AnimTag.ToString()),
			Id);
	}
}

// ============================================================================
// Tick — dirty atlas 마다 NDI Array 푸시
// ============================================================================

void UHktSpriteNiagaraCrowdRenderer::TickComponent(float DeltaTime, ELevelTick TickType,
	FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
	PushDirtyArraysToNiagara();
}

void UHktSpriteNiagaraCrowdRenderer::PushDirtyArraysToNiagara()
{
	for (auto& Pair : Atlases)
	{
		FAtlasContext& Ctx = Pair.Value;
		UNiagaraComponent* NC = Ctx.NiagaraComp.Get();
		if (!NC) continue;

		// HISM 경로의 1-frame prime 과 동일 — 등록 다음 프레임에 텍스처 재바인딩 + Activate.
		if (Ctx.bPrimePending && GFrameCounter > Ctx.PrimeRegisteredFrame)
		{
			if (UTexture2D* Tex = Ctx.AtlasTex.Get())
			{
				if (UMaterialInstanceDynamic* MID = Ctx.MID.Get())
				{
					MID->SetTextureParameterValue(FName(TEXT("Atlas")), Tex);
					MID->SetVectorParameterValue(FName(TEXT("AtlasSize")),
						FLinearColor(static_cast<float>(Tex->GetSizeX()),
									 static_cast<float>(Tex->GetSizeY()), 0.f, 0.f));
					NC->SetVariableMaterial(NP_OverrideMat, MID);
				}
			}
			Ctx.bPrimePending = false;
		}

		if (!Ctx.Arrays.bDirty) continue;

		UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector (NC, NP_Positions, Ctx.Arrays.Positions);
		UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayColor  (NC, NP_Colors,    Ctx.Arrays.Colors);
		UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector4(NC, NP_DynParam0, Ctx.Arrays.DynParam0);
		UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector4(NC, NP_DynParam1, Ctx.Arrays.DynParam1);
		UNiagaraDataInterfaceArrayFunctionLibrary::SetNiagaraArrayVector (NC, NP_Scales,    Ctx.Arrays.Scales);
		Ctx.Arrays.bDirty = false;
	}
}
