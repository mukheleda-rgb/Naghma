import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, FolderSearch, Home, ListMusic, Music2, Plus, Settings as SettingsIcon, Upload, ArrowRight, Trash2, Loader2, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore, type Skin, type TabId } from "@/lib/store";
import type { Track } from "@/lib/db";
import { TrackList, Cover } from "./TrackList";
import { FullPlayer, MiniPlayer } from "./Player";

const folderSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;
const ICONS: Record<TabId, typeof Home> = { home: Home, music: Music2, quran: BookOpen, playlists: ListMusic, settings: SettingsIcon };

function NavTab({ id, active, onClick }: { id: TabId; active: boolean; onClick: () => void }) {
  const { t } = useStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const Icon = ICONS[id];
  return (
    <button
      ref={setNodeRef} {...attributes} {...listeners} onClick={onClick}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex flex-1 touch-none select-none flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-colors ${active ? "text-primary" : "text-muted-foreground"} ${isDragging ? "panel scale-110" : ""}`}
    >
      <span className={`rounded-full px-4 py-1 transition ${active ? "bg-accent" : ""}`}><Icon className="h-5 w-5" /></span>
      {t(id)}
    </button>
  );
}

function ImportInputs({ folderRef, filesRef }: { folderRef: React.RefObject<HTMLInputElement | null>; filesRef: React.RefObject<HTMLInputElement | null> }) {
  const s = useStore();
  const handle = async (fl: FileList | null) => {
    if (!fl) return;
    const arr = Array.from(fl).map((file) => ({ file, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/").slice(0, -1).join("/") || "" }));
    const n = await s.addFiles(arr);
    toast(`${s.t("imported")} ${n} ${s.t("tracks")}`);
  };
  return (
    <>
      {/* @ts-expect-error non-standard attribute */}
      <input ref={folderRef} type="file" hidden multiple webkitdirectory="" onChange={(e) => handle(e.target.files)} />
      <input ref={filesRef} type="file" hidden multiple accept="audio/*" onChange={(e) => handle(e.target.files)} />
    </>
  );
}

function Shelf({ title, items }: { title: string; items: Track[] }) {
  const s = useStore();
  if (!items.length) return null;
  return (
    <section className="mb-6">
      <h3 className="mb-2 font-bold">{title}</h3>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2" data-noswipe>
        {items.map((x, i) => (
          <button key={x.id} onClick={() => s.playList(items.map((y) => y.id), i)} className="w-28 shrink-0 text-start">
            <Cover track={x} className="aspect-square w-28 rounded-[var(--radius)] shadow-[var(--panel-shadow)]" />
            <div className="mt-1 truncate text-sm">{x.title}</div>
            <div className="truncate text-xs text-muted-foreground">{x.artist}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

function HomeTab({ onScan }: { onScan: () => void }) {
  const s = useStore();
  const all = s.tracks;
  const recent = [...all].filter((x) => x.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 10);
  const added = [...all].sort((a, b) => b.addedAt - a.addedAt).slice(0, 10);
  const most = [...all].filter((x) => x.plays).sort((a, b) => b.plays - a.plays).slice(0, 10);
  const music = all.filter((x) => x.category === "music").length;
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="panel art p-4 text-primary-foreground"><Music2 /><div className="mt-3 text-2xl font-bold">{music}</div><div className="text-sm opacity-90">{s.t("music")}</div></div>
        <div className="panel art-quran p-4 text-primary-foreground"><BookOpen /><div className="mt-3 text-2xl font-bold">{all.length - music}</div><div className="text-sm opacity-90">{s.t("quran")}</div></div>
      </div>
      {all.length === 0 && (
        <div className="panel p-6 text-center">
          <FolderSearch className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="mb-4 text-sm text-muted-foreground">{s.t("scanHint")}</p>
          <Button onClick={onScan}>{s.t("scan")}</Button>
        </div>
      )}
      <Shelf title={s.t("recent")} items={recent} />
      <Shelf title={s.t("added")} items={added} />
      <Shelf title={s.t("most")} items={most} />
      {all.length > 3 && <Shelf title={s.t("forYou")} items={s.recommendations} />}
    </div>
  );
}

function PlaylistsTab() {
  const s = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const p = s.playlists.find((x) => x.id === open);
  if (p) {
    const tracks = p.trackIds.map((id) => s.tracks.find((x) => x.id === id)).filter(Boolean) as Track[];
    return (
      <TrackList
        tracks={tracks} sortKey={"pl:" + p.id} customOrder={p.trackIds}
        onReorder={(ids) => s.savePlaylist({ ...p, trackIds: ids })}
        onRemoveFromList={(ids) => s.savePlaylist({ ...p, trackIds: p.trackIds.filter((i) => !ids.includes(i)) })}
        header={
          <div className="mb-3 flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setOpen(null)}><ArrowRight className="ltr:rotate-180" /></Button>
            <h2 className="flex-1 truncate text-xl font-bold">{p.name}</h2>
            <Button size="icon" variant="ghost" onClick={() => { s.deletePlaylist(p.id); setOpen(null); }}><Trash2 className="text-destructive" /></Button>
          </div>
        }
      />
    );
  }
  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.t("newPlaylist")} />
        <Button size="icon" disabled={!name.trim()} onClick={() => { s.createPlaylist(name.trim()); setName(""); }}><Plus /></Button>
      </div>
      <Button variant="secondary" asChild>
        <label className="cursor-pointer"><Upload /> {s.t("importPlaylist")}
          <input type="file" hidden accept=".m3u,.m3u8,.pls,.txt" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const n = await s.importPlaylist(f); toast(`${s.t("imported")} ${n} ${s.t("tracks")}`); } e.target.value = ""; }} />
        </label>
      </Button>
      <div className="grid grid-cols-2 gap-3">
        {s.playlists.map((pl) => {
          const first = s.tracks.find((x) => x.id === pl.trackIds[0]);
          return (
            <button key={pl.id} onClick={() => setOpen(pl.id)} className="panel overflow-hidden p-2 text-start">
              <Cover track={first} className="aspect-square w-full rounded-[calc(var(--radius)*0.7)]" />
              <div className="mt-2 truncate font-medium">{pl.name}</div>
              <div className="text-xs text-muted-foreground">{pl.trackIds.length} {s.t("tracks")}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SKINS: { id: Skin; ar: string; en: string }[] = [
  { id: "glass", ar: "زجاجي", en: "Glass" },
  { id: "material", ar: "متريال", en: "Material" },
  { id: "neon", ar: "نيون", en: "Neon" },
  { id: "minimal", ar: "بسيط", en: "Minimal" },
  { id: "retro", ar: "ريترو", en: "Retro" },
];
const HUES = [175, 25, 60, 145, 230, 340, 290];

function SettingsTab({ onScan, onFiles }: { onScan: () => void; onFiles: () => void }) {
  const s = useStore();
  const ar = s.settings.lang === "ar";
  return (
    <div className="grid gap-4">
      <div className="panel grid gap-4 p-4">
        <div className="flex items-center justify-between"><span>{s.t("language")}</span>
          <div className="flex rounded-full bg-muted p-1 text-sm">
            {(["ar", "en"] as const).map((l) => (
              <button key={l} onClick={() => s.updateSettings({ lang: l })} className={`rounded-full px-3 py-1 ${s.settings.lang === l ? "bg-primary text-primary-foreground" : ""}`}>{l === "ar" ? "العربية" : "English"}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between"><span>{s.t("darkMode")}</span><Switch checked={s.settings.dark} onCheckedChange={(v) => s.updateSettings({ dark: v })} /></div>
      </div>
      <div className="panel p-4">
        <div className="mb-3">{s.t("style")}</div>
        <div className="grid grid-cols-3 gap-2">
          {SKINS.map((k) => (
            <button key={k.id} onClick={() => s.updateSettings({ skin: k.id })} className={`rounded-xl border-2 p-3 text-sm ${s.settings.skin === k.id ? "border-primary text-primary" : "border-transparent bg-muted"}`}>{ar ? k.ar : k.en}</button>
          ))}
        </div>
        <div className="mb-3 mt-5">{s.t("color")}</div>
        <div className="flex flex-wrap gap-3">
          {HUES.map((h) => (
            <button key={h} onClick={() => s.updateSettings({ hue: h })} aria-label={`hue ${h}`}
              className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-background ${s.settings.hue === h ? "ring-2 ring-foreground" : ""}`}
              style={{ background: `oklch(0.68 0.15 ${h})` }} />
          ))}
        </div>
      </div>
      <div className="panel grid gap-2 p-4">
        <div className="mb-1">{s.t("library")}</div>
        <Button onClick={onScan} disabled={s.scanning}>{s.scanning ? <Loader2 className="animate-spin" /> : <FolderSearch />} {s.t("scan")}</Button>
        <Button variant="secondary" onClick={onFiles}><FilePlus /> {s.t("addFiles")}</Button>
        <p className="text-xs text-muted-foreground">{s.t("scanHint")}</p>
        <p className="text-xs text-muted-foreground">{s.t("tabsHint")}</p>
      </div>
    </div>
  );
}

