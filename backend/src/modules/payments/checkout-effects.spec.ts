import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrismaService } from "@/database/prisma/prisma.service";
import { CheckoutRequestsService } from "./checkout-requests.service";

const imageBase64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";

function fixture(failOutbox = false) {
  const state = { status: "DRAFT", image: "", events: 0 };
  const tx = {
    checkoutRequest: {
      findFirst: async () => ({
        id: "checkout",
        companyId: "company",
        status: state.status,
        proofImageBase64: state.image,
      }),
      updateMany: async ({
        data,
      }: {
        data: { status: string; proofImageBase64: string };
      }) => {
        state.status = data.status;
        state.image = data.proofImageBase64;
        return { count: 1 };
      },
    },
    outboxEvent: {
      upsert: async () => {
        if (failOutbox) throw new Error("outbox write failed");
        state.events++;
      },
    },
  };
  const prisma = {
    $transaction: async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = { ...state };
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
  } as unknown as PrismaService;
  return {
    state,
    service: new CheckoutRequestsService(
      prisma,
      {
        sendPaymentProofReceived: async () => {
          throw new Error("SMTP unavailable");
        },
      } as never,
      {} as never,
    ),
  };
}

describe("Checkout durable submission", () => {
  it("commits submission despite unavailable SMTP and does not enqueue duplicate work on retry", async () => {
    const value = fixture();
    assert.deepEqual(
      await value.service.submitProof("checkout", "company", { imageBase64 }),
      { requestId: "checkout", status: "SUBMITTED" },
    );
    await value.service.submitProof("checkout", "company", { imageBase64 });
    assert.equal(value.state.events, 1);
    assert.equal(value.state.status, "SUBMITTED");
  });
  it("does not commit a submission if its durable event cannot be stored", async () => {
    const value = fixture(true);
    await assert.rejects(
      value.service.submitProof("checkout", "company", { imageBase64 }),
      /outbox write failed/,
    );
    assert.deepEqual(value.state, { status: "DRAFT", image: "", events: 0 });
  });
});
