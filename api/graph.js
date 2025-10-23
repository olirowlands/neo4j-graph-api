// api/graph.js

// Add any origins you want to allow (include both www + non-www)
const ALLOW_ORIGINS = [
  "https://www.thetechcovenant.com",
  "https://thetechcovenant.com",
  // "https://neo4j-graph-api.vercel.app", // <- optionally allow your prod domain for testing
  // "https://neo4j-graph-*.vercel.app"    // <- wildcards aren't supported; add specific preview URL if needed
];

export default async function handler(req, res) {
  // ----- CORS -----
  const origin = req.headers.origin || "";
  if (ALLOW_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin); // echo exact origin
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");

  if (req.method === "OPTIONS") {
    // Preflight OK (no body)
    res.status(204).end();
    return;
  }

  // ----- Env & Auth -----
  const url  = process.env.NEO4J_QUERY_API_URL;
  const user = process.env.NEO4J_USER;
  const pass = process.env.NEO4J_PASSWORD;

  if (!url || !user || !pass) {
    return res.status(500).json({
      error: "Missing environment variables",
      hint: "Set NEO4J_QUERY_API_URL, NEO4J_USER, NEO4J_PASSWORD in Vercel (Production), then redeploy."
    });
  }

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");

  try {
    // ----- Query API call -----
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify({
        statement: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 5"
        // If you want to make limit dynamic from ?limit=, switch to:
        // statement: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT $limit",
        // parameters: { limit: Math.min(parseInt(req.query.limit || "5", 10), 1000) }
      })
    });

    const text = await r.text();

    if (!r.ok) {
      // Surface upstream error for quick debugging
      return res.status(r.status).json({
        upstream_status: r.status,
        upstream_body: text.slice(0, 4000)
      });
    }

    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).send(text); // already JSON
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: e.message });
  }
}

