const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 *
 * @param rate max calls per second
 * @returns a functions that cannot be called more than rate calls per second
 */
export const makeThrottle = (rate: number) => {
  const timeBetweenCalls = 1000 / rate
  const lastCall = Date.now() - timeBetweenCalls

  return async () => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall
    if (timeSinceLastCall < timeBetweenCalls) {
      await sleep(timeBetweenCalls - timeSinceLastCall)
    }
  }
}
