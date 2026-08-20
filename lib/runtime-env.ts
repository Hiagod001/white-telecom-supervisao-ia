import { env } from "cloudflare:workers";

export type RuntimeEnv = Record<string, string | undefined>;

export function runtimeEnv(): RuntimeEnv {
  const bindings = env as unknown as RuntimeEnv;
  const nodeValues = typeof process !== "undefined" && process.env
    ? process.env as RuntimeEnv
    : {};
  return { ...nodeValues, ...bindings };
}
