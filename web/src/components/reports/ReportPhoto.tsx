"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { buildImageUrl } from "@/lib/image";

// The report's photo, large, with a placeholder when it is missing or fails to load.
export function ReportPhoto({ imageUrl }: { imageUrl: string | null }) {
  const src = buildImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-gray-100 text-small text-gray-700">
        <ImageOff className="size-6" aria-hidden="true" />
        Photo unavailable
      </div>
    );
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer" title="Open the full-size photo in a new tab" className="block">
      {/* Plain <img> on purpose: images come from the backend, no next/image config yet. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Photo of the reported waste"
        onError={() => setFailed(true)}
        className="aspect-[4/3] w-full bg-gray-100 object-cover"
      />
    </a>
  );
}
