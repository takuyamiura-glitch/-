"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";

// ---- Types ----
type BookingDisplay = {
  id: number;
  title: string;
  start: string; // "HH:MM"
  end: string;
  organizer: string | null;
};

type TimeSlot = {
  start: string;
  end: string;
  durationMinutes: number;
};

type RoomAvailability = {
  id: number;
  name: string;
  type: "meeting_room" | "phone_booth";
  capacity: number;
  floor: string | null;
  description: string | null;
  bookings: BookingDisplay[];
  availableSlots: TimeSlot[];
};

type AvailabilityData = {
  date: string;
  businessHours: { start: string; end: string };
  rooms: RoomAvailability[];
};

// ---- Timeline constants (09:00 – 19:00) ----
const BIZ_START = 9;
const BIZ_END = 19;
const TOTAL_MIN = (BIZ_END - BIZ_START) * 60;
const HOURS = Array.from(
  { length: BIZ_END - BIZ_START + 1 },
  (_, i) => i + BIZ_START
);

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function leftPct(hhmm: string) {
  return ((toMin(hhmm) - BIZ_START * 60) / TOTAL_MIN) * 100;
}
function widthPct(start: string, end: string) {
  return ((toMin(end) - toMin(start)) / TOTAL_MIN) * 100;
}
function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

