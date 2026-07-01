import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import ChromeScene from "@/components/ChromeScene";
import { ThemeToggle } from "@/components/ThemeToggle";
import { verifyTeamLeaderEmail, listPublicTeams, getTopics } from "@/lib/admin.functions";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team Portal — Ideathon 2026 Submission" },
      { name: "description", content: "Upload your Ideathon 2026 submission PDF. Your team's evaluation is handled by the judging panel." },
    ],
  }),
  component: TeamPortal,
});

function TeamPortal() {
  const inputRef = useRef<HTMLInputElement>(null);
  const verifyEmailFn = useServerFn(verifyTeamLeaderEmail);
  const listPublicTeamsFn = useServerFn(listPublicTeams);
  const getTopicsFn = useServerFn(getTopics);

  // Stepped Flow State
  const [step, setStep] = useState<"team" | "topic" | "verify" | "upload">("team");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  
  const [selectedTopic, setSelectedTopic] = useState("");
  const [topics, setTopics] = useState<{id: string, name: string}[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string; emailHint?: string }[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [emailHint, setEmailHint] = useState("");

  useEffect(() => {
    getTopicsFn().then(res => {
      setTopics(res.topics || []);
      setTopicsLoading(false);
    }).catch(() => setTopicsLoading(false));
  }, []);

  const loadTeams = async () => {
    setTeamsLoading(true);
    try {
      const data = await listPublicTeamsFn();
      setTeams(data || []);
    } catch {
      // fallback: try plain supabase
      const { data } = await supabase.from("teams").select("id, name").order("name");
      setTeams(data || []);
    }
    setTeamsLoading(false);
  };
  useEffect(() => { loadTeams(); }, []);

  const onPick = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setErr("Please upload a PDF file.");
      return;
    }
    setErr(null);
    setFile(f);
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !email.trim()) return;
    setVerifyingEmail(true);
    setErr(null);
    try {
      const res = await verifyEmailFn({ data: { teamId: selectedTeamId, email: email.trim() } });
      if (res.verified) {
        setEmailVerified(true);
        setTimeout(() => {
          setStep("upload");
        }, 1200);
      } else {
        setErr("Incorrect team leader email. Please try again.");
      }
    } catch (e: any) {
      setErr(e?.message || "Verification failed");
    } finally {
      setVerifyingEmail(false);
    }
  };

  const submit = async () => {
    if (!teamName.trim() || !file) return;
    setLoading(true);
    setErr(null);
    setDone(null);
    try {
      const fd = new FormData();
      fd.append("teamName", teamName.trim());
      fd.append("category", selectedTopic);
      fd.append("file", file, file.name);
      const res = await fetch("/api/public/submit", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Submission failed (${res.status})`);
      setDone({ ok: true, message: j.warning || "Your submission was received and is being evaluated by the panel." });
      setFile(null);
      loadTeams();
    } catch (e: any) {
      setErr(e?.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setDone(null);
    setStep("team");
    setTeamName("");
    setSelectedTeamId("");
    setSelectedTopic("");
    setEmail("");
    setEmailVerified(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08070f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#a78bfa]/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-[#67e8f9]/15 blur-[110px]" />
      </div>
      <ChromeScene intensity="ambient" className="pointer-events-none absolute right-[-10%] top-[-5%] -z-10 h-[80vh] w-[80vw] opacity-70" />
      <div className="pointer-events-none absolute inset-0 -z-20 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-300/30 bg-amber-300/10 font-serif text-amber-300">I</span>
          <span className="text-xs uppercase tracking-[0.3em] text-amber-300/80 font-semibold">Ideathon 2026</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/" className="text-xs text-slate-400 hover:text-slate-200">← Back</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-amber-300/90 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Team Portal
        </div>
        
        {/* Step Indicator */}
        {!done && (
          <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-10 bg-white/[0.02] border border-white/5 rounded-2xl p-4 backdrop-blur-md">
            <button 
              onClick={() => { if (step !== "team") { setStep("team"); } }} 
              disabled={loading}
              className="flex items-center gap-2 text-left disabled:opacity-50"
            >
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === "team" ? "bg-amber-300 text-black scale-110 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : selectedTeamId ? "bg-emerald-500 text-black" : "bg-white/10 text-slate-400"}`}>
                {selectedTeamId ? "✓" : "1"}
              </span>
              <span className={`hidden sm:inline text-[10px] uppercase tracking-wider font-semibold ${step === "team" ? "text-amber-300" : selectedTeamId ? "text-emerald-400" : "text-slate-500"}`}>Team</span>
            </button>
            <div className="h-px flex-1 bg-white/10 mx-2 sm:mx-3" />
            <button 
              onClick={() => { if (selectedTeamId && step !== "topic") { setStep("topic"); } }} 
              disabled={loading || !selectedTeamId}
              className="flex items-center gap-2 text-left disabled:opacity-50"
            >
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === "topic" ? "bg-amber-300 text-black scale-110 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : selectedTopic ? "bg-emerald-500 text-black" : "bg-white/10 text-slate-400"}`}>
                {selectedTopic ? "✓" : "2"}
              </span>
              <span className={`hidden sm:inline text-[10px] uppercase tracking-wider font-semibold ${step === "topic" ? "text-amber-300" : selectedTopic ? "text-emerald-400" : "text-slate-500"}`}>Topic</span>
            </button>
            <div className="h-px flex-1 bg-white/10 mx-2 sm:mx-3" />
            <button 
              onClick={() => { if (selectedTopic && step !== "verify" && step !== "upload") { setStep("verify"); } }}
              disabled={loading || !selectedTopic}
              className="flex items-center gap-2 text-left disabled:opacity-50"
            >
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === "verify" ? "bg-amber-300 text-black scale-110 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : emailVerified ? "bg-emerald-500 text-black" : "bg-white/10 text-slate-400"}`}>
                {emailVerified ? "✓" : "3"}
              </span>
              <span className={`hidden sm:inline text-[10px] uppercase tracking-wider font-semibold ${step === "verify" ? "text-amber-300" : emailVerified ? "text-emerald-400" : "text-slate-500"}`}>Verify</span>
            </button>
            <div className="h-px flex-1 bg-white/10 mx-2 sm:mx-3" />
            <div className="flex items-center gap-2 text-left">
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === "upload" ? "bg-amber-300 text-black scale-110 shadow-[0_0_12px_rgba(251,191,36,0.5)]" : "bg-white/10 text-slate-400"}`}>4</span>
              <span className={`hidden sm:inline text-[10px] uppercase tracking-wider font-semibold ${step === "upload" ? "text-amber-300" : "text-slate-500"}`}>Upload</span>
            </div>
          </div>
        )}

        <h1 className="mt-3 font-serif text-5xl tracking-tight sm:text-6xl">Submit your idea.</h1>
        <p className="mt-4 text-base text-slate-400">
          Select your team, verify using your team leader's email address, and submit your proposal PDF.
        </p>

        {done ? (
          <div className="mt-10 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-8 text-center animate-fade-in-up">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-7 w-7">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-checkmark" />
              </svg>
            </div>
            <h2 className="mt-4 font-serif text-2xl">Submission received</h2>
            <p className="mt-2 text-sm text-slate-300">{done.message}</p>
            <button
              onClick={resetFlow}
              className="mt-6 rounded-lg border border-white/15 px-5 py-2.5 text-xs text-slate-200 hover:bg-white/5 hover:border-white/30"
            >
              Submit another
            </button>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            
            {/* STEP 1: SELECT TEAM */}
            {step === "team" && (
              <div className="animate-fade-in-up space-y-4">
                <div className="flex items-baseline justify-between">
                  <label className="text-xs uppercase tracking-wider text-slate-400">Select your team</label>
                  <span className="text-[10px] text-slate-500">{teams.length} registered</span>
                </div>
                {teamsLoading ? (
                  <p className="text-sm text-slate-500">Loading teams…</p>
                ) : teams.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
                    No teams registered yet. Please contact the admin.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {teams.map((t) => {
                      const active = selectedTeamId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setSelectedTeamId(t.id);
                            setTeamName(t.name);
                            setEmailHint((t as any).emailHint || "");
                            // Auto-advance to topic step
                            setTimeout(() => setStep("topic"), 300);
                          }}
                          aria-pressed={active}
                          className={`group relative rounded-xl border px-3 py-3 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                            active
                              ? "border-amber-300/70 bg-amber-300/10 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                              : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-serif text-xs ${active ? "bg-amber-300 text-black font-bold" : "bg-white/10 text-amber-300"}`}>
                              {t.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="truncate text-sm font-medium text-slate-100">{t.name}</span>
                          </div>
                          {active && (
                            <span className="absolute right-2 top-2 text-amber-300" aria-hidden="true">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 1.5: SELECT TOPIC */}
            {step === "topic" && (
              <div className="animate-fade-in-up space-y-4">
                <div className="flex items-baseline justify-between">
                  <label className="text-xs uppercase tracking-wider text-slate-400">Select a Topic/Category</label>
                  <button 
                    onClick={() => setStep("team")} 
                    className="text-[10px] text-amber-300 hover:text-amber-200 uppercase tracking-wider"
                  >
                    ← Back
                  </button>
                </div>
                {topicsLoading ? (
                  <p className="text-sm text-slate-500">Loading topics…</p>
                ) : topics.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
                    No topics available.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {topics.map((t) => {
                      const active = selectedTopic === t.name;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={loading}
                          onClick={() => {
                            setSelectedTopic(t.name);
                            setTimeout(() => setStep("verify"), 300);
                          }}
                          aria-pressed={active}
                          className={`group relative rounded-xl border px-4 py-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                            active
                              ? "border-amber-300/70 bg-amber-300/10 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                              : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{active ? "🎯" : "📌"}</span>
                            <span className={`text-sm font-medium ${active ? "text-amber-300" : "text-slate-100"}`}>{t.name}</span>
                          </div>
                          {active && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300" aria-hidden="true">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: VERIFY LEADER EMAIL */}
            {step === "verify" && (
              <div className="animate-fade-in-up space-y-4">
                <div className="flex items-baseline justify-between">
                  <label className="text-xs uppercase tracking-wider text-slate-400">Verify Team Leader Email</label>
                  <button 
                    onClick={() => setStep("topic")} 
                    className="text-[10px] text-amber-300 hover:text-amber-200 uppercase tracking-wider"
                  >
                    ← Back
                  </button>
                </div>
                
                <form onSubmit={handleVerifyEmail} className="border border-white/10 rounded-2xl p-6 bg-white/[0.02] backdrop-blur-md space-y-4">
                  <p className="text-xs text-slate-400">
                    To upload proposals for <span className="text-slate-100 font-semibold">{teamName}</span>, please verify using the registered email of your team leader.
                  </p>
                  {emailHint && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2">
                      <svg className="h-3.5 w-3.5 shrink-0 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-[11px] text-amber-200/80">
                        Hint: your team leader's email looks like{" "}
                        <span className="font-mono font-semibold text-amber-300">{emailHint}</span>
                      </p>
                    </div>
                  )}

                  {emailVerified ? (
                    <div className="flex flex-col items-center justify-center space-y-3 py-6">
                      <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-7 w-7">
                          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-checkmark" />
                        </svg>
                      </div>
                      <p className="text-xs font-semibold text-emerald-400 animate-pulse">Email verified! Loading upload zone…</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="leader@yourteam.com"
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-300/60 focus-visible:ring-2 focus-visible:ring-amber-300/40"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={verifyingEmail || !email.trim()}
                        className="w-full rounded-xl bg-amber-300 py-3 text-sm font-semibold text-black hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {verifyingEmail ? "Verifying email…" : "Verify Email"}
                      </button>
                    </>
                  )}
                </form>
              </div>
            )}

            {/* STEP 3: UPLOAD FILE */}
            {step === "upload" && (
              <div className="animate-fade-in-up space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                      ✓ {teamName}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-300/20">
                      {selectedTopic}
                    </span>
                  </div>
                  <button 
                    onClick={() => { setStep("verify"); setEmailVerified(false); }} 
                    className="text-[10px] text-slate-400 hover:text-slate-200 uppercase tracking-wider"
                  >
                    ← Back to verification
                  </button>
                </div>

                <div
                  onDragOver={(e) => {
                    if (loading) return;
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    if (loading) return;
                    e.preventDefault();
                    setDragOver(false);
                    onPick(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                    dragOver ? "border-amber-300/70 bg-amber-300/5 scale-[1.01]" : "border-white/15 bg-white/[0.02] hover:border-white/30"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    disabled={loading}
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                  />
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-300/15 text-amber-300 animate-pulse-ring">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
                      <path d="M12 16V4m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 className="mt-4 font-serif text-xl">Attach submission PDF</h2>
                  <p className="mt-1 text-sm text-slate-400">Drag &amp; drop, or click to browse.</p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => inputRef.current?.click()}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"
                  >
                    Choose PDF
                  </button>

                  {file && (
                    <div className="mt-6 flex flex-col items-center gap-3 animate-fade-in-up">
                      <div className="inline-flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-left">
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">PDF</span>
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => setFile(null)}
                          aria-label={`Remove ${file.name}`}
                          className="rounded text-xs text-slate-300 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2"
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-checkmark" />
                        </svg>
                        <span>PDF Loaded &amp; Verified</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  disabled={!teamName.trim() || !file || loading}
                  onClick={submit}
                  className="w-full rounded-xl bg-amber-300 py-4 text-sm font-semibold text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 shadow-[0_4px_20px_-5px_rgba(251,191,36,0.3)] hover:shadow-[0_8px_25px_-5px_rgba(251,191,36,0.5)]"
                >
                  {loading ? "Submitting & evaluating…" : "Submit Idea"}
                </button>
                <p className="text-center text-xs text-slate-500">PDF only · 15MB max</p>
              </div>
            )}

            {err && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200 animate-fade-in-up">
                {err}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}