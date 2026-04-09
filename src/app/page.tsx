"use client";

import { Card, Col, Row, Typography } from "antd";
import { PrinterOutlined, MonitorOutlined, SettingOutlined } from "@ant-design/icons";
import Image from "next/image";
import LoadingLink from "@/components/LoadingLink";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #f8f1e9 0%, #f0e6d9 100%)",
        padding: "40px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "min(1280px, 100%)", maxWidth: "1280px" }}>
        {/* Header with Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 48 }}>
          <Image
            src="/lifehub-logo.png"
            alt="Lifehub Medical & Diagnostic Center"
            width={92}
            height={92}
            priority
            style={{ borderRadius: 16 }}
          />
          <div>
            <Typography.Title
              level={1}
              style={{
                margin: 0,
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "-0.5px",
                color: "#1f2937",
              }}
            >
              Lifehub Queuing
            </Typography.Title>
            <Typography.Paragraph
              style={{
                margin: "8px 0 0",
                fontSize: 18,
                color: "#4b5563",
                maxWidth: 620,
              }}
            >
              Welcome to the Lifehub Medical & Diagnostic Center queuing system.
              <br />
              Select a module below to begin.
            </Typography.Paragraph>
          </div>
        </div>

        <Row gutter={[24, 24]}>
          {/* Entrance Kiosk */}
          <Col xs={24} lg={8}>
            <LoadingLink href="/entrance" label="Opening Entrance Kiosk…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{
                  height: "100%",
                  borderRadius: 20,
                  border: "2px solid #e5e7eb",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                styles={{
                  body: {
                    padding: 32,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  },
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #3b82f6, #1e40af)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 32,
                    }}
                  >
                    <PrinterOutlined />
                  </div>
                  <Typography.Title level={3} style={{ margin: 0, fontSize: 26 }}>
                    Entrance Kiosk
                  </Typography.Title>
                </div>

                <Typography.Paragraph style={{ fontSize: 16, lineHeight: 1.6, flex: 1 }}>
                  Issue <strong>Regular</strong> or <strong>Priority</strong> (Pregnant, PWD, Senior) queue numbers.
                  <br />
                  Tap to print your ticket instantly.
                </Typography.Paragraph>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 16,
                    borderTop: "1px solid #f3f4f6",
                    color: "#6b7280",
                    fontSize: 14,
                  }}
                >
                  Route: <code>/entrance</code>
                </div>
              </Card>
            </LoadingLink>
          </Col>

          {/* TV Screen */}
          <Col xs={24} lg={8}>
            <LoadingLink href="/queue" label="Opening TV Screen…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{
                  height: "100%",
                  borderRadius: 20,
                  border: "2px solid #e5e7eb",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                styles={{
                  body: {
                    padding: 32,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  },
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #10b981, #047857)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 32,
                    }}
                  >
                    <MonitorOutlined />
                  </div>
                  <Typography.Title level={3} style={{ margin: 0, fontSize: 26 }}>
                    TV Screen
                  </Typography.Title>
                </div>

                <Typography.Paragraph style={{ fontSize: 16, lineHeight: 1.6, flex: 1 }}>
                  Live display for waiting patients. Shows current queue numbers for Entrance, Laboratory, Dr. Mark,
                  and Dr. Ralph with looping media/ads on the side.
                </Typography.Paragraph>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 16,
                    borderTop: "1px solid #f3f4f6",
                    color: "#6b7280",
                    fontSize: 14,
                  }}
                >
                  Route: <code>/queue/lobby-tv</code>
                </div>
              </Card>
            </LoadingLink>
          </Col>

          {/* Admin */}
          <Col xs={24} lg={8}>
            <LoadingLink href="/admin" label="Opening Admin…" style={{ display: "block", height: "100%" }}>
              <Card
                hoverable
                style={{
                  height: "100%",
                  borderRadius: 20,
                  border: "2px solid #e5e7eb",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                styles={{
                  body: {
                    padding: 32,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  },
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 32,
                    }}
                  >
                    <SettingOutlined />
                  </div>
                  <Typography.Title level={3} style={{ margin: 0, fontSize: 26 }}>
                    Admin
                  </Typography.Title>
                </div>

                <Typography.Paragraph style={{ fontSize: 16, lineHeight: 1.6, flex: 1 }}>
                  Configure TV screens, manage media playlists, set printer settings, and more.
                  <br />
                  Login restricted to <strong>Admin</strong> and <strong>Receptionist</strong> roles.
                </Typography.Paragraph>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 16,
                    borderTop: "1px solid #f3f4f6",
                    color: "#6b7280",
                    fontSize: 14,
                  }}
                >
                  Route: <code>/admin</code>
                </div>
              </Card>
            </LoadingLink>
          </Col>
        </Row>

        <div style={{ textAlign: "center", marginTop: 48, color: "#9ca3af", fontSize: 13 }}>
          Lifehub Medical & Diagnostic Center • Queuing System v1.0
        </div>
      </div>
    </div>
  );
}