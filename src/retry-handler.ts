/**
 * Smart retry handler with exponential backoff
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export class RetryHandler {
  private consecutiveFailures = 0;

  constructor(
    private options: RetryOptions = {
      maxRetries: 5,
      baseDelay: 1000, // 1 second
      maxDelay: 60000, // 1 minute
      backoffMultiplier: 2,
    }
  ) {}

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = await fn();
        this.consecutiveFailures = 0; // Reset on success
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.consecutiveFailures++;

        // Don't retry on last attempt
        if (attempt === this.options.maxRetries) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        console.warn(`⚠️  ${context} failed (attempt ${attempt + 1}/${this.options.maxRetries + 1}). Retrying in ${delay}ms...`);
        console.warn(`   Error: ${lastError.message}`);

        await this.sleep(delay);
      }
    }

    throw new Error(`${context} failed after ${this.options.maxRetries + 1} attempts: ${lastError?.message}`);
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    const delay = this.options.baseDelay * Math.pow(this.options.backoffMultiplier, attempt);
    return Math.min(delay, this.options.maxDelay);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): "healthy" | "degraded" | "unhealthy" {
    if (this.consecutiveFailures === 0) return "healthy";
    if (this.consecutiveFailures <= 2) return "degraded";
    return "unhealthy";
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.consecutiveFailures;
  }

  /**
   * Reset failure counter
   */
  reset(): void {
    this.consecutiveFailures = 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}