// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/SOverlay.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Views/SListView.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Styling/CoreStyle.h"
#include "IHktPlayerInteractionInterface.h"
#include "HktCoreProperties.h"
#include "HktCoreArchetype.h"
#include "HktBagTypes.h"
#include "HktClientRuleInterfaces.h"
#include "GameplayTagsManager.h"

class APlayerController;

/**
 * 인게임 뷰포트 HUD 위젯.
 * 하단 바에 Inventory/Equipment/Skills 버튼과 각각의 패널을 제공합니다.
 * Skills 패널은 실제 액션 슬롯 바인딩을 WorldState에서 읽어 표시합니다.
 */
class HKTUI_API SHktIngameHudWidget : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SHktIngameHudWidget) {}
	SLATE_END_ARGS()

	~SHktIngameHudWidget();

	void Construct(const FArguments& InArgs);

	void SetOwningPlayerController(APlayerController* InPC);

	virtual void Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime) override;

private:
	FReply OnInventoryClicked();
	FReply OnEquipmentClicked();
	FReply OnSkillsClicked();
	void TogglePanel(int32 PanelIndex);

	/** 슬롯 바인딩 변경 시 스킬 패널 갱신 */
	void RefreshSkillsPanel();
	void RefreshInventoryPanel();
	void RefreshEquipmentPanel();

	/** WorldState에서 엔티티의 EntitySpawnTag를 읽어 마지막 세그먼트 이름 반환 */
	static FString GetEntityDisplayName(const FHktWorldState* WS, FHktEntityId Id);

	// --- 시스템 메시지 ---
	struct FHktSystemMessageEntry
	{
		TSharedPtr<SBorder> Widget;
		double ExpireTime;
	};

	void AddSystemMessage(const FString& Message);
	void UnsubscribeSystemMessage();

	TSharedPtr<SVerticalBox> SystemMessageBox;
	TArray<FHktSystemMessageEntry> ActiveSystemMessages;
	FDelegateHandle SystemMessageHandle;
	TWeakObjectPtr<UWorld> CachedWorld;

	TSharedPtr<SBorder> InventoryPanel;
	TSharedPtr<SBorder> EquipmentPanel;
	TSharedPtr<SBorder> SkillsPanel;
	TSharedPtr<SVerticalBox> InventoryListBox;
	TSharedPtr<SVerticalBox> EquipmentListBox;
	TSharedPtr<SVerticalBox> SkillListBox;

	// --- 상단 상태 바 ---
	TSharedPtr<STextBlock> SubjectText;
	TSharedPtr<STextBlock> CommandText;
	TSharedPtr<STextBlock> TargetText;
	void UpdateSubjectDisplay(FHktEntityId EntityId);
	void UpdateTargetDisplay(FHktEntityId EntityId);
	void UpdateCommandDisplay(FGameplayTag EventTag);

	TWeakObjectPtr<APlayerController> CachedPC;
	FHktEntityId CachedSubjectEntityId = InvalidEntityId;
	FDelegateHandle SlotBindingHandle;
	FDelegateHandle BagChangedHandle;
	FDelegateHandle SubjectChangedHandle;
	FDelegateHandle TargetChangedHandle;
	FDelegateHandle CommandChangedHandle;

	int32 ActivePanel = -1; // -1 = none
};

// ============================================================================
// Inline Implementation
// ============================================================================

