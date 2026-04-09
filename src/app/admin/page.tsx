"use client";

import Link from "next/link";
import { Button, Card, Col, Row, Statistic, Tooltip, Typography, message } from "antd";
import {
  DesktopOutlined,
  PlaySquareOutlined,
  PrinterOutlined,
  PoweroffOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoadingLink from "@/components/LoadingLink";

export default function AdminHomePage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();

  async function logout() {
    const res = await fetch("/api/admin/logout", { method: "POST" });
    if (!res.ok) {
      msgApi.error("Logout failed");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {contextHolder}

      {/* Top bar */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/lifehub-logo.png" alt="Lifehub" width={36} height={36} style={{ borderRadius: 8 }} />
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>
              Lifehub Admin
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", lineHeight: 1 }}>
              Queuing System
            </Typography.Text>
          </div>
        </div>

        <Tooltip title="Logout">
          <Button
            type="text"
            danger
            icon={<PoweroffOutlined style={{ fontSize: 18 }} />}
            onClick={logout}
            style={{ width: 40, height: 40, borderRadius: 10 }}
          />
        </Tooltip>
      </div>

      {/* Dashboard content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <Typography.Title level={3} style={{ margin: "0 0 6px" }}>
          Dashboard
        </Typography.Title>
        <Typography.Paragraph style={{ margin: "0 0 24px", color: "#6b7280" }}>
          Manage TV screens, media playlists, and printer settings.
        </Typography.Paragraph>

        {/* Quick stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Active Screens"
                value={1}
                prefix={<DesktopOutlined style={{ color: "#3b82f6" }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Queues Today"
                value={4}
                prefix={<TeamOutlined style={{ color: "#22c55e" }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Uptime"
                value="Online"
                prefix={<ClockCircleOutlined style={{ color: "#f59e0b" }} />}
              />
            </Card>
          </Col>
        </Row>

        {/* Module cards */}
        <Typography.Text strong style={{ fontSize: 14, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Modules
        </Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col xs={24} md={8}>
            <LoadingLink href="/admin/checkin" label="Opening Appointment Check-in…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{ height: "100%", borderRadius: 16, border: "1px solid #e5e7eb" }}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #14b8a6, #0f766e)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 22,
                    }}
                  >
                    <CheckCircleOutlined />
                  </div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Appointment Check-in
                  </Typography.Title>
                </div>
                <Typography.Paragraph style={{ margin: 0, color: "#6b7280" }}>
                  Check in scheduled patients at Reception and route them directly to Consultation or Laboratory.
                </Typography.Paragraph>
              </Card>
            </LoadingLink>
          </Col>

          <Col xs={24} md={8}>
            <LoadingLink href="/admin/screens/lobby-tv" label="Opening Screen Config…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{ height: "100%", borderRadius: 16, border: "1px solid #e5e7eb" }}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 22,
                    }}
                  >
                    <DesktopOutlined />
                  </div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Screen Config
                  </Typography.Title>
                </div>
                <Typography.Paragraph style={{ margin: 0, color: "#6b7280" }}>
                  Configure which queues and playlists appear on each TV screen.
                </Typography.Paragraph>
              </Card>
            </LoadingLink>
          </Col>

          <Col xs={24} md={8}>
            <LoadingLink href="/admin/media" label="Opening Media Library…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{ height: "100%", borderRadius: 16, border: "1px solid #e5e7eb" }}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #10b981, #047857)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 22,
                    }}
                  >
                    <PlaySquareOutlined />
                  </div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Media Library
                  </Typography.Title>
                </div>
                <Typography.Paragraph style={{ margin: 0, color: "#6b7280" }}>
                  Upload videos, add YouTube links, and arrange playlists for the TV display.
                </Typography.Paragraph>
              </Card>
            </LoadingLink>
          </Col>

          <Col xs={24} md={8}>
            <LoadingLink href="/admin/printer" label="Opening Printer Settings…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{ height: "100%", borderRadius: 16, border: "1px solid #e5e7eb" }}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 22,
                    }}
                  >
                    <PrinterOutlined />
                  </div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Printer Settings
                  </Typography.Title>
                </div>
                <Typography.Paragraph style={{ margin: 0, color: "#6b7280" }}>
                  Configure ticket paper size, header/footer text, and printer templates.
                </Typography.Paragraph>
              </Card>
            </LoadingLink>
          </Col>
        </Row>

        {/* Quick links */}
        <Typography.Text
          strong
          style={{ fontSize: 14, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginTop: 28 }}
        >
          Quick Links
        </Typography.Text>
        <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
          <Col xs={24} sm={12} md={6}>
            <LoadingLink href="/admin/checkin" label="Opening Appointment Check-in…">
              <Card hoverable size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                <CheckCircleOutlined style={{ fontSize: 20, color: "#14b8a6", marginBottom: 6 }} />
                <div>Appointment Check-in</div>
              </Card>
            </LoadingLink>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <LoadingLink href="/entrance" label="Opening Entrance Kiosk…">
              <Card hoverable size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                <PrinterOutlined style={{ fontSize: 20, color: "#3b82f6", marginBottom: 6 }} />
                <div>Entrance Kiosk</div>
              </Card>
            </LoadingLink>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <LoadingLink href="/queue/lobby-tv" label="Opening TV Screen…">
              <Card hoverable size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                <DesktopOutlined style={{ fontSize: 20, color: "#10b981", marginBottom: 6 }} />
                <div>TV Screen</div>
              </Card>
            </LoadingLink>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Link href="/">
              <Card hoverable size="small" style={{ borderRadius: 12, textAlign: "center" }}>
                <SettingOutlined style={{ fontSize: 20, color: "#6b7280", marginBottom: 6 }} />
                <div>Home</div>
              </Card>
            </Link>
          </Col>
        </Row>

        <div style={{ textAlign: "center", marginTop: 40, color: "#9ca3af", fontSize: 12 }}>
          Lifehub Medical & Diagnostic Center • Queuing System v1.0
        </div>
      </div>
    </div>
  );
}
