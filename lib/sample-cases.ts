import type { CaseCategory } from "@/shared/tools/first-response";

type SampleCase = {
  readonly id: CaseCategory;
  readonly label: string;
  readonly code: string;
  readonly summary: string;
  readonly prompt: string;
};

export const SAMPLE_CASES = [
  {
    id: "inheritance",
    label: "相続・共有名義",
    code: "案件 01",
    summary: "連絡の取れない共有者がいる相続空き家",
    prompt:
      "父が亡くなり、地方の実家を兄弟3人で相続しました。一人とは連絡が取れていません。家には荷物が残っており、老朽化も進んでいます。売却を検討するため、まず何を確認すべきでしょうか。",
  },
  {
    id: "stigmatized",
    label: "事故・告知事項",
    code: "案件 02",
    summary: "過去に人が亡くなった相続物件",
    prompt:
      "相続した戸建てで過去に人が亡くなったと聞きました。詳しい時期や経緯は分からず、近隣から聞いただけです。売却を考える前に、どの事実を確認して誰に相談すべきでしょうか。",
  },
  {
    id: "non_rebuildable",
    label: "再建築不可・老朽化",
    code: "案件 03",
    summary: "接道条件に懸念がある古い家屋",
    prompt:
      "古い家屋を所有していますが、前面道路が狭く、再建築できない可能性があると言われました。建物の傷みも進んでいます。活用や売却を考えるための初動確認事項を整理してください。",
  },
] as const satisfies readonly SampleCase[];