export function MusicApp() {
  const s = useStore();
  const tabs = s.settings.tabs;
  const [tab, setTab] = useState<TabId>("home");
  const [full, setFull] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const touch = useRef<{ x: number; y: number; skip: boolean } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 450, tolerance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 450, tolerance: 8 } }));

  const scan = async () => {
    if (await s.pickFolder()) return;
    // WebView الأندرويد لا يدعم اختيار مجلد: نفتح منتقي الملفات الصوتية المتعدد بدلاً منه
    (folderSupported ? folderRef : filesRef).current?.click();
  };

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    s.updateSettings({ tabs: arrayMove(tabs, tabs.indexOf(e.active.id as TabId), tabs.indexOf(e.over.id as TabId)) });
  };

  const rtl = s.settings.lang === "ar";
  const swipe = (dir: 1 | -1) => { const i = tabs.indexOf(tab); const n = tabs[i + dir]; if (n) setTab(n); };

  const content =
    tab === "home" ? <HomeTab onScan={scan} /> :
    tab === "music" ? <TrackList tracks={s.tracks.filter((x) => x.category === "music")} sortKey="music" /> :
    tab === "quran" ? <TrackList tracks={s.tracks.filter((x) => x.category === "quran")} sortKey="quran" /> :
    tab === "playlists" ? <PlaylistsTab /> :
    <SettingsTab onScan={scan} onFiles={() => filesRef.current?.click()} />;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col">
      <ImportInputs folderRef={folderRef} filesRef={filesRef} />
      <header className="px-4 pb-2 pt-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{s.t(tab)}</h1>
      </header>
      <main
        key={tab}
        className="flex-1 px-4 pb-48 animate-in fade-in duration-300"
        onTouchStart={(e) => { touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, skip: !!(e.target as HTMLElement).closest("[data-noswipe],[role=dialog]") }; }}
        onTouchEnd={(e) => {
          const st = touch.current; touch.current = null;
          if (!st || st.skip) return;
          const dx = e.changedTouches[0]!.clientX - st.x, dy = e.changedTouches[0]!.clientY - st.y;
          if (Math.abs(dx) > 70 && Math.abs(dy) < 50) swipe(((dx < 0) !== rtl ? 1 : -1));
        }}
      >
        {content}
      </main>
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl">
        <MiniPlayer onOpen={() => setFull(true)} />
        <nav className="panel mx-3 mb-3 flex p-1" data-noswipe>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
              {tabs.map((id) => <NavTab key={id} id={id} active={tab === id} onClick={() => setTab(id)} />)}
            </SortableContext>
          </DndContext>
        </nav>
      </div>
      {full && <FullPlayer onClose={() => setFull(false)} />}
    </div>
  );
}
