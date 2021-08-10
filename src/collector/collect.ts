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

  const txs = await getTxs(collectedHeight + 1, latestHeight, 100).catch(errorHandler)
  if (!txs || txs.length < 1) {
    await bluebird.delay(500)
    return
  }

  const lastTx = txs[txs.length - 1]

  await getManager().transaction(async (manager: EntityManager) => {
    await parseTxs(manager, txs)

    await updateBlock(collectedBlock, lastTx.height, manager.getRepository(BlockEntity))
  })

  await updateCdps().catch(errorHandler)

  // await syncPairs(lastTx.height).catch(errorHandler)

  const txDate = formatToTimeZone(
    new Date(lastTx.timestamp), 'YYYY-MM-DD HH:mm:ss', { timeZone: 'Asia/Seoul' }
  )

  logger.info(
    `collected: ${config.TERRA_CHAIN_ID},`,
    `${collectedHeight + 1}-${lastTx.height},`,
    `${txDate}, ${txs.length} txs`
  )
}
