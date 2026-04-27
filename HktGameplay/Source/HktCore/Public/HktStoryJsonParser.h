// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktStoryTypes.h"
#include "HktStoryBuilder.h"  // FHktVar / FHktVarBlock 완전 정의 필요 (return-by-value)

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

	/**
	 * @deprecated PR-3 에서 GetVar(B, Key) 로 대체 예정. 현재는 schema 1 (구 표기 "R0".."R9", "Self") 호환.
	 * 필수 레지스터. 실패 시 R0 반환 + 에러 누적
	 */
	RegisterIndex GetReg(const FString& Key) const;

	/**
	 * @deprecated PR-3 에서 GetVar / GetVarOpt 로 대체 예정.
	 * 옵션 레지스터. 필드 없으면 Default 반환
	 */
	RegisterIndex GetRegOpt(const FString& Key, RegisterIndex Default) const;

	/**
	 * 신 FHktVar API (schema 2). 다음 4종 VarRef JSON 폼을 모두 처리:
	 *   - {"var": "name"}        — 같은 빌더 내 같은 이름은 같은 VReg.
	 *   - {"self": true}         — FHktStoryBuilder::Self()
	 *   - {"target": true}       — FHktStoryBuilder::Target()
	 *   - {"const": N}           — 자동 NewVar + LoadConst(N) 후 새 VReg 반환
	 * Schema 1 호환: 키 값이 문자열이면 ParseRegister 로 처리하여 pre-colored VReg 핸들 반환.
	 */
	FHktVar GetVar(FHktStoryBuilder& B, const FString& Key) const;

	/**
	 * 블록 변수 — JSON 폼: {"block": "name", "count": N}.
	 * 같은 이름의 블록은 같은 FHktVarBlock 을 반환한다.
	 */
	FHktVarBlock GetVarBlock(FHktStoryBuilder& B, const FString& Key, int32 Count) const;

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

	/** Story 메타의 schema 버전 (1=구, 2=신 FHktVar VarRef). 기본 1. */
	int32 SchemaVersion = 1;

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

	/** 커맨드 핸들러 등록 (게임 모듈에서 확장 가능) — schema 1 (구) */
	void RegisterCommand(const FString& OpName, FHktStoryCommandHandler Handler);

	/**
	 * Schema 2 핸들러 등록 — VarRef 객체를 받는 신 API 핸들러.
	 * Schema 2 Story 가 디스패치될 때 본 맵을 우선 조회하고, 없으면 v1 핸들러로 폴백한다(공통 op).
	 */
	void RegisterCommandV2(const FString& OpName, FHktStoryCommandHandler Handler);

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
	void InitializeCoreCommandsV2();

	/** preconditions 배열 파싱 — Builder의 BeginPrecondition/EndPrecondition 사이로 디스패치 */
	bool ParsePreconditions(
		const TArray<TSharedPtr<FJsonValue>>& PreconditionArray,
		const TFunction<FGameplayTag(const FString&)>& ResolveTag,
		FHktStoryBuilder& Builder,
		FHktStoryParseResult& Result);

	TMap<FString, FHktStoryCommandHandler> CommandMap;
	TMap<FString, FHktStoryCommandHandler> CommandMapV2;
};
