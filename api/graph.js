import neo4j from "neo4j-driver";

let driver; // reused across invocations

export default async function handler(req, res) {
  // CORS: lock this to your Ghost domain
  res.setHeader("Access-Control-Allow-Origin", "https://<your-ghost-domain>");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (!driver) {
      driver = neo4j.driver(
        process.env.NEO4J_URI, // neo4j+s://<id>.databases.neo4j.io
        neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
      );
    }
    const session = driver.session({ defaultAccessMode: neo4j.session.READ });

    const limit = Math.min(parseInt(req.query.limit || "250", 10), 1000);
    const cypher = `
      MATCH (n)-[r]->(m)
      RETURN n, r, m
      LIMIT $limit
    `;
    const result = await session.run(cypher, { limit });

    const nodes = new Map();
    const edges = [];
    for (const rec of result.records) {
      const n = rec.get("n"), m = rec.get("m"), r = rec.get("r");
      nodes.set(n.identity.toString(), { id: n.identity.toString(), labels: n.labels, props: n.properties });
      nodes.set(m.identity.toString(), { id: m.identity.toString(), labels: m.labels, props: m.properties });
      edges.push({ id: r.identity.toString(), type: r.type, from: r.start.toString(), to: r.end.toString(), props: r.properties });
    }
    await session.close();

    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ nodes: [...nodes.values()], edges });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Query failed" });
  }
}
