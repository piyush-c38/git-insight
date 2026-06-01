export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function yieldEvery<T>(
  items: T[],
  batchSize: number,
  handler: (item: T, index: number) => Promise<void> | void
): Promise<void> {
  for (let index = 0; index < items.length; index += 1) {
    await handler(items[index], index);
    if ((index + 1) % batchSize === 0) {
      await yieldToEventLoop();
    }
  }
}
