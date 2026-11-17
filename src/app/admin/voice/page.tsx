"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button, Card, Form, Radio, Skeleton, Typography, message } from "antd";
import { ArrowLeftOutlined, PoweroffOutlined, SaveOutlined, SoundOutlined } from "@ant-design/icons";
import type { QueueVoiceSettings } from "@/config/types";
import {
  PIPER_VOICE_CATALOG,
  PIPER_VOICE_CHOICES,
  type PiperVoiceChoice,
} from "@/queue/piperVoices";

export default function AdminVoicePage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<{ piper_voice: PiperVoiceChoice }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<QueueVoiceSettings | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config/voice");
      if (!res.ok) throw new Error();
      const data: QueueVoiceSettings = await res.json();
      setSettings(data);
    } catch {
      msgApi.error("Failed to load voice settings");
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading && settings) {
      form.setFieldsValue({ piper_voice: settings.piper_voice });
    }
  }, [loading, settings, form]);

  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await fetch("/api/config/voice", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        msgApi.error(res.status === 401 ? "Please log in as admin" : await res.text());
        return;
      }
      const updated: QueueVoiceSettings = await res.json();
      setSettings(updated);
      msgApi.success("Voice settings saved");
    } catch {
      /* validation */
    } finally {
      setSaving(false);
    }
  }

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
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/lifehub-logo.png" alt="Lifehub" width={36} height={36} style={{ borderRadius: 8 }} />
          <Typography.Text strong>Voice / Announcements</Typography.Text>
        </div>
        <Button type="text" danger icon={<PoweroffOutlined />} onClick={logout} />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
        <Link href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <ArrowLeftOutlined /> Back to dashboard
        </Link>

        <Card style={{ borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <SoundOutlined style={{ fontSize: 24, color: "#2563eb" }} />
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Lobby voice agent
              </Typography.Title>
              <Typography.Text type="secondary">
                Applies to all queue TV screens (global).
              </Typography.Text>
            </div>
          </div>

          <Form form={form} layout="vertical" onFinish={handleSave} disabled={loading}>
            {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}
            <Form.Item
              name="piper_voice"
              label="Announcement voice"
              hidden={loading}
              rules={[{ required: true, message: "Select a voice" }]}
            >
              <Radio.Group>
                {PIPER_VOICE_CHOICES.map((id) => (
                  <Radio key={id} value={id} style={{ display: "block", marginBottom: 8 }}>
                    {PIPER_VOICE_CATALOG[id].label}
                  </Radio>
                ))}
              </Radio.Group>
            </Form.Item>

            {!loading ? (
              <>
                <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                  Queue TVs load this voice during &quot;Loading Voice Agent&quot;. After changing the voice here,
                  refresh each lobby TV. Voice models must be installed under{" "}
                  <code>public/piper/models</code> (<code>npm run download:piper-voices</code>).
                </Typography.Paragraph>

                {settings?.updated_at ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
                    Last updated: {new Date(settings.updated_at).toLocaleString()}
                  </Typography.Text>
                ) : null}

                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  Save
                </Button>
              </>
            ) : null}
          </Form>
        </Card>
      </div>
    </div>
  );
}