import { createClient } from "@/lib/supabase/server";
import type { LinkWithTags, Profile, Tag } from "@/lib/types";

type LinkRow = {
  id: string;
  user_id: string;
  url: string;
  normalized_url: string;
  label: string;
  page_title: string | null;
  hostname: string;
  description: string | null;
  notes: string | null;
  favicon_url: string | null;
  position_x: number;
  position_y: number;
  visual_seed: number;
  open_count: number;
  last_opened_at: string | null;
  is_favorite: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  link_tags?: Array<{ tags: Tag | Tag[] | null }> | null;
};

function mapLinkWithTags(row: LinkRow): LinkWithTags {
  const tags =
    row.link_tags
      ?.flatMap((entry) => {
        if (!entry.tags) return [];
        return Array.isArray(entry.tags) ? entry.tags : [entry.tags];
      })
      .filter(Boolean) ?? [];

  return {
    id: row.id,
    user_id: row.user_id,
    url: row.url,
    normalized_url: row.normalized_url,
    label: row.label,
    page_title: row.page_title,
    hostname: row.hostname,
    description: row.description,
    notes: row.notes,
    favicon_url: row.favicon_url,
    position_x: row.position_x,
    position_y: row.position_y,
    visual_seed: row.visual_seed,
    open_count: row.open_count,
    last_opened_at: row.last_opened_at,
    is_favorite: row.is_favorite,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tags,
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      id: user.id,
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      created_at: user.created_at,
      updated_at: user.updated_at ?? user.created_at,
    };
  }

  return data as Profile;
}

export async function getLinksForCurrentUser(options?: {
  includeArchived?: boolean;
}): Promise<LinkWithTags[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  let query = supabase
    .from("links")
    .select(
      `
      *,
      link_tags (
        tags (*)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return (data as LinkRow[]).map(mapLinkWithTags);
}

export async function getTagsForCurrentUser(): Promise<Tag[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data as Tag[];
}
