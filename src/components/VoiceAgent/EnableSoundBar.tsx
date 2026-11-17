"use client";

export function EnableSoundBar({ onEnable }: { onEnable: () => void | Promise<void> }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 150,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 20px",
        borderRadius: 12,
        background: "rgba(15, 23, 42, 0.95)",
        border: "1px solid rgba(96, 165, 250, 0.45)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      }}
    >
      <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
        Tap once to enable queue announcements on this screen.
      </p>
      <button
        type="button"
        onClick={() => void onEnable()}
        style={{
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Enable sound
      </button>
    </div>
  );
}