export default async function handler(req, res) {
  // During testing you can use "*"; later lock this to your Ghost domain.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);

  // Choose auth: if API key present -> Bearer; else fall back to Basic
  let authHeader = "";
  if (process.env.NEO4J_QUERY_API_KEY) {
    authHeader = `Bearer ${process.env.NEO4J_QUERY_API_KEY}`;
  } else if (process.env.NEO4J_USER && process.env.NEO4J_PASSWORD) {
    const b64 = Buffer.from(
      `${process.env.NEO4J_USER}:${process.env.NEO4J_PASSWORD}`
    ).toString("base64");
    authHeader = `Basic ${b64}`;
  }

  try {
    const r = await fetch(process.env.NEO4J_QUERY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {})
      },
      body: JSON.stringify({
        statement: `
          MATCH (n)-[r]->(m)
          RETURN n, r, m
          LIMIT $limit
        `,
        parameters: { limit }
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Neo4j API ${r.status}: ${txt}`);
    }

    const payload = await r.json();

    // Map Query API result to {nodes, edges}
    const nodes = new Map();
    const edges = [];

    const rows = payload?.data?.values || []; // Query API v2: { data: { fields, values } }
    for (const row of rows) {
      const [n, rel, m] = row;
      if (n?.identity !== undefined) {
        nodes.set(String(n.identity), {
          id: String(n.identity),
          labels: n.labels || [],
          props: n.properties || {}
        });
      }
      if (m?.identity !== undefined) {
        nodes.set(String(m.identity), {
          id: String(m.identity),
          labels: m.labels || [],
          props: m.properties || {}
        });
      }
      if (rel?.identity !== undefined) {
        edges.push({
          id: String(rel.identity),
          type: rel.type,
          from: String(rel.start),
          to: String(rel.end),
          props: rel.properties || {}
        });
      }
    }

    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ nodes: [...nodes.values()], edges });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Query failed", detail: e.message });
  }
}
