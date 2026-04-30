// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktAnimCapturePanel.h"

#include "HktAnimCaptureFunctionLibrary.h"
#include "HktAnimCapturePanelConfig.h"
#include "HktAnimCaptureScene.h"

#include "Animation/AnimSequence.h"
#include "AssetRegistry/AssetData.h"
#include "Camera/CameraTypes.h"
#include "Camera/HktCameraModeBase.h"
#include "DesktopPlatformModule.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/TextureRenderTarget2D.h"
#include "Framework/Application/SlateApplication.h"
#include "IDesktopPlatform.h"
#include "IDetailsView.h"
#include "Modules/ModuleManager.h"
#include "PropertyCustomizationHelpers.h"
#include "PropertyEditorModule.h"
#include "ThumbnailRendering/ThumbnailManager.h"
#include "Widgets/Colors/SColorBlock.h"
#include "Widgets/Colors/SColorPicker.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SComboBox.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Notifications/SProgressBar.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktAnimCapture"

namespace HktAnimCapturePanelPrivate
{
	static TSharedRef<SWidget> MakeRow(const FText& Label, TSharedRef<SWidget> Field)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
			[ SNew(STextBlock).Text(Label).MinDesiredWidth(150.f) ]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[ Field ];
	}

	static const TArray<TSharedPtr<EHktAnimCaptureCameraPreset>>& GetPresetOptions()
	{
		static TArray<TSharedPtr<EHktAnimCaptureCameraPreset>> Options;
		if (Options.Num() == 0)
		{
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::RtsView));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::ShoulderView));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::IsometricOrtho));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::IsometricGame));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::Custom));
		}
		return Options;
	}

	static FText PresetToText(EHktAnimCaptureCameraPreset Preset)
	{
		switch (Preset)
		{
		case EHktAnimCaptureCameraPreset::RtsView:        return LOCTEXT("Preset_Rts",   "RTS View");
		case EHktAnimCaptureCameraPreset::ShoulderView:   return LOCTEXT("Preset_Sh",    "Shoulder View");
		case EHktAnimCaptureCameraPreset::IsometricOrtho: return LOCTEXT("Preset_IsoO",  "Isometric Ortho");
		case EHktAnimCaptureCameraPreset::IsometricGame:  return LOCTEXT("Preset_IsoG",  "Isometric Game");
		case EHktAnimCaptureCameraPreset::Custom:         return LOCTEXT("Preset_Cust",  "Custom");
		}
		return FText::GetEmpty();
	}

	static FText IntText(int32 V) { return FText::AsNumber(V); }
	static FText FloatText(float V) { return FText::FromString(FString::SanitizeFloat(V)); }
}

