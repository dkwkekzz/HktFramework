// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktTagDataAsset.h"
#include "HktItemVisualDataAsset.generated.h"

class UStaticMesh;
class UTexture2D;

/**
 * 아이템 시각화용 TagDataAsset.
 * IdentifierTag(예: Entity.Item.Sword)로 로드되며, 메시와 아이콘을 지정합니다.
 * 캐릭터와 달리 Blueprint Actor가 아닌 데이터 드리븐 방식으로 메시를 설정합니다.
 */
UCLASS(BlueprintType)
class HKTPRESENTATION_API UHktItemVisualDataAsset : public UHktTagDataAsset
{
	GENERATED_BODY()

public:
	/** 아이템 메시 (검, 방패, 재료 등) — 장착 시 소켓에 부착되는 메시 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Item")
	TObjectPtr<UStaticMesh> Mesh;

	/** 바닥에 떨어져 있을 때 보이는 메시 (nullptr이면 Mesh를 대신 사용) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Item")
	TObjectPtr<UStaticMesh> DroppedMesh;

	/** UI 아이콘 텍스처 (인벤토리, 장비 패널용) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Item")
	TObjectPtr<UTexture2D> Icon;

	/** 캐릭터 SkeletalMesh에서 부착할 소켓 이름 (예: weapon_r, shield_l) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Item")
	FName AttachSocketName = NAME_None;

	/** 소켓 부착 시 회전 오프셋 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Item")
	FRotator AttachRotationOffset = FRotator::ZeroRotator;

	/** 메시 스케일 오버라이드 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Item")
	FVector MeshScale = FVector::OneVector;
};
