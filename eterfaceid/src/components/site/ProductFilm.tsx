import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ProductFilm({
  src,
  poster,
  title,
  description,
  className,
}: {
  src: string;
  poster: string;
  title: string;
  description: string;
  className?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <figure className={cn("overflow-hidden border border-rule bg-paper", className)}>
      <div className="aspect-[8/5] overflow-hidden bg-paper">
        {reduceMotion ? (
          <img
            src={poster}
            alt={`${title}: ${description}`}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <video
            src={src}
            poster={poster}
            aria-label={`${title}: ${description}`}
            className="size-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        )}
      </div>
      <figcaption className="flex flex-col gap-1 border-t border-rule px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
        <span className="text-[0.82rem] font-semibold text-ink">{title}</span>
        <span className="text-[0.75rem] leading-relaxed text-ink-soft">{description}</span>
      </figcaption>
    </figure>
  );
}