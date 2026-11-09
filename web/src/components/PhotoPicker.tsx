"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "./ui";

/** Shrink to max 1600px and re-encode as JPEG in the browser, so uploads are small and fast. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("could not encode image"))), "image/jpeg", 0.84));
}

export function PhotoPicker({ value, onChange, max, label = "Photos" }: { value: string[]; onChange: (urls: string[]) => void; max: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const room = max - value.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) setError(`Up to ${max} photos.`);
    setBusy(picked.length);
    const urls: string[] = [];
    for (const f of picked) {
      try {
        const blob = await shrink(f);
        const name = f.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "photo";
        const res = await upload(`photos/${name}.jpg`, blob, { access: "public", handleUploadUrl: "/api/upload", contentType: "image/jpeg" });
        urls.push(res.url);
      } catch (e) {
        setError(`Upload failed: ${(e as Error).message}`);
      }
      setBusy((n) => n - 1);
    }
    onChange([...value, ...urls]);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
        <span className="num text-xs text-dim">
          {value.length}/{max}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <AnimatePresence>
          {value.map((u) => (
            <motion.div key={u} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== u))}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <div key={`b${i}`} className="shimmer animate-shimmer grid aspect-square place-items-center rounded-xl border border-line bg-white/[0.03]">
              <Loader2 className="size-4 animate-spin text-dim" />
            </div>
          ))}
        </AnimatePresence>
        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn("grid aspect-square place-items-center rounded-xl border border-dashed border-line-strong text-dim transition hover:border-brand/50 hover:bg-brand/[0.06] hover:text-violet-200")}
          >
            <span className="flex flex-col items-center gap-1 text-[11px]">
              <ImagePlus className="size-5" /> Add
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
    </div>
  );
}

export function Gallery({ urls, className }: { urls: string[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!urls.length) return null;
  return (
    <>
      <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-6", className)}>
        {urls.map((u, i) => (
          <button key={u} type="button" onClick={() => setOpen(u)} className="aspect-square overflow-hidden rounded-xl border border-line transition hover:border-brand/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Photo ${i + 1}`} className="size-full object-cover transition duration-300 hover:scale-105" />
          </button>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img initial={{ scale: 0.95 }} animate={{ scale: 1 }} src={open} alt="" className="max-h-full max-w-full rounded-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