void SHktAnimCapturePanel::Construct(const FArguments& InArgs)
{
	using namespace HktAnimCapturePanelPrivate;

	// 프리뷰 브러시 초기화 — RT 가 생성된 후 SetResourceObject 로 연결한다.
	PreviewBrush = MakeShared<FSlateBrush>();
	PreviewBrush->ImageSize = FVector2D(512.f, 512.f);
	PreviewBrush->DrawAs = ESlateBrushDrawType::Image;

	// 디폴트 설정 적용 (IsometricOrtho).
	Settings.NumDirections = 8;
	Settings.OutputWidth = 256;
	Settings.OutputHeight = 256;
	Settings.CaptureFPS = 10.0f;
	Settings.PixelToWorld = 2.0f;
	Settings.FrameDurationMs = 100.0f;
	Settings.bLooping = true;
	Settings.bAutoBuildAtlas = true;
	Settings.bTransparentBackground = true;
	ApplyPresetToCustomFields(Settings.CameraPreset);

	// 영구 저장된 마지막 세팅이 있으면 덮어쓴다 — 디폴트는 위에서 채워두었기에
	// 새 사용자(저장 파일 없음) 도 안전하게 동작.
	LoadPersistedSettings();

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 13);

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SScrollBox)

			+ SScrollBox::Slot()
			[
				SNew(SVerticalBox)

				// === 헤더 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock).Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
					.Text(LOCTEXT("Title", "HKT Animation Capture"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock).Text(LOCTEXT("Hint",
						"SkeletalMesh + AnimSequence 를 8(또는 1·4)방향에서 캡처하여 PNG 시퀀스로 저장. "
						"옵션으로 즉시 Sprite Atlas DataAsset 까지 생성."))
					.AutoWrapText(true)
				]

				// === 모델 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("MeshLbl", "Skeletal Mesh"),
					SNew(SObjectPropertyEntryBox)
						.AllowedClass(USkeletalMesh::StaticClass())
						.ObjectPath(this, &SHktAnimCapturePanel::GetSkeletalMeshPath)
						.OnObjectChanged(this, &SHktAnimCapturePanel::OnSkeletalMeshChanged)
						.AllowClear(true)
						.DisplayUseSelected(true)
						.DisplayBrowse(true)
						.DisplayThumbnail(true)
						.ThumbnailPool(UThumbnailManager::Get().GetSharedThumbnailPool())
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("AnimLbl", "Anim Sequence"),
					SNew(SObjectPropertyEntryBox)
						.AllowedClass(UAnimSequence::StaticClass())
						.ObjectPath(this, &SHktAnimCapturePanel::GetAnimSequencePath)
						.OnObjectChanged(this, &SHktAnimCapturePanel::OnAnimSequenceChanged)
						.AllowClear(true)
						.DisplayUseSelected(true)
						.DisplayBrowse(true)
						.DisplayThumbnail(true)
						.ThumbnailPool(UThumbnailManager::Get().GetSharedThumbnailPool())
				) ]

				// === 식별 (UE 표준 GameplayTag 피커) ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					[&]() -> TSharedRef<SWidget>
					{
						// 패널 라이프타임 동안 유지되는 태그 holder 를 만들고 Settings 의 현재 값으로 동기화.
						TagHolder = TStrongObjectPtr<UHktAnimCaptureTagHolder>(
							NewObject<UHktAnimCaptureTagHolder>(GetTransientPackage()));
						TagHolder->CharacterTag = Settings.CharacterTag;
						TagHolder->AnimTag      = Settings.AnimTag;

						// IDetailsView 는 holder 의 모든 UPROPERTY(EditAnywhere) 를 자동으로 그리며,
						// FGameplayTag 는 GameplayTagsEditor 가 등록한 PropertyTypeCustomization 으로
						// UE 표준 태그 피커(트리/검색/신규 추가) 가 자동 적용된다.
						FPropertyEditorModule& PEM = FModuleManager::LoadModuleChecked<FPropertyEditorModule>(TEXT("PropertyEditor"));
						FDetailsViewArgs Args;
						Args.NameAreaSettings = FDetailsViewArgs::HideNameArea;
						Args.bAllowSearch = false;
						Args.bShowOptions = false;
						Args.bShowScrollBar = false;
						Args.bHideSelectionTip = true;
						Args.bLockable = false;
						Args.bUpdatesFromSelection = false;
						TSharedRef<IDetailsView> DetailsView = PEM.CreateDetailView(Args);
						DetailsView->SetObject(TagHolder.Get());
						DetailsView->OnFinishedChangingProperties().AddSP(
							this, &SHktAnimCapturePanel::OnTagHolderPropertyChanged);
						return DetailsView;
					}()
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("ActionLbl", "Action Id (file prefix, optional)"),
					SAssignNew(ActionIdBox, SEditableTextBox)
						.Text(FText::FromString(Settings.ActionId))
						.HintText(LOCTEXT("ActionHint", "비워두면 AnimTag 의 leaf 자동 사용"))
						.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })
				) ]

				// === 카메라 프리셋 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("CameraSec", "Camera"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("CamModeLbl", "Camera Mode Class"),
					SNew(SClassPropertyEntryBox)
						.MetaClass(UHktCameraModeBase::StaticClass())
						.SelectedClass(this, &SHktAnimCapturePanel::GetCameraModeClass)
						.OnSetClass(this, &SHktAnimCapturePanel::OnCameraModeClassChanged)
						.AllowAbstract(false)
						.AllowNone(true)
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,2,0,4)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("CamModeHint",
						"네이티브 클래스(UHktCameraMode_*) 또는 그로부터 파생된 BP 클래스를 선택. "
						"CDO 의 Framing(Projection/FOV/OrthoWidth/Pitch/ArmLength/SocketOffset)이 SceneCapture 에 적용됨. "
						"미지정 시 아래 프리셋/Custom 값 사용."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("PresetLbl", "Camera Preset"),
					SNew(SComboBox<TSharedPtr<EHktAnimCaptureCameraPreset>>)
						.OptionsSource(&GetPresetOptions())
						.OnGenerateWidget_Lambda([](TSharedPtr<EHktAnimCaptureCameraPreset> P)
						{
							return SNew(STextBlock).Text(PresetToText(*P));
						})
						.OnSelectionChanged_Lambda([this](TSharedPtr<EHktAnimCaptureCameraPreset> P, ESelectInfo::Type)
						{
							if (P.IsValid())
							{
								Settings.CameraPreset = *P;
								ApplyPresetToCustomFields(*P);
								if (PitchBox.IsValid())      PitchBox->SetText(FloatText(Settings.Pitch));
								if (FovBox.IsValid())        FovBox->SetText(FloatText(Settings.FieldOfView));
								if (OrthoWidthBox.IsValid()) OrthoWidthBox->SetText(FloatText(Settings.OrthoWidth));
								if (ArmLengthBox.IsValid())  ArmLengthBox->SetText(FloatText(Settings.ArmLength));
								// 텍스트 갱신 후 즉시 카메라 적용 — 프리뷰 라이브 갱신.
								ApplyCameraFromUI();
							}
						})
						.InitiallySelectedItem(GetPresetOptions()[2])  // IsoOrtho
						[
							SNew(STextBlock)
							.Text_Lambda([this]() { return PresetToText(Settings.CameraPreset); })
						]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("PitchLbl", "Pitch (deg)"),
						SAssignNew(PitchBox, SEditableTextBox)
							.Text(FloatText(Settings.Pitch))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyCameraFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("YawOffLbl", "Yaw Offset (deg)"),
						SAssignNew(YawOffsetBox, SEditableTextBox)
							.Text(FloatText(Settings.YawOffset))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyCameraFromUI(); })) ]
					+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("FovLbl", "FOV (Persp)"),
						SAssignNew(FovBox, SEditableTextBox)
							.Text(FloatText(Settings.FieldOfView))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyCameraFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("OrthoLbl", "Ortho Width"),
						SAssignNew(OrthoWidthBox, SEditableTextBox)
							.Text(FloatText(Settings.OrthoWidth))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyCameraFromUI(); })) ]
					+ SUniformGridPanel::Slot(0,2)[ MakeRow(LOCTEXT("ArmLbl", "Arm Length"),
						SAssignNew(ArmLengthBox, SEditableTextBox)
							.Text(FloatText(Settings.ArmLength))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyCameraFromUI(); })) ]
				]

				// === Preview ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("PreviewSec", "Preview"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,2,0,4)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("PreviewHint",
						"Refresh Preview 로 현재 설정의 캡처 결과를 그대로 시뮬레이션. "
						"방향(◀ ▶)과 Play/Pause 로 애니메이션을 직접 확인."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,8,0)
					[ SNew(SButton)
						.Text(LOCTEXT("PreviewRefresh", "Refresh Preview"))
						.OnClicked(this, &SHktAnimCapturePanel::OnRefreshPreviewClicked) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,8,0)
					[ SNew(SCheckBox)
						.Style(FCoreStyle::Get(), "ToggleButtonCheckbox")
						.IsChecked_Lambda([this]() { return bPreviewPlaying ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
						.OnCheckStateChanged(this, &SHktAnimCapturePanel::OnPlayPauseChanged)
						[ SNew(SBox).Padding(FMargin(8,2))
							[ SNew(STextBlock).Text_Lambda([this]() {
								return bPreviewPlaying ? LOCTEXT("Pause", "Pause") : LOCTEXT("Play", "Play");
							}) ]
						]
					]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,4,0)
					[ SNew(SButton).Text(LOCTEXT("DirPrev", "◀"))
						.OnClicked(this, &SHktAnimCapturePanel::OnPrevDirectionClicked) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,8,0)
					[ SNew(SButton).Text(LOCTEXT("DirNext", "▶"))
						.OnClicked(this, &SHktAnimCapturePanel::OnNextDirectionClicked) ]
					+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
					[ SAssignNew(PreviewStatusText, STextBlock)
						.Text(LOCTEXT("PreviewIdle", "Preview idle. Set mesh/anim and click Refresh Preview."))
						.ColorAndOpacity(FSlateColor::UseSubduedForeground()) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SBorder)
					.HAlign(HAlign_Center)
					.VAlign(VAlign_Center)
					.Padding(2)
					[
						SNew(SBox)
						.WidthOverride(512.f)
						.HeightOverride(512.f)
						[
							SAssignNew(PreviewImage, SImage)
						]
					]
				]

				// === Lighting ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("LightSec", "Lighting"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,2,0,4)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("LightHint",
						"기본 라이팅(키+스카이)을 그대로 두고, 추가 KeyLight/FillLight 와 SkyLight 를 더 부착할 수 있다. "
						"색상 박스를 클릭하여 컬러 피커를 연다. 변경 후 Refresh Preview 로 즉시 반영."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked_Lambda([this]() { return Settings.bUseDefaultLighting ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){
							Settings.bUseDefaultLighting = (S==ECheckBoxState::Checked);
							// FPreviewScene 의 bDefaultLighting 은 생성 시점에 박혀 있어 — 재생성 필요.
							RebuildPreviewScene();
						})
						[ SNew(STextBlock).Text(LOCTEXT("DefLightChk", "Use Default Scene Lighting")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked_Lambda([this]() { return Settings.bEnableKeyLight ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){
							Settings.bEnableKeyLight = (S==ECheckBoxState::Checked);
							ApplyLightingFromUI();
						})
						[ SNew(STextBlock).Text(LOCTEXT("KeyLightChk", "Add Key Light")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(SCheckBox)
						.IsChecked_Lambda([this]() { return Settings.bEnableFillLight ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){
							Settings.bEnableFillLight = (S==ECheckBoxState::Checked);
							ApplyLightingFromUI();
						})
						[ SNew(STextBlock).Text(LOCTEXT("FillLightChk", "Add Fill Light")) ]
					]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("KLIntLbl", "Key Light Intensity"),
						SAssignNew(KeyLightIntensityBox, SEditableTextBox)
							.Text(FloatText(Settings.KeyLightIntensity))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("KLColorLbl", "Key Light Color"),
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
						[ SNew(SBox).WidthOverride(40.f).HeightOverride(20.f)
							[ SAssignNew(KeyLightColorBlock, SColorBlock)
								.Color_Lambda([this](){ return Settings.KeyLightColor; })
								.ShowBackgroundForAlpha(false)
								.OnMouseButtonDown_Lambda([this](const FGeometry&, const FPointerEvent&) -> FReply {
									return OpenColorPicker(&Settings.KeyLightColor, KeyLightColorBlock);
								})
							]
						]) ]
					+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("KLPitchLbl", "Key Light Pitch"),
						SAssignNew(KeyLightPitchBox, SEditableTextBox)
							.Text(FloatText(Settings.KeyLightRotation.Pitch))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("KLYawLbl", "Key Light Yaw"),
						SAssignNew(KeyLightYawBox, SEditableTextBox)
							.Text(FloatText(Settings.KeyLightRotation.Yaw))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]

					+ SUniformGridPanel::Slot(0,2)[ MakeRow(LOCTEXT("FLIntLbl", "Fill Light Intensity"),
						SAssignNew(FillLightIntensityBox, SEditableTextBox)
							.Text(FloatText(Settings.FillLightIntensity))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,2)[ MakeRow(LOCTEXT("FLColorLbl", "Fill Light Color"),
						SNew(SHorizontalBox)
						+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
						[ SNew(SBox).WidthOverride(40.f).HeightOverride(20.f)
							[ SAssignNew(FillLightColorBlock, SColorBlock)
								.Color_Lambda([this](){ return Settings.FillLightColor; })
								.ShowBackgroundForAlpha(false)
								.OnMouseButtonDown_Lambda([this](const FGeometry&, const FPointerEvent&) -> FReply {
									return OpenColorPicker(&Settings.FillLightColor, FillLightColorBlock);
								})
							]
						]) ]
					+ SUniformGridPanel::Slot(0,3)[ MakeRow(LOCTEXT("FLPitchLbl", "Fill Light Pitch"),
						SAssignNew(FillLightPitchBox, SEditableTextBox)
							.Text(FloatText(Settings.FillLightRotation.Pitch))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,3)[ MakeRow(LOCTEXT("FLYawLbl", "Fill Light Yaw"),
						SAssignNew(FillLightYawBox, SEditableTextBox)
							.Text(FloatText(Settings.FillLightRotation.Yaw))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]

					+ SUniformGridPanel::Slot(0,4)[ MakeRow(LOCTEXT("SkyIntLbl", "Extra SkyLight Intensity"),
						SAssignNew(SkyLightIntensityBox, SEditableTextBox)
							.Text(FloatText(Settings.ExtraSkyLightIntensity))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyLightingFromUI(); })) ]
				]

				// === 캡처 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("CapSec", "Capture"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("WLbl", "Output Width (px)"),
						SAssignNew(WidthBox, SEditableTextBox)
							.Text(IntText(Settings.OutputWidth))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("HLbl", "Output Height (px)"),
						SAssignNew(HeightBox, SEditableTextBox)
							.Text(IntText(Settings.OutputHeight))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("NDirLbl", "Num Directions (1 or 8)"),
						SAssignNew(NumDirBox, SEditableTextBox)
							.Text(IntText(Settings.NumDirections))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ ApplyCameraFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("FpsLbl", "Capture FPS"),
						SAssignNew(FpsBox, SEditableTextBox)
							.Text(FloatText(Settings.CaptureFPS))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(0,2)[ MakeRow(LOCTEXT("FCntLbl", "Frame Count (0=Auto)"),
						SAssignNew(FrameCountBox, SEditableTextBox)
							.Text(IntText(Settings.FrameCount))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,2)[ MakeRow(LOCTEXT("StartLbl", "Start Time (sec)"),
						SAssignNew(StartTimeBox, SEditableTextBox)
							.Text(FloatText(Settings.StartTime))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(0,3)[ MakeRow(LOCTEXT("EndLbl", "End Time (0=Full)"),
						SAssignNew(EndTimeBox, SEditableTextBox)
							.Text(FloatText(Settings.EndTime))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,3)[ MakeRow(LOCTEXT("PadLbl", "Crop Padding (px)"),
						SAssignNew(CropPaddingBox, SEditableTextBox)
							.Text(IntText(Settings.CropPaddingPx))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bTransparentBackground ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bTransparentBackground = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("BgChk", "Transparent Background")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bAutoCropToContent ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bAutoCropToContent = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("CropChk", "Auto Crop To Content")) ]
					]
				]

				// === 출력 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("OutSec", "Output"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("DiskLbl", "Disk Output Dir"),
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[ SAssignNew(DiskOutDirBox, SEditableTextBox)
						.Text(FText::FromString(Settings.DiskOutputDir))
						.HintText(LOCTEXT("DiskHint", "비워두면 <Project>/Saved/SpriteGenerator/AnimCapture/..."))
						.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); }) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
					[ SNew(SButton).Text(LOCTEXT("Browse", "Browse..."))
						.OnClicked(this, &SHktAnimCapturePanel::OnBrowseDiskOutputDir) ]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("AssetLbl", "Asset Output Dir (UE)"),
					SAssignNew(AssetOutDirBox, SEditableTextBox)
						.Text(FText::FromString(Settings.AssetOutputDir))
						.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("P2WLbl", "PixelToWorld"),
						SAssignNew(PixelToWorldBox, SEditableTextBox)
							.Text(FloatText(Settings.PixelToWorld))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("FrDurLbl", "FrameDuration (ms)"),
						SAssignNew(FrameDurationBox, SEditableTextBox)
							.Text(FloatText(Settings.FrameDurationMs))
							.OnTextCommitted_Lambda([this](const FText&, ETextCommit::Type){ RebuildSettingsFromUI(); })) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bLooping ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bLooping = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("LoopChk", "Looping")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bMirrorWestFromEast ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bMirrorWestFromEast = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("MirrorChk", "Mirror W from E")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bAutoBuildAtlas ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bAutoBuildAtlas = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("AtlasChk", "Auto-Build Sprite Atlas after capture")) ]
					]
				]

				// === 캡처 진행률 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,16,0,2)
				[
					SAssignNew(CaptureProgressBar, SProgressBar)
					.Percent_Lambda([this]() -> TOptional<float> {
						return CaptureProgressFraction;
					})
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,2,0,4)
				[
					SAssignNew(CaptureProgressText, STextBlock)
					.Text(LOCTEXT("CapProgIdle", "Idle"))
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				// === 캡처 버튼 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4,0,4)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.ContentPadding(FMargin(24,8))
					.Text(LOCTEXT("CapBtn", "Capture Animation"))
					.OnClicked(this, &SHktAnimCapturePanel::OnCaptureClicked)
				]

				// === 결과 로그 ===
				+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,0)
				[
					SAssignNew(ResultBox, SMultiLineEditableTextBox)
					.IsReadOnly(true)
					.AllowMultiLine(true)
					.HintText(LOCTEXT("ResHint", "캡처 결과 JSON 이 여기 표시됩니다"))
				]
			]
		]
	];

	// 프리뷰 이미지에 브러시 연결.
	if (PreviewImage.IsValid() && PreviewBrush.IsValid())
	{
		PreviewImage->SetImage(PreviewBrush.Get());
	}

	// ~30 FPS 활성 타이머 — 프리뷰 씬이 살아있을 때만 RenderPreview.
	PreviewTimerHandle = RegisterActiveTimer(
		1.0f / 30.0f,
		FWidgetActiveTimerDelegate::CreateSP(this, &SHktAnimCapturePanel::TickPreview));
}

