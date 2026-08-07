export function isRequestAbort(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 4; depth += 1) {
    if (current instanceof Error) {
      const code = "code" in current ? String(current.code) : "";
      if (current.name === "AbortError" || current.message === "aborted" || code === "ECONNRESET") {
        return true;
      }
      current = current.cause;
      continue;
    }

    if (current && typeof current === "object" && "cause" in current) {
      current = (current as { cause?: unknown }).cause;
      continue;
    }

    break;
  }

  return false;
}