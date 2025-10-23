export default async function handler(req, res) {
  // Lock this to your Ghost domain once you’ve tested it.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // allow ?limit= to tweak size
  const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);

  try {
    const r = await fetch(process.env.NEO4J_QUERY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEO4J_QUERY_API_KEY}`,
      },
      body: JSON.stringify({
        statements: [
          {
            cypher: `
              MATCH (n)-[r]->(m)
              RETURN n, r, m
              LIMIT $limit
            `,
            parameters: { limit }
          }
        ]
      })
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`Neo4j API ${r.status}: ${text}`);
    }

    const payload = await r.json();

    // Convert Query API v2 response → {nodes, edges}
    const nodes = new Map();
    const edges = [];

    for (const result of payload.results || []) {
      for (const rec of result.data || []) {
        const row = rec.row || [];
        const [n, rel, m] = row;

        if (n && n.identity !== undefined) {
          nodes.set(String(n.identity), {
            id: String(n.identity),
            labels: n.labels || [],
            props: n.properties || {}
          });
        }
        if (m && m.identity !== undefined) {
          nodes.set(String(m.identity), {
            id: String(m.identity),
            labels: m.labels || [],
            props: m.properties || {}
          });
        }
        if (rel && rel.identity !== undefined) {
          edges.push({
            id: String(rel.identity),
            type: rel.type,
            from: String(rel.start),
            to: String(rel.end),
            props: rel.properties || {}
          });
        }
      }
    }

    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ nodes: [...nodes.values()], edges });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Query failed", detail: e.message });
  }
}