SHktAnimCapturePanel::~SHktAnimCapturePanel()
{
	// 위젯이 닫힐 때 마지막 UI 값을 다시 한 번 거둬 저장 — 캡처를 누르지 않고
	// 패널만 닫는 경우에도 다음 세션에서 동일한 설정으로 복원되게 한다.
	RebuildSettingsFromUI();
	SavePersistedSettings();

	DestroyPreviewScene();
}

void SHktAnimCapturePanel::OnSkeletalMeshChanged(const FAssetData& Asset)
{
	Settings.SkeletalMesh = TSoftObjectPtr<USkeletalMesh>(Asset.ToSoftObjectPath());
}

void SHktAnimCapturePanel::OnAnimSequenceChanged(const FAssetData& Asset)
{
	Settings.AnimSequence = TSoftObjectPtr<UAnimSequence>(Asset.ToSoftObjectPath());
}

void SHktAnimCapturePanel::OnCameraModeClassChanged(const UClass* NewClass)
{
	Settings.CameraModeClass = NewClass
		? TSoftClassPtr<UHktCameraModeBase>(const_cast<UClass*>(NewClass))
		: TSoftClassPtr<UHktCameraModeBase>();
	// 클래스 CDO 의 Framing 이 카메라에 반영되도록 즉시 적용.
	ApplyCameraFromUI();
}

