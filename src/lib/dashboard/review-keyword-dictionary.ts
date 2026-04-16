import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardReviewKeywordCategory } from "@/entities/dashboard/reviews-types";

export type ReviewKeywordDictionaryEntry = {
  sentiment: "positive" | "negative";
  category: Exclude<DashboardReviewKeywordCategory, "other">;
  canonical_keyword: string;
};

type AliasRow = {
  alias: string;
  review_keyword_dictionary?: ReviewKeywordDictionaryEntry | null;
};

type DictRow = ReviewKeywordDictionaryEntry;

function isMissingRelationError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  // PostgREST: "relation \"...\" does not exist" / "Could not find the table ..."
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    msg.includes("PGRST")
  );
}

export async function tryFetchReviewKeywordDictionaryMaps(
  supabase: SupabaseClient,
): Promise<{
  aliasToCanonical: Map<
    string,
    {
      canonicalKeyword: string;
      category: DashboardReviewKeywordCategory;
      sentiment: "positive" | "negative";
    }
  >;
  canonicalToCategory: Map<
    string,
    { category: DashboardReviewKeywordCategory; sentiment: "positive" | "negative" }
  >;
}> {
  const aliasToCanonical = new Map<
    string,
    {
      canonicalKeyword: string;
      category: DashboardReviewKeywordCategory;
      sentiment: "positive" | "negative";
    }
  >();
  const canonicalToCategory = new Map<
    string,
    { category: DashboardReviewKeywordCategory; sentiment: "positive" | "negative" }
  >();

  try {
    const { data: dictRows, error: dictError } = await supabase
      .from("review_keyword_dictionary")
      .select("sentiment, category, canonical_keyword");
    if (dictError) throw dictError;
    for (const raw of (dictRows ?? []) as unknown as DictRow[]) {
      const sent = raw.sentiment;
      if (sent !== "positive" && sent !== "negative") continue;
      const canon = (raw.canonical_keyword ?? "").trim();
      if (!canon) continue;
      const category = (raw.category ?? "") as DashboardReviewKeywordCategory;
      canonicalToCategory.set(`${sent}::${canon}`, { sentiment: sent, category });
    }

    const { data: aliasRows, error: aliasError } = await supabase
      .from("review_keyword_dictionary_aliases")
      .select(
        "alias, review_keyword_dictionary(sentiment, category, canonical_keyword)",
      );
    if (aliasError) throw aliasError;

    for (const raw of (aliasRows ?? []) as unknown as AliasRow[]) {
      const alias = (raw.alias ?? "").trim();
      if (!alias) continue;
      const d = raw.review_keyword_dictionary;
      const sent = d?.sentiment;
      if (sent !== "positive" && sent !== "negative") continue;
      const canon = (d?.canonical_keyword ?? "").trim();
      if (!canon) continue;
      const category = (d?.category ?? "other") as DashboardReviewKeywordCategory;
      aliasToCanonical.set(`${sent}::${alias}`, {
        sentiment: sent,
        canonicalKeyword: canon,
        category,
      });
    }
  } catch (e) {
    if (!isMissingRelationError(e)) throw e;
    // 마이그레이션이 아직 미적용인 경우: 정규화 없이 raw 그대로 사용
    return { aliasToCanonical, canonicalToCategory };
  }

  return { aliasToCanonical, canonicalToCategory };
}

export async function tryResolveCanonicalKeywordMatchList(
  supabase: SupabaseClient,
  args: { sentiment: "positive" | "negative"; canonicalKeyword: string },
): Promise<string[]> {
  const canon = args.canonicalKeyword.trim();
  if (!canon) return [];

  try {
    const { data: dict, error: dictError } = await supabase
      .from("review_keyword_dictionary")
      .select("id")
      .eq("sentiment", args.sentiment)
      .eq("canonical_keyword", canon)
      .maybeSingle();
    if (dictError) throw dictError;
    const dictId = (dict as { id?: string } | null)?.id;
    if (!dictId) return [canon];

    const { data: aliases, error: aliasError } = await supabase
      .from("review_keyword_dictionary_aliases")
      .select("alias")
      .eq("dictionary_id", dictId);
    if (aliasError) throw aliasError;

    const out = new Set<string>([canon]);
    for (const raw of (aliases ?? []) as unknown as { alias?: string }[]) {
      const a = (raw.alias ?? "").trim();
      if (a) out.add(a);
    }
    return [...out];
  } catch (e) {
    if (!isMissingRelationError(e)) throw e;
    return [canon];
  }
}

