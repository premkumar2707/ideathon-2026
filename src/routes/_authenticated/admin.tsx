import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ChromeScene from "@/components/ChromeScene";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  listTeams,
  addTeam,
  deleteTeam,
  getPdfUrl,
  deleteSubmission,
  renameTeam,
  updateTeamLeaderEmail,
  getCriteria,
  saveCriteria,
  getTopics,
  saveTopics,
  buildFeedbackEmail,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Ideathon 2026" },
      { name: "description", content: "Manage Ideathon 2026 teams and review submission evaluations." },
    ],
  }),
  component: AdminDashboard,
});

type TeamRow   = Awaited<ReturnType<typeof listTeams>>[number];
type Submission = TeamRow["submissions"][number];
type Criterion = { id: string; name: string; maxScore: number; description: string };
type Topic = { id: string; name: string };

// ─── helpers ─────────────────────────────────────────────────────────────────

function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "team"; }

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCSV(filename: string, teams: TeamRow[]) {
  const rows: string[] = [
    ["Team","Email","Best Score","Submissions","Evaluated","Overall Rating","Strengths","Weaknesses","Suggestions"].join(","),
  ];
  for (const t of teams) {
    const best = t.submissions.find((s) => s.score === t.bestScore);
    const r: any = best?.result || {};
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    rows.push([
      esc(t.name),
      esc(t.leader_email),
      t.bestScore ?? "",
      t.submissions.length,
      t.submissions.filter((s) => s.status === "done").length,
      esc(r.overallRating),
      esc((r.strengths  || []).join("; ")),
      esc((r.weaknesses || []).join("; ")),
      esc((r.suggestions || []).join("; ")),
    ].join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openPrintReport(teams: TeamRow[], single?: TeamRow) {
  const target = single ? [single] : teams.filter((t) => t.bestScore != null);
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  const teamHtml = target.map((t) => {
    const best = t.submissions.find((s) => s.score === t.bestScore);
    const r: any = best?.result || {};
    const pct = Math.min(100, t.bestScore ?? 0);
    const criteriaRows = (r.criteria || []).map((c: any) => {
      const max = c.maxScore ?? 10;
      const pct = Math.round((c.score / max) * 100);
      const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
      return `
        <tr>
          <td style="padding:6px 8px;font-weight:600;white-space:nowrap;color:#1e293b">${c.id}</td>
          <td style="padding:6px 8px;color:#334155">${c.name}</td>
          <td style="padding:6px 8px;width:120px">
            <div style="background:#e2e8f0;border-radius:4px;height:8px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div>
            </div>
          </td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;color:${color}">${c.score}/${max}</td>
        </tr>
        ${c.weaknesses ? `<tr><td></td><td colspan="3" style="padding:2px 8px 8px;font-size:12px;color:#64748b"><b>Issues:</b> ${c.weaknesses}</td></tr>` : ""}
      `;
    }).join("");

    const strList = (r.strengths   || []).map((s: string) => `<li>${s}</li>`).join("");
    const wkList  = (r.weaknesses  || []).map((s: string) => `<li>${s}</li>`).join("");
    const sgList  = (r.suggestions || []).map((s: string) => `<li>${s}</li>`).join("");

    return `
      <div style="page-break-inside:avoid;margin-bottom:40px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:4px">Team</div>
            <div style="font-size:22px;font-weight:700;color:#f8fafc">${t.name}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px">📧 ${t.leader_email || "—"}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:40px;font-weight:900;color:#fbbf24;line-height:1">${t.bestScore ?? "—"}</div>
            <div style="font-size:12px;color:#94a3b8">/100 · ${r.overallRating || ""}</div>
          </div>
        </div>
        <div style="padding:4px 24px 0;background:#f8fafc">
          <div style="background:#e2e8f0;border-radius:4px;height:10px;overflow:hidden;margin:12px 0 16px">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f59e0b,#fbbf24);border-radius:4px"></div>
          </div>
        </div>
        ${r.executiveSummary ? `<div style="padding:0 24px 16px;font-size:13px;color:#475569;background:#f8fafc;border-bottom:1px solid #e2e8f0"><b>Summary:</b> ${r.executiveSummary}</div>` : ""}
        <div style="padding:16px 24px;background:#fff">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:8px">Criteria Breakdown</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            ${criteriaRows}
          </table>
        </div>
        ${(strList || wkList || sgList) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid #e2e8f0">
          ${strList ? `<div style="padding:16px;border-right:1px solid #e2e8f0"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#10b981;margin-bottom:8px">✅ Strengths</div><ul style="margin:0;padding-left:16px;font-size:12px;color:#374151">${strList}</ul></div>` : "<div></div>"}
          ${wkList  ? `<div style="padding:16px;border-right:1px solid #e2e8f0;background:#fff1f2"><div style="font-size:12px;font-weight:900;text-transform:uppercase;color:#e11d48;margin-bottom:8px">⚠️ Areas for Improvement (Weaknesses)</div><ul style="margin:0;padding-left:16px;font-size:12px;color:#881337;font-weight:500;">${wkList}</ul></div>` : "<div></div>"}
          ${sgList  ? `<div style="padding:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#3b82f6;margin-bottom:8px">💡 Suggestions</div><ul style="margin:0;padding-left:16px;font-size:12px;color:#374151">${sgList}</ul></div>` : "<div></div>"}
        </div>` : ""}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ideathon 2026 Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; margin: 0; padding: 32px; background: #f1f5f9; color: #1e293b; }
    @media print {
      body { padding: 16px; background: white; }
      .no-print { display: none; }
    }
  </style></head><body>
  <div style="max-width:900px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1e293b">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#64748b">Official Report</div>
        <h1 style="margin:4px 0 0;font-size:28px;font-weight:900;color:#0f172a">Ideathon 2026</h1>
        <div style="font-size:13px;color:#64748b;margin-top:2px">${single ? `Team: ${single.name}` : `All Teams — ${target.length} scored`}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#64748b">Generated on</div>
        <div style="font-size:14px;font-weight:600">${date}</div>
      </div>
    </div>
    ${single ? "" : `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:32px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:12px">Leaderboard Summary</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="border-bottom:2px solid #e2e8f0">
          <th style="padding:6px 8px;text-align:left">#</th>
          <th style="padding:6px 8px;text-align:left">Team</th>
          <th style="padding:6px 8px;text-align:left">Leader Email</th>
          <th style="padding:6px 8px;text-align:right">Best Score</th>
        </tr></thead>
        <tbody>${target.map((t, i) => `<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:6px 8px;color:#94a3b8">${i + 1}</td>
          <td style="padding:6px 8px;font-weight:600">${t.name}</td>
          <td style="padding:6px 8px;color:#64748b">${t.leader_email || "—"}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:700;color:#f59e0b">${t.bestScore ?? "—"}/100</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>`}
    ${teamHtml}
    <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0">
      Ideathon 2026 — Confidential Evaluation Report — Generated ${date}
    </div>
  </div>
  <div class="no-print" style="position:fixed;bottom:24px;right:24px">
    <button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3)">🖨️ Print / Save as PDF</button>
  </div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const navigate          = useNavigate();
  const listFn            = useServerFn(listTeams);
  const addFn             = useServerFn(addTeam);
  const delTeamFn         = useServerFn(deleteTeam);
  const delSubFn          = useServerFn(deleteSubmission);
  const renameFn          = useServerFn(renameTeam);
  const updateEmailFn     = useServerFn(updateTeamLeaderEmail);
  const getCriteriaFn     = useServerFn(getCriteria);
  const saveCriteriaFn    = useServerFn(saveCriteria);
  const getTopicsFn       = useServerFn(getTopics);
  const saveTopicsFn      = useServerFn(saveTopics);
  const buildFeedbackFn   = useServerFn(buildFeedbackEmail);

  // ── Queries ──
  const teamsQ = useQuery({
    queryKey: ["admin", "teams"],
    queryFn: () => listFn(),
    refetchInterval: (query) => {
      const data = query.state.data as TeamRow[] | undefined;
      const hasActive = data?.some((t) => t.submissions?.some((s) => s.status === "pending" || s.status === "evaluating"));
      return hasActive ? 2000 : 10000;
    },
  });

  const criteriaQ = useQuery({
    queryKey: ["admin", "criteria"],
    queryFn: () => getCriteriaFn(),
  });

  // ── State ──
  const [newTeam,        setNewTeam]        = useState("");
  const [newTeamEmail,   setNewTeamEmail]   = useState("");
  const [openTeam,       setOpenTeam]       = useState<string | null>(null);
  const [selectedSub,    setSelectedSub]    = useState<Submission | null>(null);
  const [editingTeam,    setEditingTeam]    = useState<string | null>(null);
  const [editName,       setEditName]       = useState("");
  const [editEmail,      setEditEmail]      = useState("");
  const [saveState,      setSaveState]      = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [confirmDelete,  setConfirmDelete]  = useState<TeamRow | null>(null);
  const [activeTab,      setActiveTab]      = useState<"teams"|"criteria"|"topics">("teams");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Criteria editor state
  const [localCriteria,  setLocalCriteria]  = useState<Criterion[]>([]);
  const [critSaveState,  setCritSaveState]  = useState<"idle"|"saving"|"saved"|"error">("idle");

  // Topics editor state
  const [localTopics,    setLocalTopics]    = useState<Topic[]>([]);
  const [topicSaveState, setTopicSaveState] = useState<"idle"|"saving"|"saved"|"error">("idle");

  // Feedback modal
  const [feedbackModal,  setFeedbackModal]  = useState<{to:string;subject:string;body:string} | null>(null);
  const [feedbackLoading,setFeedbackLoading]= useState<string|null>(null);

  // Sync local criteria when server data loads
  useEffect(() => {
    if (criteriaQ.data?.criteria && localCriteria.length === 0) {
      setLocalCriteria(criteriaQ.data.criteria);
    }
  }, [criteriaQ.data]);

  const topicsQ = useQuery({
    queryKey: ["admin", "topics"],
    queryFn: () => getTopicsFn(),
  });

  useEffect(() => {
    if (topicsQ.data?.topics && localTopics.length === 0) {
      setLocalTopics(topicsQ.data.topics);
    }
  }, [topicsQ.data]);

  // ── Mutations ──
  const addMut = useMutation({
    mutationFn: (v: { name: string; email?: string }) => addFn({ data: v }),
    onSuccess: () => { setNewTeam(""); setNewTeamEmail(""); teamsQ.refetch(); },
  });
  const delTeamMut = useMutation({
    mutationFn: (id: string) => delTeamFn({ data: { id } }),
    onSuccess: () => teamsQ.refetch(),
  });
  const delSubMut = useMutation({
    mutationFn: (id: string) => delSubFn({ data: { id } }),
    onSuccess: () => { setSelectedSub(null); teamsQ.refetch(); },
  });
  const saveCriteriaMut = useMutation({
    mutationFn: (criteria: Criterion[]) => saveCriteriaFn({ data: { criteria } }),
    onSuccess: () => { setCritSaveState("saved"); criteriaQ.refetch(); setTimeout(() => setCritSaveState("idle"), 2000); },
    onError: () => setCritSaveState("error"),
  });
  const saveTopicsMut = useMutation({
    mutationFn: (topics: Topic[]) => saveTopicsFn({ data: { topics } }),
    onSuccess: () => { setTopicSaveState("saved"); topicsQ.refetch(); setTimeout(() => setTopicSaveState("idle"), 2000); },
    onError: () => setTopicSaveState("error"),
  });

  // ── Autosave team name ──
  useEffect(() => {
    if (!editingTeam) return;
    const team = (teamsQ.data || []).find((x) => x.id === editingTeam);
    if (!team) return;
    const next = editName.trim();
    if (!next || next === team.name || next.length < 2) { setSaveState("idle"); return; }
    setSaveState("saving");
    const handle = setTimeout(async () => {
      try { await renameFn({ data: { id: team.id, name: next } }); setSaveState("saved"); teamsQ.refetch(); setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 1200); }
      catch { setSaveState("error"); }
    }, 600);
    return () => clearTimeout(handle);
  }, [editName, editingTeam]);

  // ── Autosave email ──
  useEffect(() => {
    if (!editingTeam) return;
    const team = (teamsQ.data || []).find((x) => x.id === editingTeam);
    if (!team) return;
    const next = editEmail.trim();
    if (!next || next === team.leader_email || !next.includes("@")) { setSaveState("idle"); return; }
    setSaveState("saving");
    const handle = setTimeout(async () => {
      try { await updateEmailFn({ data: { id: team.id, email: next } }); setSaveState("saved"); teamsQ.refetch(); setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 1200); }
      catch { setSaveState("error"); }
    }, 600);
    return () => clearTimeout(handle);
  }, [editEmail, editingTeam]);

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); };

  const teams = teamsQ.data || [];
  
  // Filter teams by category (using the category of their latest submission)
  const filteredTeams = categoryFilter === "All" 
    ? teams 
    : teams.filter((t) => t.latest?.category === categoryFilter || t.submissions.some((s) => s.category === categoryFilter));

  const leaderboard = [...filteredTeams].filter((t) => t.bestScore != null).sort((a, b) => (b.bestScore ?? 0) - (a.bestScore ?? 0));

  const exportAll  = () => downloadJson(`ideathon-2026-all-${new Date().toISOString().slice(0,10)}.json`, { exportedAt: new Date().toISOString(), teams });
  const exportTeam = (t: TeamRow) => downloadJson(`team-${slug(t.name)}.json`, { exportedAt: new Date().toISOString(), team: t });
  const exportSubmission = (t: TeamRow, s: Submission) => downloadJson(`team-${slug(t.name)}-${s.id.slice(0,8)}.json`, { exportedAt: new Date().toISOString(), team: { id: t.id, name: t.name }, submission: s });

  const handleSendFeedback = async (teamId: string) => {
    setFeedbackLoading(teamId);
    try {
      const result = await buildFeedbackFn({ data: { teamId } });
      setFeedbackModal(result);
    } catch (e: any) {
      alert("Failed to build feedback: " + (e?.message || "unknown error"));
    } finally {
      setFeedbackLoading(null);
    }
  };

  const updateCriterion = (i: number, field: keyof Criterion, value: string | number) => {
    setLocalCriteria((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  };

  const addCriterion = () => {
    const next = localCriteria.length + 1;
    setLocalCriteria((prev) => [...prev, { id: `F${next}`, name: "New Criterion", maxScore: 10, description: "" }]);
  };

  const removeCriterion = (i: number) => {
    setLocalCriteria((prev) => prev.filter((_, idx) => idx !== i));
  };

  const resetCriteria = () => {
    if (criteriaQ.data?.criteria) setLocalCriteria(criteriaQ.data.criteria);
  };

  const updateTopic = (i: number, field: keyof Topic, value: string) => {
    setLocalTopics((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  };

  const addTopic = () => {
    const next = localTopics.length + 1;
    setLocalTopics((prev) => [...prev, { id: `T${next}`, name: "New Topic" }]);
  };

  const removeTopic = (i: number) => {
    setLocalTopics((prev) => prev.filter((_, idx) => idx !== i));
  };

  const resetTopics = () => {
    if (topicsQ.data?.topics) setLocalTopics(topicsQ.data.topics);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08070f] text-slate-100">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute -top-40 left-1/3 h-[460px] w-[460px] rounded-full bg-[#a78bfa]/15 blur-[120px]" />
        <div className="absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-[#67e8f9]/12 blur-[120px]" />
      </div>
      <ChromeScene intensity="ambient" className="pointer-events-none absolute right-[-15%] top-[-8%] -z-10 h-[60vh] w-[60vw] opacity-50" />

      {/* Header */}
      <header className="relative border-b border-white/5 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-5 sm:flex sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/30 bg-amber-300/10 font-serif text-lg text-amber-300" aria-hidden="true">I</span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80">Ideathon 2026</p>
              <h1 className="mt-0.5 truncate font-serif text-xl sm:text-2xl">Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            <ThemeToggle />
            {/* Download report buttons */}
            <button
              onClick={() => openPrintReport(teams)}
              disabled={!leaderboard.length}
              className="rounded-md border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-40"
            >
              📄 PDF Report
            </button>
            <button
              onClick={() => downloadCSV(`ideathon-2026-${new Date().toISOString().slice(0,10)}.csv`, teams)}
              disabled={!leaderboard.length}
              className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-40"
            >
              📊 CSV Export
            </button>
            <button
              onClick={exportAll}
              disabled={!teams.length}
              className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-40"
            >
              JSON
            </button>
            <button
              onClick={signOut}
              className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Teams",       v: teams.length },
            { l: "Submissions", v: teams.reduce((a, t) => a + t.submissions.length, 0) },
            { l: "Evaluated",   v: teams.reduce((a, t) => a + t.submissions.filter((s) => s.status === "done").length, 0) },
            { l: "Top score",   v: leaderboard[0]?.bestScore ?? "—" },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{s.l}</div>
              <div className="mt-1 font-serif text-3xl text-amber-300">{s.v}</div>
            </div>
          ))}
        </section>

        {teamsQ.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {teamsQ.error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {(teamsQ.error as Error).message}
          </div>
        )}

        {/* Leaderboard */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-serif text-2xl">Leaderboard</h2>
              <span className="text-xs text-slate-500">{leaderboard.length} scored</span>
            </div>
            
            {/* Category Filter */}
            {localTopics.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-300/60"
              >
                <option value="All">All Categories</option>
                {localTopics.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Score bar</th>
                  <th className="px-4 py-3 text-right">Best Score</th>
                  <th className="px-4 py-3 text-right">Submissions</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No scored submissions yet.</td></tr>
                )}
                {leaderboard.map((t, i) => {
                  const medal = ["🥇", "🥈", "🥉"][i];
                  const pct = Math.max(0, Math.min(100, t.bestScore ?? 0));
                  return (
                    <tr key={t.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-400">
                        {medal ? <span className="text-lg" aria-label={`Rank ${i + 1}`}>{medal}</span> : i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">{t.name}</td>
                      <td className="px-4 py-3 text-xs text-amber-300/80">
                        {t.latest?.category ? (
                          <span className="inline-flex items-center rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1">
                            {t.latest.category}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} score`} className="h-2.5 w-full min-w-[120px] overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-300">{t.bestScore}<span className="text-slate-500">/100</span></td>
                      <td className="px-4 py-3 text-right text-slate-400">{t.submissions.length}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openPrintReport(teams, t)}
                            aria-label={`Download report for ${t.name}`}
                            className="rounded border border-violet-400/30 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-400/15"
                          >📄 Report</button>
                          <button
                            onClick={() => handleSendFeedback(t.id)}
                            disabled={feedbackLoading === t.id || !t.submissions.some(s => s.status === "done")}
                            aria-label={`Send feedback to ${t.name}`}
                            className="rounded border border-sky-400/30 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-400/15 disabled:opacity-40"
                          >{feedbackLoading === t.id ? "…" : "📧 Feedback"}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tab nav */}
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1 w-fit">
          {(["teams", "topics", "criteria"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-amber-300 text-black" : "text-slate-400 hover:text-slate-200"}`}
            >
              {tab === "criteria" ? "⚙️ Evaluation Criteria" : tab === "topics" ? "🏷️ Topics" : "👥 Teams"}
            </button>
          ))}
        </div>

        {/* ─── TEAMS TAB ─────────────────────────────────────────────── */}
        {activeTab === "teams" && (
          <section>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="font-serif text-xl">Teams</h2>
                <span className="text-xs text-slate-500">{filteredTeams.length} total</span>
              </div>
              {/* Reuse category filter here if needed, or just let the global one apply */}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (newTeam.trim() && newTeamEmail.trim()) addMut.mutate({ name: newTeam.trim(), email: newTeamEmail.trim() }); }}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <div className="flex-1 flex flex-col gap-3 sm:flex-row">
                <input id="new-team" required value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Team Name (e.g. Team Ninja)"
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-300/60 focus-visible:ring-2 focus-visible:ring-amber-300/40" />
                <input id="new-team-email" type="email" required value={newTeamEmail} onChange={(e) => setNewTeamEmail(e.target.value)} placeholder="Leader Email"
                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-300/60 focus-visible:ring-2 focus-visible:ring-amber-300/40" />
              </div>
              <button type="submit" disabled={!newTeam.trim() || !newTeamEmail.trim() || addMut.isPending}
                className="rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100 disabled:opacity-60">
                {addMut.isPending ? "Adding…" : "Add team"}
              </button>
            </form>
            {addMut.error && <p className="mt-2 text-xs text-rose-300">{(addMut.error as Error).message}</p>}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.length === 0 && !teamsQ.isLoading && (
                <p className="col-span-full text-sm text-slate-500">No teams found for this category.</p>
              )}
              {filteredTeams.map((t) => {
                const open = openTeam === t.id;
                const isEditing = editingTeam === t.id;
                const evaluated = t.submissions.filter((s) => s.status === "done").length;
                const pct = Math.max(0, Math.min(100, t.bestScore ?? 0));
                const hasDone = t.submissions.some((s) => s.status === "done");
                return (
                  <div key={t.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] transition hover:border-amber-300/30 hover:shadow-[0_10px_40px_-10px_rgba(251,191,36,0.2)]">
                    <div className="absolute right-3 top-3 flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${t.submissions.length ? "bg-emerald-400" : "bg-slate-500"}`} aria-hidden="true" />
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{t.submissions.length ? "Active" : "Idle"}</span>
                    </div>

                    <div className="p-5 pb-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-0.5">Team Name</label>
                            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} aria-label={`Rename ${t.name}`}
                              className="w-full rounded-md border border-amber-300/20 bg-black/40 px-2 py-1 text-xs text-slate-100 outline-none focus:border-amber-300" />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-wider text-slate-500 block mb-0.5">Leader Email</label>
                            <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} aria-label={`Edit email for ${t.name}`}
                              className="w-full rounded-md border border-amber-300/20 bg-black/40 px-2 py-1 text-xs text-slate-100 outline-none focus:border-amber-300" />
                          </div>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-[9px] uppercase tracking-wider">
                              {saveState === "saving" && <span className="text-amber-300 animate-pulse">Saving…</span>}
                              {saveState === "saved"  && <span className="text-emerald-300">✓ Saved</span>}
                              {saveState === "error"  && <span className="text-rose-300">Error</span>}
                            </span>
                            <button onClick={() => setEditingTeam(null)} className="text-[9px] uppercase tracking-wider text-slate-400 hover:text-slate-200">Close</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="pr-16 font-serif text-2xl leading-tight text-slate-100 truncate">{t.name}</h3>
                          <p className="mt-1.5 text-xs text-slate-400 truncate flex items-center gap-1.5" title={t.leader_email || ""}>
                            <span className="text-slate-500">📧</span>
                            <span>{t.leader_email || "No email set"}</span>
                          </p>
                          {t.latest?.category && (
                            <p className="mt-1 text-xs text-amber-300/80 truncate">
                              📌 {t.latest.category}
                            </p>
                          )}
                        </>
                      )}
                      <p className="mt-2 text-[10px] text-slate-500">Added {new Date(t.created_at).toLocaleDateString()}</p>
                    </div>

                    <div className="px-5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Best score</span>
                        <span className="font-serif text-2xl text-amber-300">{t.bestScore ?? "—"}<span className="text-xs text-slate-500">/100</span></span>
                      </div>
                      <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${t.name} best score`} className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-px border-t border-white/5 bg-white/5 text-center">
                      <div className="bg-[#0a0a14] px-2 py-2.5">
                        <div className="font-serif text-base text-slate-100">{t.submissions.length}</div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">Submissions</div>
                      </div>
                      <div className="bg-[#0a0a14] px-2 py-2.5">
                        <div className="font-serif text-base text-emerald-300">{evaluated}</div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-500">Evaluated</div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-1.5 border-t border-white/5 p-3">
                      <button onClick={() => setOpenTeam(open ? null : t.id)} aria-expanded={open} aria-controls={`team-${t.id}-panel`}
                        className="flex-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                        {open ? "Hide" : "View"} PDFs
                      </button>
                      <button onClick={() => { setEditingTeam(t.id); setEditName(t.name); setEditEmail(t.leader_email || ""); }} aria-label={`Edit ${t.name}`}
                        className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                        Edit
                      </button>
                      <button onClick={() => exportTeam(t)} disabled={!t.submissions.length} aria-label={`Export ${t.name} as JSON`}
                        className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-40">
                        JSON
                      </button>
                    </div>

                    {/* Report + Feedback + Delete row */}
                    <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-3 pb-3">
                      <button
                        onClick={() => openPrintReport(teams, t)}
                        disabled={!hasDone}
                        className="flex-1 rounded-md border border-violet-400/30 bg-violet-400/5 px-2 py-1.5 text-xs text-violet-300 hover:bg-violet-400/15 disabled:opacity-40"
                      >📄 Download Report</button>
                      <button
                        onClick={() => handleSendFeedback(t.id)}
                        disabled={feedbackLoading === t.id || !hasDone}
                        className="flex-1 rounded-md border border-sky-400/30 bg-sky-400/5 px-2 py-1.5 text-xs text-sky-300 hover:bg-sky-400/15 disabled:opacity-40"
                      >{feedbackLoading === t.id ? "Building…" : "📧 Send Feedback"}</button>
                      <button onClick={() => setConfirmDelete(t)} aria-label={`Delete team ${t.name}`}
                        className="rounded-md border border-rose-400/40 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">
                        Delete
                      </button>
                    </div>

                    {open && (
                      <div id={`team-${t.id}-panel`} className="space-y-2 border-t border-white/5 bg-black/30 p-3">
                        {t.submissions.length === 0 && <p className="text-xs text-slate-400">No submissions for this team yet.</p>}
                        {t.submissions.map((s) => (
                          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-slate-100">{s.file_name}</p>
                              <p className="text-[11px] text-slate-400">{new Date(s.created_at).toLocaleString()} · {s.status}{s.error ? ` · ${s.error}` : ""}</p>
                            </div>
                            {s.score != null && <span className="shrink-0 text-sm font-semibold text-amber-300">{s.score}/100</span>}
                            <button onClick={() => setSelectedSub(s)} disabled={s.status !== "done"} aria-label={`View evaluation for ${s.file_name}`}
                              className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">View</button>
                            <button onClick={() => exportSubmission(t, s)} disabled={s.status !== "done"} aria-label={`Export ${s.file_name} as JSON`}
                              className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-40">JSON</button>
                            <button onClick={() => { if (confirm("Delete this submission?")) delSubMut.mutate(s.id); }} aria-label={`Delete submission ${s.file_name}`}
                              className="rounded-md border border-rose-400/40 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/15">
                              <span aria-hidden="true">×</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── CRITERIA TAB ──────────────────────────────────────────── */}
        {activeTab === "criteria" && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl">Evaluation Criteria</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  These criteria are sent to the AI evaluator for every new submission.
                  {criteriaQ.data?.updatedAt && (
                    <> Last saved: {new Date(criteriaQ.data.updatedAt).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={resetCriteria} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
                  Reset
                </button>
                <button
                  onClick={addCriterion}
                  disabled={localCriteria.length >= 20}
                  className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-300/20 disabled:opacity-40"
                >
                  + Add Criterion
                </button>
                <button
                  onClick={() => { setCritSaveState("saving"); saveCriteriaMut.mutate(localCriteria); }}
                  disabled={saveCriteriaMut.isPending || localCriteria.length === 0}
                  className="rounded-md bg-amber-300 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-200 disabled:opacity-60"
                >
                  {saveCriteriaMut.isPending ? "Saving…" : critSaveState === "saved" ? "✓ Saved!" : "Save Criteria"}
                </button>
              </div>
            </div>

            {criteriaQ.isLoading && <p className="mt-4 text-sm text-slate-400">Loading criteria…</p>}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {localCriteria.map((c, i) => {
                const totalMax = localCriteria.reduce((s, x) => s + x.maxScore, 0);
                return (
                  <div key={i} className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-amber-300/20">
                    <div className="flex items-start gap-3">
                      {/* ID badge */}
                      <input
                        value={c.id}
                        onChange={(e) => updateCriterion(i, "id", e.target.value)}
                        maxLength={10}
                        className="w-14 shrink-0 rounded-md bg-amber-300/15 px-2 py-1 text-center text-xs font-bold text-amber-300 outline-none focus:ring-1 focus:ring-amber-300 border border-transparent focus:border-amber-300/60"
                        aria-label="Criterion ID"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <input
                          value={c.name}
                          onChange={(e) => updateCriterion(i, "name", e.target.value)}
                          placeholder="Criterion name"
                          className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-300/60"
                          aria-label="Criterion name"
                        />
                        <textarea
                          value={c.description}
                          onChange={(e) => updateCriterion(i, "description", e.target.value)}
                          placeholder="Description (sent to AI evaluator)"
                          rows={2}
                          className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-slate-400 placeholder:text-slate-600 outline-none focus:border-amber-300/60 resize-none"
                          aria-label="Criterion description"
                        />
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <label className="text-[9px] uppercase text-slate-600">Max</label>
                        <input
                          type="number" min={1} max={100}
                          value={c.maxScore}
                          onChange={(e) => updateCriterion(i, "maxScore", parseInt(e.target.value) || 10)}
                          className="w-14 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-center text-sm font-bold text-amber-300 outline-none focus:border-amber-300/60"
                          aria-label="Max score"
                        />
                        <span className="text-[9px] text-slate-600">pts</span>
                      </div>
                      <button onClick={() => removeCriterion(i)} disabled={localCriteria.length <= 1} aria-label={`Remove criterion ${c.id}`}
                        className="shrink-0 rounded-md border border-rose-400/30 px-1.5 py-1 text-xs text-rose-300 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 transition disabled:pointer-events-none">
                        ×
                      </button>
                    </div>
                    {/* weight bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400/60" style={{ width: `${Math.round((c.maxScore / Math.max(totalMax, 1)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-600">{Math.round((c.maxScore / Math.max(totalMax, 1)) * 100)}% weight</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-5 py-3">
              <span className="text-sm text-slate-400">Total max score</span>
              <span className="font-serif text-2xl text-amber-300">{localCriteria.reduce((s, c) => s + c.maxScore, 0)}<span className="text-sm text-slate-500"> pts</span></span>
            </div>

            {critSaveState === "error" && (
              <p className="mt-2 text-xs text-rose-300">Failed to save criteria. Please try again.</p>
            )}
          </section>
        )}

        {/* ─── TOPICS TAB ──────────────────────────────────────────── */}
        {activeTab === "topics" && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl">Submission Topics</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Categories that teams select when submitting their proposals.
                  {topicsQ.data?.updatedAt && (
                    <> Last saved: {new Date(topicsQ.data.updatedAt).toLocaleString()}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={resetTopics} className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
                  Reset
                </button>
                <button
                  onClick={addTopic}
                  disabled={localTopics.length >= 20}
                  className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-300/20 disabled:opacity-40"
                >
                  + Add Topic
                </button>
                <button
                  onClick={() => { setTopicSaveState("saving"); saveTopicsMut.mutate(localTopics); }}
                  disabled={saveTopicsMut.isPending || localTopics.length === 0}
                  className="rounded-md bg-amber-300 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-200 disabled:opacity-60"
                >
                  {saveTopicsMut.isPending ? "Saving…" : topicSaveState === "saved" ? "✓ Saved!" : "Save Topics"}
                </button>
              </div>
            </div>

            {topicsQ.isLoading && <p className="mt-4 text-sm text-slate-400">Loading topics…</p>}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {localTopics.map((t, i) => (
                <div key={i} className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:border-amber-300/20">
                  <input
                    value={t.id}
                    onChange={(e) => updateTopic(i, "id", e.target.value)}
                    maxLength={10}
                    className="w-12 shrink-0 rounded-md bg-amber-300/15 px-1.5 py-1 text-center text-xs font-bold text-amber-300 outline-none focus:ring-1 focus:ring-amber-300 border border-transparent focus:border-amber-300/60"
                    aria-label="Topic ID"
                  />
                  <input
                    value={t.name}
                    onChange={(e) => updateTopic(i, "name", e.target.value)}
                    placeholder="Topic Name"
                    className="flex-1 min-w-0 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm font-medium text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-300/60"
                    aria-label="Topic Name"
                  />
                  <button onClick={() => removeTopic(i)} disabled={localTopics.length <= 1} aria-label={`Remove topic ${t.id}`}
                    className="shrink-0 rounded-md border border-rose-400/30 px-1.5 py-1 text-xs text-rose-300 opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 transition disabled:pointer-events-none">
                    ×
                  </button>
                </div>
              ))}
            </div>
            {topicSaveState === "error" && (
              <p className="mt-2 text-xs text-rose-300">Failed to save topics. Please try again.</p>
            )}
          </section>
        )}
      </main>

      {/* ── Submission Modal ── */}
      {selectedSub && (
        <SubmissionModal
          submission={selectedSub}
          onClose={() => setSelectedSub(null)}
          onExport={() => downloadJson(`submission-${selectedSub.id.slice(0,8)}.json`, { exportedAt: new Date().toISOString(), submission: selectedSub })}
        />
      )}

      {/* ── Delete Confirm ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete team?"
          message={<>You're about to permanently delete <span className="font-semibold text-slate-100">"{confirmDelete.name}"</span> and {confirmDelete.submissions.length === 0 ? "no submissions." : `all ${confirmDelete.submissions.length} submission${confirmDelete.submissions.length === 1 ? "" : "s"} attached to it.`} This cannot be undone.</>}
          confirmLabel={delTeamMut.isPending ? "Deleting…" : "Delete team"}
          busy={delTeamMut.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => { const id = confirmDelete.id; delTeamMut.mutate(id, { onSettled: () => setConfirmDelete(null) }); }}
        />
      )}

      {/* ── Feedback Email Modal ── */}
      {feedbackModal && (
        <FeedbackModal
          feedback={feedbackModal}
          onClose={() => setFeedbackModal(null)}
        />
      )}
    </div>
  );
}

// ─── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, confirmLabel, busy, onCancel, onConfirm }: {
  title: string; message: React.ReactNode; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-rose-400/30 bg-[#0a0a14] p-6 text-slate-100 shadow-[0_20px_60px_-20px_rgba(244,63,94,0.4)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-300" aria-hidden="true">!</span>
          <div>
            <h3 id="confirm-title" className="font-serif text-xl">{title}</h3>
            <p className="mt-2 text-sm text-slate-300">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button autoFocus onClick={onCancel} className="rounded-md border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-60">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── FeedbackModal ─────────────────────────────────────────────────────────────

function FeedbackModal({ feedback, onClose }: { feedback: { to: string; subject: string; body: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyBody = async () => {
    await navigator.clipboard.writeText(feedback.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoHref = `mailto:${encodeURIComponent(feedback.to)}?subject=${encodeURIComponent(feedback.subject)}&body=${encodeURIComponent(feedback.body)}`;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="feedback-title" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-2xl rounded-2xl border border-sky-400/30 bg-[#0a0a14] p-5 text-slate-100 shadow-[0_20px_60px_-20px_rgba(56,189,248,0.3)] sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 id="feedback-title" className="font-serif text-xl text-sky-300">📧 Feedback Email</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">To: <span className="text-slate-200">{feedback.to}</span></p>
            <p className="text-xs text-slate-400 truncate">Subject: <span className="text-slate-200">{feedback.subject}</span></p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">✕ Close</button>
        </div>

        {/* Body preview */}
        <div className="rounded-lg border border-white/10 bg-black/40 p-4 max-h-80 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-xs text-slate-300 font-mono leading-relaxed">{feedback.body}</pre>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={mailtoHref}
            className="flex-1 rounded-md bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            ✉️ Open in Email Client
          </a>
          <button
            onClick={copyBody}
            className="rounded-md border border-white/15 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
          >
            {copied ? "✓ Copied!" : "📋 Copy Body"}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
          Clicking "Open in Email Client" will open your default mail app with this email pre-filled. Review and hit Send.
        </p>
      </div>
    </div>
  );
}

// ─── SubmissionModal ────────────────────────────────────────────────────────────

function SubmissionModal({ submission, onClose, onExport }: { submission: Submission; onClose: () => void; onExport: () => void }) {
  const pdfFn = useServerFn(getPdfUrl);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const r: any = submission.result || {};

  useEffect(() => {
    pdfFn({ data: { path: submission.pdf_path } })
      .then((res) => setPdfUrl(res.url))
      .catch(() => setPdfUrl(null));
  }, [submission.pdf_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="eval-title" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0a0a14] p-5 text-slate-100 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-400">{submission.file_name}</p>
            <h3 id="eval-title" className="mt-1 font-serif text-2xl">Evaluation</h3>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-amber-300">{submission.score ?? "—"}<span className="text-base text-slate-400">/100</span></div>
            <div className="text-[10px] uppercase tracking-wider text-slate-300">{r.overallRating || ""}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">Open PDF ↗</a>
          )}
          <button onClick={onExport} className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-300/20">Download JSON</button>
        </div>

        {r.executiveSummary && <p className="mt-5 text-sm text-slate-300">{r.executiveSummary}</p>}

        {r.problemStatement && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <h4 className="text-[10px] uppercase tracking-wider text-slate-400">Problem</h4>
              <p className="mt-1 text-sm">{r.problemStatement}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <h4 className="text-[10px] uppercase tracking-wider text-slate-400">Solution</h4>
              <p className="mt-1 text-sm">{r.solution}</p>
            </div>
          </div>
        )}

        {r.criteria && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {r.criteria.map((c: any) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">{c.id}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-amber-300">{c.score}/{c.maxScore ?? 10}</span>
                </div>
                <div role="progressbar" aria-valuenow={Math.round(Number(c.score) || 0)} aria-valuemin={0} aria-valuemax={c.maxScore ?? 10} aria-label={`${c.name} score`} className="mt-2 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200" style={{ width: `${Math.max(0, Math.min(c.maxScore ?? 10, Number(c.score) || 0)) / (c.maxScore ?? 10) * 100}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-300"><b className="text-slate-100">Evidence:</b> {c.evidence}</p>
                {c.strengths  && <p className="mt-1 text-xs text-slate-300"><b className="text-slate-100">Strengths:</b> {c.strengths}</p>}
                {c.weaknesses && <p className="mt-1 text-xs text-slate-300"><b className="text-slate-100">Weaknesses:</b> {c.weaknesses}</p>}
                {c.deductions && <p className="mt-1 text-xs text-rose-200"><b className="text-rose-100">Deductions:</b> {c.deductions}</p>}
              </div>
            ))}
          </div>
        )}

        {(r.strengths || r.weaknesses || r.risks || r.suggestions) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { t: "Strengths",   items: r.strengths },
              { t: "Weaknesses",  items: r.weaknesses },
              { t: "Risks",       items: r.risks },
              { t: "Suggestions", items: r.suggestions },
            ].map((b) => (
              <div key={b.t} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400">{b.t}</h4>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-300">
                  {b.items?.map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">Close</button>
        </div>
      </div>
    </div>
  );
}