FString SHktAnimCapturePanel::GetSkeletalMeshPath() const
{
	return Settings.SkeletalMesh.IsNull() ? FString() : Settings.SkeletalMesh.ToString();
}

FString SHktAnimCapturePanel::GetAnimSequencePath() const
{
	return Settings.AnimSequence.IsNull() ? FString() : Settings.AnimSequence.ToString();
}

const UClass* SHktAnimCapturePanel::GetCameraModeClass() const
{
	// SoftClassPtr::Get() 는 이미 로드된 경우만 반환 — 미로드면 LoadSynchronous.
	return Settings.CameraModeClass.IsNull() ? nullptr : Settings.CameraModeClass.LoadSynchronous();
}

void SHktAnimCapturePanel::ApplyPresetToCustomFields(EHktAnimCaptureCameraPreset Preset)
{
	switch (Preset)
	{
	case EHktAnimCaptureCameraPreset::RtsView:
		Settings.ProjectionMode = ECameraProjectionMode::Perspective;
		Settings.FieldOfView = 90.0f;  Settings.Pitch = -60.0f;  Settings.ArmLength = 2000.0f;
		break;
	case EHktAnimCaptureCameraPreset::ShoulderView:
		Settings.ProjectionMode = ECameraProjectionMode::Perspective;
		Settings.FieldOfView = 90.0f;  Settings.Pitch = -15.0f;  Settings.ArmLength = 300.0f;
		break;
	case EHktAnimCaptureCameraPreset::IsometricOrtho:
		Settings.ProjectionMode = ECameraProjectionMode::Orthographic;
		Settings.OrthoWidth = 2500.0f; Settings.Pitch = -30.0f;  Settings.ArmLength = 2000.0f;
		break;
	case EHktAnimCaptureCameraPreset::IsometricGame:
		Settings.ProjectionMode = ECameraProjectionMode::Perspective;
		Settings.FieldOfView = 20.0f;  Settings.Pitch = -55.0f;  Settings.ArmLength = 2500.0f;
		break;
	case EHktAnimCaptureCameraPreset::Custom:
	default:
		break;
	}
}

