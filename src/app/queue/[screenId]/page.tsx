import { QueueScreenClient } from "@/app/queue/[screenId]/QueueScreenClient";
import type { MediaPlaylistItem, QueueScreen } from "@/config/types";
import { supabaseServer } from "@/db/supabaseServer";
import { formatTicketDateForQueue } from "@/queue/ticketDate";
import type { QueueTicket } from "@/queue/types";

type Counter = { id: string; code: string; name: string; description: string | null };
type Priority = { id: number; code: string; name: string; level: number };

export default async function QueueScreenPage({ params }: { params: Promise<{ screenId: string }> }) {
  const { screenId } = await params;
  const supabase = supabaseServer();

  const { data: screen } = await supabase
    .from("queue_screens")
    .select("*")
    .eq("screen_id", screenId)
    .maybeSingle<QueueScreen>();

  const { data: countersRaw } = await supabase
    .from("queue_counters")
    .select("id, code, name, description")
    .eq("is_active", true);

  const counters = (countersRaw ?? []).map((c) => ({ ...c, id: String(c.id) })) as Counter[];

  const { data: prioritiesRaw } = await supabase
    .from("queue_priorities")
    .select("id, code, name, level")
    .eq("is_active", true);
  const priorities = (prioritiesRaw ?? []) as Priority[];

  const counterIds = counters.map((c) => c.id);
  const ticketDate = formatTicketDateForQueue(new Date());
  const { data: ticketsRaw } = await supabase
    .from("queue_tickets")
    .select(
      "id,counter_id,priority_id,queue_number,queue_display,ticket_date,status,issued_at,called_at,serving_at,completed_at",
    )
    .in("counter_id", counterIds.length ? counterIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("ticket_date", ticketDate)
    .in("status", ["Waiting", "Called", "Serving", "Completed"]);

  const initialTickets = (ticketsRaw ?? []).map((t) => ({
    ...(t as QueueTicket),
    id: String((t as QueueTicket).id),
    counter_id: String((t as QueueTicket).counter_id),
  })) as QueueTicket[];

  let playlistItems: MediaPlaylistItem[] = [];
  let playlistLoop = true;
  let playlistId = screen?.playlist_id ?? null;

  if (!playlistId) {
    const { data: defaultPlaylist } = await supabase
      .from("media_playlists")
      .select("id, loop")
      .eq("is_default", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    playlistId = defaultPlaylist?.id ?? null;
    playlistLoop = defaultPlaylist?.loop ?? true;

    if (!playlistId) {
      const { data: latestPlaylist } = await supabase
        .from("media_playlists")
        .select("id, loop")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      playlistId = latestPlaylist?.id ?? null;
      playlistLoop = latestPlaylist?.loop ?? true;
    }
  }

  if (playlistId) {
    const { data: playlist } = await supabase
      .from("media_playlists")
      .select("id, loop")
      .eq("id", playlistId)
      .maybeSingle();
    playlistLoop = playlist?.loop ?? true;

    const { data: itemsRaw } = await supabase
      .from("media_playlist_items")
      .select("id,playlist_id,sort_order,type,src,title,duration_seconds")
      .eq("playlist_id", playlistId)
      .order("sort_order", { ascending: true });
    playlistItems = (itemsRaw ?? []) as MediaPlaylistItem[];
  }

  return (
    <QueueScreenClient
      screenId={screenId}
      screen={screen ?? null}
      counters={counters}
      priorities={priorities}
      initialTickets={initialTickets}
      playlistItems={playlistItems}
      playlistLoop={playlistLoop}
    />
  );
}
