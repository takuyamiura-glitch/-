import { NextRequest, NextResponse } from "next/server";
import { getRoomsWithBookings } from "@/lib/db";
import {
  calculateFreeSlots,
  BUSINESS_HOURS,
  RoomAvailability,
  BookingDisplay,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const date = params.get("date") ?? new Date().toISOString().slice(0, 10);
  const minDuration = Math.max(0, parseInt(params.get("minDuration") ?? "30", 10));

  try {
    const rooms = await getRoomsWithBookings(date);

    const result: RoomAvailability[] = rooms.map((room) => {
      const bookings: BookingDisplay[] = room.bookings.map((b) => ({
        id: b.id,
        title: b.title,
        start: b.start_time.slice(11, 16),
        end: b.end_time.slice(11, 16),
        organizer: b.organizer,
      }));
      return {
        id: room.id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        floor: room.floor,
        description: room.description,
        bookings,
        availableSlots: calculateFreeSlots(bookings, minDuration),
      };
    });

    return NextResponse.json({ date, businessHours: BUSINESS_HOURS, rooms: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
