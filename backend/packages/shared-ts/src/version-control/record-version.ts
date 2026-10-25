import axios from 'axios';

export interface RecordVersionOptions {
  versionControlUrl: string;
  resourceType: string;
  resourceKey: string;
  snapshot: Record<string, unknown>;
  changedBy?: string;
}

/**
 * Fire-and-forget, like `logEvent` — a missed version snapshot is a real
 * loss (unlike a missed log line), but the actual update this call sits
 * next to must never fail *because* change-history is temporarily
 * unreachable. Call this right before persisting an update, with the
 * object's state as it was *before* the change (so the history reads as
 * "what did version N look like", not "what triggered it").
 */
export async function recordVersion(options: RecordVersionOptions): Promise<void> {
  const { versionControlUrl, ...payload } = options;
  try {
    await axios.post(`${versionControlUrl}/versions`, payload, { timeout: 2000 });
  } catch {
    // Intentionally silent — see doc comment above.
  }
}
