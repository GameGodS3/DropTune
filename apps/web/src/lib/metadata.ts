import { parseBlob } from "music-metadata-browser";
import type { TrackMetadata } from "@droptune/shared-types";

const ALLOWED_EXTENSIONS = new Set(["mp3", "flac", "wav", "m4a", "aac"]);

type ImportableFile = {
  id: string;
  file: File;
};

function normalizeName(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function inferFormat(fileName: string): TrackMetadata["format"] {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return "unknown";
  if (ALLOWED_EXTENSIONS.has(ext)) return ext as TrackMetadata["format"];
  return "unknown";
}

export function filterSupportedFiles(files: File[]): File[] {
  return files.filter((f) => inferFormat(f.name) !== "unknown");
}

export async function indexFiles(deviceId: string, files: ImportableFile[]): Promise<TrackMetadata[]> {
  const result: TrackMetadata[] = [];
  for (const fileEntry of files) {
    const file = fileEntry.file;
    const format = inferFormat(file.name);
    if (format === "unknown") continue;

    const fallbackTitle = file.name.replace(/\.[^/.]+$/, "");
    let title = fallbackTitle;
    let artist: string | undefined;
    let album: string | undefined;
    let durationSec = 0;

    try {
      const meta = await parseBlob(file);
      title = meta.common.title ?? fallbackTitle;
      artist = meta.common.artist ?? undefined;
      album = meta.common.album ?? undefined;
      durationSec = Number(meta.format.duration ?? 0);
    } catch {
      // Ignore parse failures for compatibility with partially malformed files.
    }

    result.push({
      id: fileEntry.id,
      sourceDeviceId: deviceId,
      fileName: file.name,
      title,
      artist,
      album,
      durationSec,
      format,
      sizeBytes: file.size,
      normalizedName: normalizeName(file.name)
    });
  }
  return result;
}
