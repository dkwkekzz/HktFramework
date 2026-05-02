// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktStorySpecParser.h"

#include "Misc/FileHelper.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"

namespace
{
	// JSON 정수 → int32 (실수도 허용해 floor).
	int32 AsInt(const TSharedPtr<FJsonValue>& V, int32 Default = 0)
	{
		if (!V.IsValid()) return Default;
		double D = 0.0;
		if (V->TryGetNumber(D)) return static_cast<int32>(D);
		return Default;
	}

	bool ParseEntity(const TSharedPtr<FJsonObject>& Obj, FHktSpecEntity& Out, FString& OutError)
	{
		if (!Obj.IsValid()) return true; // 미명시 OK — 기본값 유지

		Obj->TryGetStringField(TEXT("archetype"), Out.Archetype);

		// properties: { name: int }
		const TSharedPtr<FJsonObject>* PropsObj = nullptr;
		if (Obj->TryGetObjectField(TEXT("properties"), PropsObj) && PropsObj && PropsObj->IsValid())
		{
			// 중복 키 검출용 TMap (load time 한정).
			TMap<FString, int32> Seen;
			for (const auto& Pair : (*PropsObj)->Values)
			{
				if (Seen.Contains(Pair.Key))
				{
					OutError = FString::Printf(TEXT("properties 중복 키: %s"), *Pair.Key);
					return false;
				}
				const int32 V = AsInt(Pair.Value);
				Seen.Add(Pair.Key, V);
				Out.Properties.Add({Pair.Key, V});
			}
		}

		// tags: [string]
		const TArray<TSharedPtr<FJsonValue>>* TagsArr = nullptr;
		if (Obj->TryGetArrayField(TEXT("tags"), TagsArr))
		{
			for (const auto& V : *TagsArr)
			{
				FString S;
				if (V->TryGetString(S)) Out.Tags.Add(S);
			}
		}

		// position: [x, y, z]
		const TArray<TSharedPtr<FJsonValue>>* PosArr = nullptr;
		if (Obj->TryGetArrayField(TEXT("position"), PosArr))
		{
			if (PosArr->Num() != 3)
			{
				OutError = TEXT("position 배열은 정확히 3개 (x,y,z) 여야 한다");
				return false;
			}
			Out.bHasPosition = true;
			Out.PosX = AsInt((*PosArr)[0]);
			Out.PosY = AsInt((*PosArr)[1]);
			Out.PosZ = AsInt((*PosArr)[2]);
		}

		return true;
	}

	bool ParseGiven(const TSharedPtr<FJsonObject>& Obj, FHktSpecGiven& Out, FString& OutError)
	{
		if (!Obj.IsValid())
		{
			OutError = TEXT("scenario.given 누락");
			return false;
		}

		const TSharedPtr<FJsonObject>* SelfObj = nullptr;
		if (Obj->TryGetObjectField(TEXT("self"), SelfObj))
		{
			if (!ParseEntity(*SelfObj, Out.Self, OutError)) return false;
		}

		const TSharedPtr<FJsonObject>* TargetObj = nullptr;
		if (Obj->TryGetObjectField(TEXT("target"), TargetObj))
		{
			Out.bHasTarget = true;
			if (!ParseEntity(*TargetObj, Out.Target, OutError)) return false;
		}

		// event: { param0, param1, param2, param3, targetPosX, targetPosY, targetPosZ } — 모두 optional
		const TSharedPtr<FJsonObject>* EventObj = nullptr;
		if (Obj->TryGetObjectField(TEXT("event"), EventObj) && EventObj && EventObj->IsValid())
		{
			Out.Event.bSet = true;
			auto ReadIntField = [&](const TCHAR* Field, int32& Dst)
			{
				double D = 0.0;
				if ((*EventObj)->TryGetNumberField(Field, D)) Dst = static_cast<int32>(D);
			};
			ReadIntField(TEXT("param0"),     Out.Event.Param0);
			ReadIntField(TEXT("param1"),     Out.Event.Param1);
			ReadIntField(TEXT("param2"),     Out.Event.Param2);
			ReadIntField(TEXT("param3"),     Out.Event.Param3);
			ReadIntField(TEXT("targetPosX"), Out.Event.TargetPosX);
			ReadIntField(TEXT("targetPosY"), Out.Event.TargetPosY);
			ReadIntField(TEXT("targetPosZ"), Out.Event.TargetPosZ);
		}

		const TArray<TSharedPtr<FJsonValue>>* EntitiesArr = nullptr;
		if (Obj->TryGetArrayField(TEXT("entities"), EntitiesArr))
		{
			for (int32 i = 0; i < EntitiesArr->Num(); ++i)
			{
				const TSharedPtr<FJsonObject>* EObj = nullptr;
				if (!(*EntitiesArr)[i]->TryGetObject(EObj))
				{
					OutError = FString::Printf(TEXT("entities[%d] 가 객체가 아니다"), i);
					return false;
				}
				FHktSpecEntity E;
				if (!ParseEntity(*EObj, E, OutError)) return false;
				Out.Entities.Add(MoveTemp(E));
			}
		}

		return true;
	}

