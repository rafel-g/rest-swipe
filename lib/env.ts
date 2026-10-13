import { z } from "zod";

const schema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().min(1, "GOOGLE_MAPS_API_KEY is missing from .env.local"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is missing from .env.local"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL is missing or not a URL in .env.local"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local"),
});

type Env = z.infer<typeof schema>;

/** Read one required env var, failing with a readable message. Lazy so builds work without secrets. */
export function env<K extends keyof Env>(key: K): Env[K] {
  const result = schema.shape[key].safeParse(process.env[key]);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? `${key} is invalid`);
  }
  return result.data as Env[K];
}
