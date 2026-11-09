export function storeExperiencePolicy(
  companyId: string,
  enabled: boolean,
  rollout = "all",
  pilotCompanies = "",
) {
  const eligible =
    rollout === "all" ||
    (rollout === "pilot" &&
      pilotCompanies
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .includes(companyId));
  return {
    enabled: eligible && enabled,
    eligible,
    reason: !eligible
      ? rollout === "pilot"
        ? "PILOT_ONLY"
        : "GLOBAL_DISABLED"
      : enabled
        ? null
        : "COMPANY_DISABLED",
  };
}
