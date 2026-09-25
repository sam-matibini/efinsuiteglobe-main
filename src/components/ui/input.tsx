import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Clamp a date input value to a 4-digit year (YYYY-MM-DD).
 * Native <input type="date"> in Chromium allows years up to 6 digits,
 * which leads to bogus values like "202425-12-31". This normalizes the
 * year segment to at most 4 digits so dates stay valid downstream.
 */
function clampDateYear(value: string): string {
  if (!value) return value;
  // ISO date is YYYY-MM-DD; year is everything before the first dash.
  const firstDash = value.indexOf("-");
  if (firstDash <= 4) return value;
  const year = value.slice(0, firstDash);
  const rest = value.slice(firstDash);
  // Keep the last 4 digits of the typed year (preserves the most recent keystrokes
  // which mirror typical numeric-segment behaviour in date inputs).
  return year.slice(-4) + rest;
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onChange, max, ...props }, ref) => {
    const isDate = type === "date";

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDate) {
          const clamped = clampDateYear(e.target.value);
          if (clamped !== e.target.value) {
            // Mutate the value so downstream consumers (react-hook-form, controlled state)
            // receive the clamped string.
            e.target.value = clamped;
          }
        }
        onChange?.(e);
      },
      [isDate, onChange],
    );

    return (
      <input
        type={type}
        max={isDate ? max ?? "9999-12-31" : max}
        onChange={handleChange}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
