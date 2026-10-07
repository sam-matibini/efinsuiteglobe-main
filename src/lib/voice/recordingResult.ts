export function recordingFailureMessage(
  error: { message?: string } | null,
  data: { success?: boolean; error?: string } | null,
): string | null {
  if (!error && data?.success !== false) return null;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  return "Failed to fetch recordings";
}
