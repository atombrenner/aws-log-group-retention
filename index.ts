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
    response = await cw.describeLogStreams({
      logGroupName,
      nextToken: response?.nextToken,
      limit: 50,
    })
    for (const logStream of response.logStreams ?? []) {
      yield logStream
    }
    await sleep(200) // describeLogStream is limited to 5 calls per second
  } while (response.nextToken)
}

async function main() {
  const now = +Date.now()
  const oneDay = 1000 * 60 * 60 * 24

  for await (let { logGroupName, retentionInDays } of getLogGroups()) {
    if (!logGroupName) continue

    // set the retention policy to 14 days
    if (!retentionInDays) {
      console.log('Updating LogGroup', logGroupName)
      retentionInDays = 14
      await cw.putRetentionPolicy({ logGroupName, retentionInDays })
      await sleep(200) // limited to 5 calls per second
    }

    // delete all streams not in the retention period
    const tooOld = now - retentionInDays * oneDay
    for await (const stream of getLogStreams(logGroupName)) {
      const lastIngestionTime = stream.lastIngestionTime ?? 0
      if (lastIngestionTime < tooOld) {
        console.log(`Deleting LogStream ${logGroupName}-${fmtDate(lastIngestionTime)}`)
        await cw.deleteLogStream({ logGroupName, logStreamName: stream.logStreamName })
        await sleep(200) // deleteLogStream is limited to 5 calls per second
      }
    }
  }
}

main().catch(console.error)
