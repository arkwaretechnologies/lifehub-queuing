"use client";

import type { QueueCardModel } from "@/queue/types";

import type { QueueAccent } from "@/queue/types";

const accentToColor: Record<QueueAccent, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  gold: "#eab308",
  purple: "#a855f7",
  red: "#ef4444",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
};

export function QueueCard({ model }: { model: QueueCardModel }) {
  const accent = accentToColor[model.accent];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        backdropFilter: "blur(8px)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 12px ${accent}`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "clamp(1.125rem, 1.1rem + 0.9vw, 1.625rem)",
                fontWeight: 800,
                color: "#fff",
                lineHeight: 1.15,
                letterSpacing: 0.02,
              }}
            >
              {model.title}
            </div>
            {model.subtitle && (
              <div
                style={{
                  fontSize: "clamp(0.75rem, 0.7rem + 0.35vw, 0.875rem)",
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: 1.35,
                  letterSpacing: 0.25,
                  marginTop: 2,
                }}
              >
                {model.subtitle}
              </div>
            )}
          </div>
        </div>
        {model.nextUp.length > 0 && (
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.06)",
              padding: "2px 8px",
              borderRadius: 10,
              fontWeight: 500,
            }}
          >
            {model.nextUp.length} waiting
          </div>
        )}
      </div>

      {/* Now Serving - hero area */}
      <div
        style={{
          flex: 1,
          background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
          border: `1px solid ${accent}25`,
          borderRadius: 10,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          Now Serving
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: model.nowServing ? "#fff" : "rgba(255,255,255,0.12)",
            lineHeight: 1,
            letterSpacing: 2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {model.nowServing ?? "—"}
        </div>
      </div>

      {/* Next Up */}
      {model.nextUp.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
            Next Up
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {model.nextUp.slice(0, 5).map((item) => (
              <div
                key={item}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.5)",
                  background: "rgba(255,255,255,0.05)",
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontVariantNumeric: "tabular-nums",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {item}
              </div>
            ))}
            {model.nextUp.length > 5 && (
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.2)",
                  padding: "3px 8px",
                  alignSelf: "center",
                }}
              >
                +{model.nextUp.length - 5}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

