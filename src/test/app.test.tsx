import { describe, expect, it } from "vitest";
import { parseName, isQuran } from "@/lib/db";

describe("db helpers", () => {
  it("parses 'artist - title' file names", () => {
    expect(parseName("Fairuz - Habbaytak.mp3")).toEqual({ artist: "Fairuz", title: "Habbaytak" });
  });
  it("detects Quran files by name", () => {
    expect(isQuran("Downloads/سورة الكهف.mp3")).toBe(true);
    expect(isQuran("Music/Song.mp3")).toBe(false);
  });
});
