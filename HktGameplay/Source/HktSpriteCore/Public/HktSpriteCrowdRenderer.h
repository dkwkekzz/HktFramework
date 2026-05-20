// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "UObject/SoftObjectPath.h"
#include "Engine/StreamableManager.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCrowdRenderer.generated.h"

class UInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UTexture2D;
class UHktHISMSpriteVisualAsset;
class UHktTagDataAsset;

/**
 * EHktSpriteUpdateStatus — UpdateEntity의 마지막 결과 코드.
 *
 * 같은 사유로 매 프레임 실패가 반복되므로 *전이* 시점에만 로그를 emit한다.
 * OK로의 전이(=복구)도 1회 Info 로그를 남겨 EventLog만으로 복구 여부를 추적할 수 있게 한다.
 *
 * UENUM으로 두는 이유: 로그 출력 시 `UEnum::GetValueAsString` /
 * `StaticEnum<>()->GetNameStringByValue`로 자동 문자열화하여 별도 헬퍼 불필요.
 */
UENUM()
enum class EHktSpriteUpdateStatus : uint8
{
	OK                  = 0,
	TemplateMissing     = 1,
	AnimationNull       = 2,
	AtlasNull           = 3,
	InvalidCellSize     = 4,
	HISMCreateFailed    = 5,
	InvalidDir          = 6,
	InvalidFrame        = 7,
	CharacterTagInvalid = 8,
	AddInstanceFailed   = 9,
	HISMLookupLost      = 10,
	ZeroQuadSize        = 11,
	WaitingResources    = 12,
};

/**
 * FHktSpriteEntityUpdate — 한 엔터티, 한 프레임의 스프라이트 갱신 입력.
 * HktSpriteCore Processor가 구성하여 전달.
 */
struct FHktSpriteEntityUpdate
{
	FVector WorldLocation = FVector::ZeroVector;
	EHktSpriteFacing Facing = EHktSpriteFacing::S;
	FGameplayTag AnimTag;
	int64 AnimStartTick = 0;
	int64 NowTick = 0;
	float TickDurationMs = 1000.f / 30.f;
	float PlayRate = 1.f;
	FLinearColor TintOverride = FLinearColor::White;
	int32 PaletteIndex = 0;

	/**
	 * 인스턴스 단위 Z-bias (cm). 컴포넌트 ZBias 와 합산되어 CPD slot 15 에 들어간다.
	 * 같은 atlas HISM 안에서 특정 엔터티만 카메라 쪽으로 미세하게 밀어 정렬용으로 사용.
	 */
	float ZBias = 0.f;
};

/**
 * UHktSpriteCrowdRenderer — HISM 기반 2D 스프라이트 크라우드 렌더러.
 *
 * 구조:
 *   - 하나의 아틀라스 텍스처(SoftObjectPath)당 HISM 하나.
 *   - 캐릭터가 애니마다 다른 아틀라스를 쓰면 엔터티 인스턴스는 현재 재생 중 애니의
 *     아틀라스 HISM으로 이동(migrate)한다.
 *   - 메쉬는 단일 Quad, 머티리얼은 Y-axis billboard + Custom Primitive Data 16슬롯.
 *   - 엔터티 한 명은 동시에 정확히 1개의 HISM 인스턴스에만 존재.
 */
UCLASS(ClassGroup=(HktSprite), meta=(BlueprintSpawnableComponent))
class HKTSPRITECORE_API UHktSpriteCrowdRenderer : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktSpriteCrowdRenderer();

	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UMaterialInterface> SpriteMaterialTemplate;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite", meta=(ClampMin="0.01"))
	float GlobalWorldScale = 1.f;

	/**
	 * 본 컴포넌트의 모든 인스턴스에 일괄 적용되는 Z-bias (cm).
	 *
	 * `FHktSpriteEntityUpdate::ZBias` 와 합산되어 CPD slot 15 에 들어간다.
	 * 머티리얼 WPO 가 카메라 쪽으로 cm 만큼 밀어내며 depth-buffer 에 반영된다.
	 *
	 * 사용 예 — 캐릭터 ↔ 지형 정렬:
	 *   - SpriteTerrain (지형) : ComponentZBias = 0   (베이스라인)
	 *   - 본 컴포넌트 (캐릭터)  : ComponentZBias = +1  (지형 위)
	 * 양수일수록 카메라 쪽 (= 다른 그룹 앞).
	 */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Depth")
	float ComponentZBias = 0.f;

	void RegisterEntity(FHktEntityId Id);
	void UnregisterEntity(FHktEntityId Id);

	/** 엔터티의 캐릭터 태그를 지정/변경. 실제 HISM 배정은 첫 UpdateEntity에서 수행. */
	void SetCharacter(FHktEntityId Id, FGameplayTag CharacterTag);

	void UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update);
	void ClearAll();

	/** CharacterTag 의 Visual 자산 조회. 로드 완료 전이면 nullptr.
	 *  CrowdHost 의 Anim.Action 만료 콜백이 anim duration 을 산출하기 위해 사용. */
	const UHktHISMSpriteVisualAsset* ResolveVisualAsset(FGameplayTag CharacterTag) const;

