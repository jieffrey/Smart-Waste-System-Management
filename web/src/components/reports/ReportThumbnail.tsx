"use client";

import { useState } from "react";
import { buildImageUrl } from "@/lib/image";

// Fixed-size photo with a placeholder when there is no image or it fails to load.
export function ReportThumbnail({ imageUrl, size = 56 }: { imageUrl: string | null; size?: number }) {
  const src = buildImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded bg-zinc-100 text-micro text-zinc-400"
      >
        No photo
      </div>
    );
  }

  return (
    // Plain <img> on purpose: images come from the backend, no next/image config yet.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Report photo"
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className="rounded object-cover"
    />
  );
}
