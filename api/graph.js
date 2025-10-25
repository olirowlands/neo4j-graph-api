// api/graph.js

// Add any origins you want to allow (include both www + non-www)
const ALLOW_ORIGINS = [
  "https://www.thetechcovenant.com",
  "https://thetechcovenant.com",
  // "https://neo4j-graph-api.vercel.app",
];

export default async function handler(req, res) {
  // ----- CORS -----
  const origin = req.headers.origin || "";
  if (ALLOW_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");

  if (req.method === "OPTIONS") {
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

  // read limit from querystring, clamp to max 1000
  const rawLimit = parseInt(req.query.limit || "1000", 10);
  const safeLimit = Math.min(isNaN(rawLimit) ? 1000 : rawLimit, 1000);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify({
        statement: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT $limit",
        parameters: { limit: safeLimit }
      })
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(r.status).json({
        upstream_status: r.status,
        upstream_body: text.slice(0, 4000)
      });
    }

    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: "Request failed", detail: e.message });
  }
}
