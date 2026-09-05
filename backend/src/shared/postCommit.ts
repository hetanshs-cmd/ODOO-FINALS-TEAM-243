/**
 * Runs a side effect that happens AFTER its triggering transaction has
 * already committed — sending a notification, refreshing a derived score.
 *
 * These used to be awaited bare, so a failure in a non-essential follow-up
 * surfaced as a 500 for an operation that had actually succeeded. The client
 * then retried and duplicated the work (a second allocation, a second
 * quotation line). The business state is already durable at this point, so
 * the only correct response to a failure here is to log it and carry on.
 *
 * Use this ONLY for effects that are genuinely optional. Anything that must
 * happen atomically with the write belongs inside the same withTransaction
 * block, not here.
 */
export async function runPostCommit(context: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[POST-COMMIT] ${context} side effect failed (state is already committed):`, err);
  }
}
