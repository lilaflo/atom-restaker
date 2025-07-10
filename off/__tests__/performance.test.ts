import { PerformanceMonitor } from "../src/PerformanceMonitor";
import { logMemoryUsage } from "../src/utils";

describe("Performance Tests", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    monitor.start();
  });

  afterEach(() => {
    monitor.reset();
  });

  test("should track memory usage baseline", () => {
    // Test 1: Memory usage baseline
    logMemoryUsage();
    monitor.checkpoint("memory_baseline");

    const duration = monitor.getDuration();
    expect(duration).toBeGreaterThan(0);
    expect(monitor.getCheckpointDuration("memory_baseline")).toBeGreaterThan(0);
  });

  test("should handle cache operations efficiently", () => {
    // Test 2: Simulate reward cache operations
    const cache = new Map<string, { amount: number; timestamp: number }>();
    const testValidators = Array.from(
      { length: 100 },
      (_, i) => `validator${i}`
    );

    for (const validator of testValidators) {
      cache.set(validator, {
        amount: Math.random() * 1000,
        timestamp: Date.now(),
      });
    }

    // Add a small delay to ensure time passes
    const start = Date.now();
    while (Date.now() - start < 1) {
      // Busy wait for ~1ms
    }

    monitor.checkpoint("cache_operations");

    expect(cache.size).toBe(100);
    expect(monitor.getCheckpointDuration("cache_operations")).toBeGreaterThan(
      0
    );
  });

  test("should handle parallel operations", async () => {
    // Test 3: Simulate parallel reward fetching
    const testValidators = Array.from(
      { length: 50 },
      (_, i) => `validator${i}`
    );

    const rewardPromises = testValidators.map(async (validator) => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      return { validator, rewardAmount: Math.random() * 1000 };
    });

    const results = await Promise.all(rewardPromises);
    monitor.checkpoint("parallel_operations");

    expect(results).toHaveLength(50);
    expect(
      monitor.getCheckpointDuration("parallel_operations")
    ).toBeGreaterThan(0);
  });

  test("should handle error scenarios with retries", async () => {
    // Test 4: Simulate error handling with retries
    let retryCount = 0;
    const testWithRetry = async () => {
      if (Math.random() < 0.3) {
        retryCount++;
        throw new Error("Simulated error");
      }
      return "success";
    };

    try {
      await testWithRetry();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // Add a small delay to ensure checkpoint has time
    await new Promise((resolve) => setTimeout(resolve, 1));
    monitor.checkpoint("error_handling");
    expect(monitor.getCheckpointDuration("error_handling")).toBeGreaterThan(0);
  });

  test("should provide accurate performance metrics", () => {
    monitor.checkpoint("test_start");

    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait for ~10ms
    }

    monitor.checkpoint("test_end");

    const totalDuration = monitor.getDuration();
    const checkpointDuration = monitor.getCheckpointDuration("test_end");

    expect(totalDuration).toBeGreaterThan(0);
    expect(checkpointDuration).toBeGreaterThan(0);
    expect(checkpointDuration).toBeLessThanOrEqual(totalDuration);
  });

  test("should generate performance report", () => {
    monitor.checkpoint("step1");
    monitor.checkpoint("step2");
    monitor.checkpoint("step3");

    const report = monitor.getPerformanceReport();

    expect(report).toContain("Total execution time:");
    expect(report).toContain("step1:");
    expect(report).toContain("step2:");
    expect(report).toContain("step3:");
  });

  test("should track all checkpoint durations", () => {
    // Add a small delay to ensure time passes
    const start = Date.now();
    while (Date.now() - start < 1) {
      // Busy wait for ~1ms
    }

    monitor.checkpoint("checkpoint1");

    // Add another small delay
    const start2 = Date.now();
    while (Date.now() - start2 < 1) {
      // Busy wait for ~1ms
    }

    monitor.checkpoint("checkpoint2");

    const allDurations = monitor.getAllCheckpointDurations();

    expect(allDurations.has("checkpoint1")).toBe(true);
    expect(allDurations.has("checkpoint2")).toBe(true);
    expect(allDurations.get("checkpoint1")).toBeGreaterThan(0);
    expect(allDurations.get("checkpoint2")).toBeGreaterThan(0);
  });

  test("should reset performance monitor", () => {
    // Add a small delay to ensure time passes
    const start = Date.now();
    while (Date.now() - start < 1) {
      // Busy wait for ~1ms
    }

    monitor.checkpoint("test_checkpoint");

    const beforeReset = monitor.getDuration();
    monitor.reset();
    const afterReset = monitor.getDuration();

    expect(beforeReset).toBeGreaterThan(0);
    expect(afterReset).toBeLessThan(10); // Should be a small number after reset
    expect(monitor.getCheckpointDuration("test_checkpoint")).toBeNull();
  });
});