inline void SHktIngameHudWidget::Construct(const FArguments& InArgs)
{
	// --- 인벤토리 패널 (WorldState 기반) ---
	auto BuildInventoryPanel = [this]() -> TSharedRef<SWidget>
	{
		InventoryListBox = SNew(SVerticalBox);

		return SAssignNew(InventoryPanel, SBorder)
			.Padding(12.f)
			.BorderBackgroundColor(FLinearColor(0.1f, 0.1f, 0.15f, 0.9f))
			.Visibility(EVisibility::Collapsed)
			[
				SNew(SBox)
				.WidthOverride(250.f)
				.HeightOverride(300.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 8.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Inventory")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 16))
						.ColorAndOpacity(FLinearColor::Yellow)
					]
					+ SVerticalBox::Slot()
					.FillHeight(1.f)
					[
						InventoryListBox.ToSharedRef()
					]
				]
			];
	};

	// --- 장착 패널 (WorldState 기반) ---
	auto BuildEquipmentPanel = [this]() -> TSharedRef<SWidget>
	{
		EquipmentListBox = SNew(SVerticalBox);

		return SAssignNew(EquipmentPanel, SBorder)
			.Padding(12.f)
			.BorderBackgroundColor(FLinearColor(0.1f, 0.1f, 0.15f, 0.9f))
			.Visibility(EVisibility::Collapsed)
			[
				SNew(SBox)
				.WidthOverride(250.f)
				.HeightOverride(300.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 8.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Equipment")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 16))
						.ColorAndOpacity(FLinearColor(0.3f, 0.8f, 1.f))
					]
					+ SVerticalBox::Slot()
					.FillHeight(1.f)
					[
						EquipmentListBox.ToSharedRef()
					]
				]
			];
	};

	// --- 스킬 패널 (데이터 기반) ---
	auto BuildSkillsPanel = [this]() -> TSharedRef<SWidget>
	{
		SkillListBox = SNew(SVerticalBox);

		return SAssignNew(SkillsPanel, SBorder)
			.Padding(12.f)
			.BorderBackgroundColor(FLinearColor(0.1f, 0.1f, 0.15f, 0.9f))
			.Visibility(EVisibility::Collapsed)
			[
				SNew(SBox)
				.WidthOverride(280.f)
				.HeightOverride(350.f)
				[
					SNew(SVerticalBox)
					+ SVerticalBox::Slot()
					.AutoHeight()
					.Padding(0.f, 0.f, 0.f, 8.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Action Slots")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 16))
						.ColorAndOpacity(FLinearColor(1.f, 0.4f, 0.4f))
					]
					+ SVerticalBox::Slot()
					.FillHeight(1.f)
					[
						SkillListBox.ToSharedRef()
					]
				]
			];
	};

	// --- 메인 레이아웃 ---
	ChildSlot
	[
		SNew(SOverlay)

		// 상단 상태 바 (Subject / Command / Target)
		+ SOverlay::Slot()
		.HAlign(HAlign_Center)
		.VAlign(VAlign_Top)
		.Padding(0.f, 8.f, 0.f, 0.f)
		[
			SNew(SBorder)
			.Padding(FMargin(12.f, 6.f))
			.BorderBackgroundColor(FLinearColor(0.05f, 0.05f, 0.1f, 0.8f))
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.f, 0.f)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Subject: ")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
						.ColorAndOpacity(FLinearColor(0.6f, 0.6f, 0.6f))
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SAssignNew(SubjectText, STextBlock)
						.Text(FText::FromString(TEXT("None")))
						.Font(FCoreStyle::GetDefaultFontStyle("Regular", 11))
						.ColorAndOpacity(FLinearColor(0.2f, 0.8f, 1.f))
					]
				]
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(16.f, 0.f, 4.f, 0.f)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Command: ")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
						.ColorAndOpacity(FLinearColor(0.6f, 0.6f, 0.6f))
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SAssignNew(CommandText, STextBlock)
						.Text(FText::FromString(TEXT("None")))
						.Font(FCoreStyle::GetDefaultFontStyle("Regular", 11))
						.ColorAndOpacity(FLinearColor(1.f, 0.8f, 0.3f))
					]
				]
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(16.f, 0.f, 4.f, 0.f)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(STextBlock)
						.Text(FText::FromString(TEXT("Target: ")))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 11))
						.ColorAndOpacity(FLinearColor(0.6f, 0.6f, 0.6f))
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SAssignNew(TargetText, STextBlock)
						.Text(FText::FromString(TEXT("None")))
						.Font(FCoreStyle::GetDefaultFontStyle("Regular", 11))
						.ColorAndOpacity(FLinearColor(1.f, 0.4f, 0.4f))
					]
				]
			]
		]

		// 패널들 (하단 바 위)
		+ SOverlay::Slot()
		.HAlign(HAlign_Left)
		.VAlign(VAlign_Bottom)
		.Padding(10.f, 0.f, 0.f, 50.f)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(2.f) [ BuildInventoryPanel() ]
			+ SHorizontalBox::Slot().AutoWidth().Padding(2.f) [ BuildEquipmentPanel() ]
			+ SHorizontalBox::Slot().AutoWidth().Padding(2.f) [ BuildSkillsPanel() ]
		]

		// 시스템 메시지 (하단 버튼 바 위, 클릭 투과)
		+ SOverlay::Slot()
		.HAlign(HAlign_Center)
		.VAlign(VAlign_Bottom)
		.Padding(0.f, 0.f, 0.f, 50.f)
		[
			SAssignNew(SystemMessageBox, SVerticalBox)
			.Visibility(EVisibility::SelfHitTestInvisible)
		]

		// 하단 버튼 바
		+ SOverlay::Slot()
		.HAlign(HAlign_Center)
		.VAlign(VAlign_Bottom)
		.Padding(0.f, 0.f, 0.f, 5.f)
		[
			SNew(SBorder)
			.Padding(FMargin(8.f, 4.f))
			.BorderBackgroundColor(FLinearColor(0.08f, 0.08f, 0.12f, 0.85f))
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.f)
				[
					SNew(SBox).WidthOverride(100.f).HeightOverride(32.f)
					[
						SNew(SButton)
						.HAlign(HAlign_Center).VAlign(VAlign_Center)
						.OnClicked(this, &SHktIngameHudWidget::OnInventoryClicked)
						[ SNew(STextBlock).Text(FText::FromString(TEXT("Inventory"))) ]
					]
				]
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.f)
				[
					SNew(SBox).WidthOverride(100.f).HeightOverride(32.f)
					[
						SNew(SButton)
						.HAlign(HAlign_Center).VAlign(VAlign_Center)
						.OnClicked(this, &SHktIngameHudWidget::OnEquipmentClicked)
						[ SNew(STextBlock).Text(FText::FromString(TEXT("Equipment"))) ]
					]
				]
				+ SHorizontalBox::Slot()
				.AutoWidth()
				.Padding(4.f)
				[
					SNew(SBox).WidthOverride(100.f).HeightOverride(32.f)
					[
						SNew(SButton)
						.HAlign(HAlign_Center).VAlign(VAlign_Center)
						.OnClicked(this, &SHktIngameHudWidget::OnSkillsClicked)
						[ SNew(STextBlock).Text(FText::FromString(TEXT("Skills"))) ]
					]
				]
			]
		]
	];
}

