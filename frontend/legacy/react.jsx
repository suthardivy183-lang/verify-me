import React, { useEffect, useState } from "react";

export default function App() {
  const [currentPage, setCurrentPage] = useState("upload");
  const [file, setFile] = useState(null);
  const [assetType, setAssetType] = useState("video");
  const [candidateId, setCandidateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const API_BASE = "http://127.0.0.1:8000";

  useEffect(() => {
    if (currentPage !== "history") return;

    async function loadHistory() {
      setHistoryLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/verifications?org_id=demo_org`
        );

        if (!response.ok) {
          throw new Error("Failed to load verification history");
        }

        const data = await response.json();
        setHistory(data);
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setHistoryLoading(false);
      }
    }

    loadHistory();
  }, [currentPage]);

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }

  function handleDrop(event) {
    event.preventDefault();

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  }

  async function runVerification() {
    if (!file) {
      setError("Please choose a file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("asset_type", assetType);
    formData.append("candidate_id", candidateId);
    formData.append("org_id", "demo_org");

    try {
      const response = await fetch(`${API_BASE}/api/verify`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Verification failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function downloadReport(verificationId) {
    try {
      const response = await fetch(`${API_BASE}/api/report/${verificationId}`);

      if (!response.ok) {
        throw new Error("Failed to download report");
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
    } catch (err) {
      setError(err.message || "Report download failed");
    }
  }

  function VerdictText({ verdict, size = 24 }) {
    const color = verdict === "LIKELY FAKE" ? "var(--danger)" : "var(--success)";

    return (
      <span style={{ color, fontWeight: 800, fontSize: size }}>
        {verdict || "UNKNOWN"}
      </span>
    );
  }

  function Spinner() {
    return (
      <svg
        width="28"
        height="28"
        viewBox="0 0 50 50"
        style={{ display: "block" }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="var(--border)"
          strokeWidth="5"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="80 60"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 25 25"
            to="360 25 25"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    );
  }

  const styles = {
    app: {
      "--bg": "#f7f8fb",
      "--surface": "#ffffff",
      "--text": "#172033",
      "--muted": "#667085",
      "--border": "#d8deea",
      "--accent": "#315efb",
      "--accentDark": "#2246bd",
      "--danger": "#d92d20",
      "--success": "#12805c",
      "--amber": "#b76e00",
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    nav: {
      height: 68,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 32px",
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
    },
    logo: {
      fontSize: 22,
      fontWeight: 900,
      letterSpacing: 0,
    },
    navLinks: {
      display: "flex",
      gap: 12,
    },
    navButton: {
      border: "none",
      background: "transparent",
      color: "var(--muted)",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      padding: "10px 12px",
    },
    navButtonActive: {
      color: "var(--accent)",
    },
    main: {
      width: "min(980px, calc(100% - 32px))",
      margin: "0 auto",
      padding: "36px 0",
    },
    panel: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 24,
    },
    h2: {
      margin: "0 0 22px",
      fontSize: 28,
      letterSpacing: 0,
    },
    dropZone: {
      border: "2px dashed var(--border)",
      borderRadius: 8,
      padding: 34,
      textAlign: "center",
      background: "#fbfcff",
      cursor: "pointer",
      marginBottom: 20,
    },
    dropText: {
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 6,
    },
    muted: {
      color: "var(--muted)",
      fontSize: 14,
    },
    fieldGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 16,
      marginBottom: 20,
    },
    label: {
      display: "block",
      fontSize: 13,
      color: "var(--muted)",
      fontWeight: 700,
      marginBottom: 7,
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "12px 13px",
      fontSize: 15,
      color: "var(--text)",
      background: "var(--surface)",
    },
    button: {
      border: "none",
      borderRadius: 8,
      padding: "12px 16px",
      color: "#ffffff",
      background: "var(--accent)",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
    },
    secondaryButton: {
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "9px 12px",
      color: "var(--text)",
      background: "var(--surface)",
      fontSize: 14,
      fontWeight: 800,
      cursor: "pointer",
    },
    error: {
      color: "var(--danger)",
      fontWeight: 700,
      marginTop: 16,
    },
    resultCard: {
      marginTop: 24,
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 22,
      background: "#ffffff",
    },
    resultTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      flexWrap: "wrap",
      marginBottom: 20,
    },
    score: {
      fontSize: 42,
      lineHeight: 1,
      fontWeight: 900,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      background: "var(--surface)",
    },
    th: {
      textAlign: "left",
      borderBottom: "1px solid var(--border)",
      color: "var(--muted)",
      fontSize: 13,
      padding: "12px 10px",
    },
    td: {
      borderBottom: "1px solid var(--border)",
      padding: "12px 10px",
      fontSize: 14,
      verticalAlign: "middle",
    },
  };

  return (
    <div style={styles.app}>
      <nav style={styles.nav}>
        <div style={styles.logo}>Asli</div>

        <div style={styles.navLinks}>
          <button
            type="button"
            onClick={() => setCurrentPage("upload")}
            style={{
              ...styles.navButton,
              ...(currentPage === "upload" ? styles.navButtonActive : {}),
            }}
          >
            Verify
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage("history")}
            style={{
              ...styles.navButton,
              ...(currentPage === "history" ? styles.navButtonActive : {}),
            }}
          >
            History
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        {currentPage === "upload" && (
          <section style={styles.panel}>
            <h2 style={styles.h2}>Verify an Identity</h2>

            <label
              style={styles.dropZone}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="video/*,image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div style={styles.dropText}>
                {file ? file.name : "Drop a file here or click to upload"}
              </div>

              <div style={styles.muted}>Accepts video and image files</div>
            </label>

            <div style={styles.fieldGrid}>
              <div>
                <label style={styles.label}>Asset Type</label>
                <select
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value)}
                  style={styles.input}
                >
                  <option value="video">video</option>
                  <option value="photo">photo</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Candidate ID (optional)</label>
                <input
                  value={candidateId}
                  onChange={(event) => setCandidateId(event.target.value)}
                  placeholder="Candidate ID"
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={runVerification}
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Run Verification
            </button>

            {loading && (
              <div style={{ marginTop: 18 }}>
                <Spinner />
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}

            {result && (
              <div style={styles.resultCard}>
                <div style={styles.resultTop}>
                  <div>
                    <VerdictText verdict={result.verdict} size={30} />
                    <div style={{ ...styles.muted, marginTop: 6 }}>
                      Verification ID: {result.verification_id}
                    </div>
                  </div>

                  <div>
                    <div style={styles.score}>{result.risk_score}</div>
                    <div style={styles.muted}>Risk Score</div>
                  </div>
                </div>

                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Signal</th>
                      <th style={styles.th}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.signals || {}).map(([key, value]) => (
                      <tr key={key}>
                        <td style={styles.td}>{key}</td>
                        <td style={styles.td}>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  type="button"
                  onClick={() => downloadReport(result.verification_id)}
                  style={{ ...styles.secondaryButton, marginTop: 18 }}
                >
                  Download Report
                </button>
              </div>
            )}
          </section>
        )}

        {currentPage === "history" && (
          <section style={styles.panel}>
            <h2 style={styles.h2}>Verification History</h2>

            {historyLoading && <Spinner />}

            {error && <div style={styles.error}>{error}</div>}

            {!historyLoading && (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Candidate ID</th>
                    <th style={styles.th}>Asset Type</th>
                    <th style={styles.th}>Verdict</th>
                    <th style={styles.th}>Risk Score</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Report</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item) => (
                    <tr key={item.verification_id}>
                      <td style={styles.td}>{item.candidate_id || "-"}</td>
                      <td style={styles.td}>{item.asset_type || "-"}</td>
                      <td style={styles.td}>
                        <VerdictText verdict={item.verdict} size={14} />
                      </td>
                      <td style={styles.td}>{item.risk_score}</td>
                      <td style={styles.td}>{item.timestamp || "-"}</td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() => downloadReport(item.verification_id)}
                          style={styles.secondaryButton}
                        >
                          Report
                        </button>
                      </td>
                    </tr>
                  ))}

                  {history.length === 0 && (
                    <tr>
                      <td style={styles.td} colSpan="6">
                        No verifications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
