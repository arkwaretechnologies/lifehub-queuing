"use client";

import {
  CheckCircleFilled,
  CloseCircleFilled,
  DownOutlined,
  ReloadOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import { Button, ConfigProvider, Progress, Select, Tooltip, theme } from "antd";
import {
  PIPER_VOICE_CATALOG,
  PIPER_VOICE_CHOICES,
  type PiperVoiceChoice,
} from "@/queue/piperVoices";

const VOICE_ACCENT: Record<PiperVoiceChoice, { from: string; to: string }> = {
  hfc_female_medium: { from: "#f472b6", to: "#a78bfa" },
  hfc_male_medium: { from: "#38bdf8", to: "#6366f1" },
};

const VOICE_SELECT_THEME = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#60a5fa",
    colorBgElevated: "#0f172a",
    colorText: "#e2e8f0",
    fontSize: 12,
  },
  components: {
    Select: {
      selectorBg: "rgba(30, 58, 138, 0.28)",
      colorBorder: "rgba(96, 165, 250, 0.35)",
      hoverBorderColor: "rgba(147, 197, 253, 0.75)",
      activeBorderColor: "#60a5fa",
      activeOutlineColor: "rgba(59, 130, 246, 0.25)",
      borderRadiusSM: 8,
      borderRadiusLG: 12,
      optionActiveBg: "#172554",
      optionSelectedBg: "#1e3a8a",
      optionSelectedColor: "#ffffff",
      optionSelectedFontWeight: 600,
      optionHeight: 36,
    },
  },
};

function renderVoiceLabel(choice: PiperVoiceChoice, inMenu: boolean) {
  const entry = PIPER_VOICE_CATALOG[choice];
  if (!entry) return null;
  const accent = VOICE_ACCENT[choice];
  const name = entry.label.replace(" (medium)", "");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        aria-hidden
        style={{
          width: inMenu ? 10 : 8,
          height: inMenu ? 10 : 8,
          borderRadius: "50%",
          flexShrink: 0,
          background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
          boxShadow: `0 0 8px ${accent.from}99`,
        }}
      />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
        <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
        {inMenu ? (
          <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(191, 219, 254, 0.7)" }}>Medium quality</span>
        ) : null}
      </span>
    </span>
  );
}

type Props = {
  voiceReady: boolean;
  status: "loading" | "error";
  progress: number;
  phaseLabel?: string | null;
  errorDetail?: string | null;
  activeVoice: PiperVoiceChoice;
  onVoiceChange: (choice: PiperVoiceChoice) => void;
  onRetry: () => void;
  onTestVoice?: () => void;
};

export function VoiceAgentDock({
  voiceReady,
  status,
  progress,
  phaseLabel,
  errorDetail,
  activeVoice,
  onVoiceChange,
  onRetry,
  onTestVoice,
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  const indicator = (() => {
    if (status === "error") {
      return (
        <Tooltip title={errorDetail ?? "Voice agent failed. Tap Retry."}>
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry voice agent"
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <CloseCircleFilled style={{ fontSize: 28, color: "#f87171" }} />
          </button>
        </Tooltip>
      );
    }
    if (voiceReady) {
      return (
        <Tooltip title="Voice agent ready">
          <CheckCircleFilled style={{ fontSize: 28, color: "#34d399", flexShrink: 0 }} />
        </Tooltip>
      );
    }
    return (
      <Tooltip title={phaseLabel ?? "Loading voice agent…"}>
        <Progress
          type="circle"
          percent={pct}
          size={28}
          strokeColor={{ "0%": "#60a5fa", "100%": "#34d399" }}
          railColor="rgba(255,255,255,0.12)"
          format={(p) => <span style={{ fontSize: 9, color: "rgba(255,255,255,0.75)" }}>{p}</span>}
        />
      </Tooltip>
    );
  })();

  const selectOptions = PIPER_VOICE_CHOICES.map((id) => ({
    value: id,
    label: PIPER_VOICE_CATALOG[id].label.replace(" (medium)", ""),
  }));

  return (
    <div
      className="lh-voice-dock"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "4px 10px 4px 6px",
        borderRadius: 10,
        background: "linear-gradient(180deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)",
        border: "1px solid rgba(96, 165, 250, 0.28)",
        flexShrink: 0,
      }}
    >
      {indicator}
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          lineHeight: 1.15,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "rgba(148, 163, 184, 0.95)",
            whiteSpace: "nowrap",
          }}
        >
          Voice
        </span>
        {!voiceReady && status === "loading" && phaseLabel ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: "rgba(148, 163, 184, 0.72)",
              whiteSpace: "nowrap",
              maxWidth: 118,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={phaseLabel}
          >
            {phaseLabel}
          </span>
        ) : null}
      </span>
      <ConfigProvider theme={VOICE_SELECT_THEME}>
        <Select
          className="lh-voice-select"
          size="small"
          value={activeVoice}
          options={selectOptions}
          onChange={(value) => onVoiceChange(value as PiperVoiceChoice)}
          style={{ width: 150, borderRadius: 999 }}
          popupMatchSelectWidth={190}
          classNames={{ popup: { root: "lh-voice-dock-dropdown" } }}
          suffixIcon={<DownOutlined style={{ fontSize: 10, color: "#93c5fd" }} />}
          labelRender={({ value }) => renderVoiceLabel(value as PiperVoiceChoice, false)}
          optionRender={(option) => renderVoiceLabel(option.value as PiperVoiceChoice, true)}
        />
      </ConfigProvider>
      {voiceReady && status !== "error" && onTestVoice ? (
        <Tooltip title="Test voice">
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={onTestVoice}
            aria-label="Test voice"
            style={{
              color: "#93c5fd",
              minWidth: 28,
              padding: "0 4px",
            }}
          />
        </Tooltip>
      ) : null}
      {status === "error" ? (
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRetry}
          aria-label="Retry voice agent"
          style={{
            color: "#93c5fd",
            minWidth: 28,
            padding: "0 4px",
          }}
        />
      ) : null}
    </div>
  );
}