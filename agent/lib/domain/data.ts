import { z } from "zod";
import casesRaw from "@/data/cases.json";
import expertsRaw from "@/data/experts.json";
import guidesRaw from "@/data/guides.json";
import {
  CaseRecordSchema,
  ExpertSchema,
  GuideSchema,
  type CaseRecord,
  type Expert,
  type Guide,
} from "@/shared/tools/first-response";

// ダミーデータの読込・検証で失敗したことを表す（REQUIREMENT §8.4）
export class DomainDataError extends Error {
  override name = "DomainDataError";
}

// 配列データをZodで検証し、ID重複を拒否して返す（読込時検証）
export function loadCollection<T extends { id: string }>(
  itemSchema: z.ZodType<T>,
  raw: unknown,
  label: string,
): T[] {
  const parsed = z.array(itemSchema).safeParse(raw);
  if (!parsed.success) {
    throw new DomainDataError(`${label}データの検証に失敗しました: ${parsed.error.message}`);
  }

  const seen = new Set<string>();
  for (const item of parsed.data) {
    if (seen.has(item.id)) {
      throw new DomainDataError(`${label}データにIDの重複があります: ${item.id}`);
    }
    seen.add(item.id);
  }

  return parsed.data;
}

export const CASES: CaseRecord[] = loadCollection(CaseRecordSchema, casesRaw, "事例");
export const EXPERTS: Expert[] = loadCollection(ExpertSchema, expertsRaw, "有識者");
export const GUIDES: Guide[] = loadCollection(GuideSchema, guidesRaw, "社内初動ガイド");