	bool ParseEvents(const TArray<TSharedPtr<FJsonValue>>* Arr, TArray<FHktSpecEvent>& Out, FString& OutError)
	{
		if (!Arr) return true;
		for (int32 i = 0; i < Arr->Num(); ++i)
		{
			const TSharedPtr<FJsonObject>* EObj = nullptr;
			if (!(*Arr)[i]->TryGetObject(EObj))
			{
				OutError = FString::Printf(TEXT("events[%d] 가 객체가 아니다"), i);
				return false;
			}
			FHktSpecEvent Ev;
			int32 AdvanceN = 0;
			if ((*EObj)->TryGetNumberField(TEXT("advance"), AdvanceN))
			{
				Ev.Kind = EHktSpecEventKind::Advance;
				Ev.Frames = AdvanceN;
				Out.Add(Ev);
				continue;
			}
			FString InjectKind;
			if ((*EObj)->TryGetStringField(TEXT("inject"), InjectKind))
			{
				if      (InjectKind == TEXT("Collision")) { Ev.Kind = EHktSpecEventKind::InjectCollision;
				                                            (*EObj)->TryGetStringField(TEXT("entity"), Ev.EntityRef); }
				else if (InjectKind == TEXT("MoveEnd"))    Ev.Kind = EHktSpecEventKind::InjectMoveEnd;
				else if (InjectKind == TEXT("Grounded"))   Ev.Kind = EHktSpecEventKind::InjectGrounded;
				else if (InjectKind == TEXT("AnimEnd"))    Ev.Kind = EHktSpecEventKind::InjectAnimEnd;
				else
				{
					OutError = FString::Printf(TEXT("events[%d] 알 수 없는 inject kind: %s"), i, *InjectKind);
					return false;
				}
				Out.Add(Ev);
				continue;
			}
			OutError = FString::Printf(TEXT("events[%d] 폼 인식 실패 (advance/inject 둘 다 없음)"), i);
			return false;
		}
		return true;
	}

	bool ParseMatcher(const FString& EntityRef, const TSharedPtr<FJsonObject>& MObj,
	                  FHktSpecMatcher& Out, FString& OutError)
	{
		Out.EntityRef = EntityRef;
		if (!MObj.IsValid()) return true;

		const TSharedPtr<FJsonObject>* PropsObj = nullptr;
		if (MObj->TryGetObjectField(TEXT("properties"), PropsObj) && PropsObj && PropsObj->IsValid())
		{
			TMap<FString, int32> Seen;
			for (const auto& Pair : (*PropsObj)->Values)
			{
				if (Seen.Contains(Pair.Key))
				{
					OutError = FString::Printf(TEXT("expect.%s.properties 중복 키: %s"), *EntityRef, *Pair.Key);
					return false;
				}
				const int32 V = AsInt(Pair.Value);
				Seen.Add(Pair.Key, V);
				Out.Properties.Add({Pair.Key, V});
			}
		}

		auto ReadTagArr = [&](const TCHAR* Field, TArray<FString>& Dst)
		{
			const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
			if (MObj->TryGetArrayField(Field, Arr))
			{
				for (const auto& V : *Arr) { FString S; if (V->TryGetString(S)) Dst.Add(S); }
			}
		};
		ReadTagArr(TEXT("tags"),       Out.TagsContains);
		ReadTagArr(TEXT("tagsExact"),  Out.TagsExact);
		ReadTagArr(TEXT("tagsAbsent"), Out.TagsAbsent);

		return true;
	}