FReply SHktAnimCapturePanel::OnBrowseDiskOutputDir()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = DiskOutDirBox.IsValid() ? DiskOutDirBox->GetText().ToString() : FString();
	FString OutPath;
	const bool bOK = DP->OpenDirectoryDialog(
		FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared()),
		TEXT("Select Capture Output Directory"),
		Current.IsEmpty() ? FPaths::ProjectSavedDir() : Current,
		OutPath);
	if (bOK && DiskOutDirBox.IsValid())
	{
		DiskOutDirBox->SetText(FText::FromString(OutPath));
		Settings.DiskOutputDir = OutPath;
	}
	return FReply::Handled();
}

void SHktAnimCapturePanel::OnTagHolderPropertyChanged(const FPropertyChangedEvent& /*Event*/)
{
	if (TagHolder.IsValid())
	{
		Settings.CharacterTag = TagHolder->CharacterTag;
		Settings.AnimTag      = TagHolder->AnimTag;
		// 태그가 바뀌면 설정을 즉시 영구 저장 — 다음 세션에서 그대로 복원.
		SavePersistedSettings();
	}
}

void SHktAnimCapturePanel::RebuildSettingsFromUI()
{
	auto GetStr = [](const TSharedPtr<SEditableTextBox>& Box) -> FString {
		return Box.IsValid() ? Box->GetText().ToString() : FString();
	};
	auto GetInt = [&](const TSharedPtr<SEditableTextBox>& Box, int32 Def) -> int32 {
		const FString S = GetStr(Box);
		return S.IsEmpty() ? Def : FCString::Atoi(*S);
	};
	auto GetFlt = [&](const TSharedPtr<SEditableTextBox>& Box, float Def) -> float {
		const FString S = GetStr(Box);
		return S.IsEmpty() ? Def : FCString::Atof(*S);
	};

	// 태그는 holder UObject 가 source-of-truth — UI 가 즉시 반영한 값을 거둔다.
	if (TagHolder.IsValid())
	{
		Settings.CharacterTag = TagHolder->CharacterTag;
		Settings.AnimTag      = TagHolder->AnimTag;
	}
	Settings.ActionId        = GetStr(ActionIdBox);
	Settings.DiskOutputDir   = GetStr(DiskOutDirBox);
	Settings.AssetOutputDir  = GetStr(AssetOutDirBox);

	Settings.OutputWidth     = FMath::Max(16,  GetInt(WidthBox,  Settings.OutputWidth));
	Settings.OutputHeight    = FMath::Max(16,  GetInt(HeightBox, Settings.OutputHeight));
	// SpriteGenerator 디렉터리 매핑 안전성 위해 1 또는 8 만 허용 (라이브러리도 동일 강제).
	{
		const int32 RawN = GetInt(NumDirBox, Settings.NumDirections);
		Settings.NumDirections = (RawN <= 1) ? 1 : 8;
	}
	Settings.FrameCount      = FMath::Max(0,   GetInt(FrameCountBox, Settings.FrameCount));
	Settings.CaptureFPS      = FMath::Max(0.1f, GetFlt(FpsBox, Settings.CaptureFPS));
	Settings.StartTime       = FMath::Max(0.0f, GetFlt(StartTimeBox, Settings.StartTime));
	Settings.EndTime         = FMath::Max(0.0f, GetFlt(EndTimeBox, Settings.EndTime));

	Settings.Pitch           = GetFlt(PitchBox,      Settings.Pitch);
	Settings.YawOffset       = GetFlt(YawOffsetBox,  Settings.YawOffset);
	Settings.FieldOfView     = GetFlt(FovBox,        Settings.FieldOfView);
	Settings.OrthoWidth      = GetFlt(OrthoWidthBox, Settings.OrthoWidth);
	Settings.ArmLength       = GetFlt(ArmLengthBox,  Settings.ArmLength);

	Settings.PixelToWorld    = GetFlt(PixelToWorldBox,  Settings.PixelToWorld);
	Settings.FrameDurationMs = GetFlt(FrameDurationBox, Settings.FrameDurationMs);
	Settings.CropPaddingPx   = FMath::Max(0, GetInt(CropPaddingBox, Settings.CropPaddingPx));

	// === Lighting ===
	Settings.KeyLightIntensity      = FMath::Max(0.0f, GetFlt(KeyLightIntensityBox,  Settings.KeyLightIntensity));
	Settings.KeyLightRotation.Pitch = GetFlt(KeyLightPitchBox, Settings.KeyLightRotation.Pitch);
	Settings.KeyLightRotation.Yaw   = GetFlt(KeyLightYawBox,   Settings.KeyLightRotation.Yaw);

	Settings.FillLightIntensity      = FMath::Max(0.0f, GetFlt(FillLightIntensityBox, Settings.FillLightIntensity));
	Settings.FillLightRotation.Pitch = GetFlt(FillLightPitchBox, Settings.FillLightRotation.Pitch);
	Settings.FillLightRotation.Yaw   = GetFlt(FillLightYawBox,   Settings.FillLightRotation.Yaw);

	Settings.ExtraSkyLightIntensity  = FMath::Max(0.0f, GetFlt(SkyLightIntensityBox, Settings.ExtraSkyLightIntensity));
}

