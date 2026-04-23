// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteCrowdRenderer.h"
#include "HktSpritePartTemplate.h"
#include "HktSpriteFrameResolver.h"
#include "HktSpriteBillboardMaterial.h"
#include "HktSpriteCoreLog.h"
#include "HktAssetSubsystem.h"
#include "Components/HierarchicalInstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Texture2D.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/World.h"

// ============================================================================
// 상수
// ============================================================================

namespace
{
	constexpr int32 kNumCpdSlots = 16;

	// CPD 슬롯 레이아웃 (HktSpriteBillboardMaterial.cpp의 HLSL과 동기):
	//  0    AtlasIndex (cell 그리드 내 프레임 번호)
	//  1    CellW (아틀라스 셀 픽셀 너비)
	//  2    CellH (아틀라스 셀 픽셀 높이)
	//  3    reserved
	//  4~5  Pivot Offset (world cm)
	//  6    Rotation (rad, 빌보드 평면 내)
	//  7~8  Scale (half-width, half-height in world cm)
	//  9~12 Tint RGBA
	//  13   Palette Index (현재 미사용)
	//  14   Flip X (0=normal, 1=horizontal flip)
	//  15   ZBias (cm toward camera)
}

// ============================================================================
// UHktSpriteCrowdRenderer
// ============================================================================

UHktSpriteCrowdRenderer::UHktSpriteCrowdRenderer()
{
	PrimaryComponentTick.bCanEverTick = false;
	bAutoActivate = true;
}

void UHktSpriteCrowdRenderer::RegisterEntity(FHktEntityId Id)
{
	if (Id < 0) return;
	FEntityState& State = Entities.FindOrAdd(Id);
	State.bActive = true;
}

void UHktSpriteCrowdRenderer::UnregisterEntity(FHktEntityId Id)
{
	FEntityState* State = Entities.Find(Id);
	if (!State) return;

	for (int32 SlotIdx = 0; SlotIdx < (int32)EHktSpritePartSlot::MAX; ++SlotIdx)
	{
		FSlotInstance& Inst = State->Slots[SlotIdx];
		if (Inst.InstanceIndex != INDEX_NONE)
		{
			RemoveInstanceAndRemap(Inst.Key, Inst.InstanceIndex);
		}
		Inst = FSlotInstance{};
	}
	State->bActive = false;
	Entities.Remove(Id);
}

// ----------------------------------------------------------------------------
// RemoveInstanceAndRemap — HISM의 swap-and-pop 제거 후 InstanceIndex remap
//
// UInstancedStaticMeshComponent::RemoveInstance는 내부적으로 마지막 인스턴스를
// 제거 대상 슬롯에 swap → 배열을 pop한다. 즉 "마지막 인스턴스를 참조하던 FSlotInstance"의
// InstanceIndex가 제거된 슬롯 번호로 바뀌어야 한다.
// ----------------------------------------------------------------------------
void UHktSpriteCrowdRenderer::RemoveInstanceAndRemap(const FSpritePartKey& Key, int32 InstanceIndex)
{
	UHierarchicalInstancedStaticMeshComponent** HPtr = PartHISMs.Find(Key);
	if (!HPtr || !*HPtr) return;
	UHierarchicalInstancedStaticMeshComponent* HISM = *HPtr;

	const int32 InstanceCount = HISM->GetInstanceCount();
	if (InstanceCount <= 0) return;
	const int32 LastIdx = InstanceCount - 1;

	if (!HISM->RemoveInstance(InstanceIndex)) return;

	// 제거가 마지막 인덱스였으면 remap 불필요.
	if (InstanceIndex == LastIdx) return;

	// 마지막 인덱스를 참조하던 슬롯을 제거된 인덱스로 갱신.
	for (auto& Pair : Entities)
	{
		FEntityState& ES = Pair.Value;
		for (int32 i = 0; i < (int32)EHktSpritePartSlot::MAX; ++i)
		{
			FSlotInstance& I = ES.Slots[i];
			if (I.Key == Key && I.InstanceIndex == LastIdx)
			{
				I.InstanceIndex = InstanceIndex;
				// 같은 (Key, LastIdx)는 하나만 존재하므로 조기 탈출 가능.
				return;
			}
		}
	}
}

// ----------------------------------------------------------------------------
// Helper: HISM을 GC 루팅 TArray와 룩업 TMap에 동시 등록/해제
// ----------------------------------------------------------------------------

