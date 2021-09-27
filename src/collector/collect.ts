import * as bluebird from 'bluebird'
import { formatToTimeZone } from 'date-fns-timezone'
import { getManager, EntityManager } from 'typeorm'
import { getLatestBlockHeight, getTxs } from 'lib/terra'
import * as logger from 'lib/logger'
import { errorHandler } from 'lib/error'
import { BlockEntity } from 'orm'
import { parseTxs } from './parser'
import { getCollectedBlock, updateBlock } from './block'
// import { syncPairs } from './sync'
import { updateCdps } from './cdp'
import config from 'config'

export async function collect(now: number): Promise<void> {
  const latestHeight = await getLatestBlockHeight().catch(async (error) => {
    errorHandler(error)
    await bluebird.delay(5000)
  })
  const collectedBlock = await getCollectedBlock().catch(errorHandler)
  if (!latestHeight || !collectedBlock || collectedBlock.height >= latestHeight) {
    return
  }
  const collectedHeight = collectedBlock.height

  for (let height = collectedHeight + 1; height < latestHeight; height += 1) {
    const txs = await getTxs(height).catch(errorHandler)
    if (!txs) {
      await bluebird.delay(500)
      return
    }

    await getManager().transaction(async (manager: EntityManager) => {
      await parseTxs(manager, txs)

      await updateBlock(collectedBlock, height, manager.getRepository(BlockEntity))
    })

    await updateCdps().catch(errorHandler)

    // await syncPairs(lastTx.height).catch(errorHandler)

    const lastTx = txs[txs.length - 1]
    if (!lastTx) {
      continue
    }

    const txDate = formatToTimeZone(new Date(lastTx.timestamp), 'YYYY-MM-DD HH:mm:ss', {
      timeZone: 'Asia/Seoul',
    })

    logger.info(`collected: ${config.TERRA_CHAIN_ID}, ${height}, ${txDate}, ${txs.length} txs`)
  }
}
