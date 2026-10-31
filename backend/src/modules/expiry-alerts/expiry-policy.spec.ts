import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateProductDto } from "@/modules/products/dto/product.dto";
import { expiryState, subtractCalendarMonths, validateExpiryPolicy } from "./expiry-policy";

describe("Product expiry calendar and policy", () => {
  it("warns three calendar months before long-life goods expire, including clamped month ends", () => {
    const policy = validateExpiryPolicy("LONG_LIFE");
    assert.equal(subtractCalendarMonths("2027-05-31", 3), "2027-02-28");
    assert.equal(subtractCalendarMonths("2028-05-31", 3), "2028-02-29");
    assert.equal(expiryState(policy, "2027-05-31", "America/Lima", new Date("2027-02-28T05:00:00Z")).stage, "EARLY");
    assert.equal(expiryState(policy, "2027-05-31", "America/Lima", new Date("2027-02-28T04:59:59Z")).stage, null);
  });
  it("distinguishes perishable, standard and custom windows", () => {
    const now = new Date("2026-10-31T15:00:00Z");
    assert.equal(expiryState(validateExpiryPolicy("PERISHABLE"), "2026-11-04", "America/Lima", now).stage, null);
    assert.equal(expiryState(validateExpiryPolicy("STANDARD"), "2026-11-04", "America/Lima", now).stage, "URGENT");
    assert.equal(expiryState(validateExpiryPolicy("CUSTOM", 45), "2026-12-15", "America/Lima", now).stage, "EARLY");
    assert.equal(expiryState(validateExpiryPolicy("CUSTOM", 44), "2026-12-15", "America/Lima", now).stage, null);
  });
  it("uses the company's civil day while preserving the label's date instead of shifting midnight UTC", () => {
    const policy = validateExpiryPolicy("STANDARD");
    const now = new Date("2026-11-01T04:30:00Z");
    assert.equal(expiryState(policy, "2026-10-31T00:00:00Z", "America/Lima", now).stage, "TODAY");
    assert.equal(expiryState(policy, "2026-10-31T00:00:00Z", "Asia/Tokyo", now).stage, "EXPIRED");
    assert.equal(expiryState(policy, "2026-10-31", "America/Lima", now).daysLeft, 0);
  });
  it("does not mistake a 25-hour DST day for a second elapsed calendar day", () => {
    const state = expiryState(validateExpiryPolicy("STANDARD"), "2026-11-02", "America/New_York", new Date("2026-11-01T05:30:00Z"));
    assert.equal(state.daysLeft, 1);
  });
  it("keeps early reminders in the same calendar week and daily reminders stable within a civil day", () => {
    const policy = validateExpiryPolicy("LONG_LIFE");
    assert.equal(expiryState(policy, "2027-01-31", "America/Lima", new Date("2026-11-02T15:00:00Z")).reminderKey, expiryState(policy, "2027-01-31", "America/Lima", new Date("2026-11-08T15:00:00Z")).reminderKey);
    assert.notEqual(expiryState(policy, "2027-01-31", "America/Lima", new Date("2026-11-08T15:00:00Z")).reminderKey, expiryState(policy, "2027-01-31", "America/Lima", new Date("2026-11-09T15:00:00Z")).reminderKey);
    assert.equal(expiryState(policy, "2026-10-30", "America/Lima", new Date("2026-10-31T12:00:00Z")).reminderKey, "day:2026-10-31");
  });
  it("rejects invalid custom policies and leaves undated goods unclassified", async () => {
    for (const days of [undefined, null, 0, -1, 1.5, 3651]) assert.throws(() => validateExpiryPolicy("CUSTOM", days), BadRequestException);
    assert.throws(() => validateExpiryPolicy("LONG_LIFE", 3), BadRequestException);
    assert.equal(expiryState(validateExpiryPolicy("STANDARD"), null, "America/Lima").stage, null);
    for (const body of [{ expiryProfile: "GUESS" }, { expiryProfile: null }, { expiryWarningDays: 0 }, { expiryWarningDays: "90" }]) assert.ok((await validate(plainToInstance(UpdateProductDto, body), { whitelist: true, forbidNonWhitelisted: true })).length);
  });
});
