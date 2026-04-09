// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktStoryTypes.h"

/**
 * FHktStoryValidator — Story 바이트코드 정적 검증기
 *
 * Build() 시점에 컴파일된 바이트코드의 레지스터 흐름을 분석하여
 * 런타임 버그를 사전에 감지한다.
 *
 * 검증 항목:
 * 1. EntityFlow: 엔티티 레지스터(R10~R14) 초기화 순서 검증
 *    - Label 합류점에서 보수적으로 Spawned/Hit/Iter를 무효 처리
 *    - PlayAnim, SetForwardTarget, DispatchEventTo/From 포함 전 opcode 검증
 * 2. RegisterFlow: 범용 레지스터(R0~R9) Read-before-Write / Dead Write 감지
 *
 * 검증 정책:
 * - EntityFlow 실패: 등록 차단 + ensure (에디터/게임 공통)
 * - RegisterFlow: Editor Warning, Game(Shipping) 등록 차단
 */
class HKTCORE_API FHktStoryValidator
{
public:
	/**
	 * @param InCode      컴파일된 명령어 배열
	 * @param InTag       Story 태그 (로그 출력용)
	 * @param InLabels    문자열 Label → PC 매핑 (합류점 판정용)
	 * @param InIntLabels 정수 Label → PC 매핑 (자동 생성 라벨)
	 * @param bInFlowMode true이면 Self/Target 엔티티가 항상 유효하다고 가정하지 않음
	 */
	FHktStoryValidator(
		const TArray<FInstruction>& InCode,
		const FGameplayTag& InTag,
		const TMap<FName, int32>& InLabels,
		const TMap<int32, int32>& InIntLabels = {},
		bool bInFlowMode = false);

	/**
	 * 엔티티 레지스터 초기화 검증
	 * - R10~R14: SpawnEntity/WaitCollision/NextFound 이후에만 유효
	 * - R0~R9: 엔티티 파라미터로 사용될 때 Write 이후에만 유효
	 * @return true면 검증 통과, false면 치명적 오류 (등록 차단)
	 */
	bool ValidateEntityFlow();

	/**
	 * 범용 레지스터(R0~R9) 흐름 검증
	 * - Read-before-Write: 초기화 안 된 레지스터 읽기
	 * - Dead Write: 값을 쓰고 읽지 않고 다시 덮어쓰기
	 *
	 * @return 경고 수 (0이면 이상 없음)
	 */
	int32 ValidateRegisterFlow();

private:
	const TArray<FInstruction>& Code;
	const FGameplayTag& Tag;
	TSet<int32> LabelPCs;
	bool bFlowMode = false;
};