	bool ParseExpect(const TSharedPtr<FJsonObject>& Obj, FHktSpecExpect& Out, FString& OutError)
	{
		if (!Obj.IsValid())
		{
			OutError = TEXT("scenario.expect 누락");
			return false;
		}

		FString StatusStr;
		if (Obj->TryGetStringField(TEXT("status"), StatusStr))
		{
			if      (StatusStr == TEXT("Completed")) Out.Status = EVMStatus::Completed;
			else if (StatusStr == TEXT("Failed"))    Out.Status = EVMStatus::Failed;
			else if (StatusStr == TEXT("Waiting"))   Out.Status = EVMStatus::WaitingEvent;
			else
			{
				OutError = FString::Printf(TEXT("status 값 인식 실패: %s"), *StatusStr);
				return false;
			}
		}

		// entityRef 키들을 매처로 수집 (status 외 모든 객체 키).
		for (const auto& Pair : Obj->Values)
		{
			if (Pair.Key == TEXT("status")) continue;
			const TSharedPtr<FJsonObject>* MObj = nullptr;
			if (!Pair.Value->TryGetObject(MObj))
			{
				OutError = FString::Printf(TEXT("expect.%s 가 객체가 아니다"), *Pair.Key);
				return false;
			}
			FHktSpecMatcher M;
			if (!ParseMatcher(Pair.Key, *MObj, M, OutError)) return false;
			Out.Matchers.Add(MoveTemp(M));
		}
		return true;
	}

	bool ParseScenario(const TSharedPtr<FJsonObject>& Obj, FHktSpecScenario& Out, FString& OutError)
	{
		if (!Obj->TryGetStringField(TEXT("name"), Out.Name) || Out.Name.IsEmpty())
		{
			OutError = TEXT("scenario.name 누락 또는 빈 문자열");
			return false;
		}
		Obj->TryGetNumberField(TEXT("maxFrames"), Out.MaxFrames);
		if (Out.MaxFrames <= 0) Out.MaxFrames = 500;

		const TSharedPtr<FJsonObject>* GivenObj = nullptr;
		Obj->TryGetObjectField(TEXT("given"), GivenObj);
		if (!ParseGiven(GivenObj ? *GivenObj : nullptr, Out.Given, OutError)) return false;

		const TArray<TSharedPtr<FJsonValue>>* EventsArr = nullptr;
		Obj->TryGetArrayField(TEXT("events"), EventsArr);
		if (!ParseEvents(EventsArr, Out.Events, OutError)) return false;

		const TSharedPtr<FJsonObject>* ExpectObj = nullptr;
		Obj->TryGetObjectField(TEXT("expect"), ExpectObj);
		if (!ParseExpect(ExpectObj ? *ExpectObj : nullptr, Out.Expect, OutError)) return false;

		return true;
	}
}

bool FHktStorySpecParser::ParseJson(const FString& JsonStr, FHktStorySpec& Out, FString& OutError)
{
	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<TCHAR>> Reader = TJsonReaderFactory<TCHAR>::Create(JsonStr);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		OutError = TEXT("JSON 파싱 실패");
		return false;
	}

	if (!Root->TryGetStringField(TEXT("storyTag"), Out.StoryTag) || Out.StoryTag.IsEmpty())
	{
		OutError = TEXT("storyTag 누락 또는 빈 문자열");
		return false;
	}
	Root->TryGetStringField(TEXT("description"), Out.Description);

	const TArray<TSharedPtr<FJsonValue>>* ScArr = nullptr;
	if (!Root->TryGetArrayField(TEXT("scenarios"), ScArr) || !ScArr || ScArr->Num() == 0)
	{
		OutError = TEXT("scenarios 배열 누락 또는 빈 배열");
		return false;
	}

	for (int32 i = 0; i < ScArr->Num(); ++i)
	{
		const TSharedPtr<FJsonObject>* SObj = nullptr;
		if (!(*ScArr)[i]->TryGetObject(SObj))
		{
			OutError = FString::Printf(TEXT("scenarios[%d] 가 객체가 아니다"), i);
			return false;
		}
		FHktSpecScenario S;
		if (!ParseScenario(*SObj, S, OutError))
		{
			OutError = FString::Printf(TEXT("scenarios[%d] (%s): %s"), i, *S.Name, *OutError);
			return false;
		}
		Out.Scenarios.Add(MoveTemp(S));
	}

	return true;
}

bool FHktStorySpecParser::ParseFile(const FString& AbsolutePath, FHktStorySpec& Out, FString& OutError)
{
	FString JsonStr;
	if (!FFileHelper::LoadFileToString(JsonStr, *AbsolutePath))
	{
		OutError = FString::Printf(TEXT("파일 읽기 실패: %s"), *AbsolutePath);
		return false;
	}
	return ParseJson(JsonStr, Out, OutError);
}