inline void SHktIngameHudWidget::SetOwningPlayerController(APlayerController* InPC)
{
	CachedPC = InPC;

	// 기존 시스템 메시지 구독 해제
	UnsubscribeSystemMessage();

	// 시스템 메시지 구독
	if (InPC)
	{
		if (UWorld* World = InPC->GetWorld())
		{
			CachedWorld = World;
			SystemMessageHandle = HktRule::GetSystemMessageDelegate(World).AddLambda(
				[this](const FString& Msg)
				{
					AddSystemMessage(Msg);
				});
		}
	}

	// 슬롯 바인딩 변경 구독 (아이템 상태 변화 시 모든 패널 갱신)
	if (InPC)
	{
		if (IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(InPC))
		{
			SlotBindingHandle = Interaction->OnSlotBindingChanged().AddLambda([this](int32 /*SlotIndex*/)
			{
				RefreshEquipmentPanel();
				RefreshSkillsPanel();
			});

			BagChangedHandle = Interaction->OnBagChanged().AddLambda([this](const FHktBagDelta& /*Delta*/)
			{
				RefreshInventoryPanel();
			});

			SubjectChangedHandle = Interaction->OnSubjectChanged().AddLambda([this](FHktEntityId EntityId)
			{
				CachedSubjectEntityId = EntityId;
				UpdateSubjectDisplay(EntityId);
				RefreshEquipmentPanel();
				RefreshSkillsPanel();
			});

			TargetChangedHandle = Interaction->OnTargetChanged().AddLambda([this](FHktEntityId EntityId)
			{
				UpdateTargetDisplay(EntityId);
			});

			CommandChangedHandle = Interaction->OnCommandChanged().AddLambda([this](FGameplayTag EventTag)
			{
				UpdateCommandDisplay(EventTag);
			});

			Interaction->OnIntentSubmitted().AddLambda([this](const FHktRuntimeEvent& Event)
			{
				// 마지막 제출된 커맨드/타겟 정보를 유지하여 표시
				UpdateCommandDisplay(Event.Value.EventTag);
				UpdateTargetDisplay(Event.Value.TargetEntity);
			});
		}
	}
}