void UHktSpriteCrowdRenderer::SetLoadout(FHktEntityId Id, const FHktSpriteLoadout& Loadout)
{
	FEntityState* State = Entities.Find(Id);
	if (!State)
	{
		RegisterEntity(Id);
		State = Entities.Find(Id);
		if (!State) return;
	}

	// 슬롯별로 변경 여부 확인 후 교체
	for (int32 SlotIdx = 0; SlotIdx < (int32)EHktSpritePartSlot::MAX; ++SlotIdx)
	{
		const EHktSpritePartSlot Slot = static_cast<EHktSpritePartSlot>(SlotIdx);
		const FGameplayTag NewTag = Loadout.GetSlotTag(Slot);
		const FGameplayTag OldTag = State->Loadout.GetSlotTag(Slot);

		if (NewTag == OldTag && State->Slots[SlotIdx].InstanceIndex != INDEX_NONE)
		{
			continue;
		}

		// 기존 슬롯 제거
		ClearPartSlot(Id, Slot);

		// 새 파츠 스폰 (로드 대기 가능)
		if (NewTag.IsValid())
		{
			AssignPartSlot(Id, Slot, NewTag);
		}
	}
	State->Loadout = Loadout;
}

void UHktSpriteCrowdRenderer::UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update)
{
	FEntityState* State = Entities.Find(Id);
	if (!State || !State->bActive) return;

	// 비동기 로드 완료 대기 슬롯 해소
	ResolvePendingSlots();

	for (int32 SlotIdx = 0; SlotIdx < (int32)EHktSpritePartSlot::MAX; ++SlotIdx)
	{
		FSlotInstance& Inst = State->Slots[SlotIdx];
		if (Inst.InstanceIndex == INDEX_NONE) continue;
		if (!Inst.PartTag.IsValid()) continue;

		UHktSpritePartTemplate* Template = nullptr;
		if (TObjectPtr<UHktSpritePartTemplate>* Found = TemplateCache.Find(Inst.PartTag))
		{
			Template = Found->Get();
		}
		if (!Template) continue;

		ApplySlotInstanceTransform(Id, static_cast<EHktSpritePartSlot>(SlotIdx), Update, Template, Inst);
	}
}

void UHktSpriteCrowdRenderer::ClearAll()
{
	Entities.Empty();

	for (auto& [Key, H] : PartHISMs)
	{
		if (H)
		{
			H->ClearInstances();
		}
	}
	// AllHISMs는 컴포넌트 수명 동안 유지 (재사용). 명시적 파괴가 필요하면 별도 함수.
}

// ============================================================================
// 파츠 슬롯 관리
// ============================================================================

void UHktSpriteCrowdRenderer::AssignPartSlot(FHktEntityId Id, EHktSpritePartSlot Slot, FGameplayTag PartTag)
{
	FEntityState* State = Entities.Find(Id);
	if (!State) return;

	FSlotInstance& Inst = State->Slots[(int32)Slot];
	Inst.PartTag = PartTag;
	Inst.Key = FSpritePartKey{Slot, PartTag};

	TObjectPtr<UHktSpritePartTemplate>* Cached = TemplateCache.Find(PartTag);
	UHktSpritePartTemplate* Template = Cached ? Cached->Get() : nullptr;

	if (!Template)
	{
		// 비동기 로드 요청하고 대기
		Inst.bPending = true;
		Inst.InstanceIndex = INDEX_NONE;
		RequestTemplateLoad(PartTag);
		return;
	}

	UHierarchicalInstancedStaticMeshComponent* HISM = GetOrCreateHISM(Inst.Key, Template);
	if (!HISM)
	{
		UE_LOG(LogHktSpriteCore, Warning, TEXT("AssignPartSlot: HISM 생성 실패 Slot=%d Tag=%s"),
			static_cast<int32>(Slot), *PartTag.ToString());
		return;
	}

	// 기본 Identity 트랜스폼으로 인스턴스 추가 — 실제 값은 UpdateEntity에서 덮어씀
	const int32 NewIdx = HISM->AddInstance(FTransform::Identity, /*bWorldSpace=*/true);
	Inst.InstanceIndex = NewIdx;
	Inst.bPending = false;
}

void UHktSpriteCrowdRenderer::ClearPartSlot(FHktEntityId Id, EHktSpritePartSlot Slot)
{
	FEntityState* State = Entities.Find(Id);
	if (!State) return;

	FSlotInstance& Inst = State->Slots[(int32)Slot];
	if (Inst.InstanceIndex != INDEX_NONE)
	{
		RemoveInstanceAndRemap(Inst.Key, Inst.InstanceIndex);
	}
	Inst = FSlotInstance{};
}

