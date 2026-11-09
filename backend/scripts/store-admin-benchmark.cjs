const { PGlite } = require("@electric-sql/pglite");
const { performance } = require("node:perf_hooks");

async function main() {
  const started = performance.now();
  const db = new PGlite();
  try {
    await db.waitReady;
    const initializationMs = performance.now() - started;
    await db.exec(`CREATE TABLE store_orders(id TEXT PRIMARY KEY, company_id TEXT NOT NULL, account_id TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL, payment_status TEXT NOT NULL, fulfillment TEXT NOT NULL);
      INSERT INTO store_orders SELECT 'order-' || lpad(n::text,8,'0'), 'company-' || (n % 10), 'account-' || (n % 1000), timestamp '2026-01-01' + n * interval '1 minute', 'PENDING', 'UNFULFILLED' FROM generate_series(1,100000) n;
      CREATE INDEX existing_account_index ON store_orders(company_id,account_id,created_at);
      ANALYZE store_orders;`);
    const sql =
      "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,created_at,payment_status,fulfillment FROM store_orders WHERE company_id='company-3' ORDER BY created_at DESC,id DESC LIMIT 31";
    const measure = async () => {
      const plans = [];
      for (let sample = 0; sample < 6; sample++) {
        const result = await db.query(sql);
        const plan = result.rows[0]["QUERY PLAN"][0];
        plans.push(plan);
      }
      const warm = plans
        .slice(1)
        .map((plan) => plan["Execution Time"])
        .sort((a, b) => a - b);
      return {
        firstExecutionMs: plans[0]["Execution Time"],
        warmMedianMs: warm[2],
        plan: plans[0].Plan,
      };
    };
    const baseline = await measure();
    const indexStart = performance.now();
    await db.exec(
      "CREATE INDEX candidate_inbox_index ON store_orders(company_id,created_at DESC,id DESC); ANALYZE store_orders;",
    );
    const indexBuildMs = performance.now() - indexStart;
    const candidate = await measure();
    console.log(
      JSON.stringify(
        {
          environment:
            "PostgreSQL embebido/PGlite, datos sinteticos, no produccion",
          rows: 100000,
          companies: 10,
          pageSize: 31,
          initializationMs,
          indexBuildMs,
          baseline,
          candidate,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
