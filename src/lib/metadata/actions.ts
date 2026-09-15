"use server";

import { createClient } from "@/lib/supabase/server";
import {
  fetchUrlMetadata,
  suggestedLabelFromMetadata,
  type UrlMetadata,
} from "@/lib/metadata/fetch-metadata";
import { takeRateLimitToken } from "@/lib/metadata/rate-limit";
import { normalizeUrl, UrlNormalizationError } from "@/lib/normalize-url";
import type { ActionResult } from "@/lib/types";

export type MetadataActionData = {
  hostname: string;
  suggestedLabel: string;
  metadata: UrlMetadata | null;
};

export async function fetchLinkMetadataAction(
  rawUrl: string
): Promise<ActionResult<MetadataActionData>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const limited = takeRateLimitToken(`metadata:${user.id}`, 20, 60_000);
  if (!limited.ok) {
    return {
      success: false,
      error: "Too many metadata requests. Try again shortly.",
      code: "UNKNOWN",
    };
  }

  let normalized;
  try {
    normalized = normalizeUrl(rawUrl);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof UrlNormalizationError
          ? error.message
          : "That doesn't look like a valid URL.",
      code: "VALIDATION",
    };
  }

  const metadata = await fetchUrlMetadata(normalized.normalized);

  return {
    success: true,
    data: {
      hostname: normalized.hostname,
      suggestedLabel: suggestedLabelFromMetadata(metadata, normalized.hostname),
      metadata,
    },
  };
}
