import { describe, expect, it } from "vitest";
import { recordingFailureMessage } from "./recordingResult";

describe("recording list result", () => {
  it("does not treat a successful empty list as a failure", () => {
    expect(recordingFailureMessage(null, { success: true, recordings: [] } as { success: boolean })).toBeNull();
  });

  it("uses the voice service message when the request fails", () => {
    expect(recordingFailureMessage({ message: "non-2xx" }, { success: false, error: "Twilio credentials not configured" })).toBe(
      "Twilio credentials not configured",
    );
  });

  it("keeps a fallback when the service returns no message", () => {
    expect(recordingFailureMessage({ message: "non-2xx" }, null)).toBe("Failed to fetch recordings");
  });
});
