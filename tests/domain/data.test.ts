import { describe, expect, it } from "vitest";
import {
  CASES,
  CaseRecordSchema,
  DomainDataError,
  EXPERTS,
  GUIDES,
  loadCollection,
  type CaseCategory,
} from "#lib/domain";

describe("ダミーデータの件数と構成", () => {
  it("事例は12件（3領域×4）", () => {
    expect(CASES).toHaveLength(12);
    const byCategory = CASES.reduce<Record<CaseCategory, number>>(
      (acc, record) => {
        acc[record.category] += 1;
        return acc;
      },
      { inheritance: 0, stigmatized: 0, non_rebuildable: 0 },
    );
    expect(byCategory).toEqual({ inheritance: 4, stigmatized: 4, non_rebuildable: 4 });
  });

  it("有識者は6名で各領域を2名以上カバーする", () => {
    expect(EXPERTS).toHaveLength(6);
    for (const category of ["inheritance", "stigmatized", "non_rebuildable"] as const) {
      const count = EXPERTS.filter((expert) => expert.specialties.includes(category)).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it("社内初動ガイドは4件", () => {
    expect(GUIDES).toHaveLength(4);
  });

  it("すべてのIDは重複しない", () => {
    const ids = [
      ...CASES.map((c) => c.id),
      ...EXPERTS.map((e) => e.id),
      ...GUIDES.map((g) => g.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("loadCollection によるZod検証（読込時検証）", () => {
  it("不正な形のデータは検証エラーになる", () => {
    expect(() => loadCollection(CaseRecordSchema, [{ id: "X" }], "事例")).toThrow(DomainDataError);
  });

  it("配列でない入力は検証エラーになる", () => {
    expect(() => loadCollection(CaseRecordSchema, { id: "X" }, "事例")).toThrow(DomainDataError);
  });

  it("IDが重複する場合は検証エラーになる", () => {
    expect(() => loadCollection(CaseRecordSchema, [CASES[0], CASES[0]], "事例")).toThrow(
      /IDの重複/,
    );
  });

  it("正しいデータはそのまま返る", () => {
    const result = loadCollection(CaseRecordSchema, CASES, "事例");
    expect(result).toHaveLength(12);
  });
});