private:
	/** 엔터티 1명의 렌더 상태 — 현재 속한 아틀라스 HISM + 인스턴스 인덱스. */
	struct FEntityState
	{
		FGameplayTag CharacterTag;
		FSoftObjectPath CurrentAtlasPath;  // 현재 들어가 있는 HISM의 키
		int32 InstanceIndex = INDEX_NONE;
		bool bActive = false;

		EHktSpriteUpdateStatus LastUpdateStatus = EHktSpriteUpdateStatus::OK;
	};

	UPROPERTY(Transient)
	TArray<TObjectPtr<UInstancedStaticMeshComponent>> AllHISMs;

	/** 아틀라스 SoftObjectPath → ISM (고유 아틀라스당 하나) */
	TMap<FSoftObjectPath, UInstancedStaticMeshComponent*> AtlasHISMs;

	UPROPERTY(Transient)
	TMap<FGameplayTag, TObjectPtr<UHktHISMSpriteVisualAsset>> VisualCache;

	/**
	 * 정적 Visual(`AnimationAsset == nullptr`) 의 합성 anim 1회 캐시. 매 프레임 룩업에서
	 * 동적 경로와 동일한 `FHktSpriteAnimation*` 인터페이스를 제공한다. 동적 Visual 은
	 * 본 맵에 등록되지 않으며 `Visual->AnimationAsset->Animations` 를 직접 사용.
	 */
	TMap<FGameplayTag, FHktSpriteAnimation> StaticAnimCache;

	TMap<FHktEntityId, FEntityState> Entities;

	// ========================================================================
	// Template Readiness — 첫 PIE atlas-honeycomb 회피의 핵심.
	//
	// 모든 atlas 텍스처 + RHI 준비 + HISM proxy 생성 + MID 파라미터 propagation 까지
	// 완료된 뒤에야 첫 AddInstance 를 허용한다. 단순 1-프레임 prime 으로는 UE5.7 PIE 의
	// 콜드 스타트 race (proxy + instance + 미반영 MID) 가 잡히지 않아 readiness state
	// machine 으로 격상.
	// ========================================================================

	enum class ETemplateReadyStage : uint8
	{
		LoadingTemplate = 0,
		LoadingAtlases  = 1,
		WaitingAtlasRHI = 2,
		WarmupHISMs     = 3,
		Ready           = 4,
		Failed          = 5,
	};

	struct FTemplateReady
	{
		ETemplateReadyStage Stage = ETemplateReadyStage::LoadingTemplate;
		TArray<FSoftObjectPath> AtlasPaths;
		TSharedPtr<FStreamableHandle> AtlasLoadHandle;
		uint64 WarmupStartFrame = 0;
	};

	TMap<FGameplayTag, FTemplateReady> TemplateReadiness;

	void RequestTemplateLoad(FGameplayTag Tag);
	void OnTemplateLoaded(FGameplayTag Tag, UHktTagDataAsset* Loaded);
	void OnAtlasesLoaded(FGameplayTag Tag);
	/** UpdateEntity 진입 시 호출. true 반환 = Ready 단계, 그릴 수 있음. */
	bool AdvanceTemplateReadiness(FGameplayTag Tag);
	void CollectAtlasPaths(FGameplayTag CharacterTag, TArray<FSoftObjectPath>& OutPaths) const;
	static bool AreAllAtlasesRHIReady(const TArray<FSoftObjectPath>& Paths);
	void PrecreateHISMs(const TArray<FSoftObjectPath>& Paths);

	/**
	 * Visual + AnimTag → FHktSpriteAnimation* 해석. 정적 Visual 은 `StaticAnimCache`
	 * 의 합성 anim 을, 동적 Visual 은 `AnimationAsset->FindAnimationOrFallback` 결과를 반환.
	 */
	const FHktSpriteAnimation* ResolveAnimation(FGameplayTag CharacterTag, const FGameplayTag& AnimTag) const;

	UInstancedStaticMeshComponent* GetOrCreateHISM(const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex);

	/** swap-and-pop 제거 + InstanceIndex remap. */
	void RemoveInstanceAndRemap(const FSoftObjectPath& AtlasPath, int32 InstanceIndex);

	/**
	 * 방향 단위 atlas/셀크기 해석 — Animation.AtlasSlots(분할) 또는 단일 Anim.Atlas/Visual.Atlas 폴백.
	 * 반환 텍스처는 LoadSynchronous 결과. 실패 시 nullptr.
	 */
	static UTexture2D* ResolveAtlas(const FHktSpriteAnimation& Anim, int32 DirIdx,
		const UHktHISMSpriteVisualAsset* Visual, FSoftObjectPath& OutPath, FVector2f& OutCellSize);

	void ApplyEntityInstanceTransform(FHktEntityId Id, const FHktSpriteEntityUpdate& Update,
		const UHktHISMSpriteVisualAsset* Visual, FEntityState& State);
};
