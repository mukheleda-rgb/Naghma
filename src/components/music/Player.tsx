import { useRef, useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward, SlidersHorizontal, FileText } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { EQ_FREQS, useStore } from "@/lib/store";
import { fmt } from "@/lib/i18n";
import { Cover } from "./TrackList";

const PRESETS: Record<string, number[]> = { Flat: [0, 0, 0, 0, 0], Bass: [7, 4, 0, 0, 1], Vocal: [-2, 0, 4, 3, 0], Treble: [0, 0, 1, 4, 7], Quran: [-1, 1, 4, 2, -1] };

export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const s = useStore();
  if (!s.current) return null;
  return (
    <div className="panel mx-3 mb-2 flex items-center gap-3 overflow-hidden p-2" onClick={onOpen}>
      <Cover track={s.current} className={`h-11 w-11 shrink-0 rounded-[calc(var(--radius)*0.6)] ${s.playing ? "playing-glow" : ""}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{s.current.title}</div>
        <div className="h-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(s.pos / (s.dur || 1)) * 100}%` }} /></div>
      </div>
      <button className="p-2" onClick={(e) => { e.stopPropagation(); s.toggle(); }}>{s.playing ? <Pause /> : <Play />}</button>
      <button className="p-2" onClick={(e) => { e.stopPropagation(); s.next(); }}><SkipForward /></button>
    </div>
  );
}

export function FullPlayer({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [panel, setPanel] = useState<"none" | "eq" | "lyrics">("none");
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const tr = s.current;
  const rtl = s.settings.lang === "ar";
  const eq = s.settings.eq;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in slide-in-from-bottom duration-300">
      <div className="pointer-events-none absolute inset-0 opacity-40 blur-3xl">{tr && <Cover track={tr} className="h-full w-full" />}</div>
      <div className="relative flex flex-1 flex-col px-6 pb-8 pt-4">
        <button onClick={onClose} className="self-start p-2"><ChevronDown className="h-7 w-7" /></button>

        <div className="flex flex-1 items-center justify-center py-4">
          {panel === "none" && (
            <div
              data-noswipe
              className="aspect-square w-full max-w-sm touch-pan-y"
              style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: start.current == null ? "transform .3s" : "none" }}
              onTouchStart={(e) => (start.current = e.touches[0]!.clientX)}
              onTouchMove={(e) => start.current != null && setDx(e.touches[0]!.clientX - start.current)}
              onTouchEnd={() => {
                if (Math.abs(dx) > 80) { const forward = rtl ? dx > 0 : dx < 0; forward ? s.next() : s.prev(); }
                start.current = null; setDx(0);
              }}
            >
              <Cover track={tr} className={`h-full w-full rounded-[calc(var(--radius)*1.5)] transition-transform duration-500 ${s.playing ? "playing-glow" : "scale-90"}`} />
            </div>
          )}
          {panel === "lyrics" && (
            <div className="panel h-full max-h-[50vh] w-full overflow-y-auto whitespace-pre-line p-5 text-center text-lg leading-loose">
              {tr?.lyrics || <span className="text-muted-foreground">{s.t("noLyrics")}</span>}
            </div>
          )}
          {panel === "eq" && (
            <div className="panel w-full p-5" data-noswipe>
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([k, v]) => (
                  <button key={k} onClick={() => s.updateSettings({ eq: v })} className="rounded-full bg-muted px-3 py-1 text-xs">{k === "Flat" ? s.t("reset") : k}</button>
                ))}
              </div>
              <div className="flex h-48 justify-around" dir="ltr">
                {EQ_FREQS.map((f, i) => (
                  <div key={f} className="flex flex-col items-center gap-2">
                    <span className="text-xs tabular-nums">{(eq[i] ?? 0) > 0 ? "+" : ""}{eq[i] ?? 0}</span>
                    <Slider orientation="vertical" min={-12} max={12} step={1} value={[eq[i] ?? 0]} className="flex-1"
                      onValueChange={([v]) => { const n = [...eq]; n[i] = v ?? 0; s.updateSettings({ eq: n }); }} />
                    <span className="text-[10px] text-muted-foreground">{f >= 1000 ? f / 1000 + "k" : f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 text-center">
          <h2 className="truncate text-2xl font-bold">{tr?.title ?? s.t("nothingPlaying")}</h2>
          <p className="truncate text-muted-foreground">{tr?.artist || tr?.album}</p>
        </div>

        <Slider dir="ltr" value={[s.pos]} max={s.dur || 1} step={1} onValueChange={([v]) => s.seek(v ?? 0)} />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground" dir="ltr">
          <span>{fmt(s.pos)}</span><span>{fmt(s.dur)}</span>
        </div>

        <div className="mt-6 flex items-center justify-between" dir="ltr">
          <button onClick={() => setPanel(panel === "eq" ? "none" : "eq")} className={`p-2 ${panel === "eq" ? "text-primary" : ""}`}><SlidersHorizontal /></button>
          <button onClick={s.prev} className="p-2"><SkipBack className="h-8 w-8" /></button>
          <button onClick={s.toggle} className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-90">
            {s.playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
          </button>
          <button onClick={() => s.next()} className="p-2"><SkipForward className="h-8 w-8" /></button>
          <button onClick={() => setPanel(panel === "lyrics" ? "none" : "lyrics")} className={`p-2 ${panel === "lyrics" ? "text-primary" : ""}`}><FileText /></button>
        </div>
      </div>
    </div>
  );
}
