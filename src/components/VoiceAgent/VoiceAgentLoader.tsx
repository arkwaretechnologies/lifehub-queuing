"use client";

type Props = {
  progress: number;
  status?: "loading" | "error";
  errorDetail?: string | null;
  onRetry?: () => void;
};

export function VoiceAgentLoader({ progress, status = "loading", errorDetail, onRetry }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0f1a",
        color: "#fff",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 22,
          marginBottom: 28,
          boxShadow: "0 12px 40px rgba(59,130,246,0.35)",
        }}
      >
        LH
      </div>
      <p style={{ fontSize: 28, fontWeight: 700, margin: 0, textAlign: "center" }}>
        {status === "error" ? "Voice agent unavailable" : "Loading Voice Agent"}
      </p>
      <p style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 420 }}>
        {status === "error"
          ? (errorDetail?.trim() ||
              "Could not start the voice engine on this device. Check Wi‑Fi, then tap Retry (first load may take up to a minute).")
          : "First load downloads the voice model (~60MB). This can take up to a minute."}
      </p>
      <div style={{ width: "min(420px, 100%)", marginTop: 36 }}>
        <div
          style={{
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, #60a5fa, #34d399)",
              transition: "width 0.25s ease-out",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{status === "error" ? "Load failed" : "Initializing"}</span>
          <span>{pct}%</span>
        </div>
      </div>
      {status === "error" && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 28,
            padding: "10px 22px",
            borderRadius: 8,
            border: "1px solid rgba(96,165,250,0.5)",
            background: "rgba(59,130,246,0.2)",
            color: "#bfdbfe",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}