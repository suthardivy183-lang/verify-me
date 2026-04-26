window.DashboardPage = function DashboardPage() {
  const {
    fetchVerifications,
    buildDashboardMetrics,
    normalizeVerdict,
    clampNumber,
    formatDateOnly,
    LayoutCard,
    SectionTitle,
    LoadingCard,
    ErrorCard,
    EmptyState,
    DownloadButton,
    VerdictBadge,
    StatCard,
    SeverityRing,
    Speedometer,
    DashboardIcon,
    ReportsIcon,
    HistoryIcon,
    ShieldIcon,
    FileIcon,
  } = window.AsliUI;

  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchVerifications();
      setItems(data);
    } catch (err) {
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadDashboard();
  }, []);

  const shellClass =
    "cinematic-shell relative isolate overflow-hidden rounded-[34px] bg-[#05070e] p-6 shadow-[0_40px_120px_-52px_rgba(12,18,34,0.98)] ring-1 ring-white/10 md:p-8";
  const panelClass =
    "floating-panel rounded-3xl bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-white/[0.02] backdrop-blur-xl shadow-[0_24px_80px_-30px_rgba(67,56,202,0.55)] ring-1 ring-white/15 transition-all duration-500 ease-in-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_40px_90px_-36px_rgba(59,130,246,0.72)]";

  const getRiskTone = (value) => {
    if (value >= 70) {
      return {
        text: "text-rose-200",
        chip: "bg-rose-400/10 text-rose-200 ring-1 ring-rose-300/20",
        bar: "bg-gradient-to-r from-fuchsia-500 via-rose-400 to-orange-300",
      };
    }
    if (value >= 40) {
      return {
        text: "text-amber-100",
        chip: "bg-amber-400/10 text-amber-100 ring-1 ring-amber-300/20",
        bar: "bg-gradient-to-r from-amber-300 via-orange-300 to-orange-400",
      };
    }
    return {
      text: "text-emerald-100",
      chip: "bg-emerald-400/10 text-emerald-100 ring-1 ring-emerald-300/20",
      bar: "bg-gradient-to-r from-cyan-300 via-emerald-300 to-teal-400",
    };
  };

  if (loading) {
    return <LoadingCard title="Loading dashboard insights..." />;
  }

  if (error) {
    return (
      <div className={shellClass}>
        <style>{`
          .cinematic-shell::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(70% 50% at 15% 0%, rgba(76, 29, 149, 0.38), transparent 70%),
              radial-gradient(60% 50% at 88% 12%, rgba(14, 116, 144, 0.35), transparent 75%),
              linear-gradient(180deg, rgba(4, 6, 16, 0.85) 0%, rgba(2, 4, 12, 0.92) 100%);
            pointer-events: none;
            z-index: -3;
          }
          .cinematic-shell::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(100% 120% at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.58) 100%),
              repeating-linear-gradient(
                110deg,
                rgba(255, 255, 255, 0.02) 0px,
                rgba(255, 255, 255, 0.02) 1px,
                transparent 1px,
                transparent 8px
              );
            mix-blend-mode: soft-light;
            opacity: 0.75;
            pointer-events: none;
            z-index: -2;
          }
          .floating-panel {
            position: relative;
            overflow: hidden;
          }
          .floating-panel::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(125deg, rgba(255, 255, 255, 0.18), transparent 45%);
            opacity: 0.35;
            pointer-events: none;
          }
          .aurora-light {
            position: absolute;
            border-radius: 9999px;
            filter: blur(52px);
            animation: drift 16s ease-in-out infinite alternate;
            pointer-events: none;
          }
          .orbital-loop {
            animation: breathe 7s ease-in-out infinite;
          }
          .reveal-soft {
            animation: revealUp 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
          }
          @keyframes drift {
            0% { transform: translate3d(-10px, 0, 0) scale(0.98); opacity: 0.75; }
            100% { transform: translate3d(16px, -14px, 0) scale(1.05); opacity: 1; }
          }
          @keyframes breathe {
            0%, 100% { transform: scale(1); opacity: 0.72; }
            50% { transform: scale(1.04); opacity: 1; }
          }
          @keyframes revealUp {
            from { opacity: 0; transform: translate3d(0, 20px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .aurora-light,
            .orbital-loop,
            .reveal-soft {
              animation: none !important;
            }
          }
        `}</style>
        <div className="pointer-events-none absolute -top-28 right-8 h-64 w-64 rounded-full bg-rose-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-6 h-64 w-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="relative">
          <SectionTitle
            eyebrow="Dashboard"
            title="Verification Command Center"
            subtitle="Real-time visibility into identity checks, risk posture, and report activity."
          />
          <div className={`${panelClass} mt-6 p-8`}>
            <div className="mx-auto max-w-lg text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-200 ring-1 ring-rose-300/25">
                <ShieldIcon className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">Dashboard temporarily unavailable</h3>
              <p className="mt-2 text-base leading-relaxed text-slate-300">{error}</p>
              <button
                type="button"
                onClick={loadDashboard}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-all duration-300 ease-out hover:bg-white/20"
              >
                Retry loading data
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={shellClass}>
        <style>{`
          .cinematic-shell::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(70% 50% at 15% 0%, rgba(76, 29, 149, 0.38), transparent 70%),
              radial-gradient(60% 50% at 88% 12%, rgba(14, 116, 144, 0.35), transparent 75%),
              linear-gradient(180deg, rgba(4, 6, 16, 0.85) 0%, rgba(2, 4, 12, 0.92) 100%);
            pointer-events: none;
            z-index: -3;
          }
          .cinematic-shell::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(100% 120% at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.58) 100%),
              repeating-linear-gradient(
                110deg,
                rgba(255, 255, 255, 0.02) 0px,
                rgba(255, 255, 255, 0.02) 1px,
                transparent 1px,
                transparent 8px
              );
            mix-blend-mode: soft-light;
            opacity: 0.75;
            pointer-events: none;
            z-index: -2;
          }
          .floating-panel {
            position: relative;
            overflow: hidden;
          }
          .floating-panel::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(125deg, rgba(255, 255, 255, 0.18), transparent 45%);
            opacity: 0.35;
            pointer-events: none;
          }
        `}</style>
        <div className="pointer-events-none absolute -top-24 left-8 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-8 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <SectionTitle
          eyebrow="Dashboard"
          title="Verification Command Center"
          subtitle="Track verification outcomes, anomaly pressure, and downloadable intelligence in one polished workspace."
        />
        <div className={`${panelClass} mt-6 p-8`}>
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-200/20">
              <DashboardIcon className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">No verification activity yet</h3>
            <p className="mt-2 text-base leading-relaxed text-slate-300">
              Run your first identity checks to unlock live KPIs, risk visualizations, and the recent verification stream.
            </p>
            <p className="mt-4 text-sm text-slate-400">Tip: Upload image, video, and voice samples to see richer anomaly patterns.</p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = buildDashboardMetrics(items);
  const recentItems = items.slice(0, 6);

  return (
    <div className={shellClass}>
      <style>{`
        .cinematic-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(70% 50% at 15% 0%, rgba(76, 29, 149, 0.42), transparent 70%),
            radial-gradient(60% 50% at 88% 12%, rgba(8, 145, 178, 0.35), transparent 75%),
            linear-gradient(180deg, rgba(4, 6, 16, 0.88) 0%, rgba(2, 4, 12, 0.95) 100%);
          pointer-events: none;
          z-index: -3;
        }
        .cinematic-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.62) 100%),
            repeating-linear-gradient(
              110deg,
              rgba(255, 255, 255, 0.02) 0px,
              rgba(255, 255, 255, 0.02) 1px,
              transparent 1px,
              transparent 8px
            );
          opacity: 0.8;
          mix-blend-mode: soft-light;
          pointer-events: none;
          z-index: -2;
        }
        .floating-panel {
          position: relative;
          overflow: hidden;
        }
        .floating-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(125deg, rgba(255, 255, 255, 0.2), transparent 45%);
          opacity: 0.4;
          pointer-events: none;
        }
        .aurora-light {
          position: absolute;
          border-radius: 9999px;
          filter: blur(52px);
          animation: drift 16s ease-in-out infinite alternate;
          pointer-events: none;
        }
        .orbital-loop {
          animation: breathe 7s ease-in-out infinite;
        }
        .reveal-soft {
          animation: revealUp 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes drift {
          0% { transform: translate3d(-10px, 0, 0) scale(0.98); opacity: 0.75; }
          100% { transform: translate3d(16px, -14px, 0) scale(1.05); opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.72; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes revealUp {
          from { opacity: 0; transform: translate3d(0, 20px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-light,
          .orbital-loop,
          .reveal-soft {
            animation: none !important;
          }
        }
      `}</style>
      <div className="aurora-light -left-10 -top-16 h-64 w-64 bg-indigo-500/35" />
      <div className="aurora-light right-2 top-20 h-72 w-72 bg-fuchsia-500/20 [animation-delay:2s]" />
      <div className="aurora-light -bottom-16 right-10 h-72 w-72 bg-cyan-500/25 [animation-delay:4s]" />
      <div className="relative space-y-8">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
        <div className="reveal-soft">
          <p className="text-xs font-medium tracking-[0.22em] text-indigo-200/80">VERIFICATION EXPERIENCE</p>
          <h1
            className="mt-3 text-4xl font-semibold leading-[1.02] text-white sm:text-5xl xl:text-6xl"
            style={{ fontFamily: "ui-serif, Georgia, Cambria, Times New Roman, serif" }}
          >
            Command Center
            <span className="block bg-gradient-to-r from-cyan-200 via-indigo-200 to-fuchsia-200 bg-clip-text text-transparent">
              for Digital Trust
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            A cinematic lens into anomaly detection, verification confidence, and threat momentum across your identity pipeline.
          </p>
        </div>
        <div className={`${panelClass} reveal-soft p-5 [animation-delay:120ms]`}>
          <p className="text-xs tracking-[0.16em] text-slate-300">NOW MONITORING</p>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-white">{metrics.total.toLocaleString()}</p>
              <p className="text-sm text-slate-300">Live verifications in timeline</p>
            </div>
            <span className="orbital-loop rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-200/35">
              Stream Active
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr_1fr]">
        <div className={`${panelClass} reveal-soft p-6 [animation-delay:160ms]`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-slate-300">Verification Volume</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{metrics.total.toLocaleString()}</h2>
              <p className="mt-2 text-sm text-slate-400">Total verifications processed in current rolling window.</p>
            </div>
            <div className="rounded-xl bg-white/10 p-2.5 text-sky-100 ring-1 ring-white/15">
              <DashboardIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300 transition-all duration-500 ease-out" />
          </div>
        </div>

        <div className="reveal-soft [animation-delay:220ms]">
          <StatCard icon={<ShieldIcon className="h-6 w-6" />} label="Fakes Detected" value={metrics.fakes} delta="+6.8%" deltaPositive={false} />
        </div>
        <div className="reveal-soft [animation-delay:280ms]">
          <StatCard icon={<HistoryIcon className="h-6 w-6" />} label="Real Verified" value={metrics.reals} delta="+9.1%" />
        </div>
        <div className="reveal-soft [animation-delay:340ms]">
          <StatCard icon={<ReportsIcon className="h-6 w-6" />} label="High Risk Cases" value={metrics.highRisk} delta="+3.2%" deltaPositive={false} />
        </div>
        <div className="reveal-soft [animation-delay:400ms]">
          <StatCard icon={<FileIcon type="document" className="h-6 w-6" />} label="Reports Downloaded" value={metrics.reportsDownloaded} delta="+18.0%" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <LayoutCard className={`${panelClass} reveal-soft p-7 [animation-delay:420ms]`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-slate-300">Overall Threat Profile</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Composite Risk Gauge</h2>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${getRiskTone(metrics.fakeRiskPercent).chip}`}>
              {metrics.fakeRiskPercent}% fake risk
            </div>
          </div>
          <div className="mt-7">
            <Speedometer value={metrics.fakeRiskPercent} />
          </div>
        </LayoutCard>

        <LayoutCard className={`${panelClass} reveal-soft p-7 [animation-delay:500ms]`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-[0.14em] text-slate-300">Threat Severity</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Case Distribution</h2>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/15">Signal intensity</span>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
            {metrics.severity.map((item) => (
              <SeverityRing key={item.label} label={item.label} color={item.color} count={item.count} />
            ))}
          </div>
        </LayoutCard>
      </div>

      <LayoutCard className={`${panelClass} reveal-soft overflow-hidden [animation-delay:560ms]`}>
        <div className="flex flex-col gap-3 border-b border-white/10 px-7 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white">Recent Verifications</h2>
            <p className="mt-1 text-sm text-slate-300">Latest verification activity from `demo_org`.</p>
          </div>
          <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/15">
            Showing {recentItems.length} most recent checks
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-white/[0.04] text-xs tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-6 py-4">Candidate ID</th>
                <th className="px-6 py-4">Asset Type</th>
                <th className="px-6 py-4">Verdict</th>
                <th className="px-6 py-4">Risk Score</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentItems.map((item) => {
                const verdict = normalizeVerdict(item.verdict || item.prediction);
                const score = Math.round(clampNumber(item.risk_score));
                const riskTone = getRiskTone(score);

                return (
                  <tr key={item.verification_id} className="group bg-black/5 transition-all duration-300 ease-out hover:bg-white/[0.04]">
                    <td className="px-6 py-4 font-medium text-slate-100">{item.candidate_id || "Not provided"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sky-200 ring-1 ring-white/15 transition-all duration-300 ease-out group-hover:scale-[1.03]">
                          <FileIcon type={item.asset_type || item.type} className="h-5 w-5" />
                        </div>
                        <span className="capitalize text-slate-300">{item.asset_type || item.type || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><VerdictBadge verdict={verdict} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${riskTone.text}`}>{score}</span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full shadow-[0_0_12px_rgba(255,255,255,0.2)] transition-all duration-300 ease-out ${riskTone.bar}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{formatDateOnly(item.timestamp)}</td>
                    <td className="px-6 py-4 text-right">
                      <DownloadButton verificationId={item.verification_id} onClick={window.AsliUI.downloadReport} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LayoutCard>
      </div>
    </div>
  );
};