FReply SHktAnimCapturePanel::OnCaptureClicked()
{
	if (bCaptureInProgress)
	{
		// FScopedSlowTask 가 모달이라 사실상 재진입은 불가하지만 안전장치.
		return FReply::Handled();
	}

	RebuildSettingsFromUI();
	SavePersistedSettings();   // 캡처 시점에도 저장 — 충돌/실패해도 세팅은 보존.

	bCaptureInProgress = true;
	CaptureProgressFraction = 0.0f;
	if (CaptureProgressText.IsValid())
	{
		CaptureProgressText->SetText(LOCTEXT("CapStart", "Starting capture..."));
	}

	FHktAnimCaptureProgressDelegate Progress = FHktAnimCaptureProgressDelegate::CreateSP(
		this, &SHktAnimCapturePanel::OnCaptureProgress);

	const FString Result = UHktAnimCaptureFunctionLibrary::CaptureAnimationWithProgress(Settings, Progress);

	bCaptureInProgress = false;
	CaptureProgressFraction = 1.0f;
	if (CaptureProgressText.IsValid())
	{
		CaptureProgressText->SetText(LOCTEXT("CapDone", "Capture finished. See result log below."));
	}
	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

void SHktAnimCapturePanel::ApplyCameraFromUI()
{
	auto GetFlt = [](const TSharedPtr<SEditableTextBox>& Box, float Def) -> float {
		if (!Box.IsValid()) return Def;
		const FString S = Box->GetText().ToString();
		return S.IsEmpty() ? Def : FCString::Atof(*S);
	};
	auto GetInt = [](const TSharedPtr<SEditableTextBox>& Box, int32 Def) -> int32 {
		if (!Box.IsValid()) return Def;
		const FString S = Box->GetText().ToString();
		return S.IsEmpty() ? Def : FCString::Atoi(*S);
	};

	Settings.Pitch       = GetFlt(PitchBox,       Settings.Pitch);
	Settings.YawOffset   = GetFlt(YawOffsetBox,   Settings.YawOffset);
	Settings.FieldOfView = GetFlt(FovBox,         Settings.FieldOfView);
	Settings.OrthoWidth  = GetFlt(OrthoWidthBox,  Settings.OrthoWidth);
	Settings.ArmLength   = GetFlt(ArmLengthBox,   Settings.ArmLength);

	// NumDirections 는 Capture 섹션에 있지만 프리뷰 ◀▶ 네비게이션에 직접 영향 — 함께 처리.
	{
		const int32 RawN = GetInt(NumDirBox, Settings.NumDirections);
		Settings.NumDirections = (RawN <= 1) ? 1 : 8;
	}

	if (PreviewScene.IsValid())
	{
		PreviewScene->UpdateCameraSettings(Settings);
		// UpdateCameraSettings 내부에서 NumDirections 클램프 후 CurrentDirection 도 보정하지만,
		// 패널 측 PreviewDirectionIdx 는 우리가 따로 관리하므로 추가 클램프.
		const int32 NumDir = FMath::Clamp(Settings.NumDirections, 1, 8);
		PreviewDirectionIdx = FMath::Clamp(PreviewDirectionIdx, 0, NumDir - 1);
		PreviewScene->SetDirectionIndex(PreviewDirectionIdx);
	}
}

void SHktAnimCapturePanel::ApplyLightingFromUI()
{
	auto GetFlt = [](const TSharedPtr<SEditableTextBox>& Box, float Def) -> float {
		if (!Box.IsValid()) return Def;
		const FString S = Box->GetText().ToString();
		return S.IsEmpty() ? Def : FCString::Atof(*S);
	};

	Settings.KeyLightIntensity      = FMath::Max(0.0f, GetFlt(KeyLightIntensityBox,  Settings.KeyLightIntensity));
	Settings.KeyLightRotation.Pitch = GetFlt(KeyLightPitchBox, Settings.KeyLightRotation.Pitch);
	Settings.KeyLightRotation.Yaw   = GetFlt(KeyLightYawBox,   Settings.KeyLightRotation.Yaw);

	Settings.FillLightIntensity      = FMath::Max(0.0f, GetFlt(FillLightIntensityBox, Settings.FillLightIntensity));
	Settings.FillLightRotation.Pitch = GetFlt(FillLightPitchBox, Settings.FillLightRotation.Pitch);
	Settings.FillLightRotation.Yaw   = GetFlt(FillLightYawBox,   Settings.FillLightRotation.Yaw);

	Settings.ExtraSkyLightIntensity  = FMath::Max(0.0f, GetFlt(SkyLightIntensityBox, Settings.ExtraSkyLightIntensity));

	if (PreviewScene.IsValid())
	{
		PreviewScene->UpdateLightingSettings(Settings);
	}
}

void SHktAnimCapturePanel::OnCaptureProgress(int32 DoneFrames, int32 TotalFrames, const FString& Status)
{
	if (TotalFrames > 0)
	{
		CaptureProgressFraction = FMath::Clamp(static_cast<float>(DoneFrames) / static_cast<float>(TotalFrames), 0.0f, 1.0f);
	}
	if (CaptureProgressText.IsValid())
	{
		CaptureProgressText->SetText(FText::FromString(FString::Printf(
			TEXT("%s  (%d/%d, %.0f%%)"), *Status, DoneFrames, TotalFrames, CaptureProgressFraction * 100.0f)));
	}
	// FScopedSlowTask 가 SlateApplication 을 펌프하므로 SProgressBar 의 .Percent_Lambda 가
	// 다음 frame paint 에서 자동으로 새 값을 읽는다. 별도 Invalidate 불필요.
}

FReply SHktAnimCapturePanel::OpenColorPicker(FLinearColor* TargetColor, TSharedPtr<SColorBlock> Block)
{
	if (!TargetColor) return FReply::Handled();

	FColorPickerArgs Args;
	Args.bIsModal = true;
	Args.bUseAlpha = true;
	// 드래그 중에도 OnColorCommitted 가 호출되도록 — 실시간 프리뷰 갱신용.
	Args.bOnlyRefreshOnMouseUp = false;
	Args.InitialColor = *TargetColor;
	TWeakPtr<SHktAnimCapturePanel> WeakSelf = SharedThis(this);
	Args.OnColorCommitted = FOnLinearColorValueChanged::CreateLambda([TargetColor, Block, WeakSelf](FLinearColor NewColor)
	{
		*TargetColor = NewColor;
		if (Block.IsValid())
		{
			Block->Invalidate(EInvalidateWidgetReason::Paint);
		}
		if (TSharedPtr<SHktAnimCapturePanel> Self = WeakSelf.Pin())
		{
			Self->ApplyLightingFromUI();
		}
	});

	::OpenColorPicker(Args);
	return FReply::Handled();
}

void SHktAnimCapturePanel::LoadPersistedSettings()
{
	UHktAnimCapturePanelConfig* Cfg = GetMutableDefault<UHktAnimCapturePanelConfig>();
	if (!Cfg) return;

	// LoadConfig() 는 INI 파일에서 UPROPERTY(Config) 멤버를 다시 읽어 채운다.
	// 파일이 없거나 키가 없으면 기존 디폴트 값(생성자 / 우리가 세팅한 값) 유지.
	Cfg->LoadConfig();

	// 저장 파일 존재 여부는 OutputWidth(>0 으로 강제 클램프되는 필수 캡처 파라미터) 로
	// 판정한다 — Skeletal/Anim 만으로 판정하던 기존 로직은 사용자가 태그만 입력해두고
	// 닫은 경우 다음 세션에서 그 태그가 사라지는 문제가 있었다.
	if (Cfg->LastSettings.OutputWidth > 0)
	{
		Settings = Cfg->LastSettings;
	}
}

void SHktAnimCapturePanel::SavePersistedSettings()
{
	UHktAnimCapturePanelConfig* Cfg = GetMutableDefault<UHktAnimCapturePanelConfig>();
	if (!Cfg) return;
	Cfg->LastSettings = Settings;
	Cfg->SaveConfig();
}

// ============================================================================
// Editor Preview
// ============================================================================

void SHktAnimCapturePanel::DestroyPreviewScene()
{
	// 브러시가 곧 파괴될 RT 를 가리키지 않게 먼저 해제.
	if (PreviewBrush.IsValid())
	{
		PreviewBrush->SetResourceObject(nullptr);
	}
	PreviewScene.Reset();
}

void SHktAnimCapturePanel::RebuildPreviewScene()
{
	RebuildSettingsFromUI();

	// 기존 씬 폐기 — 메시/애니가 바뀌었을 수 있으므로 깔끔히 재구성.
	DestroyPreviewScene();

	if (Settings.SkeletalMesh.IsNull())
	{
		if (PreviewStatusText.IsValid())
		{
			PreviewStatusText->SetText(LOCTEXT("PreviewNoMesh", "SkeletalMesh 가 지정되지 않음."));
		}
		return;
	}

	PreviewScene = MakeUnique<FHktAnimCaptureScene>();

	FString Err;
	if (!PreviewScene->Initialize(Settings, Err))
	{
		if (PreviewStatusText.IsValid())
		{
			PreviewStatusText->SetText(FText::FromString(FString::Printf(TEXT("Preview init 실패: %s"), *Err)));
		}
		PreviewScene.Reset();
		return;
	}

	if (!PreviewScene->InitializePreviewRT(512, 512, Err))
	{
		if (PreviewStatusText.IsValid())
		{
			PreviewStatusText->SetText(FText::FromString(FString::Printf(TEXT("Preview RT 실패: %s"), *Err)));
		}
		PreviewScene.Reset();
		return;
	}

	// 방향 인덱스 보정 + 카메라 적용.
	const int32 NumDir = FMath::Clamp(Settings.NumDirections, 1, 8);
	PreviewDirectionIdx = FMath::Clamp(PreviewDirectionIdx, 0, NumDir - 1);
	PreviewScene->SetDirectionIndex(PreviewDirectionIdx);

	// 첫 프레임으로 시간 리셋 후 1프레임 렌더.
	PreviewTimeSec = 0.0f;
	PreviewScene->SetAnimationTime(PreviewTimeSec);
	PreviewScene->RenderPreview();

	// 브러시에 RT 연결.
	if (PreviewBrush.IsValid())
	{
		PreviewBrush->SetResourceObject(PreviewScene->GetPreviewRenderTarget());
		PreviewBrush->ImageSize = FVector2D(512.f, 512.f);
	}
	if (PreviewImage.IsValid())
	{
		PreviewImage->Invalidate(EInvalidateWidget::LayoutAndVolatility);
	}

	if (PreviewStatusText.IsValid())
	{
		const float L = PreviewScene->GetAnimSequenceLength();
		PreviewStatusText->SetText(FText::FromString(FString::Printf(
			TEXT("Dir %d/%d  Len %.2fs  %s"),
			PreviewDirectionIdx, NumDir, L, bPreviewPlaying ? TEXT("Playing") : TEXT("Paused"))));
	}
}

EActiveTimerReturnType SHktAnimCapturePanel::TickPreview(double, float InDeltaTime)
{
	if (!PreviewScene.IsValid())
	{
		return EActiveTimerReturnType::Continue;
	}

	if (bPreviewPlaying)
	{
		const float L = PreviewScene->GetAnimSequenceLength();
		PreviewTimeSec += InDeltaTime;
		if (L > 0.0f)
		{
			PreviewTimeSec = FMath::Fmod(PreviewTimeSec, L);
		}
		PreviewScene->SetAnimationTime(PreviewTimeSec);
	}

	PreviewScene->RenderPreview();

	if (PreviewStatusText.IsValid())
	{
		const int32 NumDir = FMath::Clamp(Settings.NumDirections, 1, 8);
		const float L = PreviewScene->GetAnimSequenceLength();
		PreviewStatusText->SetText(FText::FromString(FString::Printf(
			TEXT("Dir %d/%d  T %.2f/%.2fs  %s"),
			PreviewDirectionIdx, NumDir, PreviewTimeSec, L,
			bPreviewPlaying ? TEXT("Playing") : TEXT("Paused"))));
	}

	return EActiveTimerReturnType::Continue;
}

FReply SHktAnimCapturePanel::OnRefreshPreviewClicked()
{
	RebuildPreviewScene();
	return FReply::Handled();
}

FReply SHktAnimCapturePanel::OnPrevDirectionClicked()
{
	RebuildSettingsFromUI();
	const int32 NumDir = FMath::Clamp(Settings.NumDirections, 1, 8);
	PreviewDirectionIdx = ((PreviewDirectionIdx - 1) % NumDir + NumDir) % NumDir;
	if (PreviewScene.IsValid())
	{
		PreviewScene->SetDirectionIndex(PreviewDirectionIdx);
	}
	return FReply::Handled();
}

FReply SHktAnimCapturePanel::OnNextDirectionClicked()
{
	RebuildSettingsFromUI();
	const int32 NumDir = FMath::Clamp(Settings.NumDirections, 1, 8);
	PreviewDirectionIdx = (PreviewDirectionIdx + 1) % NumDir;
	if (PreviewScene.IsValid())
	{
		PreviewScene->SetDirectionIndex(PreviewDirectionIdx);
	}
	return FReply::Handled();
}

void SHktAnimCapturePanel::OnPlayPauseChanged(ECheckBoxState NewState)
{
	bPreviewPlaying = (NewState == ECheckBoxState::Checked);
}

#undef LOCTEXT_NAMESPACE
