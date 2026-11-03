import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ListMusic, Plus } from "lucide-react";
import { useStore } from "@/lib/store";

export function PlaylistPicker({ ids, onClose }: { ids: string[] | null; onClose: () => void }) {
  const s = useStore();
  const [name, setName] = useState("");
  return (
    <Drawer open={!!ids} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>{s.t("addToPlaylist")}</DrawerTitle></DrawerHeader>
        <div className="grid gap-2 p-4 pt-0">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={s.t("newPlaylist")} />
            <Button size="icon" disabled={!name.trim()} onClick={() => { s.createPlaylist(name.trim(), ids ?? []); setName(""); onClose(); }}><Plus /></Button>
          </div>
          {s.playlists.map((p) => (
            <button key={p.id} onClick={() => { s.addToPlaylist(p.id, ids ?? []); onClose(); }} className="flex items-center gap-3 rounded-xl p-3 text-start hover:bg-muted">
              <ListMusic className="h-5 w-5 text-primary" /> <span className="flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.trackIds.length}</span>
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
