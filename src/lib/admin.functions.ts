import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Criteria Config ────────────────────────────────────────────────────────

const CRITERIA_PATH = path.resolve(process.cwd(), "criteria-config.json");
const TOPICS_PATH = path.resolve(process.cwd(), "topics-config.json");

const DEFAULT_CRITERIA = [
  { id: "F1",  name: "Innovation & Creativity",          maxScore: 10, description: "Originality, uniqueness, and creative thinking behind the idea." },
  { id: "F2",  name: "Problem Understanding & Relevance", maxScore: 10, description: "Clarity of problem definition and alignment to the ideathon theme." },
  { id: "F3",  name: "Feasibility & Practicality",        maxScore: 10, description: "Realistic implementation plan within available resources and timeframe." },
  { id: "F4",  name: "Impact & Usefulness",               maxScore: 10, description: "Social, environmental, or economic impact potential of the solution." },
  { id: "F5",  name: "User-Centric Approach",             maxScore: 10, description: "Focus on user needs, accessibility, and inclusivity of the solution." },
  { id: "F6",  name: "Scalability & Future Scope",        maxScore: 10, description: "Ability to expand, sustain, and evolve the solution over time." },
  { id: "F7",  name: "Sustainability & Ethics",           maxScore: 10, description: "Eco-friendly practices and ethical considerations in the solution design." },
  { id: "F8",  name: "Presentation & Communication",      maxScore: 10, description: "Pitch clarity, structure, visual design, and confidence of delivery." },
  { id: "F9",  name: "Teamwork & Collaboration",          maxScore: 10, description: "Coordination, participation, and team dynamics demonstrated." },
  { id: "F10", name: "Business Viability",                maxScore: 10, description: "Market potential, affordability, and real-world applicability of the idea." },
];

function readCriteriaFile() {
  try {
    if (fs.existsSync(CRITERIA_PATH)) {
      return JSON.parse(fs.readFileSync(CRITERIA_PATH, "utf-8"));
    }
  } catch {}
  return { version: 1, criteria: DEFAULT_CRITERIA };
}

export const CriterionSchema = z.object({
  id:          z.string().min(1).max(10),
  name:        z.string().min(2).max(80),
  maxScore:    z.number().int().min(1).max(100),
  description: z.string().max(300),
});

export const getCriteria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const config = readCriteriaFile();
    return { criteria: config.criteria as z.infer<typeof CriterionSchema>[], updatedAt: config.updatedAt as string | undefined };
  });

export const saveCriteria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ criteria: z.array(CriterionSchema).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const config = { version: 1, updatedAt: new Date().toISOString(), criteria: data.criteria };
    fs.writeFileSync(CRITERIA_PATH, JSON.stringify(config, null, 2), "utf-8");
    return { ok: true };
  });

// ─── Topics Config ────────────────────────────────────────────────────────

const DEFAULT_TOPICS = [
  { id: "T1", name: "AI & Machine Learning" },
  { id: "T2", name: "FinTech & Web3" },
  { id: "T3", name: "EdTech & Learning" },
  { id: "T4", name: "Healthcare & MedTech" },
  { id: "T5", name: "Sustainability & GreenTech" },
];

function readTopicsFile() {
  try {
    if (fs.existsSync(TOPICS_PATH)) {
      return JSON.parse(fs.readFileSync(TOPICS_PATH, "utf-8"));
    }
  } catch {}
  return { version: 1, topics: DEFAULT_TOPICS };
}

export const TopicSchema = z.object({
  id: z.string().min(1).max(10),
  name: z.string().min(2).max(100),
});

export const getTopics = createServerFn({ method: "GET" })
  .handler(async () => {
    // Making it public so team portal can load them
    const config = readTopicsFile();
    return { topics: config.topics as z.infer<typeof TopicSchema>[], updatedAt: config.updatedAt as string | undefined };
  });

export const saveTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ topics: z.array(TopicSchema).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const config = { version: 1, updatedAt: new Date().toISOString(), topics: data.topics };
    fs.writeFileSync(TOPICS_PATH, JSON.stringify(config, null, 2), "utf-8");
    return { ok: true };
  });

