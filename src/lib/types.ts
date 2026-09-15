export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
};

export type Link = {
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
};

export type LinkWithTags = Link & {
  tags: Tag[];
};

export type CreateLinkInput = {
  url: string;
  label: string;
  notes?: string | null;
  tags?: string[];
  position_x?: number;
  position_y?: number;
  page_title?: string | null;
  description?: string | null;
  favicon_url?: string | null;
};

export type UpdateLinkInput = {
  id: string;
  url?: string;
  label?: string;
  notes?: string | null;
  tags?: string[];
  position_x?: number;
  position_y?: number;
  is_favorite?: boolean;
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      code?: ActionErrorCode;
      existing?: LinkWithTags;
    };

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "DUPLICATE"
  | "NOT_FOUND"
  | "UNKNOWN";
