"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
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
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined,
  PlaySquareOutlined,
  ReloadOutlined,
  YoutubeOutlined,
  VideoCameraOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import type { MediaPlaylist, MediaPlaylistItem } from "@/config/types";

export default function AdminMediaPage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();

  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState<MediaPlaylist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<MediaPlaylistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editSaving, setEditSaving] = useState(false);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm] = Form.useForm();
  const [addingItem, setAddingItem] = useState(false);

  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemForm] = Form.useForm();
  const [editItemSaving, setEditItemSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const selected = playlists.find((p) => p.id === selectedId) ?? null;

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config/playlists");
      if (!res.ok) throw new Error();
      const data: MediaPlaylist[] = await res.json();
      setPlaylists(data);
      if (data.length && !selectedId) {
        const def = data.find((p) => p.is_default) ?? null;
        setSelectedId((def ?? data[0]).id);
      }
    } catch {
      msgApi.error("Failed to load playlists");
    } finally {
      setLoading(false);
    }
  }, [msgApi, selectedId]);

  async function setDefaultPlaylist(id: string) {
    const res = await fetch(`/api/config/playlists/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (!res.ok) {
      msgApi.error((await res.text()) || "Failed to set default playlist");
      return;
    }
    const updated: MediaPlaylist = await res.json();
    setPlaylists((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : { ...p, is_default: false })),
    );
    msgApi.success("Default playlist updated");
  }

  const loadItems = useCallback(
    async (pid: string) => {
      setItemsLoading(true);
      try {
        const res = await fetch(`/api/config/playlists/${pid}/items`);
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch {
        msgApi.error("Failed to load items");
      } finally {
        setItemsLoading(false);
      }
    },
    [msgApi],
  );

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (selectedId) loadItems(selectedId);
    else setItems([]);
  }, [selectedId, loadItems]);

  async function handleCreate() {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const res = await fetch("/api/config/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: values.name, loop: values.loop ?? true }),
      });
      if (!res.ok) {
        msgApi.error(await res.text());
        return;
      }
      const created: MediaPlaylist = await res.json();
      setPlaylists((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setCreateOpen(false);
      createForm.resetFields();
      msgApi.success("Playlist created");
    } catch {
      /* validation */
    } finally {
      setCreating(false);
    }
  }

  async function handleEditPlaylist() {
    if (!selectedId) return;
    try {
      const values = await editForm.validateFields();
      setEditSaving(true);
      const res = await fetch(`/api/config/playlists/${selectedId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: values.name, loop: values.loop }),
      });
      if (!res.ok) {
        msgApi.error(await res.text());
        return;
      }
      const updated: MediaPlaylist = await res.json();
      setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditOpen(false);
      msgApi.success("Playlist updated");
    } catch {
      /* validation */
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeletePlaylist(id: string) {
    const res = await fetch(`/api/config/playlists/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      msgApi.error("Delete failed");
      return;
    }
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) {
      const remaining = playlists.filter((p) => p.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
    msgApi.success("Playlist deleted");
  }

  async function uploadFile(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/config/upload", { method: "POST", body: fd });
      if (!res.ok) {
        msgApi.error(await res.text());
        return null;
      }
      const { url } = await res.json();
      return url as string;
    } catch {
      msgApi.error("Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleAddItem() {
    if (!selectedId) return;
    try {
      const values = await addItemForm.validateFields();
      setAddingItem(true);

      let src = values.src as string | undefined;
      const type = values.type as string;

      if ((type === "image" || type === "video") && pendingFile) {
        const url = await uploadFile(pendingFile);
        if (!url) return;
        src = url;
      } else if (type === "image" && !src) {
        msgApi.error("Upload an image or provide a URL");
        return;
      } else if (type === "video" && !src) {
        msgApi.error("Upload a video or provide a URL");
        return;
      }

      const needsDuration = type === "youtube" || type === "image";
      const res = await fetch(`/api/config/playlists/${selectedId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          src,
          title: values.title || null,
          duration_seconds: needsDuration ? (values.duration_seconds ?? 10) : null,
        }),
      });
      if (!res.ok) {
        msgApi.error(await res.text());
        return;
      }
      const created: MediaPlaylistItem = await res.json();
      setItems((prev) => [...prev, created]);
      setAddItemOpen(false);
      addItemForm.resetFields();
      setUploadPreview(null);
      setPendingFile(null);
      msgApi.success("Item added");
    } catch {
      /* validation */
    } finally {
      setAddingItem(false);
    }
  }

  async function handleEditItem() {
    if (!selectedId || !editItemId) return;
    try {
      const values = await editItemForm.validateFields();
      setEditItemSaving(true);
      const res = await fetch(`/api/config/playlists/${selectedId}/items/${editItemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          src: values.src,
          title: values.title || null,
          duration_seconds: values.duration_seconds ?? null,
        }),
      });
      if (!res.ok) {
        msgApi.error(await res.text());
        return;
      }
      const updated: MediaPlaylistItem = await res.json();
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setEditItemId(null);
      msgApi.success("Item updated");
    } catch {
      /* validation */
    } finally {
      setEditItemSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/config/playlists/${selectedId}/items/${itemId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) {
      msgApi.error("Delete failed");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    msgApi.success("Item removed");
  }

  async function moveItem(index: number, direction: -1 | 1) {
    if (!selectedId) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    const withOrder = reordered.map((item, i) => ({ ...item, sort_order: i + 1 }));
    setItems(withOrder);

    await fetch(`/api/config/playlists/${selectedId}/items`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: withOrder.map((item) => ({ id: item.id, sort_order: item.sort_order })),
      }),
    });
  }

  function openEditPlaylist() {
    if (!selected) return;
    editForm.setFieldsValue({ name: selected.name, loop: selected.loop });
    setEditOpen(true);
  }

  function openEditItem(item: MediaPlaylistItem) {
    editItemForm.setFieldsValue({
      src: item.src,
      title: item.title ?? "",
      duration_seconds: item.duration_seconds,
    });
    setEditItemId(item.id);
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

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Link href="/admin">
            <Button type="text" icon={<ArrowLeftOutlined />} style={{ borderRadius: 8 }} />
          </Link>
          <div style={{ flex: 1 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Media Library
            </Typography.Title>
            <Typography.Text type="secondary">
              Manage video playlists shown on the TV side panel.
            </Typography.Text>
          </div>
          <Tooltip title="Reload">
            <Button icon={<ReloadOutlined />} onClick={loadPlaylists} loading={loading} />
          </Tooltip>
        </div>

        {loading ? (
          <Card style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        ) : (
          <Row gutter={20}>
            {/* Left: Playlist list */}
            <Col xs={24} lg={8}>
              <Card
                title="Playlists"
                style={{ borderRadius: 12, marginBottom: 20 }}
                styles={{ header: { borderBottom: "1px solid #f0f0f0" }, body: { padding: 0 } }}
                extra={
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      createForm.resetFields();
                      setCreateOpen(true);
                    }}
                  >
                    New
                  </Button>
                }
              >
                {playlists.length === 0 ? (
                  <div style={{ padding: 24 }}>
                    <Empty description="No playlists yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                ) : (
                  <div>
                    {playlists.map((pl) => (
                      <div
                        key={pl.id}
                        onClick={() => setSelectedId(pl.id)}
                        style={{
                          cursor: "pointer",
                          padding: "12px 16px",
                          background: pl.id === selectedId ? "#e6f4ff" : undefined,
                          borderLeft: pl.id === selectedId ? "3px solid #1677ff" : "3px solid transparent",
                          borderBottom: "1px solid #f0f0f0",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <PlaySquareOutlined
                          style={{ fontSize: 20, color: pl.id === selectedId ? "#1677ff" : "#999", flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Typography.Text strong={pl.id === selectedId}>
                            {pl.name}
                          </Typography.Text>
                          <div>
                            <Tag color={pl.loop ? "blue" : "default"} style={{ fontSize: 11 }}>
                              {pl.loop ? "Loop" : "Once"}
                            </Tag>
                            {pl.is_default ? (
                              <Tag color="green" style={{ fontSize: 11 }}>
                                Default
                              </Tag>
                            ) : null}
                          </div>
                        </div>
                        <Popconfirm
                          title="Delete this playlist?"
                          description="All items inside will also be removed."
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            handleDeletePlaylist(pl.id);
                          }}
                          onCancel={(e) => e?.stopPropagation()}
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            {/* Right: Items for selected playlist */}
            <Col xs={24} lg={16}>
              {!selectedId ? (
                <Card style={{ borderRadius: 12, textAlign: "center", padding: 40 }}>
                  <Empty description="Select or create a playlist" />
                </Card>
              ) : (
                <Card
                  title={
                    <Space>
                      <span>{selected?.name ?? "Playlist"}</span>
                      {selected && (
                        <Tag color={selected.loop ? "blue" : "default"} style={{ fontSize: 11 }}>
                          {selected.loop ? "Loop" : "Play once"}
                        </Tag>
                      )}
                      {selected?.is_default ? (
                        <Tag color="green" style={{ fontSize: 11 }}>
                          Default
                        </Tag>
                      ) : null}
                    </Space>
                  }
                  style={{ borderRadius: 12, marginBottom: 20 }}
                  styles={{ header: { borderBottom: "1px solid #f0f0f0" } }}
                  extra={
                    <Space>
                      <Button
                        size="small"
                        onClick={() => selectedId && setDefaultPlaylist(selectedId)}
                        disabled={!selectedId || !!selected?.is_default}
                      >
                        Set Default
                      </Button>
                      <Button size="small" icon={<EditOutlined />} onClick={openEditPlaylist}>
                        Edit
                      </Button>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          addItemForm.resetFields();
                          addItemForm.setFieldsValue({ type: "youtube", duration_seconds: 30 });
                          setUploadPreview(null);
                          setPendingFile(null);
                          setAddItemOpen(true);
                        }}
                      >
                        Add Item
                      </Button>
                    </Space>
                  }
                >
                  {itemsLoading ? (
                    <Skeleton active paragraph={{ rows: 4 }} />
                  ) : items.length === 0 ? (
                    <Empty
                      description="No media items yet"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          addItemForm.resetFields();
                          addItemForm.setFieldsValue({ type: "youtube", duration_seconds: 30 });
                          setUploadPreview(null);
                          setPendingFile(null);
                          setAddItemOpen(true);
                        }}
                      >
                        Add First Item
                      </Button>
                    </Empty>
                  ) : (
                    <div>
                      {items.map((item, index) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "10px 0",
                            borderBottom: index < items.length - 1 ? "1px solid #f0f0f0" : undefined,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {item.type === "image" ? (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                overflow: "hidden",
                                background: "#f3f4f6",
                                flexShrink: 0,
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.src}
                                alt={item.title ?? ""}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                display: "grid",
                                placeItems: "center",
                                background: item.type === "youtube" ? "#fee2e2" : "#dbeafe",
                                color: item.type === "youtube" ? "#dc2626" : "#2563eb",
                                fontSize: 18,
                                flexShrink: 0,
                              }}
                            >
                              {item.type === "youtube" ? <YoutubeOutlined /> : <VideoCameraOutlined />}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Typography.Text ellipsis style={{ maxWidth: 260 }}>
                                {item.title || item.src}
                              </Typography.Text>
                              <Tag style={{ fontSize: 11 }}>#{item.sort_order}</Tag>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                                {item.src}
                              </Typography.Text>
                              {item.duration_seconds && (
                                <Tag style={{ fontSize: 11 }}>{item.duration_seconds}s</Tag>
                              )}
                            </div>
                          </div>
                          <Space size={2}>
                            <Tooltip title="Move up">
                              <Button
                                type="text"
                                size="small"
                                icon={<ArrowUpOutlined />}
                                disabled={index === 0}
                                onClick={() => moveItem(index, -1)}
                              />
                            </Tooltip>
                            <Tooltip title="Move down">
                              <Button
                                type="text"
                                size="small"
                                icon={<ArrowDownOutlined />}
                                disabled={index === items.length - 1}
                                onClick={() => moveItem(index, 1)}
                              />
                            </Tooltip>
                            <Tooltip title="Edit">
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => openEditItem(item)}
                              />
                            </Tooltip>
                            <Popconfirm
                              title="Remove this item?"
                              onConfirm={() => handleDeleteItem(item.id)}
                            >
                              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </Col>
          </Row>
        )}
      </div>

      {/* Create Playlist Modal */}
      <Modal
        title="Create Playlist"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Enter a playlist name" }]}
          >
            <Input placeholder="e.g. Lobby Announcements" />
          </Form.Item>
          <Form.Item label="Loop" name="loop" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Playlist Modal */}
      <Modal
        title="Edit Playlist"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEditPlaylist}
        confirmLoading={editSaving}
        okText="Save"
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Enter a name" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Loop" name="loop" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Item Modal */}
      <Modal
        title="Add Media Item"
        open={addItemOpen}
        onCancel={() => {
          setAddItemOpen(false);
          setUploadPreview(null);
          setPendingFile(null);
        }}
        onOk={handleAddItem}
        confirmLoading={addingItem || uploading}
        okText={uploading ? "Uploading…" : "Add"}
      >
        <Form form={addItemForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Type"
            name="type"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: "YouTube Link", value: "youtube" },
                { label: "Upload Video", value: "video" },
                { label: "Upload Image", value: "image" },
              ]}
              onChange={() => { setUploadPreview(null); setPendingFile(null); }}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue("type");

              if (type === "image" || type === "video") {
                const isImage = type === "image";
                return (
                  <>
                    <Form.Item
                      label={isImage ? "Upload Image" : "Upload Video"}
                      extra={
                        isImage
                          ? "JPEG, PNG, GIF, WebP, or SVG. Max 10 MB."
                          : "MP4, WebM, or MOV. Max 100 MB."
                      }
                    >
                      <input
                        type="file"
                        accept={isImage ? "image/*" : "video/mp4,video/webm,video/quicktime"}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPendingFile(file);
                            setUploadPreview(URL.createObjectURL(file));
                            addItemForm.setFieldValue("src", undefined);
                          }
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 12px",
                          border: "1px solid #d9d9d9",
                          borderRadius: 6,
                          background: "#fafafa",
                          cursor: "pointer",
                        }}
                      />
                    </Form.Item>
                    {uploadPreview && (
                      <div style={{ marginBottom: 16 }}>
                        {isImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={uploadPreview}
                            alt="Preview"
                            style={{
                              maxWidth: "100%",
                              maxHeight: 180,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        ) : (
                          <video
                            src={uploadPreview}
                            controls
                            muted
                            style={{
                              maxWidth: "100%",
                              maxHeight: 180,
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                            }}
                          />
                        )}
                      </div>
                    )}
                    <Form.Item
                      label={`Or paste ${isImage ? "image" : "video"} URL`}
                      name="src"
                      extra={`If you already have a hosted URL, paste it here instead of uploading.`}
                    >
                      <Input placeholder={isImage ? "https://example.com/image.jpg" : "https://example.com/video.mp4"} />
                    </Form.Item>
                  </>
                );
              }

              return (
                <Form.Item
                  label="YouTube URL"
                  name="src"
                  rules={[{ required: true, message: "Enter a YouTube URL" }]}
                  extra="Paste the full YouTube URL or video ID."
                >
                  <Input placeholder="https://www.youtube.com/watch?v=..." />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label="Title" name="title">
            <Input placeholder="Optional display title" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue("type");
              if (type === "youtube" || type === "image") {
                return (
                  <Form.Item
                    label="Duration (seconds)"
                    name="duration_seconds"
                    extra={
                      type === "youtube"
                        ? "How long to show this video before advancing."
                        : "How long to display this image before advancing."
                    }
                  >
                    <InputNumber min={3} max={3600} style={{ width: "100%" }} />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        title="Edit Item"
        open={!!editItemId}
        onCancel={() => setEditItemId(null)}
        onOk={handleEditItem}
        confirmLoading={editItemSaving}
        okText="Save"
      >
        <Form form={editItemForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Source URL"
            name="src"
            rules={[{ required: true, message: "Enter a URL" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Title" name="title">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item
            label="Duration (seconds)"
            name="duration_seconds"
            extra="For YouTube items: time before auto-advancing."
          >
            <InputNumber min={5} max={3600} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
