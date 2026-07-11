import { describe, expect, it } from "vitest";
import { parsePersistedEveEvents } from "../../shared/eve-events";

describe("永続化したEveイベントの公開読込境界", () => {
  it("既知のイベントを検証してEveへ渡せる形で返す", () => {
    const events = [{
      type: "message.received",
      data: {
        message: "相談内容",
        sequence: 1,
        turnId: "turn-1",
      },
      meta: { at: "2026-07-12T00:00:00.000Z" },
    }];

    expect(parsePersistedEveEvents(events)).toEqual(events);
  });

  it("既知イベントのネストした必須項目が壊れている場合は拒否する", () => {
    expect(() => parsePersistedEveEvents([{
      type: "message.received",
      data: {
        message: "相談内容",
        sequence: "1",
      },
    }])).toThrow();
  });

  it("未知のイベント種別はEveのreducerへ渡さない", () => {
    expect(() => parsePersistedEveEvents([{
      type: "unknown.event",
      data: {},
    }])).toThrow();
  });
});
