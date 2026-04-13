"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Form,
  Radio,
  Select,
  Space,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  PoweroffOutlined,
  PrinterOutlined,
} from "@ant-design/icons";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };
type FormValues = {
  counterCode: string;
  priorityCode: string;
};

export default function AdminCheckInPage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [countersRes, prioritiesRes] = await Promise.all([
          fetch("/api/config/counters"),
          fetch("/api/config/priorities"),
        ]);

        if (!countersRes.ok || !prioritiesRes.ok) {
          throw new Error("Failed to load check-in configuration");
        }

        const [countersData, prioritiesData] = await Promise.all([
          countersRes.json() as Promise<Counter[]>,
          prioritiesRes.json() as Promise<Priority[]>,
        ]);

        if (cancelled) return;
        setCounters(countersData);
        setPriorities(prioritiesData);
      } catch (error) {
        if (!cancelled) {
          const text = error instanceof Error ? error.message : "Failed to load check-in configuration";
          msgApi.error(text);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [msgApi]);

  const serviceCounters = useMemo(() => {
    return counters.filter((counter) => counter.code.toUpperCase() !== "RECEPTION");
  }, [counters]);

  const regularPriorityCode = useMemo(() => {
    const regular =
      priorities.find((priority) => /^(REG|REGULAR)$/i.test(priority.code)) ??
      priorities.find((priority) => /\bregular\b/i.test(priority.name));
    return regular?.code ?? priorities[0]?.code ?? "";
  }, [priorities]);

  const priorityLaneCode = useMemo(() => {
    const priority =
      priorities.find((lane) => /^(PRI|PRIORITY)$/i.test(lane.code)) ??
      priorities.find((lane) => /\bpriority\b/i.test(lane.name));
    return priority?.code ?? priorities[0]?.code ?? "";
  }, [priorities]);

  useEffect(() => {
    if (!serviceCounters.length || !priorities.length) return;
    form.setFieldsValue({
      counterCode: form.getFieldValue("counterCode") || serviceCounters[0]?.code,
      priorityCode: form.getFieldValue("priorityCode") || regularPriorityCode || priorityLaneCode,
    });
  }, [form, priorityLaneCode, priorities.length, regularPriorityCode, serviceCounters]);

  async function logout() {
    const res = await fetch("/api/admin/logout", { method: "POST" });
    if (!res.ok) {
      msgApi.error("Logout failed");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  async function handleCheckIn() {
    try {
      const values = await form.validateFields();
      setIssuing(true);

      const res = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const text = await res.text();
        msgApi.error(text || "Check-in failed");
        return;
      }

      const ticket = await res.json();
      msgApi.success(`Checked in successfully: ${ticket.queue_display}`);
      if (ticket?.id) {
        window.open(`/print/ticket/${ticket.id}`, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIssuing(false);
    }
  }

  const counterOptions = serviceCounters.map((counter) => ({
    label: `${counter.name} (${counter.code})`,
    value: counter.code,
  }));

  const laneOptions = [
    regularPriorityCode
      ? { label: "Regular", value: regularPriorityCode }
      : null,
    priorityLaneCode && priorityLaneCode !== regularPriorityCode
      ? { label: "Priority", value: priorityLaneCode }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

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
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/lifehub-logo.png" alt="Lifehub" width={36} height={36} style={{ borderRadius: 8 }} />
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>
              Appointment Check-in
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", lineHeight: 1 }}>
              Receptionist workflow
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

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Link href="/admin">
            <Button type="text" icon={<ArrowLeftOutlined />} style={{ borderRadius: 8 }} />
          </Link>
          <div style={{ flex: 1 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Check In Online Appointment
            </Typography.Title>
            <Typography.Text type="secondary">
              Scheduled patients skip the Entrance queue and get their real service ticket here.
            </Typography.Text>
          </div>
        </div>

        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Use this only for patients who already booked online."
            description="Walk-ins should still use the Entrance kiosk. Online appointments should be checked in here and routed directly to Consultation or Laboratory."
          />

          <Card
            loading={loading}
            title="Issue Service Ticket"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Prints immediately after check-in
              </Typography.Text>
            }
            styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
            style={{ borderRadius: 12 }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item
                label="Destination Queue"
                name="counterCode"
                rules={[{ required: true, message: "Select where the patient should be routed" }]}
                extra="Choose the real service queue the patient should join after arriving at Reception."
              >
                <Select
                  options={counterOptions}
                  placeholder="Select queue destination"
                  optionFilterProp="label"
                  disabled={!counterOptions.length}
                />
              </Form.Item>

              <Form.Item
                label="Lane"
                name="priorityCode"
                rules={[{ required: true, message: "Select the lane for this patient" }]}
                extra="Use Priority only for Senior, PWD, or Pregnant patients."
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={laneOptions}
                  disabled={!laneOptions.length}
                />
              </Form.Item>

              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="Reception-only path"
                description="Patients with online appointments should proceed directly to Reception for check-in and should not take an Entrance ticket."
                style={{ marginBottom: 18 }}
              />

              <Space>
                <Button
                  type="primary"
                  size="large"
                  icon={<PrinterOutlined />}
                  onClick={handleCheckIn}
                  loading={issuing}
                  disabled={!counterOptions.length || !laneOptions.length}
                >
                  Check In and Print Ticket
                </Button>
                <Link href="/entrance">
                  <Button size="large">Open Entrance Kiosk</Button>
                </Link>
              </Space>
            </Form>
          </Card>
        </Space>
      </div>
    </div>
  );
}
