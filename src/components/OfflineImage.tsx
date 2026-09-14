import React, { useEffect, useState } from "react";
import { getCachedImageUrl, cacheSingleImage } from "@/lib/offlineImageStore";
import { isOfflineMode } from "@/lib/offlineStore";
import { ImageOff } from "lucide-react";

interface OfflineImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
}

export default function OfflineImage({
  src,
  alt = "Medical illustration",
  className = "",
  ...props
}: OfflineImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    setHasError(false);

    // If already a local blob/data URL, keep it
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) {
      setCurrentSrc(src);
      return;
    }

    // Check if image is available in offline cache
    getCachedImageUrl(src).then((cached) => {
      if (alive && cached) {
        setCurrentSrc(cached);
      } else if (alive) {
        setCurrentSrc(src);
        // If online, pre-cache in background for future offline access
        if (typeof navigator !== "undefined" && navigator.onLine) {
          void cacheSingleImage(src);
        }
      }
    });

    return () => {
      alive = false;
    };
  }, [src]);

  const handleError = () => {
    // If the remote URL failed to load (e.g. offline / disconnected),
    // try to resolve from local cache one more time
    getCachedImageUrl(src).then((cached) => {
      if (cached && cached !== currentSrc) {
        setCurrentSrc(cached);
        setHasError(false);
      } else {
        setHasError(true);
      }
    });
  };

  if (hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-xs text-muted-foreground ${className}`}
      >
        <ImageOff className="mb-2 h-6 w-6 text-muted-foreground/60" />
        <span className="font-medium text-foreground">{alt}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">
          {isOfflineMode() ? "Image not downloaded for offline study yet" : "Could not load image"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={props.loading ?? "lazy"}
      decoding={props.decoding ?? "async"}
      className={className}
      onError={handleError}
      {...props}
    />
  );
}
