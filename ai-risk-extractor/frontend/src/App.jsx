import { useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [risks, setRisks] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [error, setError] = useState("");

  const upload = async () => {
    setError("");
    if (!content.trim()) {
      setError("Please paste some document text before uploading.");
      return;
    }
    setLoadingUpload(true);
    try {
      const res = await fetch(API_BASE + "/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      alert(`Stored. Chunks added: ${data.chunks_added}`);
    } catch (e) {
      console.error(e);
      setError("Upload failed. Check backend.");
    } finally {
      setLoadingUpload(false);
    }
  };

  const analyze = async () => {
    setError("");
    setRisks([]);
    setChecklist([]);
    if (!query.trim()) {
      setError("Please enter a query.");
      return;
    }
    setLoadingAnalyze(true);
    try {
      const res = await fetch(API_BASE + "/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      if (!res.ok) throw new Error("Analyze failed");
      const data = await res.json();
      setRisks(data.risks || []);
      setChecklist(data.checklist || []);
    } catch (e) {
      console.error(e);
      setError("Analyze failed. Check backend / LLM.");
    } finally {
      setLoadingAnalyze(false);
    }
  };

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>AI Risk Extractor & Checklist</h1>
      <p style={{ color: "#555", marginBottom: "1rem" }}>
        Paste policy / SOP text, store it in a local FAISS index, then ask questions and get risks + actions.
      </p>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>1. Upload document text</h2>
        <label style={{ display: "block", marginBottom: "0.25rem" }}>Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc", marginBottom: "0.5rem" }}
          placeholder="Example: Data Handling Policy"
        />
        <label style={{ display: "block", marginBottom: "0.25rem" }}>Document text</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={8}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc", fontFamily: "monospace" }}
          placeholder="Paste your policy or guideline text here..."
        />
        <button
          onClick={upload}
          disabled={loadingUpload}
          style={{ marginTop: "0.5rem", padding: "0.5rem 1rem", borderRadius: 4, border: "none", background: "#2563eb", color: "#fff" }}
        >
          {loadingUpload ? "Uploading..." : "Store in index"}
        </button>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>2. Ask a question</h2>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc", marginBottom: "0.5rem" }}
          placeholder="Example: What are the main risks and what should we do?"
        />
        <button
          onClick={analyze}
          disabled={loadingAnalyze}
          style={{ padding: "0.5rem 1rem", borderRadius: 4, border: "none", background: "#16a34a", color: "#fff" }}
        >
          {loadingAnalyze ? "Thinking..." : "Analyze"}
        </button>
      </section>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <section style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <div style={{ flex: 1, minWidth: 260, border: "1px solid #eee", borderRadius: 6, padding: "0.75rem" }}>
          <h3>Risks</h3>
          {risks.length === 0 ? (
            <p style={{ color: "#777" }}>No risks yet.</p>
          ) : (
            <ul>
              {risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 260, border: "1px solid #eee", borderRadius: 6, padding: "0.75rem" }}>
          <h3>Checklist</h3>
          {checklist.length === 0 ? (
            <p style={{ color: "#777" }}>No checklist yet.</p>
          ) : (
            <ul>
              {checklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
