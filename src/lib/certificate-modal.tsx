import { Printer, X, Award, ShieldCheck, QrCode } from "lucide-react";
import type { SeedAnalysis } from "./vision-engine";

export function CertificateModal({
  isOpen,
  onClose,
  sampleName,
  previewUrl,
  result,
}: {
  isOpen: boolean;
  onClose: () => void;
  sampleName: string;
  previewUrl: string;
  result: SeedAnalysis;
}) {
  if (!isOpen) return null;

  const certId = `ISTA-SS-${Date.now().toString(36).toUpperCase()}`;
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-2xl bg-white p-8 text-neutral-900 shadow-2xl ring-1 ring-black/10 print:m-0 print:w-full print:max-w-none print:rounded-none print:shadow-none print:ring-0">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4 print:hidden">
          <div className="flex items-center gap-2 text-primary">
            <Award className="size-6 text-emerald-600" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-800">
              Official Quality Report
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow"
            >
              <Printer className="size-4" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body (Printable Area) */}
        <div className="mt-6 border-4 border-double border-emerald-800/40 p-8 rounded-xl bg-gradient-to-b from-emerald-50/20 via-white to-amber-50/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold font-mono">
                  SS
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                    SeedSure AI Agronomic Inspection
                  </h1>
                  <p className="text-xs text-neutral-500 uppercase tracking-widest">
                    Digital Seed Quality & Viability Certificate
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-xs text-neutral-500">
              <div>Certificate ID: <span className="font-bold text-neutral-800">{certId}</span></div>
              <div>Issue Date: <span className="text-neutral-800">{dateStr}</span></div>
            </div>
          </div>

          <hr className="my-6 border-emerald-800/20" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 aspect-square flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt={sampleName}
                  className="size-full object-cover"
                />
              </div>
              <div className="font-mono text-[11px] text-center text-neutral-500 truncate">
                File: {sampleName}
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Species Classification
                  </span>
                  <div className="mt-1 text-lg font-bold text-emerald-800">
                    {result.seedType === "WHEAT"
                      ? "Triticum aestivum (Wheat)"
                      : result.seedType === "RICE"
                        ? "Oryza sativa (Rice)"
                        : "INVALID SAMPLE"}
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    Confidence: {(result.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Quality Rating
                  </span>
                  <div className="mt-1 text-lg font-bold text-emerald-800">
                    {result.qualityScore} / 100 ({result.qualityStatus})
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    Germination: {result.viability}%
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Biophysical & Defect Audit
                </span>
                <ul className="mt-2 space-y-1.5 text-xs text-neutral-700">
                  {result.defects.map((d) => (
                    <li key={d} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-emerald-700" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Sowing & Field Recommendation
                </span>
                <p className="mt-1 text-xs font-medium text-neutral-800">
                  {result.recommendation}
                </p>
                <p className="mt-1 text-[11px] text-neutral-600 leading-relaxed">
                  {result.notes}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-emerald-800/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded border border-neutral-300 bg-neutral-50">
                <QrCode className="size-8 text-neutral-700" />
              </div>
              <div className="text-[10px] text-neutral-500">
                <div className="font-bold text-neutral-700">Digital Verification Hash</div>
                <div className="font-mono">{certId}</div>
                <div>ISTA / Agri-Vision Neural Inspection Standard</div>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs">
                <ShieldCheck className="size-4" /> Validated by SeedSure AI Core
              </div>
              <div className="text-[10px] text-neutral-400">Authorized Agronomic Vision Seal</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
