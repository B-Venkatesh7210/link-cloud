"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeUrl,
  normalizedUrlVariants,
  findLinkByUrl,
  UrlNormalizationError,
} from "@/lib/normalize-url";
import { createLinkSchema, updateLinkSchema } from "@/lib/schemas";
import type {
  ActionResult,
  CreateLinkInput,
  LinkWithTags,
  Tag,
  UpdateLinkInput,
} from "@/lib/types";
import {
  displayTagName,
  generateCanvasPosition,
  normalizeTagName,
  occupiedFromLinks,
} from "@/lib/helpers";
import { BUBBLE_FOOTPRINT, packRankedPositions } from "@/lib/cloud/layout";
import { APP_ROUTES } from "@/config/app";
import { getLinksForCurrentUser } from "@/lib/links/queries";

async function requireUserId() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, userId: null as string | null };
  }

  return { supabase, userId: user.id };
}

async function ensureTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tagNames: string[]
): Promise<Tag[]> {
  const unique = Array.from(
    new Map(
      tagNames
        .map((name) => displayTagName(name))
        .filter(Boolean)
        .map((name) => [normalizeTagName(name), name] as const)
    ).entries()
  );

  const tags: Tag[] = [];

  for (const [normalized_name, name] of unique) {
    const { data: existing, error: selectError } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .eq("normalized_name", normalized_name)
      .maybeSingle();

    if (selectError) {
      throw new Error("Couldn't save tags. Try again.");
    }

    if (existing) {
      tags.push(existing as Tag);
      continue;
    }

    const { data: created, error: insertError } = await supabase
      .from("tags")
      .insert({
        user_id: userId,
        name,
        normalized_name,
      })
      .select("*")
      .single();

    if (insertError) {
      // Race: another request may have created it
      const { data: raced } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)
        .eq("normalized_name", normalized_name)
        .maybeSingle();

      if (raced) {
        tags.push(raced as Tag);
        continue;
      }

      throw new Error("Couldn't save tags. Try again.");
    }

    tags.push(created as Tag);
  }

  return tags;
}

async function syncLinkTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  linkId: string,
  tags: Tag[]
) {
  const { error: deleteError } = await supabase
    .from("link_tags")
    .delete()
    .eq("link_id", linkId);

  if (deleteError) {
    throw new Error("Couldn't update tags. Try again.");
  }

  if (tags.length === 0) return;

  const { error: insertError } = await supabase.from("link_tags").insert(
    tags.map((tag) => ({
      link_id: linkId,
      tag_id: tag.id,
    }))
  );

  if (insertError) {
    throw new Error("Couldn't update tags. Try again.");
  }
}

function revalidateApp() {
  revalidatePath(APP_ROUTES.app);
  revalidatePath(APP_ROUTES.settings);
}

export async function createLinkAction(
  input: CreateLinkInput
): Promise<ActionResult<LinkWithTags>> {
  const parsed = createLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      code: "VALIDATION",
    };
  }

  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  let normalized;
  try {
    normalized = normalizeUrl(parsed.data.url);
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

  const { data: duplicateRows } = await supabase
    .from("links")
    .select("id, normalized_url")
    .eq("user_id", userId)
    .in("normalized_url", normalizedUrlVariants(normalized.normalized));

  const existing = duplicateRows?.[0];

  if (existing) {
    const links = await getLinksForCurrentUser({ includeArchived: true });
    const existingLink = links.find((link) => link.id === existing.id);

    return {
      success: false,
      error: "You already saved this link.",
      code: "DUPLICATE",
      existing: existingLink,
    };
  }

  const { data: existingRows } = await supabase
    .from("links")
    .select("position_x, position_y")
    .eq("user_id", userId)
    .is("archived_at", null);

  const position = generateCanvasPosition({
    existingCount: existingRows?.length ?? 0,
    occupied: occupiedFromLinks(existingRows ?? []),
  });
  const position_x = parsed.data.position_x ?? position.position_x;
  const position_y = parsed.data.position_y ?? position.position_y;

  try {
    const { data: link, error } = await supabase
      .from("links")
      .insert({
        user_id: userId,
        url: normalized.original.includes("://")
          ? normalized.original
          : normalized.normalized,
        normalized_url: normalized.normalized,
        label: parsed.data.label,
        hostname: normalized.hostname,
        notes: parsed.data.notes ?? null,
        page_title: parsed.data.page_title ?? null,
        description: parsed.data.description ?? null,
        favicon_url: parsed.data.favicon_url ?? normalized.faviconUrl,
        position_x,
        position_y,
        visual_seed: position.visual_seed,
      })
      .select("*")
      .single();

    if (error || !link) {
      if (error?.code === "23505") {
        const links = await getLinksForCurrentUser({ includeArchived: true });
        const existingLink = findLinkByUrl(links, normalized.normalized);
        return {
          success: false,
          error: "You already saved this link.",
          code: "DUPLICATE",
          existing: existingLink ?? undefined,
        };
      }
      return {
        success: false,
        error: "Couldn't save the link. Try again.",
        code: "UNKNOWN",
      };
    }

    const tags = await ensureTags(supabase, userId, parsed.data.tags ?? []);
    await syncLinkTags(supabase, link.id, tags);

    revalidateApp();

    return {
      success: true,
      data: { ...(link as LinkWithTags), tags },
    };
  } catch {
    return {
      success: false,
      error: "Couldn't save the link. Try again.",
      code: "UNKNOWN",
    };
  }
}

