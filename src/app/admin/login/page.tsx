"use client";

import { Button, Divider, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

type Values = { username: string; password: string };

export default function AdminLoginPage() {
  const [form] = Form.useForm<Values>();
  const [msgApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const next = search.get("next") || "/admin";

  async function onFinish(values: Values) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const text = await res.text();
        msgApi.error(text || "Login failed");
        return;
      }
      router.replace(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Lifehub bg watermark */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: 'url("/lifehub logo/lifehub bg.png")',
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(900px, 80vw) auto",
          opacity: 0.45,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {contextHolder}

      <div
        style={{
          width: "min(420px, 100%)",
          background: "rgba(255, 255, 255, 0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 24,
          border: "1px solid rgba(0, 0, 0, 0.08)",
          boxShadow: "0 8px 40px rgba(0, 0, 0, 0.06)",
          padding: "36px 32px 28px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Image
            src="/lifehub-logo.png"
            alt="Lifehub"
            width={180}
            height={180}
            priority
            style={{ borderRadius: 18, marginBottom: 2 }}
          />
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 700, color: "#1f2937" }}>
            Admin Panel
          </Typography.Title>
          <Typography.Paragraph style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 13 }}>
            Lifehub Medical & Diagnostic Center
          </Typography.Paragraph>
        </div>

        <Typography.Paragraph style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 13 }}>
          Sign in with your Lifehub account. Only <strong>Admin</strong> and{" "}
          <strong>Receptionist</strong> roles are authorized.
        </Typography.Paragraph>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: "Please enter your username" }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Username"
              autoComplete="username"
              style={{ borderRadius: 12 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: "#9ca3af" }} />}
              placeholder="Password"
              autoComplete="current-password"
              style={{ borderRadius: 12 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{
                height: 46,
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Sign in
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: "18px 0 10px" }} />

        <div style={{ textAlign: "center" }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Queuing System v1.0
          </Typography.Text>
        </div>
      </div>
    </div>
  );
}
