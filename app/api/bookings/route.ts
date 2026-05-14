import { NextRequest, NextResponse } from "next/server";
import { addBooking, getAllRooms } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rooms = await getAllRooms();
    return NextResponse.json(rooms);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room_id, title, date, startTime, endTime, organizer } = body;

    if (!room_id || !title || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }
    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "終了時刻は開始時刻より後にしてください" },
        { status: 400 }
      );
    }

    const booking = await addBooking({
      room_id: Number(room_id),
      title,
      start_time: `${date} ${startTime}`,
      end_time: `${date} ${endTime}`,
      organizer: organizer || null,
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
