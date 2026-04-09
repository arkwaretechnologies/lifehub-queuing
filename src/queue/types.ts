export type QueueStatus =
  | "Waiting"
  | "Called"
  | "Serving"
  | "Completed"
  | "Skipped"
  | "Cancelled"
  | "No Show";

export type QueueTicket = {
  id: string;
  counter_id: string;
  priority_id: number;
  queue_number: number;
  queue_display: string;
  ticket_date: string;
  status: QueueStatus;
  issued_at: string;
  called_at: string | null;
  serving_at: string | null;
};

export type QueueCardModel = {
  title: string;
  subtitle?: string;
  nowServing: string | null;
  nextUp: string[];
  accent: "blue" | "green" | "gold" | "purple";
};

