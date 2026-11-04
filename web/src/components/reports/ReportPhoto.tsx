"use client";

import { useState } from "react";
import { buildImageUrl } from "@/lib/image";

// The report's photo at full width (up to its natural size), with a placeholder when it is missing or fails.
export function ReportPhoto({ imageUrl }: { imageUrl: string | null }) {
  const src = buildImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-zinc-100 text-sm text-zinc-500">
        Photo unavailable
      </div>
    );
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" title="Open the full-size photo in a new tab">
      {/* Plain <img> on purpose: images come from the backend, no next/image config yet. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Photo of the reported waste"
        onError={() => setFailed(true)}
        className="max-h-[32rem] w-full rounded-lg bg-zinc-100 object-contain"
      />
    </a>
  );
}