export type BulkCreateResult = {
  created: LinkWithTags[];
  skippedDuplicates: number;
  failed: number;
};

/** Create many links in one request; packs positions sequentially. */
export async function createLinksBulkAction(
  inputs: CreateLinkInput[]
): Promise<ActionResult<BulkCreateResult>> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return {
      success: false,
      error: "Nothing to import.",
      code: "VALIDATION",
    };
  }

  if (inputs.length > 100) {
    return {
      success: false,
      error: "Import is limited to 100 links at a time.",
      code: "VALIDATION",
    };
  }

  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { data: existingRows } = await supabase
    .from("links")
    .select("position_x, position_y, normalized_url, url, archived_at")
    .eq("user_id", userId);

  const occupied = occupiedFromLinks(
    (existingRows ?? []).filter((row) => row.archived_at == null)
  );
  const known = (existingRows ?? []).map((row) => ({
    normalized_url: row.normalized_url as string,
    url: row.url as string,
    archived_at: (row.archived_at as string | null) ?? null,
  }));

  const created: LinkWithTags[] = [];
  let skippedDuplicates = 0;
  let failed = 0;
  let existingCount = occupied.length;

  for (const input of inputs) {
    const parsed = createLinkSchema.safeParse(input);
    if (!parsed.success) {
      failed += 1;
      continue;
    }

    let normalized;
    try {
      normalized = normalizeUrl(parsed.data.url);
    } catch {
      failed += 1;
      continue;
    }

    if (findLinkByUrl(known, parsed.data.url)) {
      skippedDuplicates += 1;
      continue;
    }

    const position = generateCanvasPosition({
      existingCount,
      occupied,
    });

    try {
      const { data: link, error } = await supabase
        .from("links")
        .insert({
          user_id: userId,
          url: normalized.original.includes("://")
            ? normalized.original
            : normalized.normalized,
          normalized_url: normalized.normalized,
          label: parsed.data.label,
          hostname: normalized.hostname,
          notes: parsed.data.notes ?? null,
          page_title: parsed.data.page_title ?? null,
          description: parsed.data.description ?? null,
          favicon_url: parsed.data.favicon_url ?? normalized.faviconUrl,
          position_x: position.position_x,
          position_y: position.position_y,
          visual_seed: position.visual_seed,
        })
        .select("*")
        .single();

      if (error || !link) {
        if (error?.code === "23505") {
          skippedDuplicates += 1;
          known.push({
            normalized_url: normalized.normalized,
            url: normalized.normalized,
            archived_at: null,
          });
          continue;
        }
        failed += 1;
        continue;
      }

      const tags = await ensureTags(supabase, userId, parsed.data.tags ?? []);
      await syncLinkTags(supabase, link.id, tags);

      const withTags = { ...(link as LinkWithTags), tags };
      created.push(withTags);
      occupied.push({
        x: position.position_x,
        y: position.position_y,
        width: BUBBLE_FOOTPRINT.medium.width,
        height: BUBBLE_FOOTPRINT.medium.height,
      });
      existingCount += 1;
      known.push({
        normalized_url: normalized.normalized,
        url: normalized.normalized,
        archived_at: null,
      });
    } catch {
      failed += 1;
    }
  }

  if (created.length > 0) {
    const allActive = await getLinksForCurrentUser({ includeArchived: false });
    const packed = packRankedPositions(
      allActive.map((link) => ({
        id: link.id,
        visual_seed: link.visual_seed,
        open_count: link.open_count,
        last_opened_at: link.last_opened_at,
        is_favorite: link.is_favorite,
        created_at: link.created_at,
      }))
    );

    const positionById = new Map(
      packed.map((row) => [row.id, row] as const)
    );

    for (const row of packed) {
      await supabase
        .from("links")
        .update({
          position_x: row.position_x,
          position_y: row.position_y,
        })
        .eq("id", row.id)
        .eq("user_id", userId);
    }

    for (let i = 0; i < created.length; i += 1) {
      const link = created[i]!;
      const pos = positionById.get(link.id);
      if (pos) {
        created[i] = {
          ...link,
          position_x: pos.position_x,
          position_y: pos.position_y,
        };
      }
    }

    revalidateApp();
  }

  return {
    success: true,
    data: { created, skippedDuplicates, failed },
  };
}

