import { fetchWithTimeout, fetchWithRetry, returnFirst } from "./utils";

// Mock fetch globally
global.fetch = jest.fn();

// Helper to flush timers and microtasks
async function flushAllTimersAndPromises() {
  for (let i = 0; i < 20; i++) {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  }
}

describe("utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("fetchWithTimeout", () => {
    test("should return response when fetch succeeds", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await fetchWithTimeout("https://api.example.com", 5000);

      expect(fetch).toHaveBeenCalledWith("https://api.example.com", {
        headers: {
          "User-Agent": "RestakeBot/1.0",
          Accept: "application/json",
        },
      });
      expect(result).toBe(mockResponse);
    });

    test("should throw timeout error when request takes too long", async () => {
      (fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const promise = fetchWithTimeout("https://api.example.com", 5000);

      jest.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow("Request timeout");
    });

    test("should use default timeout of 5000ms", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      };
      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await fetchWithTimeout("https://api.example.com");

      expect(fetch).toHaveBeenCalledWith("https://api.example.com", {
        headers: {
          "User-Agent": "RestakeBot/1.0",
          Accept: "application/json",
        },
      });
    });

    test("should handle fetch errors", async () => {
      const error = new Error("Network error");
      (fetch as jest.Mock).mockRejectedValue(error);

      await expect(
        fetchWithTimeout("https://api.example.com", 5000)
      ).rejects.toThrow("Network error");
    });
  });

  describe("fetchWithRetry", () => {
    test("should return result on first successful attempt", async () => {
      const mockData = { success: true };
      const fetchFn = jest.fn().mockResolvedValue(mockData);

      const result = await fetchWithRetry(fetchFn, 3);

      expect(result).toBe(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    test("should retry and succeed on second attempt", async () => {
      const mockData = { success: true };
      const fetchFn = jest
        .fn()
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValue(mockData);

      const promise = fetchWithRetry(fetchFn, 3);
      await flushAllTimersAndPromises();
      const result = await promise;

      expect(result).toBe(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test("should use exponential backoff delays", async () => {
      const mockData = { success: true };
      const fetchFn = jest
        .fn()
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockRejectedValueOnce(new Error("Second attempt failed"))
        .mockResolvedValue(mockData);

      const promise = fetchWithRetry(fetchFn, 3);
      await flushAllTimersAndPromises();
      const result = await promise;

      expect(result).toBe(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    test("should throw error after max retries exceeded", async () => {
      const error = new Error("Persistent failure");
      const fetchFn = jest.fn().mockRejectedValue(error);

      const promise = fetchWithRetry(fetchFn, 2);
      await flushAllTimersAndPromises();
      await expect(promise).rejects.toThrow("Persistent failure");
      expect(fetchFn).toHaveBeenCalledTimes(3); // Initial + 2 retries (i <= retries)
    });

    test("should use default retry count of 5", async () => {
      const error = new Error("Persistent failure");
      const fetchFn = jest.fn().mockRejectedValue(error);

      const promise = fetchWithRetry(fetchFn);
      await flushAllTimersAndPromises();
      await expect(promise).rejects.toThrow("Persistent failure");
      expect(fetchFn).toHaveBeenCalledTimes(6); // Initial + 5 retries (i <= retries)
    });

    test("should handle custom retry count", async () => {
      const mockData = { success: true };
      const fetchFn = jest
        .fn()
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValue(mockData);

      const promise = fetchWithRetry(fetchFn, 1);
      await flushAllTimersAndPromises();
      const result = await promise;

      expect(result).toBe(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    test("should use last delay for retries beyond predefined delays", async () => {
      const mockData = { success: true };
      const fetchFn = jest.fn();
      for (let i = 0; i < 10; i++) {
        fetchFn.mockRejectedValueOnce(new Error("Attempt failed"));
      }
      fetchFn.mockResolvedValueOnce(mockData);

      const promise = fetchWithRetry(fetchFn, 10); // More retries than predefined delays
      await flushAllTimersAndPromises();
      const result = await promise;

      expect(result).toBe(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(11); // Initial + 10 retries (i <= retries)
    });
  });

  describe("returnFirst", () => {
    test("should return first successful result", async () => {
      const promises = [
        Promise.resolve("first"),
        Promise.resolve("second"),
        Promise.resolve("third"),
      ];

      const result = await returnFirst(promises);

      expect(result).toBe("first");
    });

    test("should return first successful result when some promises fail", async () => {
      const promises = [
        Promise.reject(new Error("First failed")),
        Promise.resolve("second"),
        Promise.reject(new Error("Third failed")),
      ];

      const result = await returnFirst(promises);

      expect(result).toBe("second");
    });

    test("should throw error when all promises fail", async () => {
      const promises = [
        Promise.reject(new Error("First failed")),
        Promise.reject(new Error("Second failed")),
        Promise.reject(new Error("Third failed")),
      ];

      await expect(returnFirst(promises)).rejects.toThrow(
        "No successful results"
      );
    });

    test("should handle empty array", async () => {
      await expect(returnFirst([])).rejects.toThrow("No successful results");
    });

    test("should handle single successful promise", async () => {
      const promises = [Promise.resolve("success")];

      const result = await returnFirst(promises);

      expect(result).toBe("success");
    });

    test("should handle single failed promise", async () => {
      const promises = [Promise.reject(new Error("Failed"))];

      await expect(returnFirst(promises)).rejects.toThrow(
        "No successful results"
      );
    });

    test("should work with different data types", async () => {
      const promises: Promise<any>[] = [
        Promise.resolve(42),
        Promise.resolve("string"),
        Promise.resolve({ key: "value" }),
      ];

      const result = await returnFirst(promises);

      expect(result).toBe(42);
    });

    test("should handle promises that resolve to null/undefined", async () => {
      const promises = [
        Promise.resolve(null),
        Promise.resolve(undefined),
        Promise.resolve("valid"),
      ];

      const result = await returnFirst(promises);

      expect(result).toBe(null);
    });
  });
});
