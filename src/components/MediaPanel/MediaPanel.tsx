"use client";

import { Card, Progress, Space, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaPlaylistItem } from "@/config/types";
import { getYouTubeVideoId } from "@/media/youtube";

type Props = {
  title?: string;
  items: MediaPlaylistItem[];
  loop: boolean;
};

declare global {
  interface Window {
    YT?: unknown;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayerLike = {
  destroy?: () => void;
  playVideo?: () => void;
};

type YouTubeApiLike = {
  Player?: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, string | number | boolean>;
      events: {
        onReady?: (e: { target?: YouTubePlayerLike }) => void;
        onStateChange?: (e: { data?: number }) => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayerLike;
};

export function MediaPanel({ title = "Announcements", items, loop }: Props) {
  const [idx, setIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YouTubePlayerLike | null>(null);

  const current = items[idx] ?? null;

  const useTimer =
    current?.type === "image" ||
    (current?.type === "youtube" && !!current.duration_seconds && current.duration_seconds > 0);
  const effectiveDuration = useMemo(() => {
    if (!current) return 0;
    if (current.type === "video") return 0;
    if (current.type === "image") return current.duration_seconds ?? 10;
    if (current.type === "youtube") return current.duration_seconds ?? 0;
    return 0;
  }, [current]);

  useEffect(() => {
    setTick(0);
  }, [idx]);

  useEffect(() => {
    if (!current || !useTimer || !effectiveDuration) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [current, useTimer, effectiveDuration]);

  useEffect(() => {
    if (!current || !useTimer || !effectiveDuration) return;
    if (tick < effectiveDuration) return;
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, effectiveDuration, current, useTimer]);

  function next() {
    if (!items.length) return;
    setIdx((prev) => {
      if (prev + 1 < items.length) return prev + 1;
      return loop ? 0 : prev;
    });
  }

  const youtubeId = current?.type === "youtube" ? getYouTubeVideoId(current.src) : null;
  const progressPct =
    useTimer && effectiveDuration ? Math.min(100, (tick / effectiveDuration) * 100) : 0;

  // YouTube: advance only when the video finishes (IFrame Player API).
  useEffect(() => {
    if (!current || current.type !== "youtube" || !youtubeId) return;

    let cancelled = false;

    function destroyPlayer() {
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        // ignore
      } finally {
        ytPlayerRef.current = null;
      }
    }

    async function ensureYouTubeApi(): Promise<void> {
      const yt = window.YT as YouTubeApiLike | undefined;
      if (yt?.Player) return;
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existing) {
        // Wait for it to be ready.
        await new Promise<void>((resolve) => {
          const prev = window.onYouTubeIframeAPIReady;
          window.onYouTubeIframeAPIReady = () => {
            prev?.();
            resolve();
          };
        });
        return;
      }

      await new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          resolve();
        };
        document.head.appendChild(script);
      });
    }

    (async () => {
      try {
        await ensureYouTubeApi();
        if (cancelled) return;
        const host = ytHostRef.current;
        if (!host) return;

        destroyPlayer();

        const yt = window.YT as YouTubeApiLike | undefined;
        if (!yt?.Player) return;

        ytPlayerRef.current = new yt.Player(host, {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
          },
          events: {
            onReady: (e) => {
              try {
                e?.target?.playVideo?.();
              } catch {
                // ignore
              }
            },
            onStateChange: (e) => {
              // 0 = ENDED
              if (e?.data === 0) next();
            },
            onError: () => next(),
          },
        });
      } catch {
        // If YT script is blocked/unavailable, just fall back to the timer behavior.
      }
    })();

    return () => {
      cancelled = true;
      destroyPlayer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, youtubeId]);

  useEffect(() => {
    if (!current || current.type !== "video") return;
    const el = videoRef.current;
    if (!el) return;

    // Some kiosk/TV Chromium builds still require an explicit play() call.
    try {
      el.load();
      const p = el.play();
      if (p && typeof (p as Promise<void>).catch === "function") {
        (p as Promise<void>).catch(() => {
          // If it can’t autoplay (codec, policy, etc.), skip to the next item.
          next();
        });
      }
    } catch {
      next();
    }
    // We intentionally re-run when the current media changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  return (
    <Card
      title={
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{title}</Typography.Text>
          {current?.title ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {current.title}
            </Typography.Text>
          ) : null}
        </Space>
      }
      styles={{
        body: { padding: 0, height: "calc(100% - 58px)" },
      }}
      style={{ height: "100%" }}
    >
      <div style={{ height: "100%", position: "relative", background: "#000" }}>
        {!current ? (
          <div style={{ color: "#fff", padding: 16 }}>No media configured.</div>
        ) : current.type === "video" ? (
          <video
            key={current.id}
            ref={videoRef}
            src={current.src}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            autoPlay
            muted
            playsInline
            onEnded={next}
            onError={next}
          />
        ) : current.type === "image" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.id}
              src={current.src}
              alt={current.title || ""}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onError={next}
            />
            {effectiveDuration > 0 && (
              <div style={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
                <Progress percent={progressPct} showInfo={false} strokeColor="#1677ff" />
              </div>
            )}
          </>
        ) : youtubeId ? (
          <>
            <div
              key={current.id}
              ref={ytHostRef}
              style={{ width: "100%", height: "100%", border: 0 }}
            />
            {useTimer && effectiveDuration > 0 && (
              <div style={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
                <Progress percent={progressPct} showInfo={false} strokeColor="#1677ff" />
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "#fff", padding: 16 }}>
            Invalid YouTube link. ({current.src})
          </div>
        )}
      </div>
    </Card>
  );
}