// ============================================================================
// 상태 바 업데이트
// ============================================================================

inline void SHktIngameHudWidget::UpdateSubjectDisplay(FHktEntityId EntityId)
{
	if (!SubjectText.IsValid()) return;

	if (EntityId == InvalidEntityId)
	{
		SubjectText->SetText(FText::FromString(TEXT("None")));
		return;
	}

	APlayerController* PC = CachedPC.Get();
	if (!PC) return;

	IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC);
	if (!Interaction) return;

	const FHktWorldState* WS = nullptr;
	if (Interaction->GetWorldState(WS) && WS && WS->IsValidEntity(EntityId))
	{
		SubjectText->SetText(FText::FromString(
			FString::Printf(TEXT("%s (#%d)"), *GetEntityDisplayName(WS, EntityId), EntityId)));
	}
	else
	{
		SubjectText->SetText(FText::FromString(FString::Printf(TEXT("#%d"), EntityId)));
	}
}

inline void SHktIngameHudWidget::UpdateTargetDisplay(FHktEntityId EntityId)
{
	if (!TargetText.IsValid()) return;

	if (EntityId == InvalidEntityId)
	{
		TargetText->SetText(FText::FromString(TEXT("None")));
		return;
	}

	APlayerController* PC = CachedPC.Get();
	if (!PC) return;

	IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC);
	if (!Interaction) return;

	const FHktWorldState* WS = nullptr;
	if (Interaction->GetWorldState(WS) && WS && WS->IsValidEntity(EntityId))
	{
		TargetText->SetText(FText::FromString(
			FString::Printf(TEXT("%s (#%d)"), *GetEntityDisplayName(WS, EntityId), EntityId)));
	}
	else
	{
		TargetText->SetText(FText::FromString(FString::Printf(TEXT("#%d"), EntityId)));
	}
}

inline void SHktIngameHudWidget::UpdateCommandDisplay(FGameplayTag EventTag)
{
	if (!CommandText.IsValid()) return;

	if (!EventTag.IsValid())
	{
		CommandText->SetText(FText::FromString(TEXT("None")));
		return;
	}

	FString TagStr = EventTag.ToString();
	int32 DotIdx;
	if (TagStr.FindLastChar(TEXT('.'), DotIdx))
	{
		TagStr = TagStr.Mid(DotIdx + 1);
	}
	CommandText->SetText(FText::FromString(TagStr));
}

// ============================================================================
// Helper: EntitySpawnTag → display name
// ============================================================================
inline FString SHktIngameHudWidget::GetEntityDisplayName(const FHktWorldState* WS, FHktEntityId Id)
{
	int32 SpawnTagIdx = WS->GetProperty(Id, PropertyId::EntitySpawnTag);
	if (SpawnTagIdx > 0)
	{
		FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(static_cast<FGameplayTagNetIndex>(SpawnTagIdx));
		if (!TagName.IsNone())
		{
			FString Name = TagName.ToString();
			int32 DotIdx;
			if (Name.FindLastChar(TEXT('.'), DotIdx))
			{
				Name = Name.Mid(DotIdx + 1);
			}
			return Name;
		}
	}
	return FString::Printf(TEXT("Item#%d"), WS->GetProperty(Id, PropertyId::ItemId));
}

// EquipSlot PropertyId는 HktTrait::GetEquipSlotPropertyIds()에서 가져옴