export async function updateLinkPositionAction(
  linkId: string,
  position_x: number,
  position_y: number
): Promise<ActionResult<{ id: string; position_x: number; position_y: number }>> {
  if (!Number.isFinite(position_x) || !Number.isFinite(position_y)) {
    return { success: false, error: "Invalid position.", code: "VALIDATION" };
  }

  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { error } = await supabase
    .from("links")
    .update({
      position_x: Math.round(position_x * 100) / 100,
      position_y: Math.round(position_y * 100) / 100,
    })
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't save position. Try again.",
      code: "UNKNOWN",
    };
  }

  return {
    success: true,
    data: {
      id: linkId,
      position_x: Math.round(position_x * 100) / 100,
      position_y: Math.round(position_y * 100) / 100,
    },
  };
}

export async function updateLinkAction(
  input: UpdateLinkInput
): Promise<ActionResult<LinkWithTags>> {
  const parsed = updateLinkSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      code: "VALIDATION",
    };
  }

  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.url !== undefined) {
    try {
      const normalized = normalizeUrl(parsed.data.url);
      updates.url = parsed.data.url.includes("://")
        ? parsed.data.url.trim()
        : normalized.normalized;
      updates.normalized_url = normalized.normalized;
      updates.hostname = normalized.hostname;
      updates.favicon_url = normalized.faviconUrl;
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
  }

  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  if (parsed.data.position_x !== undefined) updates.position_x = parsed.data.position_x;
  if (parsed.data.position_y !== undefined) updates.position_y = parsed.data.position_y;
  if (parsed.data.is_favorite !== undefined) updates.is_favorite = parsed.data.is_favorite;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("links")
      .update(updates)
      .eq("id", parsed.data.id)
      .eq("user_id", userId);

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "You already saved this link.",
          code: "DUPLICATE",
        };
      }
      return {
        success: false,
        error: "Couldn't update the link. Try again.",
        code: "UNKNOWN",
      };
    }
  }

  if (parsed.data.tags !== undefined) {
    try {
      const tags = await ensureTags(supabase, userId, parsed.data.tags);
      await syncLinkTags(supabase, parsed.data.id, tags);
    } catch {
      return {
        success: false,
        error: "Couldn't update tags. Try again.",
        code: "UNKNOWN",
      };
    }
  }

  const links = await getLinksForCurrentUser({ includeArchived: true });
  const updated = links.find((link) => link.id === parsed.data.id);

  if (!updated) {
    return { success: false, error: "Link not found.", code: "NOT_FOUND" };
  }

  revalidateApp();
  return { success: true, data: updated };
}

export async function archiveLinkAction(
  linkId: string
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { error } = await supabase
    .from("links")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("user_id", userId)
    .is("archived_at", null);

  if (error) {
    return {
      success: false,
      error: "Couldn't archive the link. Try again.",
      code: "UNKNOWN",
    };
  }

  revalidateApp();
  return { success: true, data: { id: linkId } };
}

export async function restoreLinkAction(
  linkId: string
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { error } = await supabase
    .from("links")
    .update({ archived_at: null })
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't restore the link. Try again.",
      code: "UNKNOWN",
    };
  }

  revalidateApp();
  return { success: true, data: { id: linkId } };
}

