import { describe, expect, it } from "vitest";
import { pickAgentId, readAgentUtterance } from "../elevenlabsAgent";

describe("elevenlabs agent selection", () => {
  it("uses the configured agent id", () => {
    expect(pickAgentId([{ agent_id: "agent_other", name: "Alice" }], "agent_ready")).toBe("agent_ready");
  });

  it("prefers an agent named Alice when no id is configured", () => {
    expect(pickAgentId([
      { agent_id: "agent_other", name: "Support" },
      { agent_id: "agent_alice", name: "Alice — efinsuite Globe" },
    ])).toBe("agent_alice");
  });

  it("reads user and agent transcripts", () => {
    expect(readAgentUtterance({ source: "user", message: " What is pricing? " })).toEqual({
      role: "user",
      text: "What is pricing?",
    });
    expect(readAgentUtterance({ source: "ai", message: "I can help with that." })).toEqual({
      role: "assistant",
      text: "I can help with that.",
    });
    expect(readAgentUtterance({ message: "   " })).toBeNull();
  });
});
