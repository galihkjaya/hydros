"use client";

import Image from "next/image";
import { Button } from "@/components/ui/primitives";
import { formatBytes } from "@/lib/utils/format";

/**
 * Selected-image preview with dimensions, file size and a clear action.
 * Uses next/image with `unoptimized` because the source is a local blob URL.
 */
export function ImagePreview({
  previewUrl,
  fileName,
  fileSize,
  onClear,
  disabled,
}: {
  previewUrl: string;
  fileName: string;
  fileSize: number;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <figure className="overflow-hidden border border-ink bg-paper">
      <div className="relative aspect-[4/3] w-full bg-surface-muted">
        <Image
          src={previewUrl}
          alt={`Selected water source photograph: ${fileName}`}
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, 480px"
          className="object-cover"
        />
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-[0.8125rem] font-medium">
            {fileName}
          </span>
          <span className="wl-mono text-subtle">{formatBytes(fileSize)}</span>
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClear}
          disabled={disabled}
        >
          Replace
        </Button>
      </figcaption>
    </figure>
  );
}
