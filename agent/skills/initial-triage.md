---
description: Procedure for initial analysis, reanalysis, and consultation-draft creation for complex real-estate inquiries. Always load this skill first when handling a new case inquiry.
---

# Initial Triage Procedure

## Step 1: Extract a Structured Case Summary

Extract the following details from the inquiry. Do not infer missing facts; mark unreadable details as unknown.

- Case category (`category`): use one of the three values below, or `null` when it cannot be determined.
  - `inheritance` = 相続・共有名義
  - `stigmatized` = 事故・告知事項
  - `non_rebuildable` = 再建築不可・老朽化
- Property state (`propertyState`), rights (`rights`), and stakeholders (`stakeholders`)
- Customer wish (`customerWish`), current problem (`currentProblem`), and unknowns (`unknowns`)
- Search tags (`tags`) and key issues (`keyIssues`)

### Search Vocabulary (Important)

`tags`, `keyIssues`, `propertyState`, and `rights` are matched by **exact value** against the dummy data. Do not paraphrase or invent values. Select only the values that apply to the inquiry from the lists below.

- **tags**: 事実確認 / 入居者対応 / 共有持分 / 再建築不可 / 単独名義 / 告知事項 / 売却 / 安全確認 / 建て替え / 心理的瑕疵 / 意見相違 / 接道 / 旗竿地 / 活用検討 / 相続 / 相続登記 / 破損 / 空き家 / 管理不全 / 老朽化 / 賃貸 / 購入検討 / 連絡不通 / 遠方物件 / 遺産分割
- **keyIssues**: 事実確認 / 入居者対応 / 共有者の同意 / 再建築可否の確認 / 告知の要否 / 売却時の説明 / 安全面の確認 / 対応方針の整理 / 心理的瑕疵の整理 / 必要書類の確認 / 接道状況の確認 / 放置の解消 / 方針の合意形成 / 方針の整理 / 活用方法の検討 / 相続登記 / 管理者の不在 / 解体費用の確認 / 調査範囲の整理 / 賃貸時の説明 / 購入判断の材料整理 / 近隣への影響の確認 / 連絡が取れない共有者 / 遺産分割協議
- **propertyState**: 一部破損 / 一部空室 / 傾き / 室内は現状のまま / 居住中 / 残置物あり / 空き家 / 空室 / 管理不全 / 老朽化 / 賃貸中
- **rights**: 共有 / 単独取得見込み / 単独所有 / 未登記相続 / 相続による取得 / 購入検討

### Safety and Urgency Signals

When the inquiry mentions safety-related conditions such as collapse, fire, flooding, electrical leakage, gas leakage, leaning, damage, intrusion, or suspicious persons, add the original wording to `tags` even when it is not in the vocabulary.

Do the same for urgency-related conditions such as deadlines, inheritance renunciation, unreachable parties, litigation, delinquency, or seizure. The tool, not the model, determines the final priority.

## Step 2: Call `analyze_case`

Call `analyze_case` once with the extracted information. Prepare the following fields yourself.

- `missingInfo`: Important facts that cannot be determined from the input, up to five items
- `actionItems`: Prioritized initial checks, up to seven items. Limit these to fact-finding and identifying consultation paths; do not state legal conclusions or procedural decisions.
- `humanEscalation`: Items that require a human or specialist to confirm. Include legal, tax, appraisal, and contract-related issues here.
- `followUpQuestion`: One question to ask the user next

The tool deterministically returns priority, similar cases, internal guides, and expert candidates.

## Step 3: Respond with Cards

The UI renders the `analyze_case` result in structured cards labelled 「初回分析」 or 「再分析」. Do not duplicate the summary, checks, or candidate lists in the ordinary response.

Write only the following in Japanese:

1. A short one- to three-sentence explanation that states the final decision belongs to the responsible staff member or an appropriate specialist.
2. The next user question, matching the intent of `followUpQuestion`.

## Step 4: Reanalyze

When the user provides additional information, merge it with the previous extraction and call `analyze_case` again with `analysisType: "reanalysis"`.

In the Japanese supporting text, briefly state which unknowns were resolved and which new facts were found.

## Step 5: Run a Focused Search

When the user asks for specific candidates, such as additional similar cases, only guides, or alternative consultation contacts, call one of `search_similar_cases`, `search_guides`, or `search_experts`.

When `hasSufficientEvidence` is `false`, clearly state 「十分な根拠なし」 in Japanese.

## Step 6: Create a Consultation Draft

When the user selects an expert, call `draft_consultation_request`.

- Set `expertId` only to an employee ID returned by `analyze_case` or `search_experts`.
- Set `referencedCaseIds` and `referencedGuideIds` only to IDs returned by the tools.
- Do not include actual names, addresses, or contact details in `caseOverview` or `consultationPoints`.
- Tell the user in Japanese that the result is a copyable draft only and is not sent automatically.
