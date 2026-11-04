import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleTokenVerifier } from "./google-token.verifier";

describe("GoogleTokenVerifier", () => {
  it("rechaza el login cuando falta GOOGLE_CLIENT_ID", async () => {
    const verifier = new GoogleTokenVerifier(new ConfigService({}));

    await assert.rejects(
      () => verifier.verify("credential"),
      ServiceUnavailableException,
    );
  });
});