UHierarchicalInstancedStaticMeshComponent* UHktSpriteCrowdRenderer::GetOrCreateHISM(const FSpritePartKey& Key, UHktSpritePartTemplate* Template)
{
	if (UHierarchicalInstancedStaticMeshComponent** Existing = PartHISMs.Find(Key))
	{
		return *Existing;
	}
	if (!QuadMesh || !Template) return nullptr;

	AActor* Owner = GetOwner();
	if (!Owner) return nullptr;

	const FString Name = FString::Printf(TEXT("HktSpriteHISM_%d_%s"),
		static_cast<int32>(Key.Slot),
		*Key.PartTag.ToString().Replace(TEXT("."), TEXT("_")));

	UHierarchicalInstancedStaticMeshComponent* HISM = NewObject<UHierarchicalInstancedStaticMeshComponent>(
		Owner, UHierarchicalInstancedStaticMeshComponent::StaticClass(), *Name, RF_Transient);
	if (!HISM) return nullptr;

	HISM->SetStaticMesh(QuadMesh);
	HISM->NumCustomDataFloats = kNumCpdSlots;

	// 머티리얼 바인딩:
	//   1) SpriteMaterialTemplate이 지정돼 있으면 이를 베이스로 MID 생성
	//   2) 미지정이면 HktSpriteBillboardMaterial의 디폴트 Y-axis 빌보드 머티리얼로 폴백
	// 각 HISM마다 고유 아틀라스(텍스처)를 바인딩해야 하므로 반드시 MID 사용.
	UMaterialInterface* BaseMat = SpriteMaterialTemplate
		? static_cast<UMaterialInterface*>(SpriteMaterialTemplate)
		: HktSpriteBillboardMaterial::GetDefault();
	if (BaseMat)
	{
		UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(BaseMat, HISM);
		if (MID)
		{
			// 아틀라스 텍스처 바인딩 — TSoftObjectPtr는 Template이 이미 로드된 시점이므로
			// LoadSynchronous가 두 번째 hop(텍스처 에셋)만 동기 로드.
			UTexture2D* AtlasTex = Template->Atlas.LoadSynchronous();
			if (AtlasTex)
			{
				MID->SetTextureParameterValue(HktSpriteBillboardMaterial::AtlasParamName, AtlasTex);
				MID->SetVectorParameterValue(
					HktSpriteBillboardMaterial::AtlasSizeParamName,
					FLinearColor(static_cast<float>(AtlasTex->GetSizeX()),
								 static_cast<float>(AtlasTex->GetSizeY()),
								 0.f, 0.f));
			}
			HISM->SetMaterial(0, MID);
		}
	}

	HISM->SetupAttachment(Owner->GetRootComponent());
	HISM->SetMobility(EComponentMobility::Movable);
	HISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	HISM->SetCastShadow(false);
	HISM->RegisterComponent();

	PartHISMs.Add(Key, HISM);
	AllHISMs.Add(HISM);  // GC 루팅
	return HISM;
}

// ============================================================================
// 비동기 로드
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
		return;
	}

	PendingTemplateLoads.Add(Tag);

	TWeakObjectPtr<UHktSpriteCrowdRenderer> WeakThis(this);
	AssetSub->LoadAssetAsync(Tag, [WeakThis, Tag](UHktTagDataAsset* Loaded)
	{
		UHktSpriteCrowdRenderer* Self = WeakThis.Get();
		if (!Self) return;

		Self->PendingTemplateLoads.Remove(Tag);

		UHktSpritePartTemplate* Template = Cast<UHktSpritePartTemplate>(Loaded);
		if (!Template)
		{
			UE_LOG(LogHktSpriteCore, Warning, TEXT("PartTemplate 로드 실패 또는 타입 불일치 tag=%s"), *Tag.ToString());
			return;
		}

		Self->TemplateCache.Add(Tag, Template);
	});
}

