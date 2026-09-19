import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="eterfaceID">
      <svg
        viewBox="0 0 34 40"
        aria-hidden="true"
        className={cn("shrink-0", compact ? "h-7 w-6" : "h-9 w-8")}
      >
        <path
          d="M17 1.8 31 6.7v11.1c0 9.2-5.5 16-14 19.6C8.5 33.8 3 27 3 17.8V6.7L17 1.8Z"
          fill="var(--brand-shield)"
        />
        <path
          d="M17 6 26.9 9.5v8.2c0 6.7-3.8 11.7-9.9 14.7-6.1-3-9.9-8-9.9-14.7V9.5L17 6Z"
          fill="none"
          stroke="var(--brand-cyan)"
          strokeWidth="1.8"
        />
        <path
          d="M11.1 19.5c0-4.7 2.2-7.5 5.9-7.5s5.9 2.8 5.9 7.5M13.4 24.2c1.5-1.8 2-3.6 2-6.1 0-1.4.7-2.4 1.7-2.4s1.7 1 1.7 2.4c0 4.8-1.3 8.1-4.2 10.5M21 27c1.8-2.7 2.4-5.2 2.4-8.2"
          fill="none"
          stroke="var(--brand-cyan)"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
      {!compact && (
        <span className="font-display text-[1.15rem] font-extrabold leading-none text-ink">
          eterface<span className="text-signal">ID</span>
        </span>
      )}
    </span>
  );
}