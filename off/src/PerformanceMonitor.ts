/**
 * Performance monitoring utility for tracking execution times and checkpoints
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private checkpoints: Map<string, number> = new Map();

  /**
   * Start performance monitoring
   */
  start(): void {
    this.startTime = Date.now();
    this.checkpoints.clear();
  }

  /**
   * Add a checkpoint with a name
   * @param name - Name of the checkpoint
   */
  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now());
  }

  /**
   * Get the total duration since start
   * @returns Duration in milliseconds
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get the duration of a specific checkpoint
   * @param name - Name of the checkpoint
   * @returns Duration in milliseconds, or null if checkpoint doesn't exist
   */
  getCheckpointDuration(name: string): number | null {
    const checkpointTime = this.checkpoints.get(name);
    if (!checkpointTime) return null;
    return checkpointTime - this.startTime;
  }

  /**
   * Get all checkpoint durations
   * @returns Map of checkpoint names to durations
   */
  getAllCheckpointDurations(): Map<string, number> {
    const durations = new Map<string, number>();
    for (const [name, time] of this.checkpoints) {
      durations.set(name, time - this.startTime);
    }
    return durations;
  }

  /**
   * Log performance metrics to console (removed Discord dependency to avoid circular imports)
   */
  logPerformance(): void {
    const totalDuration = this.getDuration();
    console.log(`⏱️ Total execution time: ${totalDuration}ms`);

    for (const [name, time] of this.checkpoints) {
      const duration = time - this.startTime;
      console.log(`⏱️ ${name}: ${duration}ms`);
    }
  }

  /**
   * Get a formatted performance report
   * @returns Formatted string with all performance metrics
   */
  getPerformanceReport(): string {
    const totalDuration = this.getDuration();
    let report = `⏱️ Total execution time: ${totalDuration}ms\n`;

    for (const [name, time] of this.checkpoints) {
      const duration = time - this.startTime;
      report += `⏱️ ${name}: ${duration}ms\n`;
    }

    return report;
  }

  /**
   * Reset the performance monitor
   */
  reset(): void {
    this.startTime = Date.now();
    this.checkpoints.clear();
  }
}