export async function toggleFavoriteAction(
  linkId: string,
  isFavorite: boolean
): Promise<ActionResult<{ id: string; is_favorite: boolean }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { error } = await supabase
    .from("links")
    .update({ is_favorite: isFavorite })
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't update favorite. Try again.",
      code: "UNKNOWN",
    };
  }

  revalidateApp();
  return { success: true, data: { id: linkId, is_favorite: isFavorite } };
}

export async function deleteLinkAction(
  linkId: string
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { error } = await supabase
    .from("links")
    .delete()
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't delete the link. Try again.",
      code: "UNKNOWN",
    };
  }

  revalidateApp();
  return { success: true, data: { id: linkId } };
}

export async function recordLinkOpenAction(
  linkId: string
): Promise<ActionResult<{ id: string; open_count: number; last_opened_at: string }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("links")
    .select("open_count")
    .eq("id", linkId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { success: false, error: "Link not found.", code: "NOT_FOUND" };
  }

  const last_opened_at = new Date().toISOString();
  const open_count = (existing.open_count ?? 0) + 1;

  const { error } = await supabase
    .from("links")
    .update({ open_count, last_opened_at })
    .eq("id", linkId)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      error: "Couldn't update open count.",
      code: "UNKNOWN",
    };
  }

  // Client already updates optimistically — skip revalidatePath to avoid
  // Router updates colliding with in-flight React state transitions.
  return { success: true, data: { id: linkId, open_count, last_opened_at } };
}

export async function attachTagsAction(
  linkId: string,
  tagNames: string[]
): Promise<ActionResult<LinkWithTags>> {
  return updateLinkAction({ id: linkId, tags: tagNames });
}

export async function removeTagFromLinkAction(
  linkId: string,
  tagId: string
): Promise<ActionResult<{ linkId: string; tagId: string }>> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { data: link } = await supabase
    .from("links")
    .select("id")
    .eq("id", linkId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!link) {
    return { success: false, error: "Link not found.", code: "NOT_FOUND" };
  }

  const { error } = await supabase
    .from("link_tags")
    .delete()
    .eq("link_id", linkId)
    .eq("tag_id", tagId);

  if (error) {
    return {
      success: false,
      error: "Couldn't remove tag. Try again.",
      code: "UNKNOWN",
    };
  }

  revalidateApp();
  return { success: true, data: { linkId, tagId } };
}

export async function mergeTagsIntoLinkAction(
  linkId: string,
  tagNames: string[]
): Promise<ActionResult<LinkWithTags>> {
  const links = await getLinksForCurrentUser({ includeArchived: true });
  const existing = links.find((link) => link.id === linkId);
  if (!existing) {
    return { success: false, error: "Link not found.", code: "NOT_FOUND" };
  }

  const merged = Array.from(
    new Set([
      ...existing.tags.map((tag) => tag.name),
      ...tagNames.map((name) => name.trim()).filter(Boolean),
    ])
  );

  return updateLinkAction({ id: linkId, tags: merged });
}

export async function resetCanvasPositionsAction(): Promise<
  ActionResult<{ count: number }>
> {
  const { supabase, userId } = await requireUserId();
  if (!userId) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { data: rows, error } = await supabase
    .from("links")
    .select("id, visual_seed, open_count, last_opened_at, is_favorite, created_at")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (error || !rows) {
    return {
      success: false,
      error: "Couldn't reset positions. Try again.",
      code: "UNKNOWN",
    };
  }

  const packed = packRankedPositions(
    rows.map((row) => ({
      id: row.id as string,
      visual_seed: row.visual_seed as number,
      open_count: (row.open_count as number) ?? 0,
      last_opened_at: (row.last_opened_at as string | null) ?? null,
      is_favorite: Boolean(row.is_favorite),
      created_at: row.created_at as string,
    }))
  );

  for (const position of packed) {
    const { error: updateError } = await supabase
      .from("links")
      .update({
        position_x: position.position_x,
        position_y: position.position_y,
      })
      .eq("id", position.id)
      .eq("user_id", userId);

    if (updateError) {
      return {
        success: false,
        error: "Couldn't reset positions. Try again.",
        code: "UNKNOWN",
      };
    }
  }

  revalidateApp();
  return { success: true, data: { count: packed.length } };
}
