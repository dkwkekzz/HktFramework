// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameplayTagContainer.h"
#include "HktStoryTypes.h"
#include "HktStoryBuilder.h"  // FHktEventPrecondition

/**
 * FHktVMProgram - 컴파일된 바이트코드 프로그램 (불변, 공유 가능)
 */
struct HKTCORE_API FHktVMProgram
{
    FGameplayTag Tag;
    TArray<FInstruction> Code;
    TArray<int32> Constants;
    TArray<FString> Strings;
    TArray<int32> LineNumbers;

    /** 같은 SourceEntity에 동일 EventTag VM이 이미 있으면 기존 것을 취소 */
    bool bCancelOnDuplicate = false;

    /** 사전조건 검증 — 설정되지 않으면 항상 true (무조건 실행 가능) */
    FHktEventPrecondition Precondition;

    /** Precondition 바이트코드 (설정 시 기존 람다보다 우선) */
    TArray<FInstruction> PreconditionCode;
    TArray<int32> PreconditionConstants;
    TArray<FString> PreconditionStrings;

    bool IsValid() const { return Code.Num() > 0; }
    bool HasPreconditionCode() const { return PreconditionCode.Num() > 0; }
    int32 CodeSize() const { return Code.Num(); }
};

/**
 * FHktVMProgramRegistry - EventTag → Program 매핑 관리
 */
class HKTCORE_API FHktVMProgramRegistry
{
public:
    static FHktVMProgramRegistry& Get();

    const FHktVMProgram* FindProgram(const FGameplayTag& Tag) const;
    void RegisterProgram(TSharedRef<FHktVMProgram> Program);
    void Clear();

    /** EventTag + WorldState로 사전조건 검증 (프로그램 미등록 또는 Precondition 미설정 시 true) */
    bool ValidateEvent(const FHktWorldState& WorldState, const FHktEvent& Event) const;

private:
    FHktVMProgramRegistry() = default;

    TMap<FGameplayTag, TSharedRef<FHktVMProgram>> Programs;
    mutable FRWLock Lock;
};

