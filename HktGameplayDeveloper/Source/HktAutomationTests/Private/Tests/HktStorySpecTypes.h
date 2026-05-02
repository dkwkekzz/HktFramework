// Copyright Hkt Studios, Inc. All Rights Reserved.
//
// FHktStorySpec — `<Story>.spec.json` 사이드카에서 파싱된 시나리오 자료구조.
// 진실원: HktGameplay/Content/Stories/SPEC.md
//
// 설계 메모:
//  - 본 구조체들은 테스트 실행(런타임) 시점에 조회되므로 TMap 을 쓰지 않는다.
//    파서는 내부적으로 TMap 을 사용해 중복 키를 검출할 수 있지만, 결과는
//    TArray<TPair> 모양으로 평탄화한다.
//  - 분기당 매처가 작아 (보통 3~5 항목) 선형 탐색이 충분하다.

#pragma once

#include "CoreMinimal.h"
#include "VM/HktVMTypes.h"

struct FHktSpecPropPair
{
	FString Name;
	int32 Value = 0;
};

struct FHktSpecEntity
{
	FString Archetype;
	TArray<FHktSpecPropPair> Properties;
	TArray<FString> Tags;
	bool bHasPosition = false;
	int32 PosX = 0;
	int32 PosY = 0;
	int32 PosZ = 0;
};

// 이벤트 페이로드 (Context.EventParam0..3 / EventTargetPos*) — entity property 와 분리.
// LoadStore Param0 류 op 는 entity 컬럼이 아닌 Context local 에서 읽으므로 별도 명시 필요.
struct FHktSpecEventParams
{
	bool bSet = false;          // given.event 블록 존재 여부
	int32 Param0 = 0;
	int32 Param1 = 0;
	int32 Param2 = 0;
	int32 Param3 = 0;
	int32 TargetPosX = 0;
	int32 TargetPosY = 0;
	int32 TargetPosZ = 0;
};

struct FHktSpecGiven
{
	FHktSpecEntity Self;
	FHktSpecEntity Target;
	bool bHasTarget = false;
	TArray<FHktSpecEntity> Entities;
	FHktSpecEventParams Event;
};

enum class EHktSpecEventKind : uint8
{
	Advance,
	InjectCollision,
	InjectMoveEnd,
	InjectGrounded,
	InjectAnimEnd,
};

struct FHktSpecEvent
{
	EHktSpecEventKind Kind = EHktSpecEventKind::Advance;
	int32 Frames = 0;          // Advance 전용
	FString EntityRef;         // InjectCollision 전용 ("self" / "target" / "entities[N]")
};

struct FHktSpecMatcher
{
	FString EntityRef;
	TArray<FHktSpecPropPair> Properties;   // 정확 일치
	TArray<FString> TagsContains;           // 부분 일치 (모두 포함)
	TArray<FString> TagsExact;              // 정확 일치 (set 비교)
	TArray<FString> TagsAbsent;             // 모두 부재
};

struct FHktSpecExpect
{
	EVMStatus Status = EVMStatus::Completed;
	TArray<FHktSpecMatcher> Matchers;
};

struct FHktSpecScenario
{
	FString Name;
	FHktSpecGiven Given;
	TArray<FHktSpecEvent> Events;
	FHktSpecExpect Expect;
	int32 MaxFrames = 500;
};

struct FHktStorySpec
{
	FString StoryTag;          // V2 prefix 없는 베이스 tag (예: "Story.Event.Move.Stop")
	FString Description;
	FString SourceFile;        // 진단용 — Stories 루트 기준 상대 경로
	TArray<FHktSpecScenario> Scenarios;
};
