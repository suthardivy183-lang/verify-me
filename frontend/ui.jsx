const {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} = window.Recharts || {};

window.VerifyMeUI = (() => {
  const API_BASE = "http://localhost:8000";
  const ORG_ID = "demo_org";
  const REPORTS_DOWNLOADED = 184;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  async function parseApiResponse(response, fallbackMessage) {
    if (response.ok) {
      return response.json();
    }

    let message = fallbackMessage;

    try {
      const data = await response.json();
      message = data.detail || data.message || fallbackMessage;
    } catch (error) {
      message = response.statusText || fallbackMessage;
    }

    throw new Error(message);
  }

  function normalizeVerdict(value) {
    const verdict = String(value || "").trim().toLowerCase();
    if (verdict.includes("fake")) return "FAKE";
    if (verdict.includes("real")) return "REAL";
    return "UNCERTAIN";
  }

  function normalizeConfidence(value) {
    if (typeof value === "string" && value.includes("%")) {
      return clampNumber(Number.parseFloat(value), 0, 100);
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric <= 1) return clampNumber(numeric * 100, 0, 100);
    return clampNumber(numeric, 0, 100);
  }

  function clampNumber(value, min = 0, max = 100) {
    return Math.min(Math.max(Number(value) || 0, min), max);
  }

  function riskLevelFromScore(score) {
    const value = clampNumber(score);
    if (value >= 85) return "CRITICAL";
    if (value >= 65) return "HIGH";
    if (value >= 40) return "MEDIUM";
    if (value >= 20) return "LOW";
    return "SAFE";
  }

  function getVerdictTone(verdict) {
    if (verdict === "REAL") {
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    }
    if (verdict === "FAKE") {
      return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    }
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  function getRiskTextTone(score) {
    const level = riskLevelFromScore(score);
    if (level === "CRITICAL") return "text-rose-300";
    if (level === "HIGH") return "text-orange-300";
    if (level === "MEDIUM") return "text-amber-300";
    if (level === "LOW") return "text-emerald-300";
    return "text-teal-300";
  }

  function getRiskBadgeTone(level) {
    if (level === "CRITICAL") return "border-rose-500/20 bg-rose-500/10 text-rose-300";
    if (level === "HIGH") return "border-orange-500/20 bg-orange-500/10 text-orange-300";
    if (level === "MEDIUM") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
    if (level === "LOW") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    return "border-teal-500/20 bg-teal-500/10 text-teal-300";
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDateOnly(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function humanizeKey(key) {
    return String(key || "")
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatSignalValue(value) {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value <= 1 ? `${Math.round(value * 100)}%` : String(Math.round(value));
    return String(value);
  }

  function normalizeSignals(signals) {
    if (!signals) return [];

    if (Array.isArray(signals)) {
      return signals.map((value, index) => ({
        key: `signal-${index}`,
        label: String(value),
        value: "",
        score: null,
      }));
    }

    return Object.entries(signals).map(([key, value]) => ({
      key,
      label: humanizeKey(key),
      value: formatSignalValue(value),
      score: typeof value === "number" ? clampNumber(value <= 1 ? value * 100 : value) : null,
    }));
  }

  async function fetchVerifications() {
    const response = await fetch(`${API_BASE}/api/verifications?org_id=${ORG_ID}`);
    const data = await parseApiResponse(response, "Unable to load verification history.");
    return Array.isArray(data) ? data : [];
  }

  async function postVerification(formData) {
    const response = await fetch(`${API_BASE}/api/verify`, {
      method: "POST",
      body: formData,
    });

    return parseApiResponse(response, "Verification failed.");
  }

  async function downloadReport(verificationId) {
    const response = await fetch(`${API_BASE}/api/report/${verificationId}`);

    if (!response.ok) {
      await parseApiResponse(response, "Unable to download report.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${verificationId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function buildDashboardMetrics(items) {
    const total = items.length;
    const fakes = items.filter((item) => normalizeVerdict(item.verdict || item.prediction) === "FAKE").length;
    const reals = items.filter((item) => normalizeVerdict(item.verdict || item.prediction) === "REAL").length;
    const highRisk = items.filter((item) => clampNumber(item.risk_score) > 70).length;
    const fakeRiskPercent = total ? Math.round((fakes / total) * 100) : 0;

    return {
      total,
      fakes,
      reals,
      highRisk,
      fakeRiskPercent,
      reportsDownloaded: REPORTS_DOWNLOADED,
      severity: [
        { label: "Critical", color: "#ef4444", count: items.filter((item) => riskLevelFromScore(item.risk_score) === "CRITICAL").length },
        { label: "High", color: "#f97316", count: items.filter((item) => riskLevelFromScore(item.risk_score) === "HIGH").length },
        { label: "Medium", color: "#facc15", count: items.filter((item) => riskLevelFromScore(item.risk_score) === "MEDIUM").length },
        { label: "Low", color: "#22c55e", count: items.filter((item) => riskLevelFromScore(item.risk_score) === "LOW").length },
        { label: "Safe", color: "#14b8a6", count: items.filter((item) => riskLevelFromScore(item.risk_score) === "SAFE").length },
      ],
    };
  }

  function LayoutCard({ children, className = "" }) {
    return (
      <div
        className={`group relative overflow-hidden rounded-[30px] border border-white/15 bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-white/[0.02] shadow-panel backdrop-blur-xl transition-all duration-500 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_36px_100px_-42px_rgba(59,130,246,0.65)] ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(255,255,255,0.18),transparent_45%)] opacity-35" />
        <div className="relative">{children}</div>
      </div>
    );
  }

  function SectionTitle({ eyebrow, title, subtitle, action }) {
    return (
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-semibold tracking-[0.2em] text-accent/85">{eyebrow}</p> : null}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-[2.1rem]">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    );
  }

  function LoadingCard({ title = "Loading data..." }) {
    return (
      <LayoutCard className="flex min-h-[240px] items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-edge border-t-accent" />
          <p className="mt-4 text-sm font-semibold text-muted">{title}</p>
        </div>
      </LayoutCard>
    );
  }

  function ErrorCard({ title = "Something went wrong", message, onRetry }) {
    return (
      <LayoutCard className="p-8">
        <div className="rounded-[24px] border border-rose-500/20 bg-rose-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="mt-2 text-sm text-rose-100/80">{message || "The API may be down. Please check the backend and try again."}</p>
            </div>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </LayoutCard>
    );
  }

  function EmptyState({ title, subtitle }) {
    return (
      <LayoutCard className="flex min-h-[240px] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-muted">
            <HistoryIcon className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
      </LayoutCard>
    );
  }

  function DownloadButton({ verificationId, onClick, className = "" }) {
    return (
      <button
        type="button"
        onClick={() => onClick(verificationId)}
        className={`rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-accent/25 ${className}`}
      >
        Download PDF
      </button>
    );
  }

  function VerdictBadge({ verdict }) {
    const normalized = normalizeVerdict(verdict);
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] ${getVerdictTone(normalized)}`}>
        {normalized}
      </span>
    );
  }

  function RiskBadge({ score, label }) {
    const resolved = label || riskLevelFromScore(score);
    return (
      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] ${getRiskBadgeTone(resolved)}`}>
        {resolved}
      </span>
    );
  }

  function StatCard({ icon, label, value, delta, deltaPositive = true }) {
    return (
      <LayoutCard className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-accent transition-all duration-500 group-hover:scale-[1.04]">
            {icon}
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${deltaPositive ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-200/25" : "bg-rose-400/15 text-rose-100 ring-1 ring-rose-200/25"}`}>
            {delta}
          </span>
        </div>
        <p className="mt-6 text-sm text-muted">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
      </LayoutCard>
    );
  }

  function SeverityRing({ label, color, count }) {
    if (!ResponsiveContainer || !PieChart || !Pie || !Cell) {
      return (
        <div className="flex min-w-[96px] flex-col items-center gap-3">
          <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl font-extrabold text-white">
            {count}
          </div>
          <span className="text-xs font-semibold text-muted">{label}</span>
        </div>
      );
    }

    return (
      <div className="flex min-w-[96px] flex-col items-center gap-3">
        <div className="relative h-[88px] w-[88px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "active", value: Math.max(count, 1) },
                  { name: "rest", value: Math.max(12 - Math.max(count, 1), 2) },
                ]}
                startAngle={90}
                endAngle={-270}
                innerRadius={28}
                outerRadius={42}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="rgba(255,255,255,0.08)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold text-white">{count}</span>
          </div>
        </div>
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
    );
  }

  function Speedometer({ value }) {
    const clamped = clampNumber(value);
    const angle = -90 + (clamped / 100) * 180;
    const radians = (Math.PI / 180) * angle;
    const needleX = 160 + 88 * Math.cos(radians);
    const needleY = 160 + 88 * Math.sin(radians);

    if (!ResponsiveContainer || !PieChart || !Pie || !Cell) {
      return (
        <div className="relative mx-auto flex h-[220px] w-full max-w-[420px] items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03]">
          <div className="text-center">
            <div className="text-4xl font-extrabold tracking-tight text-white">{clamped}%</div>
            <p className="mt-2 text-sm text-muted">Overall Risk Level</p>
          </div>
        </div>
      );
    }

    return (
      <div className="relative mx-auto h-[220px] w-full max-w-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: "safe", value: 40, color: "#22c55e" },
                { name: "warning", value: 30, color: "#facc15" },
                { name: "danger", value: 30, color: "#ef4444" },
              ]}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="73%"
              innerRadius="62%"
              outerRadius="84%"
              stroke="none"
            >
              <Cell fill="#57d9be" />
              <Cell fill="#f6c46a" />
              <Cell fill="#ff7592" />
            </Pie>
            <Pie
              data={[{ value: 100 }]}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="73%"
              innerRadius="56%"
              outerRadius="58%"
              fill="rgba(255,255,255,0.08)"
              stroke="none"
            />
          </PieChart>
        </ResponsiveContainer>

        <svg viewBox="0 0 320 220" className="pointer-events-none absolute inset-0 h-full w-full">
          <line x1="160" y1="160" x2={needleX} y2={needleY} stroke="#f8fafc" strokeWidth="6" strokeLinecap="round" />
          <circle cx="160" cy="160" r="13" fill="#78e6ff" />
          <circle cx="160" cy="160" r="5" fill="#091016" />
        </svg>

        <div className="absolute inset-x-0 bottom-3 text-center">
          <div className="text-4xl font-extrabold tracking-tight text-white">{clamped}%</div>
          <p className="mt-1 text-sm text-muted">Overall Risk Level</p>
        </div>
      </div>
    );
  }

  function BackgroundGlow() {
    return (
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <style>{`
          .vm-aurora {
            border-radius: 9999px;
            filter: blur(56px);
            animation: vmFloat 18s ease-in-out infinite alternate;
          }
          .vm-grain {
            background-image: repeating-linear-gradient(
              115deg,
              rgba(255,255,255,0.02) 0px,
              rgba(255,255,255,0.02) 1px,
              transparent 1px,
              transparent 8px
            );
            opacity: 0.45;
            mix-blend-mode: soft-light;
          }
          @keyframes vmFloat {
            0% { transform: translate3d(-12px, 0, 0) scale(0.98); opacity: 0.7; }
            100% { transform: translate3d(16px, -14px, 0) scale(1.04); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .vm-aurora { animation: none !important; }
          }
        `}</style>
        <div className="vm-aurora absolute left-[-8rem] top-[-6rem] h-72 w-72 bg-indigo-500/25" />
        <div className="vm-aurora absolute right-[-8rem] top-20 h-80 w-80 bg-cyan-500/20 [animation-delay:2s]" />
        <div className="vm-aurora absolute bottom-[-10rem] left-1/3 h-96 w-96 bg-fuchsia-500/12 [animation-delay:4s]" />
        <div className="vm-grain absolute inset-0" />
      </div>
    );
  }

  function ShieldIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 3L19 6V11.6C19 15.9 16.2 19.7 12 21C7.8 19.7 5 15.9 5 11.6V6L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.2 12.1L11.2 14.1L15.2 9.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  function DashboardIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="4" width="7" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="18" width="7" height="2" rx="1" fill="currentColor" />
      </svg>
    );
  }

  function VerifyIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 3V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6 9L12 3L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="5" y="14" width="14" height="6" rx="2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  function HistoryIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M4 12A8 8 0 1 0 7 5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 4V8H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8V12L15 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  function ReportsIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M7 3H14L19 8V20H7C5.9 20 5 19.1 5 18V5C5 3.9 5.9 3 7 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 3V8H19" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8.5 12H15.5M8.5 16H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  function SettingsIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 9.2A2.8 2.8 0 1 0 12 14.8A2.8 2.8 0 1 0 12 9.2Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19 12C19 11.4 18.9 10.9 18.7 10.3L20.5 8.9L18.7 5.7L16.5 6.4C15.7 5.8 14.9 5.4 14 5.2L13.5 3H10.5L10 5.2C9.1 5.4 8.3 5.8 7.5 6.4L5.3 5.7L3.5 8.9L5.3 10.3C5.1 10.9 5 11.4 5 12C5 12.6 5.1 13.1 5.3 13.7L3.5 15.1L5.3 18.3L7.5 17.6C8.3 18.2 9.1 18.6 10 18.8L10.5 21H13.5L14 18.8C14.9 18.6 15.7 18.2 16.5 17.6L18.7 18.3L20.5 15.1L18.7 13.7C18.9 13.1 19 12.6 19 12Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    );
  }

  function SearchIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 20L16.2 16.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  function MenuIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M4 7H20M4 12H20M4 17H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  function UploadIcon({ className = "h-6 w-6" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M12 16V4M12 4L7.5 8.5M12 4L16.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 16.5V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  function CloseIcon({ className = "h-5 w-5" }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  function FileIcon({ type, className = "h-6 w-6" }) {
    const normalized = String(type || "").toLowerCase();
    if (normalized.includes("video")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="6" width="11" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M15 10L20 7V17L15 14V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    if (normalized.includes("image") || normalized.includes("photo")) {
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M6.5 17L10.5 13L13 15.5L15.5 12.5L18.5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path d="M7 3H14L19 8V20H7C5.9 20 5 19.1 5 18V5C5 3.9 5.9 3 7 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 3V8H19" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }

  return {
    API_BASE,
    ORG_ID,
    MAX_FILE_SIZE,
    parseApiResponse,
    normalizeVerdict,
    normalizeConfidence,
    clampNumber,
    riskLevelFromScore,
    getVerdictTone,
    getRiskTextTone,
    getRiskBadgeTone,
    formatDateTime,
    formatDateOnly,
    humanizeKey,
    normalizeSignals,
    fetchVerifications,
    postVerification,
    downloadReport,
    buildDashboardMetrics,
    LayoutCard,
    SectionTitle,
    LoadingCard,
    ErrorCard,
    EmptyState,
    DownloadButton,
    VerdictBadge,
    RiskBadge,
    StatCard,
    SeverityRing,
    Speedometer,
    BackgroundGlow,
    ShieldIcon,
    DashboardIcon,
    VerifyIcon,
    HistoryIcon,
    ReportsIcon,
    SettingsIcon,
    SearchIcon,
    MenuIcon,
    UploadIcon,
    CloseIcon,
    FileIcon,
  };
})();
