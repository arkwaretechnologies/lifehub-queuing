"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App as AntdApp, Button, Layout, Menu, Tooltip, Typography, message } from "antd";
import {
  HomeOutlined,
  DesktopOutlined,
  PlaySquareOutlined,
  PrinterOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
} from "@ant-design/icons";

const { Sider, Content } = Layout;

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function pickSelectedKey(pathname: string): string {
  const p = normalizePath(pathname);
  if (p === "/") return "home";
  if (p === "/admin" || p.startsWith("/admin/")) {
    if (p.startsWith("/admin/checkin")) return "checkin";
    if (p.startsWith("/admin/screens")) return "screens";
    if (p.startsWith("/admin/media")) return "media";
    if (p.startsWith("/admin/printer")) return "printer";
    return "admin";
  }
  return "admin";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();

  // Don’t wrap the login screen with the admin shell.
  if (normalizePath(pathname).startsWith("/admin/login")) return <>{children}</>;

  const selectedKey = pickSelectedKey(pathname);

  async function logout() {
    const res = await fetch("/api/admin/logout", { method: "POST" });
    if (!res.ok) {
      msgApi.error("Logout failed");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const itemStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: 12,
    margin: "6px auto",
    color: "rgba(255,255,255,0.85)",
    fontSize: 20,
  };

  const activeStyle: React.CSSProperties = {
    ...itemStyle,
    background: "#6d28d9",
    boxShadow: "0 10px 24px rgba(109, 40, 217, 0.35)",
    color: "#fff",
  };

  return (
    <AntdApp>
      {contextHolder}
      <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
        <Sider
          width={76}
          theme="dark"
          style={{
            background: "#111827",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 12,
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          <div style={{ padding: "6px 0 10px", textAlign: "center" }}>
            <Typography.Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: 800, letterSpacing: 0.4 }}>
              LH
            </Typography.Text>
          </div>

          {/* Icon-only menu (kiosk friendly) */}
          <Menu
            selectable={false}
            style={{ background: "transparent", borderInlineEnd: 0 }}
            items={[
              {
                key: "home",
                label: (
                  <Tooltip placement="right" title="Home">
                    <Link href="/" style={selectedKey === "home" ? activeStyle : itemStyle}>
                      <HomeOutlined />
                    </Link>
                  </Tooltip>
                ),
              },
              {
                key: "admin",
                label: (
                  <Tooltip placement="right" title="Admin Dashboard">
                    <Link href="/admin" style={selectedKey === "admin" ? activeStyle : itemStyle}>
                      <DesktopOutlined />
                    </Link>
                  </Tooltip>
                ),
              },
              {
                key: "checkin",
                label: (
                  <Tooltip placement="right" title="Appointment Check-in">
                    <Link href="/admin/checkin" style={selectedKey === "checkin" ? activeStyle : itemStyle}>
                      <CheckCircleOutlined />
                    </Link>
                  </Tooltip>
                ),
              },
              {
                key: "screens",
                label: (
                  <Tooltip placement="right" title="Screen Config">
                    <Link href="/admin/screens/lobby-tv" style={selectedKey === "screens" ? activeStyle : itemStyle}>
                      <DesktopOutlined />
                    </Link>
                  </Tooltip>
                ),
              },
              {
                key: "media",
                label: (
                  <Tooltip placement="right" title="Media Library">
                    <Link href="/admin/media" style={selectedKey === "media" ? activeStyle : itemStyle}>
                      <PlaySquareOutlined />
                    </Link>
                  </Tooltip>
                ),
              },
              {
                key: "printer",
                label: (
                  <Tooltip placement="right" title="Printer Settings">
                    <Link href="/admin/printer" style={selectedKey === "printer" ? activeStyle : itemStyle}>
                      <PrinterOutlined />
                    </Link>
                  </Tooltip>
                ),
              },
            ]}
          />

          <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "grid", placeItems: "center" }}>
            <Tooltip placement="right" title="Logout">
              <Button
                type="text"
                danger
                onClick={logout}
                icon={<LogoutOutlined style={{ fontSize: 20 }} />}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  color: "rgba(255,255,255,0.85)",
                }}
              />
            </Tooltip>
          </div>
        </Sider>

        <Layout style={{ background: "transparent" }}>
          <Content style={{ minWidth: 0 }}>{children}</Content>
        </Layout>
      </Layout>
    </AntdApp>
  );
}

