import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AUDIO_EXT, db, isQuran, parseName, type Category, type Playlist, type Track } from "./db";
import { tr, type Key, type Lang } from "./i18n";

export type TabId = "home" | "music" | "quran" | "playlists" | "settings";
export type Skin = "glass" | "material" | "neon" | "minimal" | "retro";
export type SortMode = "name" | "date" | "duration" | "custom";
export interface Settings {
  lang: Lang;
  dark: boolean;
  skin: Skin;
  hue: number;
  tabs: TabId[];
  sort: Record<string, SortMode>;
  eq: number[];
}
const DEFAULT: Settings = {
  lang: "ar",
  dark: true,
  skin: "glass",
  hue: 175,
  tabs: ["home", "music", "quran", "playlists", "settings"],
  sort: {},
  eq: [0, 0, 0, 0, 0],
};
export const EQ_FREQS = [60, 230, 910, 3600, 14000];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function readDuration(blob: Blob): Promise<number> {
  return new Promise((res) => {
    const a = new Audio();
    const url = URL.createObjectURL(blob);
    a.preload = "metadata";
    a.src = url;
    const done = (d: number) => { URL.revokeObjectURL(url); res(d); };
    a.onloadedmetadata = () => done(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 4000);
  });
}

type Ctx = ReturnType<typeof useProvideStore>;
const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => useContext(StoreCtx)!;

