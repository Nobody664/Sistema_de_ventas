import { z } from "zod";

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

const rawSessionUserSchema = z
  .object({
    id: z.string().min(1).optional(),
    sub: z.string().min(1).optional(),
    email: z.string().email(),
    fullName: nullableString,
    roles: z.array(z.string().min(1)),
    companyId: z
      .string()
      .min(1)
      .nullish()
      .transform((value) => value ?? null),
    companyStatus: nullableString,
    planCode: nullableString,
    subscriptionStatus: nullableString,
    trialEndsAt: nullableString,
  })
  .refine((value) => Boolean(value.id ?? value.sub), {
    message: "La sesión no incluye un identificador de usuario",
    path: ["id"],
  });

export const sessionUserSchema = rawSessionUserSchema.transform((value) => ({
  id: value.id ?? (value.sub as string),
  email: value.email,
  fullName: value.fullName,
  roles: value.roles,
  companyId: value.companyId,
  companyStatus: value.companyStatus,
  planCode: value.planCode,
  subscriptionStatus: value.subscriptionStatus,
  trialEndsAt: value.trialEndsAt,
}));

export type SessionUser = z.infer<typeof sessionUserSchema>;

export class SessionContractError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; ") || "Contrato de sesión inválido");
    this.name = "SessionContractError";
  }
}

export function parseSessionUser(input: unknown): SessionUser {
  const result = sessionUserSchema.safeParse(input);

  if (!result.success) {
    throw new SessionContractError(
      result.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      }),
    );
  }

  return result.data;
}

export function sessionScope(user: SessionUser | null): string {
  if (!user) return "anonymous";
  const roles = [...user.roles].sort().join(",");
  return `${user.companyId ?? "platform"}:${user.id}:${roles}`;
}
