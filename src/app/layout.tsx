import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AntdRegistry from "@/components/AntdRegistry";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import RouteLoaderProvider from "@/components/RouteLoaderProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lifehub Queuing",
  description: "TV queuing display and admin configuration",
  icons: [{ rel: "icon", url: "/favicon.png" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AntdRegistry>
          <ConfigProvider
            theme={{
              algorithm: theme.defaultAlgorithm,
              token: {
                borderRadius: 4,
                borderRadiusLG: 6,
                colorInfo: "#3a87ad",
                fontFamily:
                  "var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
              },
              components: {
                Tooltip: {
                  fontSize: 12,
                },
                Checkbox: {
                  colorBorder: "#666",
                  borderRadius: 2,
                  algorithm: true,
                },
                Radio: {
                  colorBorder: "#666",
                  borderRadius: 2,
                  algorithm: true,
                },
              },
            }}
            wave={{ disabled: true }}
          >
            <AntdApp>
              <Suspense fallback={null}>
                <RouteLoaderProvider>{children}</RouteLoaderProvider>
              </Suspense>
            </AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
