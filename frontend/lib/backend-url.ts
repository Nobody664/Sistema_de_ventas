export const BACKEND_URL = (
  process.env.BACKEND_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

export const BACKEND_API_URL = process.env.BACKEND_URL
  ? `${BACKEND_URL}/api`
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(
      /\/$/,
      "",
    );
