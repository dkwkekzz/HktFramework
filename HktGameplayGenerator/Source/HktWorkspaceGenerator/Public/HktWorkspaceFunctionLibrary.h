// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HktWorkspaceFunctionLibrary.generated.h"

// ============================================================================
// UHktWorkspaceFunctionLibrary
//
// I-0008 워크스페이스 자동 빌드 진입점. Remote Control 노출용 UFUNCTION.
// 모든 함수는 결과를 JSON 문자열로 반환 (성공/실패 + 산출 자산 경로).
// ============================================================================
UCLASS()
class HKTWORKSPACEGENERATOR_API UHktWorkspaceFunctionLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * 워크스페이스 전체 스캔 — 빌드 없이 발견된 Tag 목록만 반환.
	 * 변경된(stale) 항목과 빌드된(fresh) 항목을 manifest 기준으로 표시.
	 *
	 * @param WorkspaceRoot 비우면 설정의 기본 루트({Saved}/Workspace) 사용.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Workspace")
	static FString ListWorkspaceTags(const FString& WorkspaceRoot = TEXT(""));

	/**
	 * 워크스페이스 전체 스캔 후 변경된 항목 일괄 빌드. bForce=true 면 manifest 무시.
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Workspace")
	static FString ScanAndBuildAll(const FString& WorkspaceRoot = TEXT(""), bool bForce = false);

	/**
	 * 단일 Tag 폴더 빌드. Category 는 "Paper2D" / "HISM" 중 하나.
	 *  - Paper2D Character (Animations/ 존재) → BuildPaperCharacter
	 *  - Paper2D StaticVisual (단일 PNG)      → BuildPaperStaticVisual
	 *  - HISM ...                              → 미구현 (인터페이스만)
	 */
	UFUNCTION(BlueprintCallable, Category = "HKT|Workspace")
	static FString BuildTag(
		const FString& Category,
		const FString& TagFolderName,
		bool bForce = false,
		const FString& WorkspaceRoot = TEXT(""));
};
