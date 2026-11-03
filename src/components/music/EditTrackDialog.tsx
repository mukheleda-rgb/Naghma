import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Download, FileText, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Track } from "@/lib/db";

function resizeImage(file: File): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const sz = 512;
      c.width = c.height = sz;
      const k = Math.max(sz / img.width, sz / img.height);
      c.getContext("2d")!.drawImage(img, (sz - img.width * k) / 2, (sz - img.height * k) / 2, img.width * k, img.height * k);
      res(c.toDataURL("image/jpeg", 0.85));
    };
    img.src = URL.createObjectURL(file);
  });
}

export function EditTrackDialog({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const { t, saveTrack } = useStore();
  const [d, setD] = useState<Track | null>(track);
  const [loading, setLoading] = useState(false);
  useEffect(() => setD(track), [track]);

  const fetchLyrics = async () => {
    if (!d) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ track_name: d.title, ...(d.artist ? { artist_name: d.artist } : {}) });
      let r = await fetch(`https://lrclib.net/api/search?${q}`).then((x) => x.json());
      if (!r?.length) r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(d.artist + " " + d.title)}`).then((x) => x.json());
      const hit = r?.[0];
      const text = hit?.plainLyrics || hit?.syncedLyrics?.replace(/\[[^\]]+\]\s?/g, "");
      if (text) setD({ ...d, lyrics: text }); else toast(t("notFound"));
    } catch { toast(t("notFound")); } finally { setLoading(false); }
  };

  return (
    <Dialog open={!!track} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("edit")}</DialogTitle></DialogHeader>
        {d && (
          <div className="grid gap-3">
            <label className="flex cursor-pointer items-center gap-3">
              {d.cover ? <img src={d.cover} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="art h-16 w-16 rounded-xl" />}
              <span className="flex items-center gap-2 text-sm text-primary"><ImagePlus className="h-4 w-4" />{t("cover")}</span>
              <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setD({ ...d, cover: await resizeImage(f) }); }} />
            </label>
            <Input value={d.title} placeholder={t("title")} onChange={(e) => setD({ ...d, title: e.target.value })} />
            <Input value={d.artist} placeholder={t("artist")} onChange={(e) => setD({ ...d, artist: e.target.value })} />
            <Input value={d.album} placeholder={t("album")} onChange={(e) => setD({ ...d, album: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={fetchLyrics} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <Download />} {t("fetchLyrics")}
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <label className="cursor-pointer"><FileText /> {t("loadLyricsFile")}
                  <input type="file" accept=".lrc,.txt,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setD({ ...d, lyrics: (await f.text()).replace(/\[[^\]]+\]\s?/g, "") }); }} />
                </label>
              </Button>
            </div>
            <Textarea rows={6} value={d.lyrics} placeholder={t("lyrics")} onChange={(e) => setD({ ...d, lyrics: e.target.value })} />
            <Button onClick={() => { saveTrack(d); onClose(); }}>{t("save")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