// ============================================================================
// Inventory 패널 (가방에 보관된 아이템 — BagComponent)
// ============================================================================
inline void SHktIngameHudWidget::RefreshInventoryPanel()
{
	if (!InventoryListBox.IsValid()) return;
	InventoryListBox->ClearChildren();

	APlayerController* PC = CachedPC.Get();
	if (!PC) return;

	IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC);
	if (!Interaction) return;

	// 가방 상태 조회
	const FHktBagState* BagState = Interaction->GetBagState();
	if (!BagState || BagState->Items.Num() == 0)
	{
		InventoryListBox->AddSlot()
		.AutoHeight().Padding(0.f, 4.f)
		[
			SNew(STextBlock)
			.Text(FText::FromString(TEXT("Bag is empty")))
			.ColorAndOpacity(FLinearColor(0.5f, 0.5f, 0.5f))
		];
		return;
	}

	// Subject 엔티티의 EquipSlot0~8에서 사용 중인 슬롯 수집
	const FHktWorldState* WS = nullptr;
	TSet<int32> UsedSlots;
	if (Interaction->GetWorldState(WS) && WS
		&& CachedSubjectEntityId != InvalidEntityId
		&& WS->IsValidEntity(CachedSubjectEntityId))
	{
		for (int32 i = 0; i < HktTrait::GetEquipSlotPropertyIds().Num(); ++i)
		{
			if (WS->GetProperty(CachedSubjectEntityId, HktTrait::GetEquipSlotPropertyIds()[i]) != 0)
				UsedSlots.Add(i);
		}
	}

	// 빈 EquipIndex 찾기 함수
	auto FindNextFreeSlot = [&UsedSlots]() -> int32
	{
		for (int32 S = 0; S < 9; ++S)
		{
			if (!UsedSlots.Contains(S)) return S;
		}
		return 0;
	};

	// 가방 아이템을 슬롯 순으로 정렬하여 표시
	TArray<FHktBagItem> SortedItems = BagState->Items;
	SortedItems.Sort([](const FHktBagItem& A, const FHktBagItem& B) { return A.BagSlot < B.BagSlot; });

	for (const FHktBagItem& Item : SortedItems)
	{
		const int32 BagSlot = Item.BagSlot;
		const int32 NextSlot = FindNextFreeSlot();

		// ItemId로 표시 이름 생성
		FString ItemName = FString::Printf(TEXT("Item #%d"), Item.ItemId);
		if (Item.EntitySpawnTag > 0)
		{
			FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(
				static_cast<FGameplayTagNetIndex>(Item.EntitySpawnTag));
			if (!TagName.IsNone()) ItemName = TagName.ToString();
		}
		if (Item.Equippable != 0)
		{
			ItemName += TEXT(" [E]");
		}

		InventoryListBox->AddSlot()
		.AutoHeight().Padding(0.f, 2.f)
		[
			SNew(SButton)
			.ButtonStyle(FCoreStyle::Get(), "NoBorder")
			.OnClicked_Lambda([this, BagSlot, NextSlot]() -> FReply
			{
				if (APlayerController* PC = CachedPC.Get())
				{
					if (IHktPlayerInteractionInterface* I = Cast<IHktPlayerInteractionInterface>(PC))
					{
						I->RequestBagRestore(BagSlot, NextSlot);
					}
				}
				return FReply::Handled();
			})
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(0.f, 0.f, 8.f, 0.f)
				[
					SNew(SBox).WidthOverride(30.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(FString::Printf(TEXT("[%d]"), BagSlot)))
						.ColorAndOpacity(FLinearColor(0.6f, 0.6f, 0.6f))
					]
				]
				+ SHorizontalBox::Slot().FillWidth(1.f)
				[
					SNew(STextBlock)
					.Text(FText::FromString(ItemName))
					.ColorAndOpacity(FLinearColor::White)
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(STextBlock)
					.Text(FText::FromString(Item.AttackPower > 0 ? FString::Printf(TEXT("ATK %d"), Item.AttackPower) : TEXT("")))
					.ColorAndOpacity(FLinearColor(1.f, 0.6f, 0.3f))
				]
			]
		];
	}
}

// ============================================================================
// Equipment 패널 (선택된 엔티티의 EquipSlot0~8 직접 읽기)
// ============================================================================

