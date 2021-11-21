import {
  CloudWatchLogs,
  DescribeLogGroupsCommandOutput,
  DescribeLogStreamsCommandOutput,
} from '@aws-sdk/client-cloudwatch-logs'
import { limitRate } from './limit-rate'

const cw = new CloudWatchLogs({ maxAttempts: 5 })

function fmtDate(date: number) {
  return new Date(date).toISOString().substr(0, 10)
}

async function* getLogGroups() {
  let response: DescribeLogGroupsCommandOutput | undefined
  do {
    await limitRate()
    response = await cw.describeLogGroups({ nextToken: response?.nextToken, limit: 50 })
    for (const logGroup of response.logGroups ?? []) {
      yield logGroup
    }
  } while (response.nextToken)
}

async function* getLogStreams(logGroupName: string) {
  let response: DescribeLogStreamsCommandOutput | undefined
  do {
    await limitRate()
    response = await cw.describeLogStreams({
      logGroupName,
      nextToken: response?.nextToken,
      limit: 50,
    })
    for (const logStream of response.logStreams ?? []) {
      yield logStream
    }
  } while (response.nextToken)
}

async function main() {
  const now = +Date.now()
  const oneDay = 1000 * 60 * 60 * 24

  for await (let { logGroupName, retentionInDays } of getLogGroups()) {
    if (!logGroupName) continue

    // set the retention policy to 14 days
    console.log('Found LogGroup', logGroupName)
    if (!retentionInDays) {
      console.log('Updating LogGroup', logGroupName)
      retentionInDays = 14
      await limitRate()
      await cw.putRetentionPolicy({ logGroupName, retentionInDays })
    }

    // delete all streams not in the retention period
    const tooOld = now - retentionInDays * oneDay
    for await (const stream of getLogStreams(logGroupName)) {
      const lastIngestionTime = stream.lastIngestionTime ?? 0
      if (lastIngestionTime < tooOld) {
        console.log(`Deleting LogStream ${logGroupName}-${fmtDate(lastIngestionTime)}`)
        await limitRate()
        await cw.deleteLogStream({ logGroupName, logStreamName: stream.logStreamName })
      }
    }
  }
}

main().catch(console.error)
