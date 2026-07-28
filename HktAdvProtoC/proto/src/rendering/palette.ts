// 키 → 시각 언어 매핑표 (기획서 §42-8 / Phase-8 §8.3)
//
// 빌더가 넘긴 **키**를 색·글리프로 옮기는 표다. 여기 있는 값은 전부 표현의 선택이며,
// 아이콘 스타일 교체는 이 표의 교체일 뿐이다 — 빌더·코어에는 한 줄의 변경도 없다(§8.0).
//
// 반대로 이 파일에 `if (danger > 50)` 같은 **수치 해석은 없다.** 그 판단은 이미 빌더가 키로 바꿔 보냈다.

const FALLBACK_COLOR = "#9aa0a6";

/** 위험도·상태·사건 색상 키 */
export const COLORS: Record<string, string> = {
  "danger-low": "#cfe8d5",
  "danger-mid": "#f2e3ae",
  "danger-high": "#efc39b",
  "danger-extreme": "#e2a09b",
  "climate-cold": "#dbe7f2",
  "climate-arid": "#f0e2c8",
  "climate-wild": "#d6e6cf",
  "climate-settled": "#eae6df",
  "climate-temperate": "#e6ebe4",
  "state-normal": "#3c6e9f",
  "state-afraid": "#8a6fb0",
  "state-hostile": "#b5473f",
  "state-critical": "#d13c2f",
  "event-closed": "#b9b9b9",
};

export function colorOf(key: string): string {
  return COLORS[key] ?? FALLBACK_COLOR;
}

/** 심볼 키 → 글리프 (§42-8 캐릭터 아이콘 — 에셋 저작 없이 글리프로, §43) */
export const GLYPHS: Record<string, string> = {
  "symbol-player": "◉",
  "symbol-agent": "●",
  "symbol-beast": "▲",
  "symbol-faction": "▣",
  "symbol-resource": "◇",
  "symbol-place": "▪",
  "symbol-unknown": "?",
};

export function glyphOf(key: string): string {
  const direct = GLYPHS[key];
  if (direct !== undefined) return direct;
  // 종족 심볼(`symbol-species.human`)은 표에 없으면 종족 첫 글자를 쓴다 — 새 종족이 생겨도 그려진다
  if (key.startsWith("symbol-species.")) {
    const name = key.slice("symbol-species.".length);
    return (name[0] ?? "●").toUpperCase();
  }
  if (key.startsWith("event.")) return "✦";
  return "●";
}

/**
 * 관찰 채널 → 시각 언어 (§8.3 파문·잔광·아이콘).
 * 채널마다 다른 언어를 주는 것이 "능력 효과·사건 연출"의 전부다 — 별도 연출 스크립트는 없다.
 */
export interface ChannelStyle {
  /** ripple=파문, glow=잔광, icon=아이콘 */
  shape: "ripple" | "glow" | "icon";
  color: string;
  glyph: string;
}

export const CHANNEL_STYLES: Record<string, ChannelStyle> = {
  sight: { shape: "glow", color: "#f4d67a", glyph: "◌" },
  sound: { shape: "ripple", color: "#7fb3d5", glyph: "◜" },
  smell: { shape: "glow", color: "#a8c686", glyph: "≈" },
  vibration: { shape: "ripple", color: "#c39bd3", glyph: "∿" },
  energy_sense: { shape: "ripple", color: "#76d7c4", glyph: "✧" },
  trace: { shape: "icon", color: "#b7950b", glyph: "⌇" },
  talk: { shape: "icon", color: "#5499c7", glyph: "❝" },
  report: { shape: "icon", color: "#7d6608", glyph: "✉" },
};

export function channelStyleOf(key: string): ChannelStyle {
  return CHANNEL_STYLES[key] ?? { shape: "glow", color: FALLBACK_COLOR, glyph: "·" };
}
