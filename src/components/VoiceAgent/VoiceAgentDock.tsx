"use client";

import {
  CheckCircleFilled,
  CloseCircleFilled,
  DownOutlined,
  MutedFilled,
  PlayCircleOutlined,
  ReloadOutlined,
  SoundFilled,
} from "@ant-design/icons";
import { Button, ConfigProvider, Progress, Select, Slider, Tooltip, theme } from "antd";
import { useRef } from "react";
import {
  PIPER_VOICE_CATALOG,
  PIPER_VOICE_CHOICES,
  type PiperVoiceAccent,
  type PiperVoiceChoice,
  type PiperVoiceGender,
} from "@/queue/piperVoices";

/** Dot colour by gender; UK voices get a teal tint so accents are easy to tell apart. */
const VOICE_DOT: Record<PiperVoiceGender, Record<PiperVoiceAccent, { from: string; to: string }>> = {
  female: {
    US: { from: "#f472b6", to: "#a78bfa" },
    UK: { from: "#f472b6", to: "#2dd4bf" },
  },
  male: {
    US: { from: "#38bdf8", to: "#6366f1" },
    UK: { from: "#38bdf8", to: "#2dd4bf" },
  },
};

const ACCENT_GROUP_LABEL: Record<PiperVoiceAccent, string> = {
  US: "US English",
  UK: "UK English",
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
  const accent = VOICE_DOT[entry.gender][entry.accent];
  const name = entry.label;
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
          <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(191, 219, 254, 0.7)" }}>
            {entry.gender === "female" ? "Female" : "Male"} · {entry.accent}
          </span>
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
  /** 0..2 (0%..200%). */
  volume: number;
  onVolumeChange: (value: number) => void;
  /** 0..1 (0%..100%). Applies from the next announcement. */
  echo: number;
  onEchoChange: (value: number) => void;
};

/** Volume track turns amber above 100% to signal the boosted range. */
const VOLUME_NORMAL = "#60a5fa";
const VOLUME_BOOST = "#fbbf24";
const ECHO_COLOR = "#a78bfa";
const OFF_COLOR = "rgba(148, 163, 184, 0.55)";

/** Concentric arcs — no echo glyph in @ant-design/icons. */
function EchoIcon({ dim }: { dim: boolean }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3.5" cy="8" r="2" fill="currentColor" />
      <path d="M7 4.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={dim ? 0.5 : 0.85} />
      <path d="M10 2.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={dim ? 0.3 : 0.55} />
      <path d="M13 1a10.5 10.5 0 0 1 0 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity={dim ? 0.15 : 0.3} />
    </svg>
  );
}

type SliderRowProps = {
  label: string;
  /** 0..max in percent. */
  pct: number;
  max: number;
  onPctChange: (pct: number) => void;
  icon: React.ReactNode;
  iconColor: string;
  iconTitle: string;
  onIconClick: () => void;
  track: string;
  valueColor: string;
  mark100?: boolean;
};

function SliderRow({
  label,
  pct,
  max,
  onPctChange,
  icon,
  iconColor,
  iconTitle,
  onIconClick,
  track,
  valueColor,
  mark100,
}: SliderRowProps) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, height: 17 }}>
      <Tooltip title={iconTitle}>
        <button
          type="button"
          onClick={onIconClick}
          aria-label={iconTitle}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            width: 15,
            cursor: "pointer",
            lineHeight: 0,
            color: iconColor,
            fontSize: 13,
          }}
        >
          {icon}
        </button>
      </Tooltip>
      <Slider
        min={0}
        max={max}
        step={5}
        value={pct}
        onChange={(v) => onPctChange(v as number)}
        marks={mark100 ? { 100: " " } : undefined}
        tooltip={{ formatter: (v) => `${label} ${v}%` }}
        aria-label={`Voice ${label.toLowerCase()}`}
        style={{ width: 96, margin: "0 4px", padding: "3px 0", height: 10 }}
        styles={{
          rail: { background: "rgba(148, 163, 184, 0.22)" },
          track: { background: track },
          handle: { insetBlockStart: 1 },
        }}
      />
      <span
        style={{
          width: 34,
          fontSize: 10,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: valueColor,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </span>
  );
}

