import { useRef, useState, type ReactNode } from "react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookOpen, Check, GripVertical, ListPlus, Music2, Pencil, Play, Trash2, X, ArrowRightLeft, ListEnd, CheckSquare } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useStore, sortTracks, type SortMode } from "@/lib/store";
import type { Track } from "@/lib/db";
import { fmt } from "@/lib/i18n";
import { EditTrackDialog } from "./EditTrackDialog";
import { PlaylistPicker } from "./PlaylistPicker";

export function useLongPress(onLong: () => void, ms = 450) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return {
    fired,
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = window.setTimeout(() => { fired.current = true; navigator.vibrate?.(30); onLong(); }, ms);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

export function Cover({ track, className = "" }: { track?: Track | undefined; className?: string }) {
  if (track?.cover) return <img src={track.cover} alt="" className={`object-cover ${className}`} />;
  const Q = track?.category === "quran";
  return (
    <div className={`${Q ? "art-quran" : "art"} flex items-center justify-center text-primary-foreground ${className}`}>
      {Q ? <BookOpen className="h-1/2 w-1/2 opacity-80" /> : <Music2 className="h-1/2 w-1/2 opacity-80" />}
    </div>
  );
}

function Row({ track, onPlay, onLong, selecting, selected, custom, active, playing }: {
  track: Track; onPlay: () => void; onLong: () => void; selecting: boolean; selected: boolean; custom: boolean; active: boolean; playing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id, disabled: !custom });
  const lp = useLongPress(onLong);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`flex items-center gap-3 p-2 select-none transition-colors ${isDragging ? "panel scale-[1.02]" : ""} ${selected ? "bg-accent rounded-xl" : ""}`}
    >
      <button
        {...lp.handlers}
        onClick={() => { if (!lp.fired.current) onPlay(); }}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[calc(var(--radius)*0.6)]">
          <Cover track={track} className="h-full w-full" />
          {selecting && (
            <div className={`absolute inset-0 flex items-center justify-center ${selected ? "bg-primary/80" : "bg-background/40"}`}>
              {selected && <Check className="h-6 w-6 text-primary-foreground" />}
            </div>
          )}
          {active && !selecting && (
            <div className="absolute inset-0 flex items-end justify-center gap-0.5 bg-background/50 pb-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-4 w-1 rounded bg-primary ${playing ? "eq-bar" : ""}`} style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`truncate font-medium ${active ? "text-primary" : ""}`}>{track.title}</div>
          <div className="truncate text-xs text-muted-foreground">{track.artist || track.album || "—"}</div>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{fmt(track.duration)}</span>
      </button>
      {custom && (
        <button data-noswipe {...attributes} {...listeners} className="touch-none p-2 text-muted-foreground" aria-label="drag">
          <GripVertical className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function TrackList({ tracks, sortKey, customOrder, onReorder, header, onRemoveFromList }: {
  tracks: Track[]; sortKey: string; customOrder?: string[]; onReorder?: (ids: string[]) => void; header?: ReactNode; onRemoveFromList?: (ids: string[]) => void;
}) {
  const s = useStore();
  const { t } = s;
  const mode: SortMode = s.settings.sort[sortKey] ?? "date";
  const sorted = sortTracks(tracks, mode, mode === "custom" ? customOrder : undefined);
  const [menu, setMenu] = useState<Track | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<Track | null>(null);
  const [picking, setPicking] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }));

  const setMode = (m: SortMode) => s.updateSettings({ sort: { ...s.settings.sort, [sortKey]: m } });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = sorted.map((x) => x.id);
    const n = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    (onReorder ?? s.reorderTracks)(n);
  };
  const toggleSel = (id: string) => setSel((x) => (x.includes(id) ? x.filter((i) => i !== id) : [...x, id]));
  const endSel = () => { setSelecting(false); setSel([]); };

  return (
    <div>
      {header}
      {selecting ? (
        <div className="panel sticky top-0 z-20 mb-2 flex items-center gap-2 p-2">
          <Button size="icon" variant="ghost" onClick={endSel}><X /></Button>
          <span className="flex-1 text-sm">{sel.length} {t("selected")}</span>
          <Button size="icon" variant="ghost" onClick={() => setSel(sel.length === sorted.length ? [] : sorted.map((x) => x.id))}><CheckSquare /></Button>
          <Button size="icon" variant="ghost" disabled={!sel.length} onClick={() => setPicking(sel)}><ListPlus /></Button>
          <Button size="icon" variant="ghost" disabled={!sel.length} onClick={() => { (onRemoveFromList ?? s.removeTracks)(sel); endSel(); }}><Trash2 className="text-destructive" /></Button>
        </div>
      ) : (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1" data-noswipe>
          {(["name", "date", "duration", "custom"] as SortMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`shrink-0 rounded-full px-3 py-1 text-xs transition ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {t(m === "name" ? "sortName" : m === "date" ? "sortDate" : m === "duration" ? "sortDuration" : "sortCustom")}
            </button>
          ))}
          {sorted.length > 0 && (
            <button onClick={() => s.playList(sorted.map((x) => x.id))} className="ms-auto flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
              <Play className="h-3 w-3" /> {t("playAll")}
            </button>
          )}
        </div>
      )}
      {sorted.length === 0 && <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sorted.map((x) => x.id)} strategy={verticalListSortingStrategy}>
          {sorted.map((tr, i) => (
            <Row
              key={tr.id} track={tr} custom={mode === "custom" && !selecting} selecting={selecting} selected={sel.includes(tr.id)}
              active={s.current?.id === tr.id} playing={s.playing}
              onPlay={() => (selecting ? toggleSel(tr.id) : s.playList(sorted.map((x) => x.id), i))}
              onLong={() => (selecting ? toggleSel(tr.id) : setMenu(tr))}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Drawer open={!!menu} onOpenChange={(o) => !o && setMenu(null)}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle className="truncate">{menu?.title}</DrawerTitle></DrawerHeader>
          {menu && (
            <div className="grid gap-1 p-4 pt-0">
              {[
                { icon: ListEnd, label: t("playNext"), fn: () => s.playNext(menu.id) },
                { icon: ListPlus, label: t("addToPlaylist"), fn: () => setPicking([menu.id]) },
                { icon: Pencil, label: t("edit"), fn: () => setEditing(menu) },
                { icon: ArrowRightLeft, label: menu.category === "quran" ? t("toMusic") : t("toQuran"), fn: () => s.moveTracks([menu.id], menu.category === "quran" ? "music" : "quran") },
                { icon: CheckSquare, label: t("select"), fn: () => { setSelecting(true); setSel([menu.id]); } },
                { icon: Trash2, label: t("del"), fn: () => (onRemoveFromList ?? s.removeTracks)([menu.id]), danger: true },
              ].map((a) => (
                <button key={a.label} onClick={() => { const m = menu; setMenu(null); setTimeout(a.fn, 150); void m; }} className={`flex items-center gap-3 rounded-xl p-3 text-start hover:bg-muted ${a.danger ? "text-destructive" : ""}`}>
                  <a.icon className="h-5 w-5" /> {a.label}
                </button>
              ))}
            </div>
          )}
        </DrawerContent>
      </Drawer>
      <EditTrackDialog track={editing} onClose={() => setEditing(null)} />
      <PlaylistPicker ids={picking} onClose={() => { setPicking(null); endSel(); }} />
    </div>
  );
}
