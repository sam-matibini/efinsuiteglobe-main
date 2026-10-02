import { describe, expect, it } from "vitest";
import { elevenLabsKeyFromText, explainElevenLabsFailure, pickAgentId, readAgentUtterance } from "../elevenlabsAgent";

describe("elevenlabs agent selection", () => {
  it("uses the configured agent id", () => {
    expect(pickAgentId([{ agent_id: "agent_other", name: "Alice" }], "agent_ready")).toBe("agent_ready");
  });

  it("prefers the efinsuite agent over another Alice", () => {
    expect(pickAgentId([
      { agent_id: "agent_money", name: "Alice · EfinMoney" },
      { agent_id: "agent_globe", name: "Alice — efinsuite Globe" },
    ])).toBe("agent_globe");
  });

  it("uses Alice when no efinsuite agent exists", () => {
    expect(pickAgentId([
      { agent_id: "agent_other", name: "Support" },
      { agent_id: "agent_alice", name: "Alice · EfinMoney" },
    ])).toBe("agent_alice");
  });

  it("explains a key that cannot start a conversation", () => {
    expect(explainElevenLabsFailure({
      detail: {
        status: "missing_permissions",
        message: "The API key you used is missing the permission convai_write to execute this operation.",
      },
    })).toMatch(/Conversational AI write/);
    expect(explainElevenLabsFailure({ message: "Agent not found" })).toBe("Agent not found");
  });

  it("reads an ElevenLabs key from notes without taking prose", () => {
    expect(elevenLabsKeyFromText("The key is below.\nsk_testkey123\n")).toBe("sk_testkey123");
    expect(elevenLabsKeyFromText('ELEVENLABS_API_KEY="sk_named123"\n')).toBe("sk_named123");
    expect(elevenLabsKeyFromText("no key here")).toBe("");
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
