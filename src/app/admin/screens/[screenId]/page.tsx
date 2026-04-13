"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  DesktopOutlined,
  EyeOutlined,
  PoweroffOutlined,
  SaveOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { QueueScreen, MediaPlaylist } from "@/config/types";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };

export default function AdminScreenPage() {
  const { screenId } = useParams<{ screenId: string }>();
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screen, setScreen] = useState<QueueScreen | null>(null);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [playlists, setPlaylists] = useState<MediaPlaylist[]>([]);
  const [allScreens, setAllScreens] = useState<QueueScreen[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [screenRes, countersRes, prioritiesRes, playlistsRes, screensRes] =
        await Promise.all([
          fetch(`/api/config/screens/${screenId}`),
          fetch("/api/config/counters"),
          fetch("/api/config/priorities"),
          fetch("/api/config/playlists"),
          fetch("/api/config/screens"),
        ]);

      if (!screenRes.ok) {
        msgApi.error("Screen not found");
        setLoading(false);
        return;
      }

      const [screenData, countersData, prioritiesData, playlistsData, screensData] =
        await Promise.all([
          screenRes.json(),
          countersRes.json(),
          prioritiesRes.json(),
          playlistsRes.json(),
          screensRes.json(),
        ]);

      setScreen(screenData);
      setCounters(countersData);
      setPriorities(prioritiesData);
      setPlaylists(playlistsData);
      setAllScreens(screensData);

      form.setFieldsValue({
        name: screenData.name ?? "",
        is_active: screenData.is_active,
        counter_codes: screenData.counter_codes ?? [],
        playlist_id: screenData.playlist_id ?? null,
        entrance_counter_code: screenData.entrance_counter_code ?? null,
        entrance_regular_priority_code: screenData.entrance_regular_priority_code ?? null,
        entrance_priority_priority_code: screenData.entrance_priority_priority_code ?? null,
      });
    } catch {
      msgApi.error("Failed to load screen configuration");
    } finally {
      setLoading(false);
    }
  }, [screenId, form, msgApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const body: Record<string, unknown> = {
        name: values.name || null,
        is_active: values.is_active,
        counter_codes: values.counter_codes ?? [],
        playlist_id: values.playlist_id || null,
        entrance_counter_code: values.entrance_counter_code || null,
        entrance_regular_priority_code: values.entrance_regular_priority_code || null,
        entrance_priority_priority_code: values.entrance_priority_priority_code || null,
      };

      const res = await fetch(`/api/config/screens/${screenId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        msgApi.error(text || "Save failed");
        return;
      }

      const updated = await res.json();
      setScreen(updated);
      msgApi.success("Screen configuration saved");
    } catch {
      /* validation error — form will show inline */
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

  const counterOptions = counters.map((c) => ({
    label: `${c.name} (${c.code})`,
    value: c.code,
  }));

  const priorityOptions = priorities.map((p) => ({
    label: `${p.name} (${p.code})`,
    value: p.code,
  }));

  const playlistOptions = playlists.map((p) => ({
    label: p.name,
    value: p.id,
  }));

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

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px 48px" }}>
        {/* Back + heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Link href="/admin">
            <Button type="text" icon={<ArrowLeftOutlined />} style={{ borderRadius: 8 }} />
          </Link>
          <div style={{ flex: 1 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Screen Config
            </Typography.Title>
            <Typography.Text type="secondary">
              Configure which queues and playlists appear on the TV display.
            </Typography.Text>
          </div>
          <Space>
            <Link href={`/queue/${screenId}`} target="_blank">
              <Tooltip title="Preview this screen">
                <Button icon={<EyeOutlined />}>Preview</Button>
              </Tooltip>
            </Link>
            <Tooltip title="Reload data">
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} />
            </Tooltip>
          </Space>
        </div>

        {/* Screen selector tabs */}
        {allScreens.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {allScreens.map((s) => (
              <Link key={s.screen_id} href={`/admin/screens/${s.screen_id}`}>
                <Tag
                  color={s.screen_id === screenId ? "blue" : undefined}
                  style={{ cursor: "pointer", padding: "4px 12px", fontSize: 13, borderRadius: 6 }}
                  icon={<DesktopOutlined />}
                >
                  {s.name || s.screen_id}
                </Tag>
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <Card style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : !screen ? (
          <Card style={{ borderRadius: 12, textAlign: "center", padding: 40 }}>
            <Typography.Title level={4} type="secondary">
              Screen &quot;{screenId}&quot; not found
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              This screen ID does not exist in the database. Check your Supabase queue_screens table.
            </Typography.Paragraph>
            <Link href="/admin">
              <Button type="primary">Back to Dashboard</Button>
            </Link>
          </Card>
        ) : (
          <Form form={form} layout="vertical" requiredMark={false}>
            <Row gutter={20}>
              {/* Left column — General + Display counters */}
              <Col xs={24} lg={14}>
                <Card
                  title="General"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                >
                  <Form.Item
                    label="Screen Name"
                    name="name"
                    extra="A friendly label shown in the admin only."
                  >
                    <Input placeholder="e.g. Lobby TV" />
                  </Form.Item>

                  <Form.Item
                    label="Screen ID"
                    extra="Cannot be changed — this is the URL slug used by the TV display."
                  >
                    <Input value={screen.screen_id} disabled />
                  </Form.Item>

                  <Form.Item label="Active" name="is_active" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Card>

                <Card
                  title="Display Counters"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                  extra={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Shown as queue cards on the TV
                    </Typography.Text>
                  }
                >
                  <Form.Item
                    label="Counter Queues"
                    name="counter_codes"
                    extra="Select the counters whose queues should be displayed on this screen. Order matters — they appear left-to-right."
                  >
                    <Select
                      mode="multiple"
                      options={counterOptions}
                      placeholder="Select counters…"
                      allowClear
                      optionFilterProp="label"
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Card>
              </Col>

              {/* Right column — Entrance + Media */}
              <Col xs={24} lg={10}>
                <Card
                  title="Entrance Kiosk"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                  extra={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Ticket issuing
                    </Typography.Text>
                  }
                >
                  <Form.Item
                    label="Entrance Counter"
                    name="entrance_counter_code"
                    extra="The counter used by the entrance kiosk to issue tickets."
                  >
                    <Select
                      options={counterOptions}
                      placeholder="Select counter…"
                      allowClear
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Regular Priority"
                    name="entrance_regular_priority_code"
                    extra="Priority level for standard walk-in tickets."
                  >
                    <Select
                      options={priorityOptions}
                      placeholder="Select priority…"
                      allowClear
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  <Form.Item
                    label="Priority Lane"
                    name="entrance_priority_priority_code"
                    extra="Priority level for PWD, Senior, Pregnant tickets."
                  >
                    <Select
                      options={priorityOptions}
                      placeholder="Select priority…"
                      allowClear
                      optionFilterProp="label"
                    />
                  </Form.Item>
                </Card>

                <Card
                  title="Media Playlist"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                  extra={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Side panel content
                    </Typography.Text>
                  }
                >
                  <Form.Item
                    label="Playlist"
                    name="playlist_id"
                    extra="The video/media playlist shown on the right side of the TV screen."
                  >
                    <Select
                      options={playlistOptions}
                      placeholder="Select playlist…"
                      allowClear
                      optionFilterProp="label"
                    />
                  </Form.Item>

                  {playlists.length === 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      No playlists yet.{" "}
                      <Link href="/admin/media">Create one in Media Library</Link>.
                    </Typography.Text>
                  )}
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: "4px 0 20px" }} />

            {/* Save bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Last updated: {screen.updated_at ? new Date(screen.updated_at).toLocaleString() : "—"}
              </Typography.Text>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                style={{ borderRadius: 8, minWidth: 140 }}
              >
                Save Changes
              </Button>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}
