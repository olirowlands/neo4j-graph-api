// api/graph.js
export default async function handler(req, res) {
  // Allow testing from anywhere; later change * to your Ghost domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // --- Build Basic Auth header from env vars ---
  const url = process.env.NEO4J_QUERY_API_URL;
  const user = process.env.NEO4J_USER;
  const pass = process.env.NEO4J_PASSWORD;

  if (!url || !user || !pass) {
    return res.status(500).json({
      error: "Missing environment variables",
      hint: "Set NEO4J_QUERY_API_URL, NEO4J_USER, NEO4J_PASSWORD in Vercel"
    });
  }

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");

  try {
    // --- Make the Query API call ---
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json"
      },
      body: JSON.stringify({
        statement: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 5"
      })
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(r.status).json({
        upstream_status: r.status,
        upstream_body: text.slice(0, 4000)
      });
    }

    const data = JSON.parse(text);
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Request failed", detail: e.message });
  }
}
