window.HistoryPage = function HistoryPage() {
  const {
    fetchVerifications,
    normalizeVerdict,
    normalizeConfidence,
    clampNumber,
    formatDateTime,
    getRiskTextTone,
    LayoutCard,
    SectionTitle,
    LoadingCard,
    ErrorCard,
    EmptyState,
    DownloadButton,
    VerdictBadge,
    SearchIcon,
  } = window.VerifyMeUI;

  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("ALL");

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchVerifications();
      setItems(data);
    } catch (err) {
      setError(err.message || "Unable to load history.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadHistory();
  }, []);

  const filteredItems = React.useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const verdict = normalizeVerdict(item.verdict || item.prediction);
      const matchesSearch = !query || String(item.candidate_id || "").toLowerCase().includes(query);
      const score = clampNumber(item.risk_score);

      if (!matchesSearch) return false;
      if (filter === "FAKE") return verdict === "FAKE";
      if (filter === "REAL") return verdict === "REAL";
      if (filter === "HIGH_RISK") return score > 70;
      return true;
    });
  }, [filter, items, search]);

  if (loading) {
    return <LoadingCard title="Loading verification history..." />;
  }

  if (error) {
    return <ErrorCard title="History unavailable" message={error} onRetry={loadHistory} />;
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="History"
        title="Verification Archive"
        subtitle="Search past cases, focus on fake or high-risk outcomes, and download reports for audit workflows."
      />

      <LayoutCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by candidate ID"
              className="w-full rounded-2xl border border-edge bg-[#0c141b] py-3 pl-12 pr-4 text-white outline-none transition placeholder:text-muted focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "ALL", label: "All" },
              { key: "FAKE", label: "Fake" },
              { key: "REAL", label: "Real" },
              { key: "HIGH_RISK", label: "High Risk" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === item.key ? "bg-accent text-[#08110d]" : "border border-edge bg-white/[0.03] text-muted hover:bg-white/[0.06]"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </LayoutCard>

      {!filteredItems.length ? (
        <EmptyState title="No matching verifications" subtitle="Try a different candidate search or switch the filter to view more archived results." />
      ) : (
        <LayoutCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.24em] text-muted">
                <tr>
                  <th className="px-6 py-4">Candidate ID</th>
                  <th className="px-6 py-4">Asset Type</th>
                  <th className="px-6 py-4">Verdict</th>
                  <th className="px-6 py-4">Risk Score</th>
                  <th className="px-6 py-4">Confidence</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4 text-right">Download PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {filteredItems.map((item) => {
                  const verdict = normalizeVerdict(item.verdict || item.prediction);
                  const score = Math.round(clampNumber(item.risk_score));
                  const confidence = Math.round(normalizeConfidence(item.confidence));

                  return (
                    <tr key={item.verification_id} className="bg-black/10 transition hover:bg-white/[0.03]">
                      <td className="px-6 py-4 font-semibold text-white">{item.candidate_id || "Not provided"}</td>
                      <td className="px-6 py-4 capitalize text-muted">{item.asset_type || item.type || "Unknown"}</td>
                      <td className="px-6 py-4"><VerdictBadge verdict={verdict} /></td>
                      <td className={`px-6 py-4 text-sm font-bold ${getRiskTextTone(score)}`}>{score}</td>
                      <td className="px-6 py-4 text-sm text-white">{confidence}%</td>
                      <td className="px-6 py-4 text-sm text-muted">{formatDateTime(item.timestamp)}</td>
                      <td className="px-6 py-4 text-right">
                        <DownloadButton verificationId={item.verification_id} onClick={window.VerifyMeUI.downloadReport} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </LayoutCard>
      )}
    </div>
  );
};