void UHktSpriteCrowdRenderer::ResolvePendingSlots()
{
	for (auto& [Id, State] : Entities)
	{
		for (int32 SlotIdx = 0; SlotIdx < (int32)EHktSpritePartSlot::MAX; ++SlotIdx)
		{
			FSlotInstance& Inst = State.Slots[SlotIdx];
			if (!Inst.bPending) continue;
			if (!Inst.PartTag.IsValid()) { Inst.bPending = false; continue; }

			TObjectPtr<UHktSpritePartTemplate>* Found = TemplateCache.Find(Inst.PartTag);
			if (!Found || !Found->Get()) continue;

			UHierarchicalInstancedStaticMeshComponent* HISM = GetOrCreateHISM(Inst.Key, Found->Get());
			if (!HISM) continue;

			Inst.InstanceIndex = HISM->AddInstance(FTransform::Identity, /*bWorldSpace=*/true);
			Inst.bPending = false;
		}
	}
}

// ============================================================================
// CPD + 트랜스폼 적용
// ============================================================================

FVector2f UHktSpriteCrowdRenderer::ResolveChildAnchor(EHktSpritePartSlot Slot, const FHktSpriteFrame& BodyFrame)
{
	static const FName NameHead       = "HeadAnchor";
	static const FName NameWeapon     = "WeaponHandAnchor";
	static const FName NameShield     = "ShieldHandAnchor";
	static const FName NameHeadTop    = "HeadgearTopAnchor";
	static const FName NameHeadMid    = "HeadgearMidAnchor";
	static const FName NameHeadLow    = "HeadgearLowAnchor";

	FName Key;
	switch (Slot)
	{
		case EHktSpritePartSlot::Head:        Key = NameHead;    break;
		case EHktSpritePartSlot::Weapon:      Key = NameWeapon;  break;
		case EHktSpritePartSlot::Shield:      Key = NameShield;  break;
		case EHktSpritePartSlot::HeadgearTop: Key = NameHeadTop; break;
		case EHktSpritePartSlot::HeadgearMid: Key = NameHeadMid; break;
		case EHktSpritePartSlot::HeadgearLow: Key = NameHeadLow; break;
		default: return FVector2f::ZeroVector;
	}
	if (const FVector2f* V = BodyFrame.ChildAnchors.Find(Key))
	{
		return *V;
	}
	return FVector2f::ZeroVector;
}

int32 UHktSpriteCrowdRenderer::GetSlotZBiasDefault(EHktSpritePartSlot Slot)
{
	// Body=0이 기준. Head=+1, Weapon/Shield=+2, Headgear=+3 순으로 앞에 그린다.
	switch (Slot)
	{
		case EHktSpritePartSlot::Body:        return 0;
		case EHktSpritePartSlot::Head:        return 1;
		case EHktSpritePartSlot::Weapon:      return 2;
		case EHktSpritePartSlot::Shield:      return 2;
		case EHktSpritePartSlot::HeadgearLow: return 3;
		case EHktSpritePartSlot::HeadgearMid: return 4;
		case EHktSpritePartSlot::HeadgearTop: return 5;
		default: return 0;
	}
}

