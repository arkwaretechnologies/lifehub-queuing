export type QueueCounterCode = string;

export type QueueScreen = {
  screen_id: string;
  name: string | null;
  counter_codes: QueueCounterCode[];
  playlist_id: string | null;
  is_active: boolean;
  updated_at: string;
  entrance_counter_code: string | null;
  entrance_regular_priority_code: string | null;
  entrance_priority_priority_code: string | null;
};

export type MediaPlaylist = {
  id: string;
  name: string;
  loop: boolean;
  is_default?: boolean;
  updated_at: string;
};

export type PrinterSettings = {
  id: string;
  clinic_name: string;
  header_text: string | null;
  footer_text: string | null;
  paper_width_mm: number;
  margin_mm: number;
  show_logo: boolean;
  auto_print: boolean;
  auto_print_delay_ms: number;
  font_size_number: number;
  printer_name: string | null;
  printer_id: string | null;
  updated_at: string;
};

export type MediaPlaylistItemType = "video" | "youtube" | "image";

export type MediaPlaylistItem = {
  id: string;
  playlist_id: string;
  sort_order: number;
  type: MediaPlaylistItemType;
  src: string;
  title: string | null;
  duration_seconds: number | null;
};

