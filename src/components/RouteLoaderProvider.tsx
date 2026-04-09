"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Image from "next/image";

type RouteLoaderApi = {
  show: (opts?: { label?: string }) => void;
  hide: () => void;
};

const RouteLoaderContext = createContext<RouteLoaderApi | null>(null);

export function useRouteLoader() {
  const ctx = useContext(RouteLoaderContext);
  if (!ctx) throw new Error("useRouteLoader must be used within RouteLoaderProvider");
  return ctx;
}

export default function RouteLoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<string>("Loading module…");
  const hideTimerRef = useRef<number | null>(null);

  const hide = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setOpen(false);
  }, []);

  const show = useCallback((opts?: { label?: string }) => {
    setLabel(opts?.label ?? "Loading module…");
    setOpen(true);

    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      hideTimerRef.current = null;
    }, 12_000);
  }, []);

  // When navigation completes, automatically hide.
  useEffect(() => {
    if (!open) return;
    hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const api = useMemo<RouteLoaderApi>(() => ({ show, hide }), [show, hide]);

  return (
    <RouteLoaderContext.Provider value={api}>
      {children}
      {open && (
        <div className="lh-loader-overlay" role="status" aria-live="polite" aria-label={label}>
          <div className="lh-loader-card">
            <div className="lh-loader-brand">
              <div className="lh-loader-logo">
                <Image src="/lifehub-logo.png" alt="" width={44} height={44} priority />
              </div>
              <div className="lh-loader-text">
                <div className="lh-loader-title">Lifehub</div>
                <div className="lh-loader-subtitle">{label}</div>
              </div>
            </div>
            <div className="lh-loader-bar" aria-hidden="true">
              <div className="lh-loader-barFill" />
            </div>
            <div className="lh-loader-hint">Please wait…</div>
          </div>
        </div>
      )}
    </RouteLoaderContext.Provider>
  );
}

