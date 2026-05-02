// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "UObject/SoftObjectPath.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCrowdRenderer.generated.h"

class UInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UTexture2D;
class UHktSpriteCharacterTemplate;

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

	/**
	 * GetOrCreateHISM 등록 직후 HISM → 등록 프레임 번호.
	 * 첫 PIE 에서 텍스처 RHI 가 막 valid 로 전이된 직후 SetTextureParameterValue 의 propagation
	 * 이 첫 proxy 생성과 race 해 stale binding 으로 굳는 케이스 방어. 등록 다음 프레임에 한 번만
	 * MID 파라미터 재바인딩 + MarkRenderStateDirty 로 proxy 를 강제로 다시 잡는다.
	 */
	TMap<UInstancedStaticMeshComponent*, uint64> HISMPrimePending;

	UPROPERTY(Transient)
	TMap<FGameplayTag, TObjectPtr<UHktSpriteCharacterTemplate>> TemplateCache;

	TMap<FHktEntityId, FEntityState> Entities;

	TSet<FGameplayTag> PendingTemplateLoads;

	void RequestTemplateLoad(FGameplayTag Tag);

	UInstancedStaticMeshComponent* GetOrCreateHISM(const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex);

	/** swap-and-pop 제거 + InstanceIndex remap. */
	void RemoveInstanceAndRemap(const FSoftObjectPath& AtlasPath, int32 InstanceIndex);

	/**
	 * 방향 단위 atlas/셀크기 해석 — Animation.AtlasSlots(분할) 또는 단일 Anim.Atlas/Template.Atlas 폴백.
	 * 반환 텍스처는 LoadSynchronous 결과. 실패 시 nullptr.
	 */
	static UTexture2D* ResolveAtlas(const FHktSpriteAnimation& Anim, int32 DirIdx,
		UHktSpriteCharacterTemplate* Template, FSoftObjectPath& OutPath, FVector2f& OutCellSize);

	void ApplyEntityInstanceTransform(FHktEntityId Id, const FHktSpriteEntityUpdate& Update,
		UHktSpriteCharacterTemplate* Template, FEntityState& State);
};
