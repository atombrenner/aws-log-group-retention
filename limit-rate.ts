const timeBetweenRequests = 200 // not more than 5 requests per second are allowed
const requests = [Date.now() - timeBetweenRequests]
const requestMaxAgeInSeconds = 2

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function limitRate() {
  const now = Date.now()
  const last = requests[requests.length - 1]
  const timeSinceLastRequest = now - last
  const tooOld = now - requestMaxAgeInSeconds * 1000
  while (requests[0] < tooOld) requests.shift()
  const rate = requests.length / requestMaxAgeInSeconds
  // console.log('rate', rate)
  if (timeSinceLastRequest < timeBetweenRequests) {
    await sleep(timeBetweenRequests - timeSinceLastRequest)
  }
  requests.push(Date.now())
}