void UHktSpriteCrowdRenderer::ApplySlotInstanceTransform(FHktEntityId Id, EHktSpritePartSlot Slot,
	const FHktSpriteEntityUpdate& Update, UHktSpritePartTemplate* Template, FSlotInstance& Inst)
{
	if (!Template) return;

	const FHktSpriteAction* Action = Template->FindAction(Update.ActionId);
	if (!Action)
	{
		// idle 폴백
		static const FName NameIdle = "idle";
		Action = Template->FindAction(NameIdle);
	}
	if (!Action) return;

	FHktSpriteFrameResolveInput In;
	In.Action = Action;
	In.AnimStartTick = Update.AnimStartTick;
	In.NowTick = Update.NowTick;
	In.TickDurationMs = Update.TickDurationMs;
	In.Facing = Update.Facing;
	In.PlayRate = Update.PlayRate;

	const FHktSpriteFrameResolveResult Res = HktResolveSpriteFrame(In);
	if (Res.bInvalid) return;

	const int32 DirIdx = static_cast<int32>(Res.StoredFacing);
	if (DirIdx < 0 || DirIdx >= Action->NumDirections) return;
	const int32 NumFrames = Action->GetNumFrames(DirIdx);
	if (Res.FrameIndex < 0 || Res.FrameIndex >= NumFrames) return;
	const FHktSpriteFrame Frame = Action->MakeFrame(DirIdx, Res.FrameIndex);

	// --- 앵커 오프셋 ---
	//   Body 외 파츠는 Entity의 Body 현재 프레임에서 Slot.ChildAnchors를 찾아 부모 pivot을 건다.
	//   Body 파츠는 entity root에 바로 붙는다. 이 함수 내에서 Body 프레임을 따로 재해결하지 않고,
	//   호출자(프로세서)가 Body 먼저 처리하는 순서를 강제하는 방식을 택해도 된다.
	//   MVP에서는 간단히 AnchorOffset을 0으로 두고, Body 파츠 자신의 PivotOffset만 적용.
	FVector2f AnchorOffset = FVector2f::ZeroVector;
	if (Slot != EHktSpritePartSlot::Body)
	{
		// Body 파츠의 동일 프레임에서 이 슬롯 앵커를 찾는다 — 단순화 전략:
		// 엔터티의 BodyPartTag → Template → 동일 ActionId → 같은 FrameIndex.
		const FEntityState* State = Entities.Find(Id);
		if (State && State->Loadout.BodyPart.IsValid())
		{
			if (TObjectPtr<UHktSpritePartTemplate>* BodyTmpl = TemplateCache.Find(State->Loadout.BodyPart))
			{
				if (UHktSpritePartTemplate* BT = BodyTmpl->Get())
				{
					if (const FHktSpriteAction* BodyAction = BT->FindAction(Update.ActionId))
					{
						const int32 BodyNumFrames = BodyAction->GetNumFrames(DirIdx);
						if (DirIdx >= 0 && DirIdx < BodyAction->NumDirections && BodyNumFrames > 0)
						{
							const int32 BodyIdx = FMath::Clamp(Res.FrameIndex, 0, BodyNumFrames - 1);
							const FHktSpriteFrame BodyFrame = BodyAction->MakeFrame(DirIdx, BodyIdx);
							AnchorOffset = ResolveChildAnchor(Slot, BodyFrame);
						}
					}
				}
			}
		}
	}

	// --- 월드 트랜스폼 ---
	// Identity. 빌보드 방향은 머티리얼의 World Position Offset에서 처리.
	FTransform WorldXform = FTransform::Identity;
	WorldXform.SetLocation(Update.WorldLocation);

	if (UHierarchicalInstancedStaticMeshComponent** HPtr = PartHISMs.Find(Inst.Key))
	{
		UHierarchicalInstancedStaticMeshComponent* HISM = *HPtr;
		if (!HISM) return;

		HISM->UpdateInstanceTransform(Inst.InstanceIndex, WorldXform, /*bWorldSpace=*/true,
			/*bMarkRenderStateDirty=*/false, /*bTeleport=*/true);

		// --- CPD ---
		const FVector2f AtlasCell = Template->AtlasCellSize;
		// UV Rect 계산: 아틀라스 가로 셀 수는 Atlas->Resource 없이는 정확히 알기 어렵다.
		// MVP에선 AtlasIndex를 선형 U 오프셋으로 가정하고, 실제 Atlas 크기는 머티리얼 파라미터/CPD에서 외부 주입 가능.
		// 여기서는 AtlasIndex를 그대로 floats로 인코딩해 머티리얼이 ColumnCount로 분할하도록 위임.
		const float AtlasIndexF = static_cast<float>(Frame.AtlasIndex);
		const float CellW = AtlasCell.X;
		const float CellH = AtlasCell.Y;

		const float PxToWorld = Template->PixelToWorld * GlobalWorldScale;

		const FVector2f Offset = (AnchorOffset + Frame.PivotOffset) * PxToWorld;

		const FLinearColor Tint = Frame.Tint * Update.TintOverride;
		const float FlipValue = Res.bFlipX ? 1.f : 0.f;
		const int32 ZBias = GetSlotZBiasDefault(Slot) + Frame.ZBias;

		HISM->SetCustomDataValue(Inst.InstanceIndex, 0, AtlasIndexF, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 1, CellW, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 2, CellH, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 3, 0.f, false);          // reserved

		HISM->SetCustomDataValue(Inst.InstanceIndex, 4, Offset.X, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 5, Offset.Y, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 6, FMath::DegreesToRadians(Frame.Rotation), false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 7, Frame.Scale.X * PxToWorld * CellW * 0.5f, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 8, Frame.Scale.Y * PxToWorld * CellH * 0.5f, false);

		HISM->SetCustomDataValue(Inst.InstanceIndex, 9,  Tint.R, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 10, Tint.G, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 11, Tint.B, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 12, Tint.A, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 13, static_cast<float>(Update.PaletteIndex), false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 14, FlipValue, false);
		HISM->SetCustomDataValue(Inst.InstanceIndex, 15, static_cast<float>(ZBias), true); // 마지막만 mark dirty
	}
}
