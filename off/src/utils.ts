// Re-export classes from their separate files for backward compatibility
export { PerformanceMonitor } from "./PerformanceMonitor";
export { ErrorHandler } from "./ErrorHandler";
export { Validator } from "./Validator";

// Import Validator for internal use
import { Validator } from "./Validator";

// German number formatting utility
export function formatNumberDE(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

// Configuration validation (moved to Validator class, keeping for backward compatibility)
export function validateConfig(config: Record<string, any>): void {
  const missing = Validator.getMissingFields(config);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  }
}

// Memory usage monitoring
export function logMemoryUsage(): void {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };

  console.log(`Memory usage:`, memUsageMB);
}
