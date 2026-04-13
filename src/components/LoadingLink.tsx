"use client";

import Link, { type LinkProps } from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { useRouteLoader } from "@/components/RouteLoaderProvider";

type Props = LinkProps & {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

export default function LoadingLink({ children, label, onClick, ...props }: Props) {
  const { show } = useRouteLoader();

  return (
    <Link
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        // Don’t show for new-tab or modified clicks.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        show({ label });
      }}
    >
      {children}
    </Link>
  );
}

