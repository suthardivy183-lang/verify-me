window.VerifyPage = function VerifyPage() {
  const {
    ORG_ID,
    MAX_FILE_SIZE,
    normalizeVerdict,
    normalizeConfidence,
    clampNumber,
    riskLevelFromScore,
    normalizeSignals,
    postVerification,
    downloadReport,
    LayoutCard,
    SectionTitle,
    ErrorCard,
    VerdictBadge,
    RiskBadge,
    UploadIcon,
    FileIcon,
  } = window.VerifyMeUI;

  const [selectedFile, setSelectedFile] = React.useState(null);
  const [assetType, setAssetType] = React.useState("photo");
  const [orgId, setOrgId] = React.useState(ORG_ID);
  const [candidateId, setCandidateId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const [animatedProbability, setAnimatedProbability] = React.useState(0);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (!result) return;
    setAnimatedProbability(0);
    const probability = clampNumber(result.risk_score);
    const frame = window.requestAnimationFrame(() => setAnimatedProbability(probability));
    return () => window.cancelAnimationFrame(frame);
  }, [result]);

  function assignFile(file) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Please upload a file under 50 MB.");
      return;
    }

    setError("");
    setSelectedFile(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    assignFile(event.dataTransfer.files && event.dataTransfer.files[0]);
  }

  async function handleVerify() {
    if (!selectedFile) {
      setError("Please upload an asset before running verification.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("asset_type", assetType);
    formData.append("org_id", orgId);
    formData.append("candidate_id", candidateId.trim());

    try {
      const data = await postVerification(formData);
      setResult(data);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  const fakeProbability = result ? Math.round(clampNumber(result.risk_score)) : 0;
  const confidence = result ? Math.round(normalizeConfidence(result.confidence)) : 0;
  const riskLevel = result ? riskLevelFromScore(result.risk_score) : "SAFE";
  const verdict = result ? normalizeVerdict(result.verdict || result.prediction) : "UNCERTAIN";
  const signals = result ? normalizeSignals(result.signals) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <SectionTitle
        eyebrow="Verify New"
        title="Run a fresh AI verification"
        subtitle="Upload an image, video, or document, then review the verdict, fake probability, confidence score, and detailed detection signals inline."
      />

      <LayoutCard className="p-6 md:p-8">
        <div className="mx-auto max-w-3xl">
          <label
            className={`block cursor-pointer rounded-[32px] border-2 border-dashed p-8 text-center transition md:p-12 ${dragging ? "border-accent bg-accent/10" : "border-edge bg-white/[0.03] hover:border-accent/40 hover:bg-white/[0.05]"}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current && inputRef.current.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => {
                assignFile(event.target.files && event.target.files[0]);
                event.target.value = "";
              }}
            />

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 text-accent">
              {selectedFile ? <FileIcon type={assetType} className="h-8 w-8" /> : <UploadIcon className="h-8 w-8" />}
            </div>

            <h2 className="mt-6 text-2xl font-bold text-white">{selectedFile ? selectedFile.name : "Drag and drop your file here"}</h2>
            <p className="mt-3 text-sm text-muted">Accepts image, video, and document files. Click to browse if you prefer.</p>
            {selectedFile ? (
              <p className="mt-3 text-sm font-semibold text-emerald-300">{Math.round(selectedFile.size / 1024)} KB selected</p>
            ) : null}
          </label>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-muted">Asset Type</span>
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value)}
                className="w-full rounded-2xl border border-edge bg-[#0c141b] px-4 py-3 text-white outline-none transition focus:border-accent"
              >
                <option value="photo">Photo</option>
                <option value="video">Video</option>
                <option value="document">Document</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-muted">Organization ID</span>
              <select
                value={orgId}
                onChange={(event) => setOrgId(event.target.value)}
                className="w-full rounded-2xl border border-edge bg-[#0c141b] px-4 py-3 text-white outline-none transition focus:border-accent"
              >
                <option value="demo_org">demo_org</option>
              </select>
            </label>
          </div>

          <div className="mt-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-muted">Candidate ID</span>
              <input
                value={candidateId}
                onChange={(event) => setCandidateId(event.target.value)}
                placeholder="Enter candidate ID"
                className="w-full rounded-2xl border border-edge bg-[#0c141b] px-4 py-3 text-white outline-none transition placeholder:text-muted focus:border-accent"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleVerify}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-4 text-base font-bold text-[#08110d] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Analyzing with AI..." : "Run Verification"}
          </button>

          {loading ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-edge bg-white/[0.03] px-5 py-4 text-sm text-muted">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-edge border-t-accent" />
              <span>Analyzing with AI...</span>
            </div>
          ) : null}

          {error ? <div className="mt-6"><ErrorCard title="Verification failed" message={error} /></div> : null}

          {result ? (
            <div className="mt-8 space-y-6">
              <div className={`rounded-[28px] border p-6 ${verdict === "FAKE" ? "border-rose-500/20 bg-rose-500/10" : verdict === "REAL" ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-muted">Final Verdict</p>
                    <h2 className="mt-2 text-3xl font-extrabold text-white">{verdict}</h2>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <VerdictBadge verdict={verdict} />
                    <RiskBadge score={result.risk_score} label={riskLevel} />
                  </div>
                </div>
              </div>

              <LayoutCard className="p-6">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="flex items-center justify-between text-sm font-semibold text-muted">
                      <span>Fake Probability</span>
                      <span>{fakeProbability}%</span>
                    </div>
                    <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${fakeProbability >= 70 ? "bg-gradient-to-r from-orange-500 to-rose-500" : fakeProbability >= 40 ? "bg-gradient-to-r from-yellow-400 to-orange-400" : "bg-gradient-to-r from-emerald-400 to-teal-400"}`}
                        style={{ width: `${animatedProbability}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-edge bg-black/20 p-4">
                      <p className="text-sm text-muted">Confidence Score</p>
                      <p className="mt-2 text-2xl font-bold text-white">{confidence}%</p>
                    </div>
                    <div className="rounded-2xl border border-edge bg-black/20 p-4">
                      <p className="text-sm text-muted">Verification ID</p>
                      <p className="mt-2 break-all text-sm font-semibold text-white">{result.verification_id}</p>
                    </div>
                  </div>
                </div>
              </LayoutCard>

              <LayoutCard className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">Detection Signals</h3>
                    <p className="mt-1 text-sm text-muted">Color-coded output from the backend analysis pipeline.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadReport(result.verification_id)}
                    className="rounded-2xl border border-accent/20 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/20"
                  >
                    Download PDF Report
                  </button>
                </div>

                <div className="mt-6 grid gap-3">
                  {signals.length ? signals.map((signal) => {
                    const toneClass = signal.score == null
                      ? "bg-slate-400"
                      : signal.score >= 70
                        ? "bg-rose-400"
                        : signal.score >= 40
                          ? "bg-amber-400"
                          : "bg-emerald-400";

                    return (
                      <div key={signal.key} className="flex flex-col gap-3 rounded-2xl border border-edge bg-black/20 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`h-3 w-3 rounded-full ${toneClass}`} />
                          <div>
                            <p className="font-semibold text-white">{signal.label}</p>
                            {signal.value ? <p className="text-sm text-muted">{signal.value}</p> : null}
                          </div>
                        </div>
                        {signal.score != null ? (
                          <span className="text-sm font-bold text-white">{Math.round(signal.score)}%</span>
                        ) : null}
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-muted">No detailed signals were returned for this verification.</p>
                  )}
                </div>
              </LayoutCard>
            </div>
          ) : null}
        </div>
      </LayoutCard>
    </div>
  );
};
