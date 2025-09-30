export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 5000
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RestakeBot/1.0",
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  }
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
  if (promises.length === 0) {
    throw new Error("No successful results");
  }

  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    const errors: Error[] = [];

    promises.forEach((promise) => {
      promise
        .then((value) => resolve(value))
        .catch((error) => {
          errors.push(error);
          rejectedCount++;
          if (rejectedCount === promises.length) {
            reject(new Error("No successful results"));
          }
        });
    });
  });
}