// ---- Timeline bar for a single room ----
function RoomTimeline({ room }: { room: RoomAvailability }) {
  const gridLines = Array.from(
    { length: BIZ_END - BIZ_START - 1 },
    (_, i) => ((i + 1) / (BIZ_END - BIZ_START)) * 100
  );

  return (
    <div className="relative h-8 bg-gray-100 rounded overflow-hidden select-none">
      {/* Hour grid lines */}
      {gridLines.map((pct) => (
        <div
          key={pct}
          className="absolute top-0 h-full border-l border-gray-200 pointer-events-none"
          style={{ left: `${pct}%` }}
        />
      ))}

      {/* Available slot highlights */}
      {room.availableSlots.map((slot, i) => (
        <div
          key={i}
          className="absolute top-0 h-full bg-emerald-100"
          style={{
            left: `${leftPct(slot.start)}%`,
            width: `${widthPct(slot.start, slot.end)}%`,
          }}
        />
      ))}

      {/* Bookings */}
      {room.bookings.map((b, i) => {
        const startMin = Math.max(toMin(b.start), BIZ_START * 60);
        const endMin = Math.min(toMin(b.end), BIZ_END * 60);
        if (startMin >= endMin) return null;
        const left = ((startMin - BIZ_START * 60) / TOTAL_MIN) * 100;
        const width = ((endMin - startMin) / TOTAL_MIN) * 100;
        return (
          <div
            key={i}
            className="absolute top-0 h-full bg-slate-400 text-white text-xs flex items-center overflow-hidden hover:bg-slate-500 transition-colors cursor-default"
            style={{ left: `${left}%`, width: `${width}%` }}
            title={`${b.title}${b.organizer ? `（${b.organizer}）` : ""}\n${b.start}〜${b.end}`}
          >
            <span className="truncate px-1">{b.title}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Add Booking Modal ----
function AddBookingModal({
  rooms,
  date,
  onClose,
  onAdded,
}: {
  rooms: RoomAvailability[];
  date: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [roomId, setRoomId] = useState(String(rooms[0]?.id ?? ""));
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [organizer, setOrganizer] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (startTime >= endTime) {
      setErr("終了時刻は開始時刻より後にしてください");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: Number(roomId),
          title,
          date,
          startTime,
          endTime,
          organizer,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error ?? "予約の追加に失敗しました");
        return;
      }
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">予約を追加</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              会議室
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}（
                  {r.type === "meeting_room" ? "会議室" : "フォンブース"} /{" "}
                  定員{r.capacity}名）
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              件名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="例：プロジェクト定例"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始時刻
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                min="09:00"
                max="19:00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了時刻
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min="09:00"
                max="19:00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              担当者
            </label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="例：田中"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {err && <p className="text-sm text-red-500">{err}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "予約する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Main component ----
export default function MeetingRoomSearch() {
  const { data: session } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [minDuration, setMinDuration] = useState(30);
  const [typeFilter, setTypeFilter] = useState<
    "all" | "meeting_room" | "phone_booth"
  >("all");
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/availability?date=${date}&minDuration=${minDuration}`
      );
      if (!res.ok) throw new Error("データの取得に失敗しました");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [date, minDuration]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRooms =
    data?.rooms.filter((r) => typeFilter === "all" || r.type === typeFilter) ??
    [];
  const availableCount = filteredRooms.filter(
    (r) => r.availableSlots.length > 0
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">
              会議室空き時間検索
            </h1>
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {session.user.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      className="w-7 h-7 rounded-full"
                    />
                  )}
                  <span className="hidden sm:inline">{session.user.name ?? session.user.email}</span>
                </div>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + 予約を追加
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">
                日付
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Min duration */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 whitespace-nowrap">
                最低空き時間
              </label>
              <select
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>30分以上</option>
                <option value={60}>1時間以上</option>
                <option value={90}>1時間30分以上</option>
                <option value={120}>2時間以上</option>
              </select>
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-1 ml-auto">
              {(
                [
                  { value: "all", label: "すべて" },
                  { value: "meeting_room", label: "会議室" },
                  { value: "phone_booth", label: "フォンブース" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTypeFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    typeFilter === value
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{data.date}</span>
                　営業時間{data.businessHours.start}〜{data.businessHours.end}
                　空きあり{" "}
                <span className="text-emerald-600 font-semibold">
                  {availableCount}
                </span>
                /{filteredRooms.length}室
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
                  空き
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-3 rounded bg-slate-400 inline-block" />
                  予約済み
                </span>
              </div>
            </div>

            {/* Timeline table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Time axis header */}
              <div className="flex items-center border-b border-gray-200 bg-gray-50">
                <div className="w-56 flex-shrink-0 px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  会議室
                </div>
                <div className="flex-1 pr-4 py-2">
                  <div className="flex justify-between">
                    {HOURS.map((h) => (
                      <span key={h} className="text-xs text-gray-400 font-mono">
                        {h}:00
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Room rows */}
              {filteredRooms.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">
                  該当する会議室はありません
                </div>
              ) : (
                filteredRooms.map((room, i) => (
                  <div
                    key={room.id}
                    className={`flex items-start border-b border-gray-100 last:border-0 py-3 ${
                      i % 2 === 0 ? "" : "bg-gray-50/40"
                    }`}
                  >
                    {/* Room info */}
                    <div className="w-56 flex-shrink-0 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm text-gray-800">
                          {room.name}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            room.type === "meeting_room"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-violet-100 text-violet-700"
                          }`}
                        >
                          {room.type === "meeting_room"
                            ? "会議室"
                            : "フォンブース"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {room.floor} · 定員{room.capacity}名
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {room.availableSlots.length === 0 ? (
                          <span className="text-xs text-rose-400 font-medium">
                            空きなし
                          </span>
                        ) : (
                          room.availableSlots.map((slot, j) => (
                            <div key={j} className="text-xs text-emerald-600">
                              ✓ {slot.start}〜{slot.end}
                              <span className="text-gray-400 ml-1">
                                ({fmtDur(slot.durationMinutes)})
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Timeline bar */}
                    <div className="flex-1 pr-4 pt-1">
                      <RoomTimeline room={room} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>

      {/* Add booking modal */}
      {showModal && data && (
        <AddBookingModal
          rooms={data.rooms}
          date={date}
          onClose={() => setShowModal(false)}
          onAdded={fetchData}
        />
      )}
    </div>
  );
}
