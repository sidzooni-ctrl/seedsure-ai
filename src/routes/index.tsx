import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeSeedImage, type SeedAnalysis } from "@/lib/seed-analysis.functions";
import { analyzeSeedVision, callAiVisionApi } from "@/lib/vision-engine";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SeedSure AI — Wheat & Rice Seed Quality Analysis" },
      {
        name: "description",
        content:
          "Upload wheat or rice seed images for AI quality scoring, viability prediction, defect detection and batch summaries. Unsupported samples are rejected.",
      },
      { property: "og:title", content: "SeedSure AI — Seed Quality Analysis" },
      {
        property: "og:description",
        content:
          "AI quality and viability assessment for wheat and rice seed samples, with strict invalid-sample rejection.",
      },
    ],
  }),
  component: Index,
});

type Status = "queued" | "analyzing" | "done" | "error";

type Sample = {
  id: string;
  name: string;
  previewUrl: string;
  dataUrl: string;
  status: Status;
  result?: SeedAnalysis | undefined;
  error?: string | undefined;
};

type LogLine = { id: string; level: "OK" | "WRN" | "ERR" | "SYS"; text: string };

const MAX_DIM = 1024;

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = canvas.toDataURL("image/jpeg", 0.85);
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

function Index() {
  const analyze = useServerFn(analyzeSeedImage);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([
    { id: "boot", level: "SYS", text: "SeedSure AI Vision Engine initialized — awaiting specimen input" },
  ]);
  const [dragging, setDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [savedKeyMsg, setSavedKeyMsg] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());
  const runIdRef = useRef(0);
  const samplesRef = useRef<Sample[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("seedsure_api_key") || "";
      setApiKey(stored);
    }
    const urls = urlsRef.current;
    return () => {
      mountedRef.current = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    samplesRef.current = samples;
  }, [samples]);

  const pushLog = useCallback((level: LogLine["level"], text: string) => {
    setLog((prev) => [{ id: `${Date.now()}-${Math.random()}`, level, text }, ...prev].slice(0, 40));
  }, []);

  const saveApiKey = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("seedsure_api_key", apiKey.trim());
      setSavedKeyMsg("API Key saved successfully!");
      setTimeout(() => setSavedKeyMsg(""), 3000);
      pushLog("OK", apiKey.trim() ? "Custom AI Key loaded" : "Switched to Built-in Agronomic Neural Vision");
    }
  };

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      for (const file of list) {
        try {
          const dataUrl = await fileToDataUrl(file);
          if (!mountedRef.current) return;
          const previewUrl = URL.createObjectURL(file);
          urlsRef.current.add(previewUrl);
          setSamples((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              previewUrl,
              dataUrl,
              status: "queued",
            },
          ]);
          pushLog("OK", `Queued specimen: ${file.name}`);
        } catch {
          pushLog("ERR", `Could not read ${file.name}`);
        }
      }
    },
    [pushLog],
  );

  const runAnalysis = useCallback(async () => {
    if (running) return;
    const runId = ++runIdRef.current;
    setRunning(true);
    try {
      const queue = samplesRef.current.filter(
        (s) => s.status === "queued" || s.status === "error",
      );
      if (queue.length === 0) {
        pushLog("WRN", "No pending specimens to analyze");
        return;
      }
      for (const item of queue) {
        if (runId !== runIdRef.current || !mountedRef.current) return;
        setSamples((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, status: "analyzing", error: undefined } : s)),
        );
        try {
          let result: SeedAnalysis | null = null;
          const userKey = typeof window !== "undefined" ? localStorage.getItem("seedsure_api_key") || apiKey : apiKey;

          // 1. Direct Live Multimodal AI Vision API if API Key is configured
          if (userKey) {
            try {
              result = await callAiVisionApi(item.dataUrl, userKey, item.name);
            } catch {
              result = null;
            }
          }

          // 2. High-Precision Client-Side Canvas & Morphology Vision Engine
          if (!result && typeof window !== "undefined") {
            try {
              result = await analyzeSeedVision(item.dataUrl, item.name);
            } catch {
              result = null;
            }
          }

          // 3. Server function fallback
          if (!result) {
            try {
              result = await analyze({ data: { dataUrl: item.dataUrl, apiKey: userKey, filename: item.name } });
            } catch {
              result = await analyzeSeedVision(item.dataUrl, item.name);
            }
          }

          if (runId !== runIdRef.current || !mountedRef.current) return;

          setSamples((prev) =>
            prev.map((s) => (s.id === item.id ? { ...s, status: "done", result: result! } : s)),
          );

          if (result.seedType === "INVALID") {
            pushLog("WRN", `${item.name}: INVALID SEED — Non-wheat/rice sample rejected`);
          } else {
            pushLog(
              "OK",
              `${item.name}: ${result.seedType} · Quality ${result.qualityScore}/100 · Viability ${result.viability}%`,
            );
          }
        } catch (err) {
          if (runId !== runIdRef.current || !mountedRef.current) return;
          const message = err instanceof Error ? err.message : "Analysis failed";
          setSamples((prev) =>
            prev.map((s) => (s.id === item.id ? { ...s, status: "error", error: message } : s)),
          );
          pushLog("ERR", `${item.name}: ${message}`);
        }
      }
    } finally {
      if (runId === runIdRef.current && mountedRef.current) setRunning(false);
    }
  }, [analyze, apiKey, pushLog, running]);

  const clearAll = useCallback(() => {
    runIdRef.current++;
    setRunning(false);
    setSamples((prev) => {
      prev.forEach((s) => {
        URL.revokeObjectURL(s.previewUrl);
        urlsRef.current.delete(s.previewUrl);
      });
      return [];
    });
    if (inputRef.current) inputRef.current.value = "";
    setLog([{ id: `${Date.now()}`, level: "SYS", text: "Session reset — ready for new specimen input" }]);
  }, []);

  const removeSample = useCallback((id: string) => {
    setSamples((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        urlsRef.current.delete(target.previewUrl);
      }
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const analyzed = useMemo(
    () => samples.filter((s) => s.status === "done" && s.result),
    [samples],
  );
  const valid = useMemo(
    () => analyzed.filter((s) => s.result!.seedType !== "INVALID"),
    [analyzed],
  );
  const invalidCount = analyzed.length - valid.length;
  const avgViability = valid.length
    ? Math.round(valid.reduce((a, s) => a + s.result!.viability, 0) / valid.length)
    : 0;
  const avgQuality = valid.length
    ? Math.round(valid.reduce((a, s) => a + s.result!.qualityScore, 0) / valid.length)
    : 0;

  const active = samples.find((s) => s.status === "analyzing") ?? samples[samples.length - 1];
  const featured = [...samples].reverse().find((s) => s.status === "done" && s.result);
  const pending = samples.filter((s) => s.status === "queued" || s.status === "error").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-sm bg-primary shadow-sm">
              <span className="font-mono text-sm font-bold text-primary-foreground">SS</span>
            </div>
            <div>
              <span className="text-lg font-semibold tracking-tight">SeedSure AI</span>
              <span className="ml-2 hidden rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary sm:inline">
                v2.5 Vision Engine
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{apiKey ? "AI Key Active" : "AI Settings"}</span>
            </button>

            <div className="flex items-center gap-2 rounded-md bg-surface px-3 py-1.5 ring-1 ring-black/5">
              <span className={`size-2 rounded-full ${running ? "animate-pulse bg-warn" : "bg-valid"}`} />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {running ? "Analyzing" : "Engine Online"}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-border bg-surface-strong/95 px-6 py-4 shadow-inner">
          <div className="mx-auto max-w-7xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">AI Vision Configuration (Optional)</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              SeedSure AI includes a built-in agronomic computer vision engine ready for immediate offline and online analysis without API keys. You can also connect a Google Gemini API Key for multimodal LLM vision reasoning.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="password"
                placeholder="Paste Gemini API Key or leave empty for Built-in Vision..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full max-w-md rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
              />
              <button
                onClick={saveApiKey}
                className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              {savedKeyMsg && <span className="text-xs font-medium text-valid">{savedKeyMsg}</span>}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
              Seed Quality Analysis
            </h1>
            <p className="max-w-[56ch] text-sm text-pretty text-muted-foreground">
              Continuous diagnostic assessment for Triticum aestivum and Oryza sativa cultivars.
              All other samples are rejected as invalid.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="rounded-lg bg-surface px-5 py-3 ring-1 ring-black/5">
              <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Batch Progress
              </span>
              <span className="font-mono text-xl font-medium">
                {analyzed.length} / {samples.length}
              </span>
            </div>
            <div className="rounded-lg bg-surface px-5 py-3 ring-1 ring-black/5">
              <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                Avg Viability
              </span>
              <span className="font-mono text-xl font-medium text-valid">
                {valid.length ? `${avgViability}%` : "—"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Input surface */}
          <section className="space-y-6 lg:col-span-5">
            <div className="rounded-xl bg-surface p-6 ring-1 ring-black/5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Specimen Input
              </h2>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void addFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[min(1vw,12px)] bg-secondary outline-1 -outline-offset-1 outline-black/5 transition-colors ${
                  dragging ? "outline-2 outline-primary" : ""
                }`}
              >
                {active ? (
                  <img
                    src={active.previewUrl}
                    alt={`Seed specimen preview: ${active.name}`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 px-8 text-center">
                    <span className="text-sm font-medium">Drop seed images here</span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      Wheat / Rice · JPG · PNG · multi-file
                    </span>
                  </div>
                )}
                {running && (
                  <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                    <div className="scanner-line h-0.5 w-full bg-valid/60 shadow-[0_0_15px_var(--valid)]" />
                    <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Scanning Active
                    </span>
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {samples.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {samples.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => removeSample(s.id)}
                      title={`Remove ${s.name}`}
                      className="group relative size-12 overflow-hidden rounded ring-1 ring-black/10"
                    >
                      <img src={s.previewUrl} alt={s.name} className="size-full object-cover" />
                      <span className="absolute inset-0 hidden items-center justify-center bg-foreground/70 text-[10px] font-semibold text-background group-hover:flex">
                        ✕
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6 space-y-4">
                <button
                  onClick={() => void runAnalysis()}
                  disabled={running || pending === 0}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? "Analyzing…" : `Analyze Seed${pending > 1 ? ` (${pending})` : ""}`}
                </button>
                <button
                  onClick={clearAll}
                  className="w-full rounded-lg bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-border"
                >
                  Clear Diagnostics
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-surface p-4 ring-1 ring-black/5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Status Log
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {samples.length} IN SESSION
                </span>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto font-mono text-[11px] text-secondary-foreground">
                {log.map((l) => (
                  <div key={l.id} className="flex gap-2">
                    <span
                      className={
                        l.level === "OK"
                          ? "text-valid"
                          : l.level === "WRN"
                            ? "text-warn"
                            : l.level === "ERR"
                              ? "text-invalid"
                              : "text-muted-foreground"
                      }
                    >
                      [{l.level}]
                    </span>
                    <span>{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Results */}
          <section className="space-y-8 lg:col-span-7">
            <ResultCard sample={featured} />

            <div className="overflow-hidden rounded-xl bg-surface ring-1 ring-black/5">
              <div className="flex items-center justify-between border-b border-border bg-surface-strong/50 px-6 py-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Batch Summary Dashboard
                </h3>
                <div className="flex gap-4">
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{valid.length}</span> Valid
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-invalid">{invalidCount}</span> Invalid
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {valid.length ? avgQuality : "—"}
                    </span>{" "}
                    Avg Quality
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface-strong/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Sample</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 text-center font-medium">Quality</th>
                      <th className="px-6 py-3 text-right font-medium">Viability</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-sm">
                    {samples.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                          No specimens in this session yet.
                        </td>
                      </tr>
                    )}
                    {samples.map((s) => (
                      <BatchRow key={s.id} sample={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="mx-auto max-w-7xl border-t border-border px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="font-mono text-[11px] tracking-tighter text-muted-foreground">
            SEEDSURE-CORE | ENGINE: AGRI-NEURAL-VII | CONTINUOUS MODE — UNLIMITED ANALYSES
          </div>
          <div className="text-xs text-muted-foreground">
            Supported inputs: Wheat and Rice only.
          </div>
        </div>
      </footer>
    </div>
  );
}

function ResultCard({ sample }: { sample?: Sample | undefined }) {
  if (!sample?.result) {
    return (
      <div className="rounded-xl bg-surface p-10 text-center ring-1 ring-black/5">
        <p className="text-sm text-muted-foreground">
          Upload a wheat or rice sample and run the analyzer to see a specimen report.
        </p>
      </div>
    );
  }
  const r = sample.result;
  const invalid = r.seedType === "INVALID";
  const tone = invalid
    ? "text-invalid"
    : r.qualityStatus === "Good"
      ? "text-valid"
      : r.qualityStatus === "Moderate"
        ? "text-warn"
        : "text-invalid";

  return (
    <div
      className={`overflow-hidden rounded-xl shadow-sm ring-1 ${
        invalid ? "bg-invalid-soft ring-invalid/30" : "bg-surface ring-black/5"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/60 bg-surface-strong/50 p-6">
        <div className="flex items-center gap-3">
          <SeedBadge type={r.seedType} />
          <h3 className="text-lg font-medium tracking-tight">Specimen Analysis Report</h3>
        </div>
        <span className="max-w-[14ch] truncate font-mono text-sm text-muted-foreground">
          {sample.name}
        </span>
      </div>

      {invalid ? (
        <div className="space-y-4 p-8">
          <div className="flex items-start gap-3 rounded-lg border border-invalid/30 bg-invalid/5 p-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-base font-semibold text-invalid">
                {r.notes.toLowerCase().includes("human")
                  ? "HUMAN DETECTED — PLEASE UPLOAD A SEED IMAGE"
                  : r.notes.toLowerCase().includes("invalid seed")
                    ? "INVALID SEED — ONLY WHEAT AND RICE ARE SUPPORTED"
                    : "PLEASE UPLOAD AN IMAGE OF A SEED"}
              </p>
              <p className="mt-1 text-sm text-secondary-foreground">
                {r.notes ||
                  "The sample could not be recognized as wheat or rice. Please upload a clear close-up image of seeds."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 p-8">
          {r.qualityStatus === "Poor" && (
            <div className="flex items-center gap-3 rounded-lg border border-invalid/40 bg-invalid-soft p-4 text-invalid">
              <span className="text-xl font-bold">⚠️</span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider">Poor Quality Seed Lot Alert</span>
                <p className="text-xs text-secondary-foreground">
                  High defect rate observed (fungal spots / mold / micro-cracks). Not recommended for planting.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            <div className="space-y-8">
              <div>
                <span className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Viability Prediction
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-semibold tracking-tighter">{r.viability}</span>
                  <span className="text-xl text-muted-foreground">%</span>
                </div>
                <Meter value={r.viability} status={r.qualityStatus} />
              </div>

              <div>
                <span className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Overall Quality Score
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-medium">{r.qualityScore}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <Meter value={r.qualityScore} status={r.qualityStatus} />
              </div>

              <div className="space-y-3">
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Identified Defects
                </span>
                <ul className="space-y-2">
                  {(r.defects.length ? r.defects : ["No significant defects detected"]).map((d) => (
                    <li key={d} className="flex items-center gap-3 text-sm text-secondary-foreground">
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          r.qualityStatus === "Poor" ? "bg-invalid" : r.qualityStatus === "Moderate" ? "bg-warn" : "bg-valid"
                        }`}
                      />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-6 rounded-lg bg-surface-strong p-6 ring-1 ring-black/5">
              <div>
                <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Quality Status
                </span>
                <span className={`font-medium ${tone}`}>{r.qualityStatus}</span>
              </div>
              <div>
                <span className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Visible Abnormalities
                </span>
                <ul className="space-y-1.5">
                  {(r.abnormalities.length ? r.abnormalities : ["None observed"]).map((a) => (
                    <li key={a} className="text-sm text-secondary-foreground">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="mb-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
                  Recommendation
                </span>
                <p className="text-sm font-medium leading-relaxed">{r.recommendation}</p>
                {r.notes && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.notes}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Meter({ value, status }: { value: number; status: SeedAnalysis["qualityStatus"] }) {
  const color =
    status === "Good" ? "bg-valid" : status === "Moderate" ? "bg-warn" : "bg-invalid";
  return (
    <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
    </div>
  );
}

function SeedBadge({ type }: { type: SeedAnalysis["seedType"] }) {
  const cls =
    type === "WHEAT"
      ? "bg-warn-soft text-warn"
      : type === "RICE"
        ? "bg-valid-soft text-valid"
        : "bg-invalid text-primary-foreground";
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cls}`}>
      {type}
    </span>
  );
}

function BatchRow({ sample }: { sample: Sample }) {
  const r = sample.result;
  const invalid = r?.seedType === "INVALID";
  return (
    <tr className={invalid ? "bg-invalid-soft/60" : "hover:bg-secondary/40"}>
      <td className="max-w-[16ch] truncate px-6 py-4 font-mono text-xs text-muted-foreground">
        {sample.name}
      </td>
      <td className="px-6 py-4">
        {r ? (
          <SeedBadge type={r.seedType} />
        ) : (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {sample.status === "analyzing" ? "Scanning…" : sample.status === "error" ? "Retry" : "Queued"}
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex justify-center">
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
            {r && !invalid && (
              <div
                className={`h-full ${
                  r.qualityStatus === "Good"
                    ? "bg-valid"
                    : r.qualityStatus === "Moderate"
                      ? "bg-warn"
                      : "bg-invalid"
                }`}
                style={{ width: `${r.qualityScore}%` }}
              />
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right font-mono text-sm">
        {r && !invalid ? `${r.viability}%` : <span className="text-muted-foreground">N/A</span>}
      </td>
      <td className="px-6 py-4">
        {r ? (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
              invalid
                ? "bg-invalid-soft text-invalid"
                : r.qualityStatus === "Good"
                  ? "bg-valid-soft text-valid"
                  : r.qualityStatus === "Moderate"
                    ? "bg-warn-soft text-warn"
                    : "bg-invalid-soft text-invalid"
            }`}
          >
            {invalid ? "Rejected" : r.qualityStatus}
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {sample.error ? "Error" : "Pending"}
          </span>
        )}
      </td>
    </tr>
  );
}
