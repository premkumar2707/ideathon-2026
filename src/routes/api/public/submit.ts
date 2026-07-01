import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/submit")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const rawName = form.get("teamName");
          const rawCategory = form.get("category");
          const file = form.get("file");
          const teamName = typeof rawName === "string" ? rawName.trim() : "";
          const category = typeof rawCategory === "string" ? rawCategory.trim() : "";

          if (!teamName || teamName.length < 2 || teamName.length > 80) {
            return json({ error: "Team name must be 2-80 characters." }, 400);
          }
          if (!(file instanceof File)) {
            return json({ error: "PDF file is required." }, 400);
          }
          if (file.size > 15 * 1024 * 1024) {
            return json({ error: "PDF must be 15MB or smaller." }, 400);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Only allow submissions for teams registered by the admin.
          const { data: existing } = await supabaseAdmin
            .from("teams")
            .select("id")
            .eq("name", teamName)
            .maybeSingle();
          if (!existing?.id) {
            return json({ error: "Team not registered. Please contact the admin." }, 400);
          }
          const teamId = existing.id;

          // Upload PDF
          const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
          const path = `${teamId}/${Date.now()}-${safeName}`;
          const buf = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from("submissions")
            .upload(path, buf, { contentType: "application/pdf", upsert: false });
          if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

          // Create submission row
          const { data: sub, error: subErr } = await supabaseAdmin
            .from("submissions")
            .insert({ team_id: teamId, file_name: file.name, pdf_path: path, status: "pending", category })
            .select("id")
            .single();
          if (subErr) throw subErr;

          // Evaluate in the background asynchronously
          const base64 = Buffer.from(buf).toString("base64");
          
          (async () => {
            try {
              // Update status to 'evaluating'
              await supabaseAdmin
                .from("submissions")
                .update({ status: "evaluating" })
                .eq("id", sub.id);

              const { evaluatePdf } = await import("@/lib/evaluation.server");
              const result = await evaluatePdf(base64, file.name, category);
              
              await supabaseAdmin
                .from("submissions")
                .update({ status: "done", score: result.totalScore, result })
                .eq("id", sub.id);
            } catch (evalErr: any) {
              const msg = evalErr?.message || "Evaluation failed";
              console.error("[background-eval]", evalErr);
              await supabaseAdmin
                .from("submissions")
                .update({ status: "failed", error: msg })
                .eq("id", sub.id);
            }
          })();

          return json({ ok: true, submissionId: sub.id, message: "Your submission has been queued and is being evaluated by the panel." });
        } catch (e: any) {
          console.error("[/api/submit]", e);
          return json({ error: e?.message || "Submission failed" }, 500);
        }
      },
    },
  },
});