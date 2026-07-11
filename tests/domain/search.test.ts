import { describe, expect, it } from "vitest";
import {
  assessPriority,
  buildEvidenceBundle,
  searchExperts,
  searchGuides,
  searchSimilarCases,
  type CaseQuery,
} from "#lib/domain";

const inheritanceQuery: CaseQuery = {
  category: "inheritance",
  tags: ["相続", "共有持分", "連絡不通", "空き家"],
  keyIssues: ["共有者の同意", "連絡が取れない共有者"],
  propertyState: ["空き家", "残置物あり"],
  rights: ["共有"],
};

const stigmatizedQuery: CaseQuery = {
  category: "stigmatized",
  tags: ["告知事項", "心理的瑕疵", "売却", "相続"],
  keyIssues: ["告知の要否", "売却時の説明", "心理的瑕疵の整理"],
  propertyState: ["空き家"],
  rights: ["相続による取得"],
};

const nonRebuildableQuery: CaseQuery = {
  category: "non_rebuildable",
  tags: ["再建築不可", "接道", "老朽化"],
  keyIssues: ["接道状況の確認", "再建築可否の確認", "活用方法の検討"],
  propertyState: ["老朽化", "空き家"],
  rights: ["相続による取得"],
};

const emptyQuery: CaseQuery = {
  category: null,
  tags: [],
  keyIssues: [],
  propertyState: [],
  rights: [],
};

describe("3種類のサンプル案件に対する期待候補（REQUIREMENT §15.2/§18）", () => {
  it("相続・共有名義は CASE-INH-001 を最上位に返す", () => {
    const result = searchSimilarCases(inheritanceQuery);
    expect(result.hasSufficientEvidence).toBe(true);
    expect(result.matches[0].case.id).toBe("CASE-INH-001");
    expect(result.matches[0].case.category).toBe("inheritance");
  });

  it("事故・告知事項は CASE-STG-001 を最上位に返す", () => {
    const result = searchSimilarCases(stigmatizedQuery);
    expect(result.matches[0].case.id).toBe("CASE-STG-001");
  });

  it("再建築不可・老朽化は CASE-NRB-001 を最上位に返す", () => {
    const result = searchSimilarCases(nonRebuildableQuery);
    expect(result.matches[0].case.id).toBe("CASE-NRB-001");
  });
});

