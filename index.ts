import {
  CloudWatchLogs,
  DescribeLogGroupsCommandOutput,
  DescribeLogStreamsCommandOutput,
} from '@aws-sdk/client-cloudwatch-logs'

const cw = new CloudWatchLogs({})

function fmtDate(date: number) {
  return new Date(date).toISOString().substr(0, 10)
}

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function* getLogGroups() {
  let response: DescribeLogGroupsCommandOutput | undefined
  do {
    response = await cw.describeLogGroups({ nextToken: response?.nextToken })
    for (const logGroup of response.logGroups ?? []) {
      yield logGroup
    }
  } while (response.nextToken)
}

async function* getLogStreams(logGroupName: string) {
  let response: DescribeLogStreamsCommandOutput | undefined
  do {
    response = await cw.describeLogStreams({ logGroupName, nextToken: response?.nextToken })
    for (const logStream of response.logStreams ?? []) {
      yield logStream
    }
    await sleep(200) // describeLogStream is limited to 5 calls per second
  } while (response.nextToken)
}

async function main() {
  const twoWeeksAgo = +Date.now() - 1000 * 60 * 60 * 24 * 14

  // set the retention policy to 14 days and delete all streams older than two weeks
  for await (const { logGroupName, retentionInDays } of getLogGroups()) {
    if (!retentionInDays && logGroupName) {
      console.log('Updating LogGroup', logGroupName)
      await cw.putRetentionPolicy({ logGroupName, retentionInDays: 14 })

      for await (const stream of getLogStreams(logGroupName)) {
        const lastIngestionTime = stream.lastIngestionTime ?? 0
        if (lastIngestionTime < twoWeeksAgo) {
          console.log(`Deleting LogStream ${logGroupName}-${fmtDate(lastIngestionTime)}`)
          await cw.deleteLogStream({ logGroupName, logStreamName: stream.logStreamName })
        }
      }
    }
  }
}

main().catch(console.error)
