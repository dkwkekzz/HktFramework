// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktVoxelSkinTypes.h"

class FHktVoxelRenderCache;
struct FHktVoxelChunk;

/**
 * FHktVoxelSkinAssembler — 모듈러 스킨 조합기
 *
 * 7개 레이어(Body, Head, Armor, Boots, Gloves, Cape, Weapon)를
 * 하나의 복셀 청크로 조합한다. 각 레이어는 독립적인 복셀 데이터를 갖고,
 * 레이어 오프셋과 가시성으로 조합된다.
 *
 * 레이어 우선순위: 높은 레이어가 겹치는 복셀을 덮어쓴다.
 * (Weapon > Cape > Gloves > Boots > Armor > Head > Body)
 *
 * 스킨 교체 시 팔레트 행 번호만 변경하면 되므로 재메싱 불필요.
 * 레이어 장착/탈착 시에만 재조합(재메싱) 발생.
 */
class HKTVOXELSKIN_API FHktVoxelSkinAssembler
{
public:
	/** 레이어 설정 */
	void SetLayer(EHktVoxelSkinLayer::Type Layer, const FHktVoxelSkinLayerData& Data);

	/** 레이어 제거 */
	void RemoveLayer(EHktVoxelSkinLayer::Type Layer);

	/** 레이어 가시성 토글 */
	void SetLayerVisible(EHktVoxelSkinLayer::Type Layer, bool bVisible);

	/** 현재 레이어 데이터 반환 */
	const FHktVoxelSkinLayerData* GetLayer(EHktVoxelSkinLayer::Type Layer) const;

	/**
	 * 모든 레이어를 하나의 청크로 조합 (정적 모드)
	 * @param OutChunk - 결과 복셀 청크 (메싱 대기 상태로 출력)
	 */
	void Assemble(FHktVoxelChunk& OutChunk) const;

	/**
	 * 본 그룹별로 분리 조합 (본-리지드 모드)
	 * 에셋의 BoneGroups 데이터를 사용하여 본별 청크를 생성한다.
	 * @param OutBoneChunks - 본 이름 → 해당 본의 복셀 청크
	 */
	void AssembleBoned(TMap<FName, FHktVoxelChunk>& OutBoneChunks) const;

	/** 활성 레이어 중 본 데이터가 있는 에셋이 하나라도 있는지 */
	bool HasAnyBoneData() const;

	/** 스킨 ID 변경 (팔레트만 교체 — 재메싱 불필요) */
	void ChangeSkinPalette(EHktVoxelSkinLayer::Type Layer, uint8 NewPaletteRow);

	/** 전체 레이어 초기화 */
	void Clear();

private:
	/** 기본 프로시저럴 캐릭터 형태 생성 (파이프라인 검증용) */
	void GenerateDefaultShape(FHktVoxelChunk& OutChunk, const FHktVoxelSkinLayerData& LayerData) const;

	FHktVoxelSkinLayerData Layers[EHktVoxelSkinLayer::Count];
	bool bLayerActive[EHktVoxelSkinLayer::Count] = {};
};
