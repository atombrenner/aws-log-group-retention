import {
  CloudWatchLogs,
  DescribeLogGroupsCommandOutput,
  DescribeLogStreamsCommandOutput,
} from '@aws-sdk/client-cloudwatch-logs'
import { makeThrottle } from './throttle'

const cw = new CloudWatchLogs({ maxAttempts: 5 })
const throttle = makeThrottle(2)

function fmtDate(date: number) {
  return new Date(date).toISOString().substring(0, 10)
}

async function* getLogGroups() {
  let response: DescribeLogGroupsCommandOutput | undefined
  do {
    await throttle()
    response = await cw.describeLogGroups({ nextToken: response?.nextToken, limit: 50 })
    for (const logGroup of response.logGroups ?? []) {
      yield logGroup
    }
  } while (response.nextToken)
}

async function* getLogStreams(logGroupName: string) {
  let response: DescribeLogStreamsCommandOutput | undefined
  do {
    await throttle()
    response = await cw.describeLogStreams({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true, // newest streams first
      nextToken: response?.nextToken,
      limit: 50,
    })
    yield* response.logStreams ?? []
  } while (response.nextToken)
}

const skip: string[] = []

async function main() {
  const now = Date.now()
  const oneDay = 1000 * 60 * 60 * 24

  for await (let { logGroupName, retentionInDays } of getLogGroups()) {
    if (!logGroupName) continue

    // set the retention policy to 14 days
    console.log('Found LogGroup', logGroupName)
    if (!retentionInDays) {
      console.log('Updating LogGroup', logGroupName)
      retentionInDays = 14
      await throttle()
      await cw.putRetentionPolicy({ logGroupName, retentionInDays })
    }

    if (skip.includes(logGroupName)) continue

    // delete all streams not in the retention period
    const tooOld = now - retentionInDays * oneDay
    let obsolete = true
    const outdated: [string, number][] = []

    for await (const stream of getLogStreams(logGroupName)) {
      // console.log(stream.logStreamName)
      const lastIngestionTime = stream.lastIngestionTime ?? 0
      if (stream.logStreamName && lastIngestionTime < tooOld) {
        outdated.push([stream.logStreamName, lastIngestionTime])
      } else {
        obsolete = false
        break // uncomment if we don't want to delete individual outdated streams
      }
    }

    if (obsolete) {
      console.log(`Deleting LogGroup ${logGroupName} with ${outdated.length} streams`)
      await throttle()
      cw.deleteLogGroup({ logGroupName })
    } else {
      // console.log(`Found ${outdated.length} outdated streams`)
      for (const [logStreamName, timestamp] of outdated) {
        console.log(`Deleting LogStream ${logGroupName}-${fmtDate(timestamp)}`)
        await throttle()
        await cw.deleteLogStream({ logGroupName, logStreamName })
      }
    }
  }
}

main().catch(console.error)
