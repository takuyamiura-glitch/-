import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "meeting-rooms.db");

export type Room = {
  id: number;
  name: string;
  type: "meeting_room" | "phone_booth";
  capacity: number;
  floor: string | null;
  description: string | null;
};

export type Booking = {
  id: number;
  room_id: number;
  title: string;
  start_time: string; // "YYYY-MM-DD HH:MM"
  end_time: string;
  organizer: string | null;
};

function openDb(): DatabaseSync {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  return db;
}

function ensureSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL,
      capacity    INTEGER NOT NULL DEFAULT 1,
      floor       TEXT,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id    INTEGER NOT NULL REFERENCES rooms(id),
      title      TEXT    NOT NULL,
      start_time TEXT    NOT NULL,
      end_time   TEXT    NOT NULL,
      organizer  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time);
  `);
}

function seedRooms(db: DatabaseSync) {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM rooms")
    .get() as { c: number };
  if (row.c > 0) return;

  const ins = db.prepare(
    "INSERT INTO rooms (name, type, capacity, floor, description) VALUES (?, ?, ?, ?, ?)"
  );
  const rooms: [string, string, number, string, string][] = [
    ["大会議室", "meeting_room", 20, "3F", "大型スクリーン・ホワイトボード完備"],
    ["会議室A", "meeting_room", 10, "3F", "プロジェクター完備"],
    ["会議室B", "meeting_room", 6, "2F", "テレビ会議システム完備"],
    ["会議室C", "meeting_room", 4, "2F", "小規模ミーティング向け"],
    ["会議室D", "meeting_room", 4, "1F", "来客対応向け"],
    ["フォンブース1", "phone_booth", 1, "2F", "個別通話・集中作業向け"],
    ["フォンブース2", "phone_booth", 1, "2F", "個別通話・集中作業向け"],
    ["フォンブース3", "phone_booth", 1, "3F", "個別通話・集中作業向け"],
  ];
  for (const r of rooms) ins.run(...r);
}

function seedBookings(db: DatabaseSync, date: string) {
  const row = db
    .prepare(
      "SELECT COUNT(*) as c FROM bookings WHERE start_time >= ? AND start_time < ?"
    )
    .get(`${date} 00:00`, `${date} 23:59`) as { c: number };
  if (row.c > 0) return;

  const ins = db.prepare(
    "INSERT INTO bookings (room_id, title, start_time, end_time, organizer) VALUES (?, ?, ?, ?, ?)"
  );
  const t = (hhmm: string) => `${date} ${hhmm}`;

  // room 1=大会議室, 2=会議室A, 3=会議室B, 4=会議室C, 5=会議室D
  // room 6=フォンブース1, 7=フォンブース2, 8=フォンブース3
  const bookings: [number, string, string, string, string][] = [
    [1, "全社朝礼", t("09:00"), t("10:00"), "総務部"],
    [1, "営業部月次会議", t("14:00"), t("16:30"), "山田"],
    [2, "チーム朝会", t("09:00"), t("09:30"), "鈴木"],
    [2, "プロジェクト定例", t("11:00"), t("12:30"), "田中"],
    [2, "採用面接", t("15:00"), t("16:00"), "人事部"],
    [3, "週次レポート共有", t("10:00"), t("11:00"), "佐藤"],
    [3, "クライアント打ち合わせ", t("13:00"), t("15:00"), "営業部"],
    [4, "1on1ミーティング", t("09:30"), t("10:00"), "伊藤"],
    [4, "デザインレビュー", t("14:00"), t("15:30"), "渡辺"],
    [5, "ランチMTG", t("12:00"), t("13:00"), "中村"],
    [6, "外部通話", t("10:30"), t("11:00"), "高橋"],
    [6, "採用面談", t("14:00"), t("14:30"), "人事部"],
    [7, "外部通話", t("09:00"), t("09:30"), "木村"],
    [7, "外部ミーティング", t("13:30"), t("14:30"), "加藤"],
    [8, "外部通話", t("16:00"), t("16:30"), "吉田"],
  ];
  for (const b of bookings) ins.run(...b);
}

export function getRoomsWithBookings(
  date: string
): Array<Room & { bookings: Booking[] }> {
  const db = openDb();
  try {
    ensureSchema(db);
    seedRooms(db);
    seedBookings(db, date);

    const rooms = db
      .prepare("SELECT * FROM rooms ORDER BY type ASC, id ASC")
      .all() as Room[];
    const bookings = db
      .prepare(
        "SELECT * FROM bookings WHERE start_time >= ? AND start_time < ? ORDER BY room_id, start_time"
      )
      .all(`${date} 00:00`, `${date} 23:59`) as Booking[];

    return rooms.map((room) => ({
      ...room,
      bookings: bookings.filter((b) => b.room_id === room.id),
    }));
  } finally {
    db.close();
  }
}

export function addBooking(data: {
  room_id: number;
  title: string;
  start_time: string;
  end_time: string;
  organizer?: string;
}): Booking {
  const db = openDb();
  try {
    ensureSchema(db);
    const result = db
      .prepare(
        "INSERT INTO bookings (room_id, title, start_time, end_time, organizer) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        data.room_id,
        data.title,
        data.start_time,
        data.end_time,
        data.organizer ?? null
      );
    return db
      .prepare("SELECT * FROM bookings WHERE id = ?")
      .get(result.lastInsertRowid) as Booking;
  } finally {
    db.close();
  }
}

export function getAllRooms(): Room[] {
  const db = openDb();
  try {
    ensureSchema(db);
    seedRooms(db);
    return db
      .prepare("SELECT * FROM rooms ORDER BY type ASC, id ASC")
      .all() as Room[];
  } finally {
    db.close();
  }
}
