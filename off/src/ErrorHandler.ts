/**
 * Error handling utilities with retry logic and error categorization
 */
export class ErrorHandler {
  /**
   * Execute an operation with retry logic and exponential backoff
   * @param operation - The operation to execute
   * @param maxRetries - Maximum number of retry attempts
   * @param delayMs - Base delay in milliseconds
   * @returns Promise that resolves with the operation result
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError!;
  }

  /**
   * Check if an error is retryable based on common retryable error patterns
   * @param error - The error to check
   * @returns true if the error is retryable
   */
  static isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const retryableMessages = [
      "timeout",
      "network",
      "connection",
      "rate limit",
      "temporary",
      "temporarily unavailable",
      "service unavailable",
      "bad gateway",
      "gateway timeout",
      "econnreset",
      "econnrefused",
      "enetunreach",
      "ehostunreach",
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableMessages.some((msg) => errorMessage.includes(msg));
  }

  /**
   * Get a user-friendly error message
   * @param error - The error to format
   * @returns Formatted error message
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Get error context for debugging
   * @param error - The error to analyze
   * @returns Object with error context information
   */
  static getErrorContext(error: unknown): {
    message: string;
    isRetryable: boolean;
    stack?: string;
    name?: string;
  } {
    const result: {
      message: string;
      isRetryable: boolean;
      stack?: string;
      name?: string;
    } = {
      message: this.getErrorMessage(error),
      isRetryable: this.isRetryableError(error),
    };

    if (error instanceof Error) {
      if (error.stack) {
        result.stack = error.stack;
      }
      if (error.name) {
        result.name = error.name;
      }
    }

    return result;
  }

  /**
   * Execute an operation with custom retry logic based on error type
   * @param operation - The operation to execute
   * @param shouldRetry - Function to determine if error should be retried
   * @param maxRetries - Maximum number of retry attempts
   * @param delayMs - Base delay in milliseconds
   * @returns Promise that resolves with the operation result
   */
  static async withCustomRetry<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: unknown) => boolean,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries || !shouldRetry(error)) {
          throw lastError;
        }

        // Exponential backoff
        const backoffDelay = delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError!;
  }
}
