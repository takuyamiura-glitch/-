export const BUSINESS_HOURS = { start: "09:00", end: "19:00" };

export type TimeSlot = {
  start: string; // "HH:MM"
  end: string;
  durationMinutes: number;
};

export type BookingDisplay = {
  id: number;
  title: string;
  start: string; // "HH:MM"
  end: string;
  organizer: string | null;
};

export type RoomAvailability = {
  id: number;
  name: string;
  type: "meeting_room" | "phone_booth";
  capacity: number;
  floor: string | null;
  description: string | null;
  bookings: BookingDisplay[];
  availableSlots: TimeSlot[];
};

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function calculateFreeSlots(
  bookings: BookingDisplay[],
  minDuration = 30
): TimeSlot[] {
  const dayStart = toMin(BUSINESS_HOURS.start);
  const dayEnd = toMin(BUSINESS_HOURS.end);

  const busy = bookings
    .map((b) => ({
      start: Math.max(toMin(b.start), dayStart),
      end: Math.min(toMin(b.end), dayEnd),
    }))
    .filter((b) => b.start < b.end)
    .sort((a, b) => a.start - b.start);

  // Merge overlapping intervals
  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    if (!merged.length || b.start > merged[merged.length - 1].end) {
      merged.push({ ...b });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        b.end
      );
    }
  }

  const free: TimeSlot[] = [];
  let cursor = dayStart;
  for (const b of merged) {
    const gap = b.start - cursor;
    if (gap >= minDuration) {
      free.push({
        start: toHHMM(cursor),
        end: toHHMM(b.start),
        durationMinutes: gap,
      });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd - cursor >= minDuration) {
    free.push({
      start: toHHMM(cursor),
      end: toHHMM(dayEnd),
      durationMinutes: dayEnd - cursor,
    });
  }

  return free;
}
