// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktStoryTypes.h"

class FHktStoryBuilder;
class FJsonObject;

// ============================================================================
// FHktStoryCmdArgs — JSON step 래퍼 (타입별 게터 제공)
// ============================================================================

/**
 * JSON step 객체를 래핑하여 타입 안전한 파라미터 추출을 제공.
 * 파싱 실패 시 Errors에 누적하고 안전한 기본값을 반환.
 */
struct HKTCORE_API FHktStoryCmdArgs
{
	FHktStoryCmdArgs(const TSharedPtr<FJsonObject>& InStep, int32 InStepIndex, const FString& InOpName);

	// --- 타입별 게터 ---

	/** 필수 레지스터. 실패 시 R0 반환 + 에러 누적 */
	RegisterIndex GetReg(const FString& Key) const;

	/** 옵션 레지스터. 필드 없으면 Default 반환 */
	RegisterIndex GetRegOpt(const FString& Key, RegisterIndex Default) const;

	/** 필수 정수. 실패 시 0 반환 + 에러 누적 */
	int32 GetInt(const FString& Key) const;

	/** 옵션 정수. 필드 없으면 Default 반환 */
	int32 GetIntOpt(const FString& Key, int32 Default) const;

	/** 옵션 실수. 필드 없으면 Default 반환 */
	float GetFloatOpt(const FString& Key, float Default) const;

	/** GameplayTag (ResolveTagFunc 사용). 실패 시 빈 태그 + 에러 */
	FGameplayTag GetTag(const FString& Key) const;

	/** PropertyId. 실패 시 0xFFFF + 에러 */
	uint16 GetPropertyId(const FString& Key) const;

	/** 문자열. 필드 없으면 빈 문자열 */
	FString GetString(const FString& Key) const;

	bool HasErrors() const { return Errors.Num() > 0; }

	// --- 데이터 ---
	TSharedPtr<FJsonObject> Step;
	int32 StepIndex;
	FString OpName;

	/** 태그 해석 함수 — Parser가 디스패치 전에 설정 */
	TFunction<FGameplayTag(const FString&)> ResolveTagFunc;

	/** 파싱 에러 누적 (핸들러 실행 후 검사) */
	mutable TArray<FString> Errors;
};

// ============================================================================
// FHktStoryJsonParser — 커맨드 맵 기반 JSON → Builder 디스패치
// ============================================================================

/** 커맨드 핸들러: Builder에 명령을 누적하는 람다 */
using FHktStoryCommandHandler = TFunction<void(FHktStoryBuilder&, const FHktStoryCmdArgs&)>;

/** JSON Story 파싱 결과 */
struct HKTCORE_API FHktStoryParseResult
{
	bool bSuccess = false;
	FString StoryTag;
	TArray<FString> Errors;
	TArray<FString> Warnings;
	TArray<FGameplayTag> ReferencedTags;
};

/**
 * FHktStoryJsonParser
 *
 * 커맨드 맵 기반으로 JSON Story를 FHktStoryBuilder 호출로 변환.
 * if-else 체인 없이 TMap<OpName, Handler>로 디스패치.
 *
 * 런타임(HktCore)에 위치하여 서버/클라이언트 양쪽에서 사용 가능.
 * 에디터 전용 기능(태그 자동등록, 스키마 등)은 Generator가 담당.
 *
 * 확장:
 *   FHktStoryJsonParser::Get().RegisterCommand(TEXT("MyOp"), [](auto& B, auto& A) {
 *       B.MyOp(A.GetReg(TEXT("entity")));
 *   });
 */
class HKTCORE_API FHktStoryJsonParser
{
public:
	static FHktStoryJsonParser& Get();

	/** 커맨드 핸들러 등록 (게임 모듈에서 확장 가능) */
	void RegisterCommand(const FString& OpName, FHktStoryCommandHandler Handler);

	/** JSON Story 전체를 파싱하여 빌드 + 등록 (기본 태그 해석) */
	FHktStoryParseResult ParseAndBuild(const FString& JsonStr);

	/** 커스텀 태그 해석기를 사용하는 파싱 */
	FHktStoryParseResult ParseAndBuild(
		const FString& JsonStr,
		const TFunction<FGameplayTag(const FString&)>& ResolveTag);

	/** 단일 step 디스패치. 미등록 Op이면 false */
	bool ApplyCommand(FHktStoryBuilder& Builder, const FHktStoryCmdArgs& Args);

	/** 등록된 유효 Op 이름 목록 */
	TSet<FString> GetValidOpNames() const;

	/** 레지스터 이름 → RegisterIndex 변환. 실패 시 0xFF */
	static RegisterIndex ParseRegister(const FString& RegStr);

	/** PropertyId 이름 → uint16 변환. 실패 시 0xFFFF */
	static uint16 ParsePropertyId(const FString& PropStr);

	/** 읽기 전용 op인지 검증 (precondition에서 허용되는 op) */
	static bool IsReadOnlyOp(const FString& OpName);

private:
	FHktStoryJsonParser();
	void InitializeCoreCommands();

	/** preconditions 배열 파싱 — Builder의 BeginPrecondition/EndPrecondition 사이로 디스패치 */
	bool ParsePreconditions(
		const TArray<TSharedPtr<FJsonValue>>& PreconditionArray,
		const TFunction<FGameplayTag(const FString&)>& ResolveTag,
		FHktStoryBuilder& Builder,
		FHktStoryParseResult& Result);

	TMap<FString, FHktStoryCommandHandler> CommandMap;
};
