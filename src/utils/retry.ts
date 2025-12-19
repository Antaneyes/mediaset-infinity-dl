/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param delayMs Initial delay in milliseconds (default: 1000)
 * @returns Result of the function
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) {
                // Last attempt failed, throw the error
                throw error;
            }
            const waitTime = delayMs * (i + 1); // Exponential backoff
            console.error(`❌ Attempt ${i + 1}/${maxRetries} failed. Retrying in ${waitTime}ms...`);
            console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
    throw new Error('Unreachable code');
}
