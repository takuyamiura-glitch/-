import path from "path";
import fs from "fs";

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
  start_time: string;
  end_time: string;
  organizer: string | null;
};

type Row = Record<string, unknown>;
type ExecResult = { rows: Row[]; lastInsertRowid?: number };

// ---- Turso (production) ----

async function tursoExec(sql: string, args: unknown[]): Promise<ExecResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const result = await client.execute({ sql, args });
  const rows: Row[] = result.rows.map((row: Record<string, unknown>) => ({ ...row }));
  return { rows, lastInsertRowid: Number(result.lastInsertRowid ?? 0) };
}

// ---- node:sqlite (local dev) ----

const DB_PATH = path.join(process.cwd(), "data", "meeting-rooms.db");
let _localDb: import("node:sqlite").DatabaseSync | null = null;

function getLocalDb() {
  if (!_localDb) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite");
    _localDb = new DatabaseSync(DB_PATH) as import("node:sqlite").DatabaseSync;
    _localDb.exec("PRAGMA journal_mode = WAL");
  }
  return _localDb!;
}

function localExec(sql: string, args: unknown[]): ExecResult {
  const db = getLocalDb();
  const upper = sql.trimStart().toUpperCase();
  const stmt = db.prepare(sql);
  if (upper.startsWith("SELECT")) {
    return { rows: stmt.all(...args) as Row[] };
  }
  const r = stmt.run(...args);
  return { rows: [], lastInsertRowid: Number(r.lastInsertRowid) };
}

// ---- Unified entry point ----

async function exec(sql: string, args: unknown[] = []): Promise<ExecResult> {
  if (process.env.TURSO_DATABASE_URL) {
    return tursoExec(sql, args);
  }
  return localExec(sql, args);
}

// ---- Schema + seed ----

const SCHEMA = `
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
`;

async function ensureSchema() {
  if (process.env.TURSO_DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    // Turso batch for multi-statement DDL
    await client.executeMultiple(SCHEMA);
  } else {
    getLocalDb().exec(SCHEMA);
  }
}

async function seedRooms() {
  const { rows } = await exec("SELECT COUNT(*) as c FROM rooms");
  if ((rows[0].c as number) > 0) return;

  const rooms: [string, string, number, string, string][] = [
    ["大会議室",    "meeting_room", 20, "3F", "大型スクリーン・ホワイトボード完備"],
    ["会議室A",     "meeting_room", 10, "3F", "プロジェクター完備"],
    ["会議室B",     "meeting_room",  6, "2F", "テレビ会議システム完備"],
    ["会議室C",     "meeting_room",  4, "2F", "小規模ミーティング向け"],
    ["会議室D",     "meeting_room",  4, "1F", "来客対応向け"],
    ["フォンブース1", "phone_booth",  1, "2F", "個別通話・集中作業向け"],
    ["フォンブース2", "phone_booth",  1, "2F", "個別通話・集中作業向け"],
    ["フォンブース3", "phone_booth",  1, "3F", "個別通話・集中作業向け"],
  ];
  for (const r of rooms) {
    await exec(
      "INSERT INTO rooms (name, type, capacity, floor, description) VALUES (?, ?, ?, ?, ?)",
      r
    );
  }
}

async function seedBookings(date: string) {
  const { rows } = await exec(
    "SELECT COUNT(*) as c FROM bookings WHERE start_time >= ? AND start_time < ?",
    [`${date} 00:00`, `${date} 23:59`]
  );
  if ((rows[0].c as number) > 0) return;

  const t = (hhmm: string) => `${date} ${hhmm}`;
  const bookings: [number, string, string, string, string][] = [
    [1, "全社朝礼",              t("09:00"), t("10:00"), "総務部"],
    [1, "営業部月次会議",        t("14:00"), t("16:30"), "山田"],
    [2, "チーム朝会",            t("09:00"), t("09:30"), "鈴木"],
    [2, "プロジェクト定例",      t("11:00"), t("12:30"), "田中"],
    [2, "採用面接",              t("15:00"), t("16:00"), "人事部"],
    [3, "週次レポート共有",      t("10:00"), t("11:00"), "佐藤"],
    [3, "クライアント打ち合わせ", t("13:00"), t("15:00"), "営業部"],
    [4, "1on1ミーティング",      t("09:30"), t("10:00"), "伊藤"],
    [4, "デザインレビュー",      t("14:00"), t("15:30"), "渡辺"],
    [5, "ランチMTG",             t("12:00"), t("13:00"), "中村"],
    [6, "外部通話",              t("10:30"), t("11:00"), "高橋"],
    [6, "採用面談",              t("14:00"), t("14:30"), "人事部"],
    [7, "外部通話",              t("09:00"), t("09:30"), "木村"],
    [7, "外部ミーティング",      t("13:30"), t("14:30"), "加藤"],
    [8, "外部通話",              t("16:00"), t("16:30"), "吉田"],
  ];
  for (const b of bookings) {
    await exec(
      "INSERT INTO bookings (room_id, title, start_time, end_time, organizer) VALUES (?, ?, ?, ?, ?)",
      b
    );
  }
}

// ---- Public API ----

let _initialized = false;

async function init(date?: string) {
  if (!_initialized || process.env.TURSO_DATABASE_URL) {
    await ensureSchema();
    await seedRooms();
    _initialized = true;
  }
  if (date) await seedBookings(date);
}

export async function getRoomsWithBookings(
  date: string
): Promise<Array<Room & { bookings: Booking[] }>> {
  await init(date);

  const [{ rows: roomRows }, { rows: bookingRows }] = await Promise.all([
    exec("SELECT * FROM rooms ORDER BY type ASC, id ASC"),
    exec(
      "SELECT * FROM bookings WHERE start_time >= ? AND start_time < ? ORDER BY room_id, start_time",
      [`${date} 00:00`, `${date} 23:59`]
    ),
  ]);

  const rooms = roomRows as unknown as Room[];
  const bookings = bookingRows as unknown as Booking[];

  return rooms.map((room) => ({
    ...room,
    bookings: bookings.filter((b) => Number(b.room_id) === Number(room.id)),
  }));
}

export async function addBooking(data: {
  room_id: number;
  title: string;
  start_time: string;
  end_time: string;
  organizer?: string;
}): Promise<Booking> {
  await init();
  const { lastInsertRowid } = await exec(
    "INSERT INTO bookings (room_id, title, start_time, end_time, organizer) VALUES (?, ?, ?, ?, ?)",
    [data.room_id, data.title, data.start_time, data.end_time, data.organizer ?? null]
  );
  const { rows } = await exec("SELECT * FROM bookings WHERE id = ?", [lastInsertRowid!]);
  return rows[0] as unknown as Booking;
}

export async function getAllRooms(): Promise<Room[]> {
  await init();
  const { rows } = await exec("SELECT * FROM rooms ORDER BY type ASC, id ASC");
  return rows as unknown as Room[];
}