describe("類似事例の決定的な順位付け（REQUIREMENT §7.9）", () => {
  const tieQuery: CaseQuery = {
    category: "inheritance",
    tags: ["共有持分"],
    keyIssues: [],
    propertyState: [],
    rights: [],
  };

  it("上位3件までに制限し、同点は事例ID昇順で固定する", () => {
    const result = searchSimilarCases(tieQuery);
    expect(result.matches).toHaveLength(3);
    expect(result.matches.map((m) => m.case.id)).toEqual([
      "CASE-INH-001",
      "CASE-INH-002",
      "CASE-INH-003",
    ]);
    // 同点（001/002 は共に score 7）でも ID 昇順で安定する
    expect(result.matches[0].score).toBe(result.matches[1].score);
  });

  it("スコアは高い順に並ぶ", () => {
    const result = searchSimilarCases(inheritanceQuery);
    const scores = result.matches.map((m) => m.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("マッチした事例には根拠メタデータ（signal/matched/points）が付く", () => {
    const top = searchSimilarCases(inheritanceQuery).matches[0];
    expect(top.reasons.some((r) => r.signal === "category")).toBe(true);
    expect(top.reasons.every((r) => r.points > 0)).toBe(true);
  });
});

describe("十分な根拠がない場合（REQUIREMENT §7.12）", () => {
  const noMatchQuery: CaseQuery = {
    category: null,
    tags: ["存在しないタグXYZ"],
    keyIssues: ["無関係な論点"],
    propertyState: [],
    rights: [],
  };

  it("類似事例は空結果＋十分な根拠なしを返す", () => {
    const result = searchSimilarCases(noMatchQuery);
    expect(result.matches).toEqual([]);
    expect(result.hasSufficientEvidence).toBe(false);
  });

  it("有識者は空結果＋十分な根拠なしを返す", () => {
    const result = searchExperts(noMatchQuery);
    expect(result.matches).toEqual([]);
    expect(result.hasSufficientEvidence).toBe(false);
  });

  it("ガイドは空結果＋十分な根拠なしを返す", () => {
    const result = searchGuides(noMatchQuery);
    expect(result.matches).toEqual([]);
    expect(result.hasSufficientEvidence).toBe(false);
  });
});

describe("有識者の決定的な順位付け（REQUIREMENT §7.11）", () => {
  it("領域一致者を関連案件数の多い順に返す", () => {
    const result = searchExperts(inheritanceQuery);
    expect(result.hasSufficientEvidence).toBe(true);
    expect(result.matches.map((m) => m.expert.id)).toEqual(["EXP-001", "EXP-002"]);
    expect(result.matches[0].recommendation).toContain("関連案件");
  });

  it("得意分野が一致すると加点され、推薦理由に反映される", () => {
    const query: CaseQuery = {
      category: "inheritance",
      tags: [],
      keyIssues: ["共有持分の整理"],
      propertyState: [],
      rights: [],
    };
    const result = searchExperts(query);
    expect(result.matches[0].expert.id).toBe("EXP-001");
    expect(result.matches[0].recommendation).toContain("共有持分の整理");
  });

  it("上位3名までに制限する", () => {
    const result = searchExperts(nonRebuildableQuery);
    expect(result.matches.length).toBeLessThanOrEqual(3);
  });
});

describe("社内初動ガイドの決定的な順位付け（REQUIREMENT §7.10）", () => {
  it("上位2件までに制限し、対象カテゴリ一致で決定的に並ぶ", () => {
    const result = searchGuides(nonRebuildableQuery);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].guide.id).toBe("GUIDE-NRB-ACCESS-01");
    expect(result.matches.map((m) => m.guide.id)).toContain("GUIDE-NRB-VACANT-01");
  });
});

describe("優先度・安全確認フラグ（REQUIREMENT §7.6）", () => {
  it("倒壊・破損・傾きなどの記載は安全確認を優先にする", () => {
    const query: CaseQuery = {
      category: "non_rebuildable",
      tags: [],
      keyIssues: ["安全面の確認"],
      propertyState: ["傾き", "一部破損"],
      rights: [],
    };
    const result = assessPriority(query);
    expect(result.level).toBe("safety_first");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("連絡不通・期限などは早期の担当者確認にする", () => {
    const query: CaseQuery = {
      category: "inheritance",
      tags: [],
      keyIssues: ["連絡が取れない共有者"],
      propertyState: [],
      rights: [],
    };
    expect(assessPriority(query).level).toBe("early_check");
  });

  it("安全・緊急の記載がなければ通常確認にする", () => {
    const query: CaseQuery = {
      category: "stigmatized",
      tags: ["告知事項"],
      keyIssues: ["告知の要否"],
      propertyState: ["空き家"],
      rights: [],
    };
    expect(assessPriority(query).level).toBe("normal");
  });

  it("情報が不足していれば要確認にする", () => {
    expect(assessPriority(emptyQuery).level).toBe("needs_review");
  });
});

describe("決定性（同一入力→同一出力：REQUIREMENT §11.1）", () => {
  it("類似事例検索は繰り返し同じ結果を返す", () => {
    expect(searchSimilarCases(inheritanceQuery)).toEqual(searchSimilarCases(inheritanceQuery));
  });

  it("根拠バンドルは繰り返し同じ結果を返す", () => {
    expect(buildEvidenceBundle(nonRebuildableQuery)).toEqual(
      buildEvidenceBundle(nonRebuildableQuery),
    );
  });
});