inline void SHktIngameHudWidget::RefreshEquipmentPanel()
{
	if (!EquipmentListBox.IsValid()) return;
	EquipmentListBox->ClearChildren();

	APlayerController* PC = CachedPC.Get();
	if (!PC) return;

	IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC);
	if (!Interaction) return;

	const FHktWorldState* WS = nullptr;
	if (!Interaction->GetWorldState(WS) || !WS) return;
	if (CachedSubjectEntityId == InvalidEntityId || !WS->IsValidEntity(CachedSubjectEntityId)) return;

	// Subject 엔티티의 EquipSlot0~8을 직접 읽어 장착 아이템 표시
	struct FEquipItem { FHktEntityId EntityId; int32 EquipIndex; FString Name; int32 AttackPower; bool bEquippable; };
	TArray<FEquipItem> Items;

	for (int32 i = 0; i < HktTrait::GetEquipSlotPropertyIds().Num(); ++i)
	{
		const FHktEntityId ItemId = WS->GetProperty(CachedSubjectEntityId, HktTrait::GetEquipSlotPropertyIds()[i]);
		if (ItemId == 0 || !WS->IsValidEntity(ItemId))
			continue;

		Items.Add({
			ItemId,
			i,
			GetEntityDisplayName(WS, ItemId),
			WS->GetProperty(ItemId, PropertyId::AttackPower),
			WS->GetProperty(ItemId, PropertyId::Equippable) != 0
		});
	}

	if (Items.Num() == 0)
	{
		EquipmentListBox->AddSlot()
		.AutoHeight().Padding(0.f, 4.f)
		[
			SNew(STextBlock)
			.Text(FText::FromString(TEXT("Nothing equipped")))
			.ColorAndOpacity(FLinearColor(0.5f, 0.5f, 0.5f))
		];
		return;
	}

	for (const FEquipItem& Item : Items)
	{
		FString SlotLabel = FString::Printf(TEXT("Slot %d%s"), Item.EquipIndex, Item.bEquippable ? TEXT(" [E]") : TEXT(""));
		const int32 ItemEquipIndex = Item.EquipIndex;

		EquipmentListBox->AddSlot()
		.AutoHeight().Padding(0.f, 2.f)
		[
			SNew(SButton)
			.ButtonStyle(FCoreStyle::Get(), "NoBorder")
			.OnClicked_Lambda([this, ItemEquipIndex]() -> FReply
			{
				if (APlayerController* PC = CachedPC.Get())
				{
					if (IHktPlayerInteractionInterface* I = Cast<IHktPlayerInteractionInterface>(PC))
					{
						I->RequestBagStore(ItemEquipIndex);
					}
				}
				return FReply::Handled();
			})
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(0.f, 0.f, 8.f, 0.f)
				[
					SNew(SBox).WidthOverride(80.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(SlotLabel))
						.ColorAndOpacity(Item.bEquippable ? FLinearColor(0.3f, 1.f, 0.5f) : FLinearColor(0.5f, 0.8f, 1.f))
					]
				]
				+ SHorizontalBox::Slot().FillWidth(1.f)
				[
					SNew(STextBlock)
					.Text(FText::FromString(Item.Name))
					.ColorAndOpacity(FLinearColor::White)
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(STextBlock)
					.Text(FText::FromString(Item.AttackPower > 0 ? FString::Printf(TEXT("ATK %d"), Item.AttackPower) : TEXT("")))
					.ColorAndOpacity(FLinearColor(1.f, 0.6f, 0.3f))
				]
			]
		];
	}
}

