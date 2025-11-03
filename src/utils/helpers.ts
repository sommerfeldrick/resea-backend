// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

export class Helpers {

  /**
   * Chunk array into smaller arrays
   * Useful for batch processing
   * @example
   * chunk([1,2,3,4,5], 2) => [[1,2], [3,4], [5]]
   */
  static chunk<T>(array: T[], size: number): T[][] {
    if (!Array.isArray(array) || size <= 0) {
      return [];
    }

    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Sleep for specified milliseconds
   * @example
   * await Helpers.sleep(1000) // Wait 1 second
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function with exponential backoff
   * @param fn Function to retry
   * @param maxAttempts Maximum number of attempts
   * @param delayMs Initial delay in milliseconds
   * @param backoffMultiplier Multiplier for exponential backoff (default: 2)
   * @example
   * const result = await Helpers.retry(() => fetchData(), 3, 1000);
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2
  ): Promise<T> {

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt < maxAttempts) {
          const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
          console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Remove duplicates from array by key
   * @example
   * uniqueBy([{id: 1}, {id: 2}, {id: 1}], 'id') => [{id: 1}, {id: 2}]
   */
  static uniqueBy<T>(array: T[], key: keyof T): T[] {
    if (!Array.isArray(array)) {
      return [];
    }

    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  /**
   * Format number with locale
   * @example
   * formatNumber(1234567) => "1.234.567" (pt-BR)
   */
  static formatNumber(num: number, locale: string = 'pt-BR'): string {
    return num.toLocaleString(locale);
  }

  /**
   * Calculate percentage
   * @example
   * percentage(25, 100) => 25
   */
  static percentage(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 100);
  }

  /**
   * Truncate string to max length with ellipsis
   * @example
   * truncate("Hello World", 8) => "Hello..."
   */
  static truncate(str: string, maxLength: number): string {
    if (!str || str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Deep clone object (simple version)
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Debounce function
   * @example
   * const debouncedFn = Helpers.debounce(() => console.log('called'), 300);
   */
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delayMs: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        fn(...args);
      }, delayMs);
    };
  }

  /**
   * Throttle function
   * @example
   * const throttledFn = Helpers.throttle(() => console.log('called'), 1000);
   */
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    limitMs: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;

    return (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCall >= limitMs) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  /**
   * Pick specific keys from object
   * @example
   * pick({a: 1, b: 2, c: 3}, ['a', 'c']) => {a: 1, c: 3}
   */
  static pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;

    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });

    return result;
  }

  /**
   * Omit specific keys from object
   * @example
   * omit({a: 1, b: 2, c: 3}, ['b']) => {a: 1, c: 3}
   */
  static omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj };

    keys.forEach(key => {
      delete result[key];
    });

    return result;
  }

  /**
   * Flatten nested array
   * @example
   * flatten([[1, 2], [3, [4, 5]]]) => [1, 2, 3, [4, 5]]
   */
  static flatten<T>(array: any[]): T[] {
    return array.reduce((acc, val) =>
      Array.isArray(val) ? acc.concat(this.flatten(val)) : acc.concat(val), []
    );
  }

  /**
   * Group array by key
   * @example
   * groupBy([{type: 'A', val: 1}, {type: 'B', val: 2}, {type: 'A', val: 3}], 'type')
   * => { A: [{type: 'A', val: 1}, {type: 'A', val: 3}], B: [{type: 'B', val: 2}] }
   */
  static groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  /**
   * Calculate average
   * @example
   * average([1, 2, 3, 4, 5]) => 3
   */
  static average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculate median
   * @example
   * median([1, 2, 3, 4, 5]) => 3
   */
  static median(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   * @example
   * shuffle([1, 2, 3, 4, 5]) => [3, 1, 5, 2, 4]
   */
  static shuffle<T>(array: T[]): T[] {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  /**
   * Create range of numbers
   * @example
   * range(1, 5) => [1, 2, 3, 4, 5]
   * range(0, 10, 2) => [0, 2, 4, 6, 8, 10]
   */
  static range(start: number, end: number, step: number = 1): number[] {
    const result: number[] = [];

    for (let i = start; i <= end; i += step) {
      result.push(i);
    }

    return result;
  }

  /**
   * Check if object is empty
   * @example
   * isEmpty({}) => true
   * isEmpty({a: 1}) => false
   */
  static isEmpty(obj: object): boolean {
    return Object.keys(obj).length === 0;
  }

  /**
   * Convert bytes to human-readable format
   * @example
   * formatBytes(1024) => "1 KB"
   * formatBytes(1234567) => "1.18 MB"
   */
  static formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * Format duration in milliseconds to human-readable
   * @example
   * formatDuration(65000) => "1m 5s"
   * formatDuration(3661000) => "1h 1m 1s"
   */
  static formatDuration(ms: number): string {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const parts: string[] = [];

    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  /**
   * Safe JSON parse
   * Returns default value if parse fails
   * @example
   * safeJsonParse('{"a": 1}', {}) => {a: 1}
   * safeJsonParse('invalid', {}) => {}
   */
  static safeJsonParse<T>(json: string, defaultValue: T): T {
    try {
      return JSON.parse(json);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Generate random string
   * @example
   * randomString(8) => "a7b3c9d2"
   */
  static randomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * Execute promises with concurrency limit
   * @example
   * const results = await Helpers.pLimit(
   *   [task1, task2, task3, task4, task5],
   *   2 // max 2 concurrent tasks
   * );
   */
  static async pLimit<T>(
    promises: (() => Promise<T>)[],
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const p = promise().then(result => {
        results.push(result);
        executing.splice(executing.indexOf(p), 1);
      });

      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }
}
