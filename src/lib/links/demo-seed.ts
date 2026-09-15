"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { occupiedFromLinks } from "@/lib/helpers";
import type { ActionResult } from "@/lib/types";
import { APP_ROUTES } from "@/config/app";
import { BUBBLE_FOOTPRINT, placeNewLink, toOccupiedBox } from "@/lib/cloud/layout";

const DEMO_LINKS: Array<{
  url: string;
  label: string;
  tags: string[];
  notes?: string;
  favorite?: boolean;
  opens?: number;
}> = [
  { url: "https://github.com", label: "GitHub", tags: ["Engineering", "Code"], favorite: true, opens: 42 },
  { url: "https://linear.app", label: "Linear", tags: ["Product", "Issues"], opens: 28 },
  { url: "https://figma.com", label: "Figma", tags: ["Design"], favorite: true, opens: 35 },
  { url: "https://notion.so", label: "Notion HQ", tags: ["Docs", "Wiki"], opens: 19 },
  { url: "https://vercel.com/dashboard", label: "Vercel Dashboard", tags: ["Deploy", "Production"], opens: 22 },
  { url: "https://supabase.com/dashboard", label: "Supabase", tags: ["Database"], opens: 17 },
  { url: "https://analytics.google.com", label: "GA4 Property", tags: ["ABC", "Analytics", "September"], opens: 14 },
  { url: "https://metabase.example.com", label: "Metabase", tags: ["Analytics", "BI"], opens: 11 },
  { url: "https://docs.google.com/document/d/demo", label: "Q3 Planning Doc", tags: ["Docs", "ABC"], opens: 9 },
  { url: "https://docs.google.com/spreadsheets/d/demo", label: "Usage Spreadsheet", tags: ["ABC", "September", "Finance"], favorite: true, opens: 31 },
  { url: "https://app.slack.com", label: "Slack", tags: ["Comms"], opens: 40 },
  { url: "https://mail.google.com", label: "Gmail", tags: ["Inbox"], opens: 50 },
  { url: "https://calendar.google.com", label: "Calendar", tags: ["Schedule"], opens: 33 },
  { url: "https://staging.example.com", label: "Staging App", tags: ["Staging", "Engineering"], opens: 16 },
  { url: "https://admin.example.com", label: "Admin Portal", tags: ["Internal", "Production"], opens: 12 },
  { url: "https://status.example.com", label: "Status Page", tags: ["Ops"], opens: 7 },
  { url: "https://datadoghq.com", label: "Datadog", tags: ["Observability"], opens: 13 },
  { url: "https://sentry.io", label: "Sentry", tags: ["Errors", "Engineering"], opens: 15 },
  { url: "https://stripe.com/dashboard", label: "Stripe", tags: ["Billing", "Finance"], opens: 10 },
  { url: "https://hubspot.com", label: "HubSpot", tags: ["CRM", "Sales"], opens: 8 },
  { url: "https://mixpanel.com", label: "Mixpanel", tags: ["Analytics", "Product"], opens: 6 },
  { url: "https://amplitude.com", label: "Amplitude", tags: ["Analytics"], opens: 5 },
  { url: "https://miro.com", label: "Miro Board", tags: ["Design", "Workshop"], opens: 4 },
  { url: "https://loom.com", label: "Loom", tags: ["Video"], opens: 3 },
  { url: "https://chatgpt.com", label: "ChatGPT", tags: ["AI", "Tools"], opens: 21 },
  { url: "https://claude.ai", label: "Claude", tags: ["AI", "Tools"], opens: 18 },
  { url: "https://customer-portal.example.com", label: "Customer Portal", tags: ["Support", "ABC"], opens: 9 },
  { url: "https://wiki.example.com/runbooks", label: "Runbooks", tags: ["Ops", "Internal"], opens: 7 },
  { url: "https://figma.com/file/demo-usage", label: "ABC Usage Mock", tags: ["ABC", "Design", "September"], favorite: true, opens: 12 },
  { url: "https://looker.example.com/dashboards/usage", label: "September Usage", tags: ["ABC", "September", "Analytics"], favorite: true, opens: 26 },
];

export async function seedDemoLinksAction(): Promise<
  ActionResult<{ count: number }>
> {
  if (process.env.NODE_ENV !== "development") {
    return {
      success: false,
      error: "Demo seeding is only available in development.",
      code: "UNAUTHORIZED",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please sign in to continue.", code: "UNAUTHORIZED" };
  }

  const { data: existing } = await supabase
    .from("links")
    .select("position_x, position_y, normalized_url")
    .eq("user_id", user.id)
    .is("archived_at", null);

  const occupied = occupiedFromLinks(existing ?? []);
  const existingUrls = new Set(
    (existing ?? []).map((row) => row.normalized_url as string)
  );

  let created = 0;
  let index = existing?.length ?? 0;

  for (const demo of DEMO_LINKS) {
    const normalized = demo.url.toLowerCase();
    if (existingUrls.has(normalized)) continue;

    const seed = (index + 1) * 7919;
    const point = placeNewLink({
      visualSeed: seed,
      existingCount: index,
      occupied,
      size: BUBBLE_FOOTPRINT.medium,
    });

    const { data: link, error } = await supabase
      .from("links")
      .insert({
        user_id: user.id,
        url: demo.url,
        normalized_url: normalized,
        label: demo.label,
        hostname: new URL(demo.url).hostname,
        notes: demo.notes ?? null,
        favicon_url: null,
        position_x: point.x,
        position_y: point.y,
        visual_seed: seed,
        is_favorite: Boolean(demo.favorite),
        open_count: demo.opens ?? 0,
        last_opened_at:
          (demo.opens ?? 0) > 0
            ? new Date(Date.now() - index * 36e5).toISOString()
            : null,
      })
      .select("id")
      .single();

    if (error || !link) continue;

    occupied.push(toOccupiedBox(point));
    index += 1;
    created += 1;

    for (const tagName of demo.tags) {
      const normalizedName = tagName.trim().toLowerCase();
      let tagId: string | null = null;

      const { data: existingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", user.id)
        .eq("normalized_name", normalizedName)
        .maybeSingle();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: createdTag } = await supabase
          .from("tags")
          .insert({
            user_id: user.id,
            name: tagName,
            normalized_name: normalizedName,
          })
          .select("id")
          .single();
        tagId = createdTag?.id ?? null;
      }

      if (tagId) {
        await supabase.from("link_tags").insert({
          link_id: link.id,
          tag_id: tagId,
        });
      }
    }
  }

  revalidatePath(APP_ROUTES.app);
  revalidatePath(APP_ROUTES.settings);

  return { success: true, data: { count: created } };
}
