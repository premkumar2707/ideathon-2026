import * as fs from "fs";
import * as path from "path";

// Path to local JSON fallback store
const STORE_PATH = path.resolve(process.cwd(), "team-leaders-store.json");

function getStore(): Record<string, string> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to read team-leaders-store.json:", e);
  }
  return {};
}

function saveStore(store: Record<string, string>) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write team-leaders-store.json:", e);
  }
}

// Generate a deterministic default email based on team name
export function getFallbackEmail(teamName: string): string {
  const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 15);
  return `leader.${slug || "team"}@gmail.com`;
}

export async function fetchLeaderEmail(teamId: string, teamName: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    // Try DB query
    const { data, error } = await supabaseAdmin
      .from("teams")
      .select("leader_email" as any)
      .eq("id", teamId)
      .maybeSingle();

    if (!error && data && "leader_email" in data && data.leader_email) {
      return data.leader_email as string;
    }
  } catch (e) {
    // Column likely doesn't exist, proceed to JSON fallback
  }

  // JSON Fallback
  const store = getStore();
  if (store[teamId]) {
    return store[teamId];
  }

  // Default fallback
  return getFallbackEmail(teamName);
}

export async function updateLeaderEmail(teamId: string, email: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let dbSuccess = false;
  try {
    // Try updating DB
    const { error } = await supabaseAdmin
      .from("teams")
      .update({ leader_email: email } as any)
      .eq("id", teamId);
    if (!error) {
      dbSuccess = true;
    }
  } catch (e) {
    // Column likely doesn't exist
  }

  // Always sync to JSON store as fallback
  const store = getStore();
  store[teamId] = email;
  saveStore(store);

  return dbSuccess;
}
