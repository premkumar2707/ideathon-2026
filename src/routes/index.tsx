import { createFileRoute, Link } from "@tanstack/react-router";
import ChromeScene from "@/components/ChromeScene";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ideathon 2026 — Submission & Evaluation Platform" },
      { name: "description", content: "The official platform for Ideathon 2026. Teams submit ideas; admins manage teams and review evaluations." },
      { property: "og:title", content: "Ideathon 2026" },
      { property: "og:description", content: "Official submission and evaluation portal." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08070f] text-slate-100">
      {/* Ambient gradient field */}
      <div className="pointer-events-none absolute inset-0 -z-20">
        <div className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-[#a78bfa]/25 blur-[140px]" />
        <div className="absolute -bottom-20 left-0 h-[440px] w-[440px] rounded-full bg-[#67e8f9]/20 blur-[140px]" />
        <div className="absolute -bottom-10 right-0 h-[420px] w-[420px] rounded-full bg-[#f5d0fe]/15 blur-[140px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-20 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* 3D hero canvas */}
      <ChromeScene className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[88vh] w-full max-w-[1400px]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl chrome-border bg-white/5 font-serif text-base">
            <span className="chrome-text">I</span>
          </span>
          <p className="font-serif text-lg tracking-tight">
            Ideathon<span className="chrome-text">.</span>2026
          </p>
        </div>
        <nav className="flex items-center gap-1.5">
          <Link to="/team" className="hidden rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300 hover:text-white sm:inline-block">Submit</Link>
          <Link to="/auth" className="rounded-full chrome-glass px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/10">
            Admin
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-12 sm:pt-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full chrome-glass px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a5f3fc] shadow-[0_0_8px_#a5f3fc]" />
            Live · Official platform
          </div>
          <h1 className="mt-5 font-serif text-[2.8rem] leading-[1.02] tracking-tight sm:text-7xl lg:text-[5.4rem]">
            Big ideas,
            <br />
            <span className="chrome-text italic">judged fairly.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-slate-300/90 sm:text-lg">
            Teams submit a pitch PDF. An AI panel scores it against a transparent
            ten-criterion rubric — every mark backed by evidence, every deduction explained.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/team"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0b0a14] shadow-[0_10px_40px_-10px_rgba(196,181,253,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-15px_rgba(245,208,254,0.6)]"
            >
              Submit your idea
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full chrome-glass px-6 py-3 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Open admin panel
            </Link>
          </div>
        </div>

        {/* Stats glass strip */}
        <div className="mt-16 grid grid-cols-3 overflow-hidden rounded-2xl chrome-glass text-center">
          {[
            ["10", "Criteria"],
            ["100", "Total marks"],
            ["F1–F10", "Rubric bands"],
          ].map(([n, l], i) => (
            <div
              key={l}
              className={`px-4 py-6 ${i < 2 ? "border-r border-white/10" : ""}`}
            >
              <div className="font-serif text-3xl chrome-text">{n}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-400">{l}</div>
            </div>
          ))}
        </div>

        {/* Big tilt cards */}
        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <PortalCard
            to="/team"
            tag="For Teams"
            title="Submit your idea"
            blurb="Choose your team, attach your pitch PDF, and we route it to the panel for scoring."
            tone="cyan"
          />
          <PortalCard
            to="/auth"
            tag="For Admins"
            title="Run the panel"
            blurb="Manage teams, review evaluations, export structured JSON for every submission."
            tone="violet"
          />
        </div>

        {/* Marquee of capabilities */}
        <div className="mt-16 overflow-hidden rounded-2xl chrome-glass">
          <div className="flex animate-[scroll_30s_linear_infinite] gap-10 whitespace-nowrap py-4 text-xs uppercase tracking-[0.3em] text-slate-300">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              ["Iridescent rubric", "Evidence-backed scores", "JSON export", "Per-criterion bars", "Live leaderboard", "Secure PDF storage", "Realtime evaluation"].map((s, i) => (
                <span key={`${k}-${i}`} className="flex items-center gap-3">
                  <span className="h-1 w-1 rounded-full bg-[#c4b5fd]" />
                  {s}
                </span>
              )),
            )}
          </div>
        </div>

        {/* Rubric */}
        <section className="mt-24">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-3xl sm:text-4xl">The rubric</h2>
            <span className="text-xs uppercase tracking-wider text-slate-400">100 marks</span>
          </div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              ["F1", "Innovation & Creativity", "Originality, uniqueness, and creativity of the idea."],
              ["F2", "Problem Understanding & Relevance", "Clarity of the problem and alignment with the theme."],
              ["F3", "Feasibility & Practicality", "Realistic implementation using available technologies."],
              ["F4", "Impact & Usefulness", "Potential social, environmental, or economic impact."],
              ["F5", "User-Centric Approach", "Focus on user needs, accessibility, and inclusivity."],
              ["F6", "Scalability & Future Scope", "Ability to expand, sustain, and evolve."],
              ["F7", "Sustainability & Ethics", "Eco-friendly approach and ethical considerations."],
              ["F8", "Presentation & Communication", "Clarity of pitch, structure, and confidence."],
              ["F9", "Teamwork & Collaboration", "Coordination, participation, and team dynamics."],
              ["F10", "Business Viability", "Market potential, affordability, and applicability."],
            ].map(([id, t, d]) => (
              <li key={id} className="group relative overflow-hidden rounded-2xl chrome-glass p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.07]">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-3 min-w-0">
                    <span className="font-serif text-3xl chrome-text">{id}</span>
                    <h3 className="truncate text-sm font-medium">{t}</h3>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-400">10 marks</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300/90">{d}</p>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full chrome-bar" style={{ width: "100%" }} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-24 border-t border-white/5 pt-12 pb-10 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center justify-center">
            <img src="/logo.png" alt="INNOVEDGE Logo" className="h-24 w-auto rounded-full shadow-[0_0_30px_rgba(103,232,249,0.2)]" />
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-sm sm:text-base font-medium text-slate-200">
              🚀 Built by <span className="chrome-text font-bold">Team SNPSU-Nexus</span> 💻
            </p>
            <p className="text-xs sm:text-sm text-slate-400">
              Guided by <strong className="font-bold text-slate-100">Denny Sir</strong> & <strong className="font-bold text-slate-100">Bhagya Mam</strong> ✨
            </p>
          </div>
          
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">
            Ideathon 2026 · Official Submission Portal
          </div>
        </footer>
      </main>

      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function PortalCard({
  to,
  tag,
  title,
  blurb,
  tone,
}: {
  to: "/team" | "/auth";
  tag: string;
  title: string;
  blurb: string;
  tone: "cyan" | "violet";
}) {
  const glow =
    tone === "cyan"
      ? "from-[#67e8f9]/25 to-transparent"
      : "from-[#c4b5fd]/30 to-transparent";
  const blob =
    tone === "cyan" ? "bg-[#67e8f9]/30" : "bg-[#c4b5fd]/40";
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-3xl chrome-glass p-8 transition hover:-translate-y-1 bg-gradient-to-br ${glow}`}
    >
      <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${blob}`} />
      <div className="relative flex items-start justify-between">
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-300">{tag}</span>
        <span className="text-2xl chrome-text transition-transform group-hover:translate-x-1">→</span>
      </div>
      <h3 className="relative mt-8 font-serif text-4xl sm:text-5xl">{title}</h3>
      <p className="relative mt-3 max-w-md text-sm text-slate-300/90">{blurb}</p>
    </Link>
  );
}
