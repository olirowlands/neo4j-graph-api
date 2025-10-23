export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://<your-ghost-domain>");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch(process.env.NEO4J_QUERY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEO4J_QUERY_API_KEY}`
      },
      body: JSON.stringify({
        statements: [
          {
            cypher: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 200"
          }
        ]
      })
    });

    if (!response.ok) throw new Error(`Neo4j API error: ${response.status}`);
    const data = await response.json();

    // convert Neo4j's response format to your {nodes, edges} shape
    const nodes = new Map();
    const edges = [];

    for (const result of data.results || []) {
      for (const rec of result.data || []) {
        const row = rec.row;
        if (!row) continue;
        const [n, r, m] = row;
        if (n?.identity !== undefined) {
          nodes.set(n.identity, { id: n.identity, labels: n.labels, props: n.properties });
        }
        if (m?.identity !== undefined) {
          nodes.set(m.identity, { id: m.identity, labels: m.labels, props: m.properties });
        }
        if (r?.identity !== undefined) {
          edges.push({
            id: r.identity,
            type: r.type,
            from: r.start,
            to: r.end,
            props: r.properties
          });
        }
      }
    }

    res.status(200).json({ nodes: [...nodes.values()], edges });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}

