"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Skeleton,
  Switch,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  PoweroffOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import type { PrinterSettings } from "@/config/types";
import {
  isBluetoothSupported,
  pairPrinter,
  testPrint as btTestPrint,
} from "@/print/bluetoothPrinter";

export default function AdminPrinterPage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PrinterSettings | null>(null);
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pairError, setPairError] = useState<{ title: string; details?: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config/printer");
      if (!res.ok) throw new Error();
      const data: PrinterSettings = await res.json();
      setSettings(data);
      form.setFieldsValue(data);
    } catch {
      msgApi.error("Failed to load printer settings");
    } finally {
      setLoading(false);
    }
  }, [form, msgApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await fetch("/api/config/printer", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        msgApi.error(await res.text());
        return;
      }
      const updated: PrinterSettings = await res.json();
      setSettings(updated);
      msgApi.success("Printer settings saved");
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

  const preview = Form.useWatch([], form);
  const bluetoothOk = useMemo(() => isBluetoothSupported(), []);
  const pairedName = Form.useWatch("printer_name", form) as string | null | undefined;

  function normalizePairError(e: unknown): { title: string; details?: string } {
    const details = e instanceof Error ? e.message : typeof e === "string" ? e : undefined;

    if (details?.includes("Invalid Service name")) {
      return {
        title: "Bluetooth printer pairing failed (invalid service UUID)",
        details,
      };
    }

    if (details?.toLowerCase().includes("notfounderror") || details?.toLowerCase().includes("user cancelled")) {
      return {
        title: "Pairing was cancelled",
        details,
      };
    }

    if (details?.toLowerCase().includes("securityerror")) {
      return {
        title: "Bluetooth permission denied",
        details,
      };
    }

    return {
      title: "Bluetooth printer pairing failed",
      details,
    };
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

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 24px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Link href="/admin">
            <Button type="text" icon={<ArrowLeftOutlined />} style={{ borderRadius: 8 }} />
          </Link>
          <div style={{ flex: 1 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Printer Settings
            </Typography.Title>
            <Typography.Text type="secondary">
              Configure ticket layout, paper size, and print behavior.
            </Typography.Text>
          </div>
          <Tooltip title="Reload">
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} />
          </Tooltip>
        </div>

        {loading ? (
          <Card style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : (
          <Form form={form} layout="vertical" requiredMark={false}>
            <Row gutter={24}>
              {/* Left: Settings */}
              <Col xs={24} lg={14}>
                <Card
                  title="Branding"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                >
                  <Form.Item
                    label="Clinic Name"
                    name="clinic_name"
                    rules={[{ required: true, message: "Enter clinic name" }]}
                  >
                    <Input placeholder="Lifehub Medical & Diagnostic Center" />
                  </Form.Item>
                  <Form.Item
                    label="Header Text"
                    name="header_text"
                    extra="Printed above the queue number."
                  >
                    <Input placeholder="Entrance Queue" />
                  </Form.Item>
                  <Form.Item
                    label="Footer Text"
                    name="footer_text"
                    extra="Printed below the date/time."
                  >
                    <Input placeholder="Please wait for your number to be called." />
                  </Form.Item>
                  <Form.Item label="Show Logo" name="show_logo" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Card>

                <Card
                  title="Paper & Layout"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="Paper Width (mm)"
                        name="paper_width_mm"
                        extra="Common: 58mm or 80mm thermal."
                      >
                        <InputNumber min={30} max={210} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Margin (mm)"
                        name="margin_mm"
                      >
                        <InputNumber min={0} max={30} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label="Queue Number Font Size"
                    name="font_size_number"
                    extra="Size in px for the large queue number."
                  >
                    <InputNumber min={16} max={80} style={{ width: "100%" }} />
                  </Form.Item>
                </Card>

                <Card
                  title="Print Behavior"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                >
                  <Form.Item
                    label="Auto Print"
                    name="auto_print"
                    valuePropName="checked"
                    extra="Automatically trigger the browser print dialog when the ticket page opens."
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) => prev.auto_print !== cur.auto_print}
                  >
                    {({ getFieldValue }) =>
                      getFieldValue("auto_print") ? (
                        <Form.Item
                          label="Auto Print Delay (ms)"
                          name="auto_print_delay_ms"
                          extra="Milliseconds to wait before triggering print (allows page to render)."
                        >
                          <InputNumber min={100} max={5000} step={50} style={{ width: "100%" }} />
                        </Form.Item>
                      ) : null
                    }
                  </Form.Item>
                </Card>

                <Card
                  title="Printer Connection (Bluetooth or USB)"
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                >
                  {!bluetoothOk && (
                    <Alert
                      message="Bluetooth not supported"
                      description={
                        <>
                          This browser/device does not support Web Bluetooth. If you&apos;re on iPad/iOS, Web Bluetooth is not available in Safari.
                          You can still print using a USB/system printer via the browser print dialog, or use an Android tablet with Chrome for Bluetooth.
                        </>
                      }
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  {bluetoothOk && pairedName && (
                    <Alert
                      message={`Printer paired: ${pairedName}`}
                      type="success"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  {bluetoothOk && pairError && (
                    <Alert
                      type="error"
                      showIcon
                      closable
                      onClose={() => setPairError(null)}
                      message={pairError.title}
                      description={
                        pairError.details ? (
                          <Typography.Paragraph
                            style={{ marginBottom: 0 }}
                            type="secondary"
                            copyable={{ text: pairError.details }}
                            ellipsis={{ rows: 3, expandable: true }}
                          >
                            {pairError.details}
                          </Typography.Paragraph>
                        ) : null
                      }
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <Button
                      icon={<PrinterOutlined />}
                      loading={pairing}
                      disabled={!bluetoothOk}
                      onClick={async () => {
                        setPairing(true);
                        setPairError(null);
                        try {
                          const name = await pairPrinter();
                          form.setFieldValue("printer_name", name);
                          msgApi.success(`Paired: ${name}`);
                        } catch (e) {
                          const norm = normalizePairError(e);
                          setPairError(norm);
                          msgApi.error(norm.title);
                        } finally {
                          setPairing(false);
                        }
                      }}
                    >
                      Pair Printer
                    </Button>
                    <Button
                      loading={testing}
                      disabled={!bluetoothOk || !pairedName}
                      onClick={async () => {
                        const current = (await form.validateFields().catch(() => null)) as Partial<PrinterSettings> | null;
                        if (!current) return;
                        setTesting(true);
                        try {
                          const ok = await btTestPrint(pairedName as string, {
                            ...(settings ?? current),
                            ...(current as PrinterSettings),
                          } as PrinterSettings);
                          if (ok) msgApi.success("Test print sent");
                          else msgApi.warning("Test print failed (will fall back to browser print)");
                        } catch {
                          msgApi.error("Test print failed");
                        } finally {
                          setTesting(false);
                        }
                      }}
                    >
                      Test Print
                    </Button>
                  </div>

                  <Form.Item
                    label="Paired Device Name"
                    name="printer_name"
                    extra="For Bluetooth: click Pair Printer, then Save Changes. For USB/system printer: leave empty and the app will use the browser print dialog."
                  >
                    <Input placeholder="(paired device name)" />
                  </Form.Item>
                </Card>
              </Col>

              {/* Right: Live preview */}
              <Col xs={24} lg={10}>
                <Card
                  title="Ticket Preview"
                  style={{ borderRadius: 12, position: "sticky", top: 80 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                >
                  <div
                    style={{
                      border: "1px dashed #d9d9d9",
                      borderRadius: 8,
                      background: "#fff",
                      padding: `${preview?.margin_mm ?? 4}mm`,
                      width: `${preview?.paper_width_mm ?? 58}mm`,
                      maxWidth: "100%",
                      margin: "0 auto",
                      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                      color: "#000",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      {preview?.show_logo && (
                        <div style={{ marginBottom: 4 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/lifehub-logo.png"
                            alt=""
                            style={{ width: 28, height: 28, borderRadius: 4 }}
                          />
                        </div>
                      )}
                      {preview?.clinic_name && (
                        <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, lineHeight: 1.2 }}>
                          {preview.clinic_name}
                        </div>
                      )}
                      {preview?.header_text && (
                        <div style={{ fontSize: 8, color: "#666", marginBottom: 6 }}>
                          {preview.header_text}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: preview?.font_size_number ?? 40,
                          fontWeight: 800,
                          letterSpacing: 1,
                          lineHeight: 1.1,
                          margin: "4px 0",
                        }}
                      >
                        E-001
                      </div>
                      <div style={{ fontSize: 8, color: "#666", marginTop: 4 }}>
                        {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {preview?.footer_text && (
                        <>
                          <div style={{ borderTop: "1px dashed #ccc", margin: "6px 0" }} />
                          <div style={{ fontSize: 7, color: "#999", lineHeight: 1.3 }}>
                            {preview.footer_text}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <Typography.Text
                    type="secondary"
                    style={{ display: "block", textAlign: "center", marginTop: 12, fontSize: 11 }}
                  >
                    Scaled preview — actual print may vary.
                  </Typography.Text>
                </Card>
              </Col>
            </Row>

            <Divider style={{ margin: "4px 0 20px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Last updated: {settings?.updated_at ? new Date(settings.updated_at).toLocaleString() : "—"}
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