export const buildFeedbackEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchLeaderEmail } = await import("@/lib/team-leader-email-helper.server");

    const { data: team } = await supabaseAdmin.from("teams").select("id, name").eq("id", data.teamId).maybeSingle();
    if (!team) throw new Error("Team not found");

    const { data: subs } = await supabaseAdmin
      .from("submissions")
      .select("score, result, file_name, created_at")
      .eq("team_id", data.teamId)
      .eq("status", "done")
      .order("score", { ascending: false })
      .limit(1);

    const email = await fetchLeaderEmail(team.id, team.name);
    const best = subs?.[0];

    if (!best?.result) {
      return {
        to: email,
        subject: `Ideathon 2026 — Feedback for ${team.name}`,
        body: `Dear ${team.name} Team Leader,\n\nThank you for submitting to Ideathon 2026. Your submission is still being evaluated or no results are available yet. We will follow up soon.\n\nBest regards,\nIdeathon 2026 Admin`,
      };
    }

    const r: any = best.result;
    const criteria: any[] = r.criteria || [];
    const weakCriteria = criteria.filter((c: any) => (c.score ?? 0) < 7).sort((a: any, b: any) => a.score - b.score);

    let criteriaLines = "";
    for (const c of criteria) {
      const bar = c.score >= 8 ? "✅" : c.score >= 5 ? "⚠️" : "❌";
      criteriaLines += `  ${bar} ${c.id}. ${c.name}: ${c.score}/${c.maxScore ?? 10}\n`;
      if (c.weaknesses) criteriaLines += `      Issues: ${c.weaknesses}\n`;
    }

    let improvementLines = "";
    for (const c of weakCriteria.slice(0, 5)) {
      improvementLines += `• ${c.name} (scored ${c.score}/10):\n`;
      if (c.weaknesses) improvementLines += `  Problem: ${c.weaknesses}\n`;
      if (c.deductions) improvementLines += `  Deductions: ${c.deductions}\n`;
      improvementLines += "\n";
    }

    const suggestions = (r.suggestions || []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n");
    const weaknesses  = (r.weaknesses  || []).map((s: string) => `• ${s}`).join("\n");

    const body = [
      `Dear ${team.name} Team Leader,`,
      ``,
      `Thank you for participating in Ideathon 2026. Below is a detailed evaluation report for your submission "${best.file_name}".`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `OVERALL SCORE: ${best.score}/100`,
      `Rating: ${r.overallRating || ""}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `CRITERIA BREAKDOWN`,
      criteriaLines,
      weaknesses ? `AREAS THAT NEED IMPROVEMENT\n${weaknesses}` : "",
      ``,
      improvementLines ? `HOW TO IMPROVE\n${improvementLines}` : "",
      suggestions ? `SUGGESTIONS FROM EVALUATORS\n${suggestions}` : "",
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `We encourage you to review these points and apply them in future innovations.`,
      ``,
      `Best regards,`,
      `Ideathon 2026 Admin Team`,
    ].filter((l) => l !== undefined).join("\n");

    return {
      to: email,
      subject: `Ideathon 2026 — Evaluation Feedback for ${team.name} (Score: ${best.score}/100)`,
      body,
    };
  });

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchLeaderEmail } = await import("@/lib/team-leader-email-helper.server");
    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const { data: subs, error: sErr } = await supabaseAdmin
      .from("submissions")
      .select("id, team_id, file_name, pdf_path, status, score, result, error, created_at, category")
      .order("created_at", { ascending: false });
    if (sErr) throw sErr;
    
    return Promise.all(
      (teams || []).map(async (t) => {
        const email = await fetchLeaderEmail(t.id, t.name);
        const teamSubs = (subs || []).filter((s) => s.team_id === t.id);
        const latest = teamSubs[0] || null;
        const best = teamSubs.reduce<number | null>(
          (acc, s) => (s.score != null && (acc == null || s.score > acc) ? s.score : acc),
          null,
        );
        return { ...t, leader_email: email, submissions: teamSubs, latest, bestScore: best };
      })
    );
  });

export const listPublicTeams = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchLeaderEmail } = await import("@/lib/team-leader-email-helper.server");
    const { data: teams, error } = await supabaseAdmin
      .from("teams")
      .select("id, name")
      .order("name");
    if (error) throw error;
    
    return Promise.all(
      (teams || []).map(async (t) => {
        const email = await fetchLeaderEmail(t.id, t.name);
        const [local, domain] = email.split("@");
        let maskedLocal = local;
        if (local.length > 3) {
          maskedLocal = local.slice(0, 2) + "*".repeat(local.length - 4) + local.slice(-2);
        } else {
          maskedLocal = local[0] + "*".repeat(local.length - 1);
        }
        const maskedEmail = `${maskedLocal}@${domain}`;
        return { id: t.id, name: t.name, emailHint: maskedEmail };
      })
    );
  });

export const addTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { updateLeaderEmail } = await import("@/lib/team-leader-email-helper.server");
    const { data: row, error } = await supabaseAdmin
      .from("teams")
      .insert({ name: data.name })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);
    if (data.email) {
      await updateLeaderEmail(row.id, data.email);
    }
    return row;
  });

export const updateTeamLeaderEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), email: z.string().trim().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { updateLeaderEmail } = await import("@/lib/team-leader-email-helper.server");
    await updateLeaderEmail(data.id, data.email);
    return { ok: true };
  });

export const verifyTeamLeaderEmail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ teamId: z.string().uuid(), email: z.string().trim().email() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { fetchLeaderEmail } = await import("@/lib/team-leader-email-helper.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("name")
      .eq("id", data.teamId)
      .maybeSingle();
    if (!team) return { verified: false, error: "Team not found" };
    
    const correctEmail = await fetchLeaderEmail(data.teamId, team.name);
    const isCorrect = correctEmail.toLowerCase() === data.email.toLowerCase();
    return { verified: isCorrect };
  });

export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Also delete storage files
    const { data: subs } = await supabaseAdmin
      .from("submissions")
      .select("pdf_path")
      .eq("team_id", data.id);
    if (subs && subs.length) {
      await supabaseAdmin.storage.from("submissions").remove(subs.map((s) => s.pdf_path));
    }
    const { error } = await supabaseAdmin.from("teams").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("submissions")
      .select("pdf_path")
      .eq("id", data.id)
      .maybeSingle();
    if (sub?.pdf_path) {
      await supabaseAdmin.storage.from("submissions").remove([sub.pdf_path]);
    }
    const { error } = await supabaseAdmin.from("submissions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const renameTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("teams")
      .update({ name: data.name })
      .eq("id", data.id)
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });