/**
 * Generic error reporting utility.
 * Captures and logs errors to the console, and can be extended
 * to report to any monitoring/analytics service.
 */

export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  console.error("[ErrorReport]", { error, ...context });
}
