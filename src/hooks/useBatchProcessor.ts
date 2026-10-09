import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BatchStore,
  CONCURRENCY,
  MAX_FILES,
  acceptFiles,
  type WorkItem,
} from "@/lib/batch";
import { downloadAllAsZip, preloadModel, removeToWhite } from "@/lib/paperwhite";

/**
 * React facade over BatchStore + concurrent FIFO runner.
 * UI only sees a stable WorkItem[] snapshot.
 */
export function useBatchProcessor() {
  const storeRef = useRef(new BatchStore());
  const runIdRef = useRef(0);
  const activeIdsRef = useRef(new Set<string>());
  const pumpingRef = useRef(false);

  const [items, setItems] = useState<WorkItem[]>([]);
  const [batchError, setBatchError] = useState("");
  const [zipping, setZipping] = useState(false);

  const sync = useCallback(() => {
    setItems(storeRef.current.list());
  }, []);

  useEffect(() => {
    void preloadModel();
  }, []);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      storeRef.current.clear();
    },
    [],
  );

  const processOne = useCallback(
    async (item: WorkItem, runId: number) => {
      storeRef.current.update(item.id, {
        status: "processing",
        progress: 2,
        message: "Starting…",
      });
      sync();

      try {
        const { cutoutUrl, resultUrl } = await removeToWhite(
          item.file,
          (progress, message) => {
            if (runId !== runIdRef.current) return;
            storeRef.current.update(item.id, { progress, message });
            sync();
          },
          () => runId !== runIdRef.current,
        );

        if (runId !== runIdRef.current) {
          URL.revokeObjectURL(cutoutUrl);
          URL.revokeObjectURL(resultUrl);
          return;
        }

        storeRef.current.update(item.id, {
          status: "done",
          progress: 100,
          message: "Ready",
          cutoutUrl,
          resultUrl,
        });
        sync();
      } catch (error) {
        if (runId !== runIdRef.current) return;
        const raw = error instanceof Error ? error.message : "Background removal failed.";
        if (raw === "__cancelled__") return;
        storeRef.current.update(item.id, {
          status: "error",
          progress: 0,
          message: /network|fetch|failed to fetch/i.test(raw)
            ? "Could not load the model. Check your connection."
            : raw || "Background removal failed.",
        });
        sync();
      }
    },
    [sync],
  );

  const pump = useCallback(async () => {
    if (pumpingRef.current) return;
    pumpingRef.current = true;
    const runId = runIdRef.current;

    try {
      while (runId === runIdRef.current) {
        const active = activeIdsRef.current;
        const slots = CONCURRENCY - active.size;
        const next = storeRef.current.nextQueued(slots, active);

        if (next.length === 0) {
          if (active.size === 0) break;
          await new Promise((r) => setTimeout(r, 32));
          continue;
        }

        await Promise.all(
          next.map(async (item) => {
            active.add(item.id);
            try {
              await processOne(item, runId);
            } finally {
              active.delete(item.id);
            }
          }),
        );
      }
    } finally {
      pumpingRef.current = false;
      if (
        runId === runIdRef.current &&
        storeRef.current.nextQueued(1, activeIdsRef.current).length > 0
      ) {
        void pump();
      }
    }
  }, [processOne]);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      setBatchError("");
      const room = storeRef.current.room;
      if (room <= 0) {
        setBatchError(`You can process up to ${MAX_FILES} images at a time. Start over to add more.`);
        return;
      }

      const { accepted, rejected } = acceptFiles(fileList, room);
      if (rejected.length > 0) {
        setBatchError(
          rejected.slice(0, 3).join(" · ") + (rejected.length > 3 ? ` · +${rejected.length - 3} more` : ""),
        );
      }
      if (accepted.length === 0) return;

      storeRef.current.addMany(accepted);
      sync();
      void pump();
    },
    [pump, sync],
  );

  const removeItem = useCallback(
    (id: string) => {
      storeRef.current.remove(id);
      activeIdsRef.current.delete(id);
      sync();
    },
    [sync],
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    activeIdsRef.current.clear();
    pumpingRef.current = false;
    storeRef.current.clear();
    setBatchError("");
    sync();
  }, [sync]);

  const readyItems = useMemo(
    () => items.filter((it) => it.status === "done" && it.resultUrl),
    [items],
  );

  const doneCount = useMemo(() => items.filter((it) => it.status === "done").length, [items]);
  const processingCount = useMemo(
    () => items.filter((it) => it.status === "processing" || it.status === "queued").length,
    [items],
  );

  const downloadZip = useCallback(async () => {
    if (readyItems.length === 0 || zipping) return;
    setZipping(true);
    try {
      await downloadAllAsZip(
        readyItems.map((it) => ({ fileName: it.fileName, resultUrl: it.resultUrl! })),
      );
    } catch {
      setBatchError("Could not build the ZIP. Try again.");
    } finally {
      setZipping(false);
    }
  }, [readyItems, zipping]);

  return {
    items,
    batchError,
    zipping,
    readyItems,
    doneCount,
    processingCount,
    isIdle: items.length === 0,
    canAddMore: items.length < MAX_FILES,
    slotsLeft: Math.max(0, MAX_FILES - items.length),
    addFiles,
    removeItem,
    reset,
    downloadZip,
  };
}
