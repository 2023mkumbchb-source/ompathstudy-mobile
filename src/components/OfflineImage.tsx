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
  onError,
  ...props
}: OfflineImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>("");
  const [hasError, setHasError] = useState<boolean>(false);
  const [triedRemote, setTriedRemote] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    setHasError(false);
    setTriedRemote(false);

    // If already a local blob/data URL, keep it
    if (!src || src.startsWith("blob:") || src.startsWith("data:")) {
      setCurrentSrc(src);
      return;
    }

    const resolve = async () => {
      const cached = await getCachedImageUrl(src);
      if (!alive) return;
      if (cached) { setCurrentSrc(cached); return; }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        const stored = await cacheSingleImage(src);
        if (!alive) return;
        if (stored) {
          const downloaded = await getCachedImageUrl(src);
          if (alive && downloaded) { setCurrentSrc(downloaded); return; }
        }
        // Direct remote rendering is the last online fallback.
        setCurrentSrc(src);
      } else {
        setHasError(true);
      }
    };
    void resolve();

    return () => {
      alive = false;
    };
  }, [src]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    onError?.(event);

    // A stale packaged/cache mapping must not block a valid online image.
    if (currentSrc !== src && typeof navigator !== "undefined" && navigator.onLine && !triedRemote) {
      setTriedRemote(true);
      setHasError(false);
      setCurrentSrc(src);
      return;
    }

    // If the remote URL failed (for example after connectivity dropped),
    // resolve local storage one final time.
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

  if (!currentSrc) {
    return <div className={`min-h-36 animate-pulse rounded-lg bg-muted/60 ${className}`} aria-label={`Loading ${alt}`} />;
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
