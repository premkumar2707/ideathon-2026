import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`
        relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300
        ${isDark
          ? "border-white/20 bg-white/10"
          : "border-amber-400/80 bg-amber-200/50"}
      `}
    >
      {/* Track icons */}
      <span className="pointer-events-none absolute left-1.5 text-[10px]" aria-hidden="true">🌙</span>
      <span className="pointer-events-none absolute right-1.5 text-[10px]" aria-hidden="true">☀️</span>
      {/* Thumb */}
      <span
        className={`
          absolute h-6 w-6 rounded-full shadow-md transition-all duration-300
          ${isDark
            ? "left-0.5 bg-slate-300"
            : "left-[calc(100%-1.75rem)] bg-amber-500"}
        `}
      />
    </button>
  );
}
