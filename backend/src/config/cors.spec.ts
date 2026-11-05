import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Controller, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createCorsOptions } from "./cors";

@Controller("auth")
class CorsTestController {
  @Post("login")
  login(): { ok: boolean } {
    return { ok: true };
  }
}

test("login permite el dominio ventas y rechaza otros orígenes con 403, no 500", async () => {
  const module = await Test.createTestingModule({
    controllers: [CorsTestController],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  const blocked: string[] = [];
  app.enableCors(
    createCorsOptions("https://configured.example", (origin) => blocked.push(origin)),
  );
  try {
    await app.listen(0, "127.0.0.1");
    const url = `${await app.getUrl()}/auth/login`;
    for (const origin of [
      "https://ventas.qorium-investment.qpon",
      "https://sistema-de-ventas-frontend-seven.vercel.app",
      "https://configured.example",
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(
        response.headers.get("access-control-allow-credentials"),
        "true",
      );
      await response.arrayBuffer();
    }
    const rejected = await fetch(url, {
      method: "POST",
      headers: {
        Origin: "https://ventas.qorium-investment.qpon.attacker.test",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(blocked, [
      "https://ventas.qorium-investment.qpon.attacker.test",
    ]);
    await rejected.arrayBuffer();
  } finally {
    await app.close();
  }
});
