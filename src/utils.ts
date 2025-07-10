export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 5000
): Promise<any> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
  });

  const fetchPromise = fetch(url, {
    headers: {
      "User-Agent": "RestakeBot/1.0",
      Accept: "application/json",
    },
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

const RETRY_DELAYS = [1000, 2000, 3000, 4000, 5000];
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  retries: number = 5
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (i === retries) throw error;

      const delay = RETRY_DELAYS[i] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function returnFirst<T>(promises: Promise<T>[]): Promise<T> {
  const results = await Promise.allSettled(promises);
  const firstSuccess = results.find((result) => result.status === "fulfilled");
  if (!firstSuccess) {
    throw new Error("No successful results");
  }
  return firstSuccess.value;
}
