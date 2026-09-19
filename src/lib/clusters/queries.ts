import { createClient } from "@/lib/supabase/server";
import type { Cluster } from "@/lib/clusters/types";

export async function getClustersForCurrentUser(): Promise<Cluster[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("clusters")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as Cluster[];
}