// ============================================================================
// Skills 패널 (액션 슬롯 바인딩)
// ============================================================================
inline void SHktIngameHudWidget::RefreshSkillsPanel()
{
	if (!SkillListBox.IsValid()) return;
	SkillListBox->ClearChildren();

	APlayerController* PC = CachedPC.Get();
	if (!PC) return;

	IHktPlayerInteractionInterface* Interaction = Cast<IHktPlayerInteractionInterface>(PC);
	if (!Interaction) return;

	const FHktWorldState* WS = nullptr;
	if (!Interaction->GetWorldState(WS) || !WS) return;
	if (CachedSubjectEntityId == InvalidEntityId || !WS->IsValidEntity(CachedSubjectEntityId)) return;

	// Subject 엔티티의 EquipSlot0~8에서 스킬 정보 수집
	struct FHktSlotInfo
	{
		int32 EquipIndex;
		FGameplayTag SkillTag;
		int32 CPCost;
		int32 RecoveryFrame;
	};
	TArray<FHktSlotInfo> SlotInfos;

	for (int32 i = 0; i < HktTrait::GetEquipSlotPropertyIds().Num(); ++i)
	{
		const FHktEntityId ItemId = WS->GetProperty(CachedSubjectEntityId, HktTrait::GetEquipSlotPropertyIds()[i]);
		if (ItemId == 0 || !WS->IsValidEntity(ItemId))
			continue;

		int32 SkillNetIdx = WS->GetProperty(ItemId, PropertyId::ItemSkillTag);
		FGameplayTag SkillTag;
		if (SkillNetIdx > 0)
		{
			FName TagName = UGameplayTagsManager::Get().GetTagNameFromNetIndex(static_cast<FGameplayTagNetIndex>(SkillNetIdx));
			if (!TagName.IsNone())
			{
				SkillTag = FGameplayTag::RequestGameplayTag(TagName, false);
			}
		}

		SlotInfos.Add({
			i,
			SkillTag,
			WS->GetProperty(ItemId, PropertyId::SkillCPCost),
			WS->GetProperty(ItemId, PropertyId::RecoveryFrame)
		});
	}

	// EquipIndex 순으로 정렬
	SlotInfos.Sort([](const FHktSlotInfo& A, const FHktSlotInfo& B) { return A.EquipIndex < B.EquipIndex; });

	if (SlotInfos.Num() == 0)
	{
		SkillListBox->AddSlot()
		.AutoHeight()
		.Padding(0.f, 4.f)
		[
			SNew(STextBlock)
			.Text(FText::FromString(TEXT("No active item skills")))
			.ColorAndOpacity(FLinearColor(0.5f, 0.5f, 0.5f))
		];
		return;
	}

	for (const FHktSlotInfo& Info : SlotInfos)
	{
		FString SkillName = Info.SkillTag.IsValid() ? Info.SkillTag.ToString() : TEXT("Unknown");
		// 태그 이름에서 마지막 세그먼트만 표시 (예: "Story.Event.Skill.WoodenSwordSlash" → "WoodenSwordSlash")
		int32 DotIdx;
		if (SkillName.FindLastChar('.', DotIdx))
		{
			SkillName = SkillName.Mid(DotIdx + 1);
		}

		SkillListBox->AddSlot()
		.AutoHeight()
		.Padding(0.f, 4.f)
		[
			SNew(SBorder)
			.Padding(8.f)
			.BorderBackgroundColor(FLinearColor(0.15f, 0.15f, 0.2f, 0.8f))
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0.f, 0.f, 8.f, 0.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(FString::Printf(TEXT("[%d]"), Info.EquipIndex)))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 12))
						.ColorAndOpacity(FLinearColor(0.5f, 0.8f, 1.f))
					]
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(SkillName))
						.Font(FCoreStyle::GetDefaultFontStyle("Bold", 12))
						.ColorAndOpacity(FLinearColor(1.f, 0.8f, 0.3f))
					]
				]
				+ SVerticalBox::Slot().AutoHeight()
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[
						SNew(STextBlock)
						.Text(FText::FromString(FString::Printf(TEXT("CP: %d"), Info.CPCost)))
						.ColorAndOpacity(FLinearColor(0.3f, 0.7f, 1.f))
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(STextBlock)
						.Text(FText::FromString(FString::Printf(TEXT("CD: %d frames"), Info.RecoveryFrame)))
						.ColorAndOpacity(FLinearColor(0.5f, 0.5f, 0.5f))
					]
				]
			]
		];
	}
}