function useProvideStore() {
  const [ready, setReady] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [scanning, setScanning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const urlRef = useRef<string | null>(null);
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;

  const t = useCallback((k: Key) => tr(settings.lang, k), [settings.lang]);

  // load
  useEffect(() => {
    (async () => {
      const [ts, ps, s] = await Promise.all([
        db.all<Track>("tracks"),
        db.all<Playlist>("playlists"),
        db.get<Settings>("kv", "settings"),
      ]);
      setTracks(ts);
      setPlaylists(ps);
      if (s) setSettings({ ...DEFAULT, ...s });
      setReady(true);
      // automatic rescan of saved folder
      const h = await db.get<FileSystemDirectoryHandle>("kv", "dir");
      if (h) {
        try {
          // @ts-expect-error not in all TS libs
          const p = await h.queryPermission?.({ mode: "read" });
          if (p === "granted") scanHandle(h);
        } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // apply theme
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", settings.dark);
    el.dataset["skin"] = settings.skin;
    el.style.setProperty("--hue", String(settings.hue));
    el.lang = settings.lang;
    el.dir = settings.lang === "ar" ? "rtl" : "ltr";
    if (ready) db.put("kv", settings, "settings");
    filtersRef.current.forEach((f, i) => (f.gain.value = settings.eq[i] ?? 0));
  }, [settings, ready]);

  const updateSettings = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));

  const saveTrack = (tr: Track) => {
    db.put("tracks", tr);
    setTracks((ts) => ts.map((x) => (x.id === tr.id ? tr : x)));
  };

  const addFiles = async (files: { file: File; path: string }[]) => {
    const existing = new Set(tracksRef.current.map((x) => x.name + "|" + x.size));
    const added: Track[] = [];
    let order = tracksRef.current.length;
    for (const { file, path } of files) {
      if (!AUDIO_EXT.test(file.name) && !file.type.startsWith("audio/")) continue;
      if (existing.has(file.name + "|" + file.size)) continue;
      existing.add(file.name + "|" + file.size);
      const { artist, title } = parseName(file.name);
      const duration = await readDuration(file);
      const tr: Track = {
        id: uid(), name: file.name, title, artist, album: path.split("/").pop() || "",
        duration, category: isQuran(path + "/" + file.name) ? "quran" : "music",
        addedAt: Date.now(), lastPlayed: 0, plays: 0, lyrics: "", order: order++, size: file.size,
      };
      await db.put("blobs", file, tr.id);
      await db.put("tracks", tr);
      added.push(tr);
    }
    if (added.length) setTracks((ts) => [...ts, ...added]);
    return added.length;
  };

  const scanHandle = async (h: FileSystemDirectoryHandle) => {
    setScanning(true);
    const out: { file: File; path: string }[] = [];
    const walk = async (dir: FileSystemDirectoryHandle, path: string) => {
      for await (const [name, entry] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
        if (entry.kind === "directory") await walk(entry as FileSystemDirectoryHandle, path + "/" + name);
        else if (AUDIO_EXT.test(name)) out.push({ file: await (entry as FileSystemFileHandle).getFile(), path });
      }
    };
    try { await walk(h, h.name); await addFiles(out); } finally { setScanning(false); }
  };

  const pickFolder = async () => {
    // @ts-expect-error not in all TS libs
    if (window.showDirectoryPicker) {
      try {
        // @ts-expect-error not in all TS libs
        const h: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: "read" });
        await db.put("kv", h, "dir");
        await scanHandle(h);
        return true;
      } catch { return true; }
    }
    return false; // caller falls back to <input webkitdirectory>
  };

  const removeTracks = async (ids: string[]) => {
    const set = new Set(ids);
    for (const id of ids) { await db.del("tracks", id); await db.del("blobs", id); }
    setTracks((ts) => ts.filter((x) => !set.has(x.id)));
    setPlaylists((ps) => ps.map((p) => { const np = { ...p, trackIds: p.trackIds.filter((i) => !set.has(i)) }; db.put("playlists", np); return np; }));
    setQueue((q) => q.filter((i) => !set.has(i)));
  };

  const moveTracks = (ids: string[], category: Category) => {
    ids.forEach((id) => { const tr = tracksRef.current.find((x) => x.id === id); if (tr) saveTrack({ ...tr, category }); });
  };

  const reorderTracks = (ordered: string[]) => {
    setTracks((ts) => ts.map((x) => { const i = ordered.indexOf(x.id); if (i < 0) return x; const n = { ...x, order: i }; db.put("tracks", n); return n; }));
  };

  const savePlaylist = (p: Playlist) => {
    db.put("playlists", p);
    setPlaylists((ps) => (ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? p : x)) : [...ps, p]));
  };
  const createPlaylist = (name: string, trackIds: string[] = []) => {
    const p = { id: uid(), name, trackIds, createdAt: Date.now() };
    savePlaylist(p);
    return p;
  };
  const deletePlaylist = (id: string) => { db.del("playlists", id); setPlaylists((ps) => ps.filter((p) => p.id !== id)); };
  const addToPlaylist = (pid: string, ids: string[]) => {
    const p = playlists.find((x) => x.id === pid);
    if (p) savePlaylist({ ...p, trackIds: [...p.trackIds, ...ids.filter((i) => !p.trackIds.includes(i))] });
  };

  // Import m3u/pls/txt playlist — matches by file name; keeps every match (music and Quran alike).
  const importPlaylist = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.replace(/^File\d+=/i, ""));
    const ids: string[] = [];
    for (const l of lines) {
      const base = decodeURIComponent(l.split(/[\\/]/).pop() || "").toLowerCase();
      const m = tracksRef.current.find((x) => x.name.toLowerCase() === base) || tracksRef.current.find((x) => base && x.name.toLowerCase().includes(base.replace(/\.[^.]+$/, "")));
      if (m && !ids.includes(m.id)) ids.push(m.id);
    }
    createPlaylist(file.name.replace(/\.[^.]+$/, ""), ids);
    return ids.length;
  };

  // ---------- audio ----------
  const ensureAudio = () => {
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    audioRef.current = a;
    a.ontimeupdate = () => setPos(a.currentTime);
    a.onloadedmetadata = () => setDur(a.duration);
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => next(true);
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(a);
      let node: AudioNode = src;
      filtersRef.current = EQ_FREQS.map((f, i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
        b.frequency.value = f;
        b.gain.value = settings.eq[i] ?? 0;
        node.connect(b);
        node = b;
        return b;
      });
      node.connect(ctx.destination);
      ctxRef.current = ctx;
    } catch { /* EQ unavailable */ }
    return a;
  };

  const current = tracks.find((x) => x.id === queue[index]);

  const loadAndPlay = async (id: string) => {
    const a = ensureAudio();
    ctxRef.current?.resume();
    const blob = await db.get<Blob>("blobs", id);
    if (!blob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    a.src = urlRef.current;
    await a.play().catch(() => {});
    const tr = tracksRef.current.find((x) => x.id === id);
    if (tr) saveTrack({ ...tr, plays: tr.plays + 1, lastPlayed: Date.now() });
  };

  const playList = (ids: string[], start = 0) => {
    if (!ids.length) return;
    setQueue(ids);
    setIndex(start);
    loadAndPlay(ids[start]!);
  };
  const queueRef = useRef({ queue, index });
  queueRef.current = { queue, index };
  const next = (auto = false) => {
    const { queue: q, index: i } = queueRef.current;
    if (!q.length) return;
    if (auto && i === q.length - 1) return setPlaying(false);
    const n = (i + 1) % q.length;
    setIndex(n);
    loadAndPlay(q[n]!);
  };
  const prev = () => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    const { queue: q, index: i } = queueRef.current;
    if (!q.length) return;
    const n = (i - 1 + q.length) % q.length;
    setIndex(n);
    loadAndPlay(q[n]!);
  };
  const toggle = () => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    ctxRef.current?.resume();
    if (a.paused) a.play(); else a.pause();
  };
  const seek = (s: number) => { if (audioRef.current) audioRef.current.currentTime = s; };
  const playNext = (id: string) => {
    if (!queue.length) return playList([id]);
    setQueue((q) => { const n = [...q]; n.splice(index + 1, 0, id); return n; });
  };

  // Notification / lock-screen controls
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist || (current.category === "quran" ? tr(settings.lang, "quran") : ""),
      album: current.album,
      artwork: current.cover ? [{ src: current.cover, sizes: "512x512" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("seekto", (d) => d.seekTime != null && seek(d.seekTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.title, current?.cover]);
  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  // Smart recommendations: score unplayed/lightly played music by artist & album affinity.
  const recommendations = useMemo(() => {
    const music = tracks.filter((x) => x.category === "music");
    const aff: Record<string, number> = {};
    music.forEach((x) => { if (x.artist) aff["a:" + x.artist] = (aff["a:" + x.artist] || 0) + x.plays; if (x.album) aff["b:" + x.album] = (aff["b:" + x.album] || 0) + x.plays; });
    return music
      .map((x) => ({ x, s: (aff["a:" + x.artist] || 0) * 2 + (aff["b:" + x.album] || 0) - x.plays * 3 + Math.random() }))
      .sort((a, b) => b.s - a.s).slice(0, 8).map((o) => o.x);
  }, [tracks]);

  return {
    ready, t, tracks, playlists, settings, updateSettings, saveTrack, addFiles, pickFolder, scanning,
    removeTracks, moveTracks, reorderTracks, createPlaylist, savePlaylist, deletePlaylist, addToPlaylist, importPlaylist,
    queue, index, current, playing, pos, dur, playList, next, prev, toggle, seek, playNext, recommendations,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const s = useProvideStore();
  return <StoreCtx.Provider value={s}>{children}</StoreCtx.Provider>;
}

export function sortTracks(list: Track[], mode: SortMode, customOrder?: string[]) {
  const l = [...list];
  if (mode === "name") return l.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  if (mode === "date") return l.sort((a, b) => b.addedAt - a.addedAt);
  if (mode === "duration") return l.sort((a, b) => a.duration - b.duration);
  if (customOrder) return customOrder.map((id) => l.find((x) => x.id === id)).filter(Boolean) as Track[];
  return l.sort((a, b) => a.order - b.order);
}
