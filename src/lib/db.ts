// Minimal IndexedDB wrapper for tracks (with audio blobs) and app state.
export type Category = "music" | "quran";
export interface Track {
  id: string;
  name: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  category: Category;
  addedAt: number;
  lastPlayed: number;
  plays: number;
  lyrics: string;
  cover?: string;
  order: number;
  size: number;
}
export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

const DB = "naghma-db";
let dbp: Promise<IDBDatabase> | null = null;
function open() {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore("tracks", { keyPath: "id" });
        d.createObjectStore("blobs");
        d.createObjectStore("playlists", { keyPath: "id" });
        d.createObjectStore("kv");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => res(req ? (req as IDBRequest<T>).result : (undefined as T));
    t.onerror = () => rej(t.error);
  });
}
export const db = {
  all: <T>(store: string) => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  put: (store: string, v: unknown, key?: IDBValidKey) => tx(store, "readwrite", (s) => { s.put(v, key); }),
  del: (store: string, key: IDBValidKey) => tx(store, "readwrite", (s) => { s.delete(key); }),
  get: <T>(store: string, key: IDBValidKey) => tx<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>),
};

const QURAN_HINTS = [
  "سورة", "سوره", "قرآن", "قران", "القران", "القرآن", "quran", "koran", "surah", "sura", "surat", "tilawat", "تلاوة", "ترتيل", "جزء", "juz",
  "الفاتحة", "البقرة", "عمران", "النساء", "المائدة", "الأنعام", "الكهف", "يس", "الرحمن", "الملك", "الواقعة", "مريم", "طه", "النبأ",
  "alafasy", "العفاسي", "السديس", "الشريم", "المنشاوي", "عبدالباسط", "عبد الباسط", "الحصري", "ماهر", "المعيقلي", "الغامدي", "الدوسري", "قارئ", "mishary", "sudais", "minshawi", "husary",
];
export function isQuran(path: string) {
  const p = path.toLowerCase();
  return QURAN_HINTS.some((h) => p.includes(h.toLowerCase()));
}
export const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm|wma|amr|3gp)$/i;

export function parseName(file: string) {
  const base = file.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const m = base.split(/\s+-\s+/);
  if (m.length >= 2) return { artist: m[0] ?? "", title: m.slice(1).join(" - ") };
  return { artist: "", title: base };
}
