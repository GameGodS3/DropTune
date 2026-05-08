import { useEffect, useMemo, useRef, useState } from "react";
import type { TrackMetadata } from "@droptune/shared-types";
import { filterSupportedFiles, indexFiles } from "./lib/metadata";
import { selectFilteredTracks, useLibraryStore } from "./stores/libraryStore";
import { usePeerStore } from "./stores/peerStore";
import { usePlaybackStore } from "./stores/playbackStore";
import { useQueueStore } from "./stores/queueStore";

type ExtendedWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

async function listFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  pathPrefix = ""
): Promise<File[]> {
  const files: File[] = [];
  const iterator = (dirHandle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of iterator) {
    const nextPrefix = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const file = await (entry as FileSystemFileHandle).getFile();
      files.push(new File([file], nextPrefix, { type: file.type, lastModified: file.lastModified }));
    } else if (entry.kind === "directory") {
      files.push(...(await listFilesFromHandle(entry as FileSystemDirectoryHandle, nextPrefix)));
    }
  }
  return files;
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "00:00";
  const min = Math.floor(sec / 60);
  const rem = Math.floor(sec % 60);
  return `${String(min).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function App() {
  const [indexError, setIndexError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeQueueItemId, setActiveQueueItemId] = useState<string | undefined>();

  const { tracks, localFiles, query, isIndexing, setQuery, setIndexing, upsertTracks, hydrate } =
    useLibraryStore();
  const filtered = useMemo(() => selectFilteredTracks(useLibraryStore.getState()), [tracks, query]);

  const { peerId } = usePeerStore();
  const { queue, addToQueue, removeFromQueue, moveQueueItem } = useQueueStore();
  const playback = usePlaybackStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => playback.setPosition(audio.currentTime);
    const onLoadedMetadata = () => playback.setDuration(audio.duration || 0);
    const onPlay = () => playback.setStatus("playing");
    const onPause = () => playback.setStatus("paused");
    const onEnded = () => {
      playback.setStatus("ended");
      const currentIndex = queue.findIndex((item) => item.id === activeQueueItemId);
      if (currentIndex >= 0 && currentIndex < queue.length - 1) {
        void playQueueItem(queue[currentIndex + 1].id);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playback, queue, activeQueueItemId]);

  async function ingestFiles(files: File[]) {
    setIndexError(null);
    setIndexing(true);
    try {
      const supportedFiles = filterSupportedFiles(files);
      const importable = supportedFiles.map((file) => ({ id: crypto.randomUUID(), file }));
      const indexed = await indexFiles(peerId, importable);
      await upsertTracks(indexed, importable);
    } catch (error) {
      setIndexError(error instanceof Error ? error.message : "Failed to index files");
    } finally {
      setIndexing(false);
    }
  }

  async function onSelectFolder() {
    const win = window as ExtendedWindow;
    if (typeof win.showDirectoryPicker === "function") {
      try {
        const handle = await win.showDirectoryPicker();
        const files = await listFilesFromHandle(handle);
        await ingestFiles(files);
        return;
      } catch {
        // fallback selector below.
      }
    }
    inputRef.current?.click();
  }

  async function playTrack(track: TrackMetadata) {
    const file = localFiles[track.id];
    if (!file || !audioRef.current) return;
    playback.setCurrentTrack(track.id);
    playback.setStatus("loading");
    const url = URL.createObjectURL(file);
    const audio = audioRef.current;
    audio.src = url;
    await audio.play();
  }

  async function playQueueItem(queueItemId: string) {
    const item = queue.find((q) => q.id === queueItemId);
    if (!item) return;
    const track = tracks.find((t) => t.id === item.trackId);
    if (!track) return;
    setActiveQueueItemId(queueItemId);
    await playTrack(track);
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-6">
      <audio ref={audioRef} preload="metadata" />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error non-standard but required fallback.
        webkitdirectory="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          void ingestFiles(files);
        }}
      />

      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">DropTune - Phase 1</h1>
        <button
          type="button"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          onClick={() => void onSelectFolder()}
          disabled={isIndexing}
        >
          {isIndexing ? "Indexing..." : "Select Music Folder"}
        </button>
      </header>

      {indexError ? <p className="mb-4 text-sm text-red-400">{indexError}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">Library ({tracks.length})</h2>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, artist, album..."
              className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-100"
            />
          </div>
          <div className="max-h-[65vh] overflow-auto space-y-2">
            {filtered.map((track) => (
              <article
                key={track.id}
                className="rounded border border-slate-800 bg-slate-950 p-3 text-sm"
              >
                <p className="font-medium">{track.title}</p>
                <p className="text-slate-300">{track.artist ?? "Unknown artist"}</p>
                <p className="text-xs text-slate-400">
                  {track.album ?? "Unknown album"} | {formatDuration(track.durationSec)} |{" "}
                  {formatSize(track.sizeBytes)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                    onClick={() => void playTrack(track)}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600"
                    onClick={() => addToQueue(track.id, peerId)}
                  >
                    Queue
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-lg font-medium">Queue ({queue.length})</h2>
          <div className="mb-4 space-y-2">
            {queue.map((item, index) => {
              const track = tracks.find((t) => t.id === item.trackId);
              if (!track) return null;
              return (
                <article key={item.id} className="rounded border border-slate-800 bg-slate-950 p-3 text-sm">
                  <p className="font-medium">{track.title}</p>
                  <p className="text-slate-300">{track.artist ?? "Unknown artist"}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-blue-700 px-2 py-1 hover:bg-blue-600"
                      onClick={() => void playQueueItem(item.id)}
                    >
                      Play now
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveQueueItem(index, index - 1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600 disabled:opacity-40"
                      disabled={index === queue.length - 1}
                      onClick={() => moveQueueItem(index, index + 1)}
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="rounded bg-red-700 px-2 py-1 hover:bg-red-600"
                      onClick={() => removeFromQueue(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="rounded border border-slate-800 bg-slate-950 p-3 text-sm">
            <p className="font-medium">Playback</p>
            <p>Status: {playback.status}</p>
            <p>
              Position: {formatDuration(playback.positionSec)} / {formatDuration(playback.durationSec)}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                onClick={() => audioRef.current?.play()}
              >
                Resume
              </button>
              <button
                type="button"
                className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                onClick={() => audioRef.current?.pause()}
              >
                Pause
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
