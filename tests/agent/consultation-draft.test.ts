import { describe, expect, it } from "vitest";
import { PII_NOTICE, buildConsultationDraft } from "#lib/consultation-draft";
import { EXPERTS } from "#lib/domain/data";
import { PRIORITY_LABELS } from "@/shared/tools/first-response";

const KNOWN_EXPERT = EXPERTS[0];

function baseInput() {
  return {
    expertId: KNOWN_EXPERT.id,
    caseOverview: "地方の実家を兄弟3人で相続し、共有者の一人と連絡が取れていない案件。",
    consultationPoints: ["共有者への連絡手段の整理", "初動で確認すべき書類"],
    priorityLevel: "early_check" as const,
    referencedCaseIds: ["CASE-INH-001"],
    referencedGuideIds: ["GUIDE-INH-01"],
  };
}

describe("buildConsultationDraft", () => {
  it("既知の有識者IDから宛先・論点・優先度・参照・個人情報注意を含む下書きを組み立てる", () => {
    const result = buildConsultationDraft(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.draft.recipient).toEqual({
      id: KNOWN_EXPERT.id,
      name: KNOWN_EXPERT.name,
      department: KNOWN_EXPERT.department,
    });
    expect(result.draft.priorityLabel).toBe(PRIORITY_LABELS.early_check);
    expect(result.draft.body).toContain(KNOWN_EXPERT.name);
    expect(result.draft.body).toContain("共有者への連絡手段の整理");
    expect(result.draft.body).toContain("CASE-INH-001");
    expect(result.draft.body).toContain("GUIDE-INH-01");
    expect(result.draft.body).toContain(PII_NOTICE);
    expect(result.draft.piiNotice).toBe(PII_NOTICE);
  });

  it("存在しない社員IDでは下書きを生成しない", () => {
    const result = buildConsultationDraft({ ...baseInput(), expertId: "EXP-999" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.message).toContain("EXP-999");
  });

  it("ツールが返していない事例ID・ガイドIDは参照から除外する", () => {
    const result = buildConsultationDraft({
      ...baseInput(),
      referencedCaseIds: ["CASE-INH-001", "CASE-FAKE-001"],
      referencedGuideIds: ["GUIDE-FAKE-01"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.draft.referencedCaseIds).toEqual(["CASE-INH-001"]);
    expect(result.draft.referencedGuideIds).toEqual([]);
    expect(result.draft.body).not.toContain("CASE-FAKE-001");
    expect(result.draft.body).not.toContain("GUIDE-FAKE-01");
  });

  it("同じ入力に対して同じ下書きを返す（決定性）", () => {
    const first = buildConsultationDraft(baseInput());
    const second = buildConsultationDraft(baseInput());

    expect(second).toEqual(first);
  });
});