inline FReply SHktIngameHudWidget::OnInventoryClicked()
{
	TogglePanel(0);
	if (ActivePanel == 0) { RefreshInventoryPanel(); }
	return FReply::Handled();
}
inline FReply SHktIngameHudWidget::OnEquipmentClicked()
{
	TogglePanel(1);
	if (ActivePanel == 1) { RefreshEquipmentPanel(); }
	return FReply::Handled();
}
inline FReply SHktIngameHudWidget::OnSkillsClicked()
{
	TogglePanel(2);
	// 스킬 패널 열 때 최신 데이터로 갱신
	if (ActivePanel == 2)
	{
		RefreshSkillsPanel();
	}
	return FReply::Handled();
}

// ============================================================================
// 시스템 메시지
// ============================================================================

inline SHktIngameHudWidget::~SHktIngameHudWidget()
{
	UnsubscribeSystemMessage();
}

inline void SHktIngameHudWidget::UnsubscribeSystemMessage()
{
	if (SystemMessageHandle.IsValid() && CachedWorld.IsValid())
	{
		HktRule::GetSystemMessageDelegate(CachedWorld.Get()).Remove(SystemMessageHandle);
		SystemMessageHandle.Reset();
	}
}

inline void SHktIngameHudWidget::AddSystemMessage(const FString& Message)
{
	if (!SystemMessageBox.IsValid()) return;

	// 최대 3개 — 초과 시 oldest 제거
	while (ActiveSystemMessages.Num() >= 3)
	{
		if (ActiveSystemMessages[0].Widget.IsValid())
		{
			SystemMessageBox->RemoveSlot(ActiveSystemMessages[0].Widget.ToSharedRef());
		}
		ActiveSystemMessages.RemoveAt(0);
	}

	TSharedPtr<SBorder> MessageWidget;
	SystemMessageBox->AddSlot()
	.AutoHeight()
	.Padding(0.f, 2.f)
	[
		SAssignNew(MessageWidget, SBorder)
		.Padding(FMargin(12.f, 6.f))
		.BorderBackgroundColor(FLinearColor(0.8f, 0.2f, 0.1f, 0.75f))
		[
			SNew(STextBlock)
			.Text(FText::FromString(Message))
			.Font(FCoreStyle::GetDefaultFontStyle("Bold", 12))
			.ColorAndOpacity(FLinearColor::White)
		]
	];

	ActiveSystemMessages.Add({ MessageWidget, FPlatformTime::Seconds() + 3.0 });
}

inline void SHktIngameHudWidget::Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime)
{
	SCompoundWidget::Tick(AllottedGeometry, InCurrentTime, InDeltaTime);

	if (ActiveSystemMessages.Num() == 0) return;

	const double Now = FPlatformTime::Seconds();
	for (int32 i = ActiveSystemMessages.Num() - 1; i >= 0; --i)
	{
		if (Now >= ActiveSystemMessages[i].ExpireTime)
		{
			if (ActiveSystemMessages[i].Widget.IsValid() && SystemMessageBox.IsValid())
			{
				SystemMessageBox->RemoveSlot(ActiveSystemMessages[i].Widget.ToSharedRef());
			}
			ActiveSystemMessages.RemoveAt(i);
		}
	}
}

inline void SHktIngameHudWidget::TogglePanel(int32 PanelIndex)
{
	TSharedPtr<SBorder> Panels[] = { InventoryPanel, EquipmentPanel, SkillsPanel };

	if (ActivePanel == PanelIndex)
	{
		// 같은 버튼 → 닫기
		if (Panels[PanelIndex].IsValid())
		{
			Panels[PanelIndex]->SetVisibility(EVisibility::Collapsed);
		}
		ActivePanel = -1;
	}
	else
	{
		// 기존 패널 닫기
		for (int32 i = 0; i < 3; ++i)
		{
			if (Panels[i].IsValid())
			{
				Panels[i]->SetVisibility(EVisibility::Collapsed);
			}
		}
		// 새 패널 열기
		if (Panels[PanelIndex].IsValid())
		{
			Panels[PanelIndex]->SetVisibility(EVisibility::Visible);
		}
		ActivePanel = PanelIndex;
	}
}
