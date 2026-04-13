import { describe, expect, it } from "vitest"
import { isTerminalSessionEvent, relaySessionEvents } from "../src/event-relay"

describe("isTerminalSessionEvent", () => {
  it("detects explicit terminal event types", () => {
    expect(isTerminalSessionEvent({ type: "session.completed" })).toBe(true)
    expect(isTerminalSessionEvent({ type: "session.idle" })).toBe(true)
    expect(isTerminalSessionEvent({ type: "response.completed" })).toBe(true)
  })

  it("detects completed status on message.updated", () => {
    expect(
      isTerminalSessionEvent({
        type: "message.updated",
        properties: { status: "completed" },
      }),
    ).toBe(true)

    expect(
      isTerminalSessionEvent({
        type: "message.updated",
        properties: { done: true },
      }),
    ).toBe(true)
  })

  it("ignores non-terminal events", () => {
    expect(isTerminalSessionEvent({ type: "message.part.delta" })).toBe(false)
    expect(
      isTerminalSessionEvent({
        type: "message.updated",
        properties: { status: "in_progress" },
      }),
    ).toBe(false)
  })

  it("does not relay reasoning deltas as output text", async () => {
    async function* stream() {
      yield {
        type: "message.part.updated",
        sessionID: "s1",
        properties: {
          sessionID: "s1",
          part: {
            id: "p-reason",
            sessionID: "s1",
            messageID: "m1",
            type: "reasoning",
            text: "",
            time: { start: Date.now() },
          },
          time: Date.now(),
        },
      }
      yield {
        type: "message.part.delta",
        sessionID: "s1",
        properties: {
          sessionID: "s1",
          messageID: "m1",
          partID: "p-reason",
          field: "text",
          delta: "internal thought ",
        },
      }
      yield {
        type: "message.part.updated",
        sessionID: "s1",
        properties: {
          sessionID: "s1",
          part: {
            id: "p-text",
            sessionID: "s1",
            messageID: "m1",
            type: "text",
            text: "",
            time: { start: Date.now() },
          },
          time: Date.now(),
        },
      }
      yield {
        type: "message.part.delta",
        sessionID: "s1",
        properties: {
          sessionID: "s1",
          messageID: "m1",
          partID: "p-text",
          field: "text",
          delta: "public answer",
        },
      }
      yield {
        type: "session.idle",
        sessionID: "s1",
        properties: {},
      }
    }

    const deltas: string[] = []

    const result = await relaySessionEvents(
      {
        event: {
          subscribe: () => ({ stream: stream() }),
        },
      },
      {
        onTextDelta: async (text) => {
          deltas.push(text)
        },
        onToolActivity: async () => {},
        onQuestion: async () => {},
        onPermission: async () => {},
        onError: async () => {},
      },
      "s1",
    )

    expect(result.completed).toBe(true)
    expect(deltas.join("")).toBe("public answer")
  })
})
