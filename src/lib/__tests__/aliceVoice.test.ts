import { describe, expect, it } from "vitest";
import { cleanTextForTTS, shortenForSpeech } from "@/lib/aliceVoice";

describe("alice voice text", () => {
  it("strips markdown before speech", () => {
    expect(cleanTextForTTS("**Hello** [docs](https://example.com) `code`")).toBe("Hello docs");
  });

  it("shortens a long reply on a sentence boundary", () => {
    const text = `${"Sentence one. ".repeat(40)}${"tail ".repeat(80)}`;
    const spoken = shortenForSpeech(text, 120);
    expect(spoken.shortened).toBe(true);
    expect(spoken.text.endsWith("…")).toBe(true);
    expect(spoken.text.length).toBeLessThan(text.length);
    expect(spoken.text.includes(".")).toBe(true);
  });

  it("leaves a short reply unchanged", () => {
    expect(shortenForSpeech("Accounts payable is money you owe.")).toEqual({
      text: "Accounts payable is money you owe.",
      shortened: false,
    });
  });
});
