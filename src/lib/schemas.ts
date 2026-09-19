import { z } from "zod";

const httpUrlRefine = (value: string) => {
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const rawUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  .refine(httpUrlRefine, "That doesn't look like a valid URL.");

export const linkLabelSchema = z
  .string()
  .trim()
  .min(1, "Label is required")
  .max(200, "Label is too long");

export const linkNotesSchema = z
  .string()
  .trim()
  .max(5000, "Notes are too long")
  .optional()
  .nullable();

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Tag cannot be empty")
  .max(64, "Tag is too long")
  .regex(/^[^,]+$/, "Tag cannot contain commas");

export const createLinkSchema = z.object({
  url: rawUrlSchema,
  label: linkLabelSchema,
  notes: linkNotesSchema,
  tags: z.array(tagNameSchema).max(20).default([]),
  position_x: z.number().finite().optional(),
  position_y: z.number().finite().optional(),
  page_title: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  favicon_url: z.string().trim().max(2048).optional().nullable(),
  accent_color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid accent color")
    .optional()
    .nullable(),
});

/** Form-facing schema without defaults (cleaner RHF typing). */
export const createLinkFormSchema = z.object({
  url: rawUrlSchema,
  label: linkLabelSchema,
  notes: linkNotesSchema,
  tags: z.array(tagNameSchema).max(20).optional(),
  position_x: z.number().finite().optional(),
  position_y: z.number().finite().optional(),
});

export const updateLinkSchema = z.object({
  id: z.string().uuid(),
  url: rawUrlSchema.optional(),
  label: linkLabelSchema.optional(),
  notes: linkNotesSchema,
  tags: z.array(tagNameSchema).max(20).optional(),
  position_x: z.number().finite().optional(),
  position_y: z.number().finite().optional(),
  is_favorite: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(120, "Name is too long")
    .optional()
    .nullable(),
});

export type CreateLinkFormValues = z.infer<typeof createLinkFormSchema>;
export type UpdateLinkFormValues = z.infer<typeof updateLinkSchema>;
export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
