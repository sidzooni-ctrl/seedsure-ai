import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeSeedImage, type SeedAnalysis } from "@/lib/seed-analysis.functions";
import { analyzeSeedVision, callAiVisionApi } from "@/lib/vision-engine";
import { generateDemoSample } from "@/lib/demo-samples";
import { translations, type Language } from "@/lib/translations";
import { CameraModal } from "@/lib/camera-modal";
import { CertificateModal } from "@/lib/certificate-modal";
import {
  Sparkles,
  Camera,
  Layers,
  Award,
  Download,
  Trash2,
  Settings,
  Languages,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Info,
  ShieldCheck,
  ChevronRight,
  Flame,
  Droplets,
  Scale,
  ScanLine,
  FileSpreadsheet
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SeedSure AI — Agronomic Seed Inspection & Viability Engine" },
      {
        name: "description",
        content:
          "Advanced AI agronomic inspection for wheat and rice seeds with real-time fungal defect heatmap, germination viability forecasting, biophysical metrics, and ISTA certificates.",
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([
    { id: "boot", level: "SYS", text: "SeedSure AI Vision Engine online — Neural defect classifier initialized" },
  ]);
  const [dragging, setDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [savedKeyMsg, setSavedKeyMsg] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [viewMode, setViewMode] = useState<"specimen" | "heatmap">("specimen");

  const t = translations[language];

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
      const storedLang = (localStorage.getItem("seedsure_lang") as Language) || "en";
      if (["en", "hi", "pa", "es"].includes(storedLang)) {
        setLanguage(storedLang);
      }
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
    if (!selectedId && samples.length > 0) {
      setSelectedId(samples[samples.length - 1].id);
    }
  }, [samples, selectedId]);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("seedsure_lang", lang);
    }
  };

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
          const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setSamples((prev) => [
            ...prev,
            {
              id: newId,
              name: file.name,
              previewUrl,
              dataUrl,
              status: "queued",
            },
          ]);
          setSelectedId(newId);
          pushLog("OK", `Queued specimen: ${file.name}`);
        } catch {
          pushLog("ERR", `Could not read ${file.name}`);
        }
      }
    },
    [pushLog],
  );

  const loadDemo = (type: "healthy-wheat" | "moldy-wheat" | "basmati-rice" | "chalky-rice" | "soybean-invalid" | "sunset-invalid") => {
    const demo = generateDemoSample(type);
    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setSamples((prev) => [
      ...prev,
      {
        id: newId,
        name: demo.name,
        previewUrl: demo.dataUrl,
        dataUrl: demo.dataUrl,
        status: "queued",
      },
    ]);
    setSelectedId(newId);
    pushLog("OK", `Loaded preset sample: ${demo.name}`);
  };

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

          // 2. High-Precision Client-Side Canvas & Morphology Vision Engine with Defect Heatmap
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
            pushLog("WRN", `${item.name}: Rejected — ${result.notes}`);
          } else {
            pushLog(
              result.qualityStatus === "Poor" ? "WRN" : "OK",
              `${item.name}: ${result.seedType} (${result.qualityStatus}) · Quality ${result.qualityScore}/100 · Viability ${result.viability}%`,
            );
          }
        } catch (err) {
          if (runId !== runIdRef.current || !mountedRef.current) return;
          const msg = err instanceof Error ? err.message : "Analysis failed";
          setSamples((prev) =>
            prev.map((s) => (s.id === item.id ? { ...s, status: "error", error: msg } : s)),
          );
          pushLog("ERR", `${item.name}: ${msg}`);
        }
      }
    } finally {
      if (runId === runIdRef.current && mountedRef.current) {
        setRunning(false);
      }
    }
  }, [analyze, apiKey, pushLog, running]);

  const removeSample = (id: string) => {
    setSamples((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (selectedId === id) {
        setSelectedId(next.length ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  const clearAll = () => {
    runIdRef.current++;
    setRunning(false);
    setSamples((prev) => {
      prev.forEach((s) => {
        URL.revokeObjectURL(s.previewUrl);
        urlsRef.current.delete(s.previewUrl);
      });
      return [];
    });
    setSelectedId(null);
    if (inputRef.current) inputRef.current.value = "";
    setLog([{ id: `${Date.now()}`, level: "SYS", text: "Session reset — ready for new specimen input" }]);
  };

  const exportCsv = () => {
    if (!samples.length) return;
    const rows = [
      ["Sample Name", "Species", "Quality Score", "Germination Viability", "Quality Status", "Fungal Load %", "Recommendation", "Defects"],
      ...samples.map((s) => [
        `"${s.name}"`,
        s.result?.seedType || "PENDING",
        s.result?.qualityScore ?? "N/A",
        s.result?.viability ? `${s.result.viability}%` : "N/A",
        s.result?.qualityStatus || "N/A",
        s.result?.grainMetrics?.fungalSurfacePct ? `${s.result.grainMetrics.fungalSurfacePct}%` : "0%",
        `"${s.result?.recommendation || "N/A"}"`,
        `"${(s.result?.defects || []).join("; ")}"`,
      ]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `seedsure_batch_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const active = useMemo(
    () => samples.find((s) => s.id === selectedId) || samples[samples.length - 1],
    [samples, selectedId],
  );

  const pending = samples.filter((s) => s.status === "queued" || s.status === "error").length;
  const valid = samples.filter((s) => s.result && s.result.seedType !== "INVALID");
  const invalidCount = samples.filter((s) => s.result && s.result.seedType === "INVALID").length;
  const avgQuality = valid.length
    ? Math.round(valid.reduce((acc, s) => acc + (s.result?.qualityScore || 0), 0) / valid.length)
    : 0;
  const avgViability = valid.length
    ? Math.round(valid.reduce((acc, s) => acc + (s.result?.viability || 0), 0) / valid.length)
    : 0;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface-strong/80 backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary shadow-sm text-primary-foreground font-bold">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight">{t.appTitle}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  v3.0 Neural Pro
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {t.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <div className="flex items-center rounded-lg bg-secondary p-0.5 ring-1 ring-black/5">
              {(["en", "hi", "pa", "es"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    language === lang
                      ? "bg-surface-strong text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-border transition-colors"
            >
              <Settings className="size-3.5" />
              <span className="hidden sm:inline">{t.aiSettings}</span>
            </button>

            <div className="flex items-center gap-1.5 rounded-full bg-valid-soft px-2.5 py-1 text-[11px] font-semibold text-valid">
              <span className="size-1.5 rounded-full bg-valid animate-pulse" />
              <span>{t.engineOnline}</span>
            </div>
          </div>
        </div>
      </header>

      {/* AI Settings Drawer */}
      {showSettings && (
        <div className="border-b border-border/80 bg-surface px-6 py-5 animate-in slide-in-from-top duration-200">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-semibold">{t.aiSettings} & Neural Pipeline</h4>
                <p className="text-xs text-muted-foreground">
                  Connect live Gemini Multimodal Vision API key or use built-in Offline Agronomic Computer Vision.
                </p>
              </div>
              <div className="flex max-w-md flex-1 items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste Gemini / OpenAI API Key"
                  className="w-full rounded-lg border border-input bg-surface-strong px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={saveApiKey}
                  className="shrink-0 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
            {savedKeyMsg && <p className="mt-2 text-xs font-medium text-valid">{savedKeyMsg}</p>}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Specimen Input & Scanner Controls */}
          <section className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl bg-surface-strong p-6 shadow-sm ring-1 ring-black/5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t.specimenInput}
                </span>
                <span className="text-xs font-medium text-primary">
                  {samples.length} Specimen{samples.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Specimen Viewer Canvas / Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files) void addFiles(e.dataTransfer.files);
                }}
                className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-secondary/60 ring-1 ring-black/5 transition-all ${
                  dragging ? "ring-2 ring-primary bg-primary/5" : ""
                }`}
              >
                {active ? (
                  <div className="relative size-full group">
                    <img
                      src={viewMode === "heatmap" && active.result?.defectHeatmapUrl ? active.result.defectHeatmapUrl : active.previewUrl}
                      alt={active.name}
                      className="size-full object-contain"
                    />

                    {/* View Mode Toggle Switch on Image */}
                    {active.result?.defectHeatmapUrl && (
                      <div className="absolute top-3 right-3 z-10 flex rounded-lg bg-black/70 p-0.5 backdrop-blur-md">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewMode("specimen");
                          }}
                          className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            viewMode === "specimen" ? "bg-white text-black shadow" : "text-white/70 hover:text-white"
                          }`}
                        >
                          Original
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewMode("heatmap");
                          }}
                          className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            viewMode === "heatmap" ? "bg-emerald-500 text-white shadow" : "text-white/70 hover:text-white"
                          }`}
                        >
                          Defect Heatmap
                        </button>
                      </div>
                    )}

                    {/* Heatmap Legend Overlay */}
                    {viewMode === "heatmap" && active.result?.defectHeatmapUrl && (
                      <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/80 p-2.5 text-[10px] text-white backdrop-blur-md flex flex-wrap items-center justify-around gap-2">
                        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-red-500" /> Fungal Mold / Black Point</span>
                        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber-500" /> Moisture Weathering</span>
                        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-cyan-400" /> Micro-Cracks</span>
                        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-green-500" /> Healthy Endosperm</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => inputRef.current?.click()}
                    className="flex size-full cursor-pointer flex-col items-center justify-center gap-3 p-8 text-center"
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ScanLine className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.dropSeedsHere}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{t.supportedCrops}</p>
                    </div>
                  </div>
                )}

                {running && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-black/20 backdrop-blur-[1px]">
                    <div className="scanner-line h-1 w-full bg-emerald-400 shadow-[0_0_20px_#34d399]" />
                    <span className="m-3 text-center rounded bg-black/70 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                      Neural Scan Active...
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

              {/* Action Buttons: Upload & Camera */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-border transition-colors"
                >
                  <Layers className="size-4" /> Browse Files
                </button>
                <button
                  onClick={() => setShowCamera(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-border transition-colors"
                >
                  <Camera className="size-4" /> {t.useCamera}
                </button>
              </div>

              {/* One-Click Demo Sample Library */}
              <div className="mt-5 rounded-xl border border-border/80 bg-surface p-3.5">
                <span className="mb-2.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t.testPresets}
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    onClick={() => loadDemo("healthy-wheat")}
                    className="rounded-lg bg-surface-strong p-2 font-medium hover:bg-primary/10 hover:text-primary transition-colors text-left border border-border/50"
                  >
                    🌾 {t.presetHealthyWheat}
                  </button>
                  <button
                    onClick={() => loadDemo("moldy-wheat")}
                    className="rounded-lg bg-surface-strong p-2 font-medium hover:bg-invalid-soft hover:text-invalid transition-colors text-left border border-border/50"
                  >
                    🍄 {t.presetMoldyWheat}
                  </button>
                  <button
                    onClick={() => loadDemo("basmati-rice")}
                    className="rounded-lg bg-surface-strong p-2 font-medium hover:bg-primary/10 hover:text-primary transition-colors text-left border border-border/50"
                  >
                    🍚 {t.presetBasmatiRice}
                  </button>
                  <button
                    onClick={() => loadDemo("chalky-rice")}
                    className="rounded-lg bg-surface-strong p-2 font-medium hover:bg-warn-soft hover:text-warn transition-colors text-left border border-border/50"
                  >
                    🥣 {t.presetChalkyRice}
                  </button>
                  <button
                    onClick={() => loadDemo("soybean-invalid")}
                    className="rounded-lg bg-surface-strong p-2 font-medium hover:bg-invalid-soft hover:text-invalid transition-colors text-left border border-border/50"
                  >
                    🫘 {t.presetSoybean}
                  </button>
                  <button
                    onClick={() => loadDemo("sunset-invalid")}
                    className="rounded-lg bg-surface-strong p-2 font-medium hover:bg-invalid-soft hover:text-invalid transition-colors text-left border border-border/50"
                  >
                    🌄 {t.presetLandscape}
                  </button>
                </div>
              </div>

              {/* Specimen Thumbnails Strip */}
              {samples.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-border">
                  {samples.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`group relative size-14 cursor-pointer overflow-hidden rounded-xl ring-2 transition-all ${
                        selectedId === s.id
                          ? "ring-primary scale-105 shadow-md"
                          : "ring-transparent opacity-75 hover:opacity-100"
                      }`}
                    >
                      <img src={s.previewUrl} alt={s.name} className="size-full object-cover" />
                      {s.result && (
                        <span
                          className={`absolute bottom-0 inset-x-0 text-[8px] font-bold text-center text-white ${
                            s.result.seedType === "INVALID"
                              ? "bg-red-600"
                              : s.result.qualityStatus === "Good"
                                ? "bg-emerald-600"
                                : s.result.qualityStatus === "Moderate"
                                  ? "bg-amber-600"
                                  : "bg-red-600"
                          }`}
                        >
                          {s.result.seedType === "INVALID" ? "INV" : `${s.result.qualityScore}%`}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSample(s.id);
                        }}
                        className="absolute top-1 right-1 hidden size-4 items-center justify-center rounded-full bg-black/80 text-[10px] text-white group-hover:flex"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Analysis Trigger Buttons */}
              <div className="mt-6 space-y-2.5">
                <button
                  onClick={() => void runAnalysis()}
                  disabled={running || pending === 0}
                  className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Sparkles className="size-4" />
                  {running ? t.analyzing : `${t.analyzeSeed}${pending > 1 ? ` (${pending})` : ""}`}
                </button>
                <button
                  onClick={clearAll}
                  className="w-full rounded-xl bg-secondary py-2.5 text-xs font-medium text-secondary-foreground hover:bg-border transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="size-3.5" /> {t.clearDiagnostics}
                </button>
              </div>
            </div>

            {/* System Log Console */}
            <div className="rounded-2xl bg-surface-strong p-4 shadow-sm ring-1 ring-black/5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Activity className="size-3 text-primary" /> {t.statusLog}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {samples.length} ACTIVE
                </span>
              </div>
              <div className="max-h-36 space-y-1.5 overflow-y-auto font-mono text-[11px] text-secondary-foreground">
                {log.map((l) => (
                  <div key={l.id} className="flex gap-2 leading-relaxed">
                    <span
                      className={
                        l.level === "OK"
                          ? "text-emerald-500 font-bold"
                          : l.level === "WRN"
                            ? "text-amber-500 font-bold"
                            : l.level === "ERR"
                              ? "text-red-500 font-bold"
                              : "text-blue-400 font-bold"
                      }
                    >
                      [{l.level}]
                    </span>
                    <span className="truncate">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right Column: Specimen Report & Batch Analytics */}
          <section className="space-y-6 lg:col-span-7">
            {/* Primary Specimen Report Card */}
            <ResultCard
              sample={active}
              t={t}
              onOpenCertificate={() => setShowCertificate(true)}
            />

            {/* Batch Inspection Dashboard & Summary */}
            <div className="rounded-2xl bg-surface-strong p-6 shadow-sm ring-1 ring-black/5">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h3 className="text-base font-bold tracking-tight">{t.batchSummary}</h3>
                  <p className="text-xs text-muted-foreground">Session lot statistics & compliance record</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportCsv}
                    disabled={samples.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-border transition-colors disabled:opacity-50"
                  >
                    <FileSpreadsheet className="size-3.5" /> {t.exportCsv}
                  </button>
                </div>
              </div>

              {/* Batch KPI Stat Badges */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tested Lots
                  </span>
                  <div className="mt-1 text-2xl font-bold">{samples.length}</div>
                </div>
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Valid Lots
                  </span>
                  <div className="mt-1 text-2xl font-bold text-emerald-600">{valid.length}</div>
                </div>
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Mean Quality
                  </span>
                  <div className="mt-1 text-2xl font-bold">{valid.length ? `${avgQuality}/100` : "—"}</div>
                </div>
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Mean Viability
                  </span>
                  <div className="mt-1 text-2xl font-bold text-primary">{valid.length ? `${avgViability}%` : "—"}</div>
                </div>
              </div>

              {/* Table of Batch Items */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-surface/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">{t.sample}</th>
                      <th className="px-4 py-3">{t.type}</th>
                      <th className="px-4 py-3 text-center">{t.quality}</th>
                      <th className="px-4 py-3 text-right">{t.viability}</th>
                      <th className="px-4 py-3">{t.status}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {samples.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          {t.noSpecimensYet}
                        </td>
                      </tr>
                    )}
                    {samples.map((s) => (
                      <BatchRow
                        key={s.id}
                        sample={s}
                        isSelected={s.id === active?.id}
                        onSelect={() => setSelectedId(s.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Live Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={(file) => void addFiles([file])}
      />

      {/* Official Seed Health Certificate Modal */}
      {active && active.result && active.result.seedType !== "INVALID" && (
        <CertificateModal
          isOpen={showCertificate}
          onClose={() => setShowCertificate(false)}
          sampleName={active.name}
          previewUrl={active.previewUrl}
          result={active.result}
        />
      )}

      {/* Footer */}
      <footer className="mx-auto max-w-7xl border-t border-border px-6 py-8 mt-12">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="font-mono text-[11px] text-muted-foreground">
            SEEDSURE CORE | NEURAL AGRI-INSPECTION ENGINE v3.0 | ISTA-COMPLIANT DIGITAL DIAGNOSTICS
          </div>
          <div className="text-xs text-muted-foreground">
            Approved Specimen Protocols: Wheat (Triticum aestivum) & Rice (Oryza sativa)
          </div>
        </div>
      </footer>
    </div>
  );
}

function ResultCard({
  sample,
  t,
  onOpenCertificate,
}: {
  sample?: Sample | undefined;
  t: typeof translations["en"];
  onOpenCertificate: () => void;
}) {
  if (!sample?.result) {
    return (
      <div className="rounded-2xl bg-surface-strong p-12 text-center shadow-sm ring-1 ring-black/5">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground mb-3">
          <Info className="size-6" />
        </div>
        <h4 className="text-sm font-semibold">{t.specimenReport}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload a specimen or select one from the demo library and click "Analyze Specimen" to generate a diagnostic report.
        </p>
      </div>
    );
  }

  const r = sample.result;
  const invalid = r.seedType === "INVALID";
  const metrics = r.grainMetrics;

  return (
    <div
      className={`overflow-hidden rounded-2xl shadow-sm ring-1 transition-all ${
        invalid ? "bg-red-50/40 ring-red-200 dark:bg-red-950/20 dark:ring-red-900" : "bg-surface-strong ring-black/5"
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-surface/80 p-6">
        <div className="flex items-center gap-3">
          <SeedBadge type={r.seedType} />
          <div>
            <h3 className="text-base font-bold tracking-tight">{t.specimenReport}</h3>
            <span className="font-mono text-xs text-muted-foreground">{sample.name}</span>
          </div>
        </div>
        {!invalid && (
          <button
            onClick={onOpenCertificate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Award className="size-3.5" /> {t.exportCertificate}
          </button>
        )}
      </div>

      {invalid ? (
        <div className="p-8">
          <div className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-100/50 p-5 dark:border-red-900 dark:bg-red-950/40">
            <XCircle className="size-6 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <h4 className="text-sm font-bold text-red-800 dark:text-red-300">
                {r.notes.toLowerCase().includes("human")
                  ? "HUMAN DETECTED — PLEASE UPLOAD A SEED IMAGE"
                  : r.notes.toLowerCase().includes("invalid seed")
                    ? "INVALID SEED — ONLY WHEAT AND RICE ARE SUPPORTED"
                    : "PLEASE UPLOAD AN IMAGE OF A SEED"}
              </h4>
              <p className="mt-1 text-xs text-red-700 dark:text-red-400 leading-relaxed">
                {r.notes}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 p-8">
          {/* Poor Quality Alert Banner */}
          {r.qualityStatus === "Poor" && (
            <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-100/60 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              <AlertTriangle className="size-5 shrink-0 text-red-600" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider">Critical Defect Alert</span>
                <p className="mt-0.5 text-xs">
                  Fungal mold / black point or severe fracturing detected. Sowing this seed lot is NOT recommended due to germination failure risk.
                </p>
              </div>
            </div>
          )}

          {/* Primary Viability & Quality Gauges */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t.viabilityPrediction}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight">{r.viability}</span>
                  <span className="text-sm font-semibold text-muted-foreground">% Germination</span>
                </div>
                <Meter value={r.viability} status={r.qualityStatus} />
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t.overallQuality}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono">{r.qualityScore}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
                <Meter value={r.qualityScore} status={r.qualityStatus} />
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t.qualityStatus}
                </span>
                <div className="mt-1 text-lg font-bold">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      r.qualityStatus === "Good"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : r.qualityStatus === "Moderate"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {r.qualityStatus === "Good" ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                    {r.qualityStatus} Quality
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t.recommendation}
                </span>
                <p className="mt-1 text-xs font-semibold text-foreground">{r.recommendation}</p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{r.notes}</p>
              </div>
            </div>
          </div>

          {/* Biophysical Metrics Grid */}
          {metrics && (
            <div>
              <span className="mb-2.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.grainMetricsTitle}
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Scale className="size-3" /> {t.lengthWidth}
                  </span>
                  <div className="mt-1 text-sm font-bold font-mono">
                    {metrics.lengthMm} × {metrics.widthMm} mm
                  </div>
                </div>
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Flame className="size-3" /> {t.fungalSurface}
                  </span>
                  <div className={`mt-1 text-sm font-bold font-mono ${metrics.fungalSurfacePct > 3 ? "text-red-600" : "text-foreground"}`}>
                    {metrics.fungalSurfacePct}%
                  </div>
                </div>
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Droplets className="size-3" /> {t.moistureRisk}
                  </span>
                  <div className={`mt-1 text-sm font-bold ${metrics.moistureRisk === "Critical" ? "text-red-600" : "text-foreground"}`}>
                    {metrics.moistureRisk}
                  </div>
                </div>
                <div className="rounded-xl bg-surface p-3.5 border border-border/50">
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="size-3" /> {t.sowingTier}
                  </span>
                  <div className="mt-1 text-xs font-semibold truncate text-emerald-600">
                    {metrics.sowingSuitability}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Identified Defects List */}
          <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t.identifiedDefects} & Morphology
            </span>
            <ul className="space-y-2">
              {r.defects.map((d) => (
                <li key={d} className="flex items-center gap-2.5 text-xs text-secondary-foreground">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      r.qualityStatus === "Poor" ? "bg-red-500" : r.qualityStatus === "Moderate" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Meter({ value, status }: { value: number; status: SeedAnalysis["qualityStatus"] }) {
  const color =
    status === "Good" ? "bg-emerald-500" : status === "Moderate" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
    </div>
  );
}

function SeedBadge({ type }: { type: SeedAnalysis["seedType"] }) {
  const cls =
    type === "WHEAT"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : type === "RICE"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-red-600 text-white";
  return (
    <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${cls}`}>
      {type}
    </span>
  );
}

function BatchRow({
  sample,
  isSelected,
  onSelect,
}: {
  sample: Sample;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const r = sample.result;
  const invalid = r?.seedType === "INVALID";
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/10 font-semibold"
          : invalid
            ? "bg-red-50/40 hover:bg-red-50/70 dark:bg-red-950/20"
            : "hover:bg-secondary/40"
      }`}
    >
      <td className="max-w-[18ch] truncate px-4 py-3 font-mono text-xs">
        {sample.name}
      </td>
      <td className="px-4 py-3">
        {r ? (
          <SeedBadge type={r.seedType} />
        ) : (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {sample.status === "analyzing" ? "Scanning…" : sample.status === "error" ? "Retry" : "Queued"}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-center">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
            {r && !invalid && (
              <div
                className={`h-full ${
                  r.qualityStatus === "Good"
                    ? "bg-emerald-500"
                    : r.qualityStatus === "Moderate"
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${r.qualityScore}%` }}
              />
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {r && !invalid ? `${r.viability}%` : <span className="text-muted-foreground">N/A</span>}
      </td>
      <td className="px-4 py-3">
        {r ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
              invalid
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                : r.qualityStatus === "Good"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : r.qualityStatus === "Moderate"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
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
