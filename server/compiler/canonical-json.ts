import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function compileJsonArtifact(value: unknown) {
  const canonical = canonicalJson(value);
  const bytes = Buffer.from(canonical, "utf8");
  return {
    payload: JSON.parse(canonical) as unknown,
    artifact: gzipSync(bytes, { level: 9 }),
    sha256: createHash("sha256").update(bytes).digest(),
    sha256Hex: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.byteLength,
  };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}