function VoiceSoundControls({
  volume,
  onVolumeChange,
  echo,
  onEchoChange,
}: {
  volume: number;
  onVolumeChange: (v: number) => void;
  echo: number;
  onEchoChange: (v: number) => void;
}) {
  /** Levels restored by the icon toggles; only touched in event handlers. */
  const lastVolume = useRef(1);
  const lastEcho = useRef(0.35);

  const volPct = Math.round(volume * 100);
  const muted = volPct === 0;
  const boosted = volPct > 100;
  const echoPct = Math.round(echo * 100);
  const echoOff = echoPct === 0;

  return (
    <span style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexShrink: 0 }}>
      <SliderRow
        label="Volume"
        pct={volPct}
        max={200}
        onPctChange={(p) => onVolumeChange(p / 100)}
        icon={muted ? <MutedFilled /> : <SoundFilled />}
        iconColor={muted ? "#f87171" : boosted ? VOLUME_BOOST : VOLUME_NORMAL}
        iconTitle={muted ? "Unmute voice" : "Mute voice"}
        onIconClick={() => {
          if (muted) {
            onVolumeChange(lastVolume.current > 0 ? lastVolume.current : 1);
          } else {
            lastVolume.current = volume;
            onVolumeChange(0);
          }
        }}
        track={
          boosted
            ? `linear-gradient(90deg, ${VOLUME_NORMAL} 0%, ${VOLUME_NORMAL} ${(100 / volPct) * 100}%, ${VOLUME_BOOST} 100%)`
            : VOLUME_NORMAL
        }
        valueColor={muted ? "#f87171" : boosted ? VOLUME_BOOST : "rgba(226, 232, 240, 0.85)"}
        mark100
      />
      <SliderRow
        label="Echo"
        pct={echoPct}
        max={100}
        onPctChange={(p) => onEchoChange(p / 100)}
        icon={<EchoIcon dim={echoOff} />}
        iconColor={echoOff ? OFF_COLOR : ECHO_COLOR}
        iconTitle={echoOff ? "Turn echo on" : "Turn echo off"}
        onIconClick={() => {
          if (echoOff) {
            onEchoChange(lastEcho.current > 0 ? lastEcho.current : 0.35);
          } else {
            lastEcho.current = echo;
            onEchoChange(0);
          }
        }}
        track={ECHO_COLOR}
        valueColor={echoOff ? OFF_COLOR : ECHO_COLOR}
      />
    </span>
  );
}

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
  volume,
  onVolumeChange,
  echo,
  onEchoChange,
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

  const selectOptions = (["US", "UK"] as const).map((accent) => ({
    label: ACCENT_GROUP_LABEL[accent],
    title: ACCENT_GROUP_LABEL[accent],
    options: PIPER_VOICE_CHOICES.filter((id) => PIPER_VOICE_CATALOG[id].accent === accent).map((id) => ({
      value: id,
      label: PIPER_VOICE_CATALOG[id].label,
    })),
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
          popupMatchSelectWidth={200}
          listHeight={600}
          classNames={{ popup: { root: "lh-voice-dock-dropdown" } }}
          suffixIcon={<DownOutlined style={{ fontSize: 10, color: "#93c5fd" }} />}
          labelRender={({ value }) => renderVoiceLabel(value as PiperVoiceChoice, false)}
          optionRender={(option) => renderVoiceLabel(option.value as PiperVoiceChoice, true)}
        />
        <VoiceSoundControls
          volume={volume}
          onVolumeChange={onVolumeChange}
          echo={echo}
          onEchoChange={onEchoChange}
        />
      </ConfigProvider>
      {voiceReady && status !== "error" && onTestVoice ? (
        <Tooltip title="Test voice">
          <Button
            type="text"
            size="small"
            icon={<PlayCircleOutlined />}
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