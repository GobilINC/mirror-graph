import {
  Msg,
  TxLog,
  MsgSend,
  MsgMultiSend,
  MsgSwap,
  MsgSwapSend,
  MsgExecuteContract,
} from '@terra-money/terra.js'
import { isSameDay } from 'date-fns'
import * as bluebird from 'bluebird'
import { EntityManager } from 'typeorm'
import { statisticService } from 'services'
import { DailyStatisticEntity /*, TxHashEntity*/ } from 'orm'
import { parseTerraMsg } from './terra'
import { parseMirrorMsg } from './mirror'
import { MantleTx } from 'lib/terra'

const msgWhitelist = [
  'wasm/MsgExecuteContract',
  'bank/MsgSend',
  'bank/MsgMultiSend',
  'market/MsgSwap',
  'market/MsgSwapSend',
]
let lastTick = 0

async function parseMsg(
  manager: EntityManager,
  txInfo: MantleTx,
  msg: Msg,
  index: number,
  log: TxLog
): Promise<void> {
  if (msg instanceof MsgExecuteContract) {
    return parseMirrorMsg(manager, txInfo, msg, index, log)
  } else if (
    msg instanceof MsgSend ||
    msg instanceof MsgMultiSend ||
    msg instanceof MsgSwap ||
    msg instanceof MsgSwapSend
  ) {
    return parseTerraMsg(manager, txInfo, msg, log)
  }
}

async function txTick(manager: EntityManager, timestamp: number): Promise<void> {
  // 3minutes tick
  if (timestamp - lastTick > 180000) {
    const dailyStatRepo = manager.getRepository(DailyStatisticEntity)

    // calculate today's liquidity volume
    await statisticService().calculateDailyCumulativeLiquidity(timestamp, dailyStatRepo)

    if (lastTick > 0 && !isSameDay(lastTick, timestamp)) {
      // calculate yesterday's liquidity volume finally
      await statisticService().calculateDailyCumulativeLiquidity(lastTick, dailyStatRepo)
    }
    lastTick = timestamp
  }
}

export async function parseTxs(manager: EntityManager, txs: MantleTx[]): Promise<void> {
  await bluebird.mapSeries(txs, async (txInfo) => {
    await bluebird.mapSeries(txInfo.tx.msg, async (msg, index) => {
      // parse only whitelisted msgs
      if (!msgWhitelist.includes(msg.type)) {
        return
      }

      await parseMsg(
        manager,
        txInfo,
        Msg.fromAmino(msg as Msg.Amino),
        index,
        TxLog.fromData(txInfo.logs[index] as TxLog.Data)
      ).catch((error) => {
        if (error) {
          error['height'] = txInfo.height
          error['txHash'] = txInfo.txhash
          error['msg'] = JSON.stringify(msg)
          error['log'] = JSON.stringify(txInfo.logs[index])
        }
        throw error
      })
    })

    // save parsed tx hash
    // await manager.getRepository(TxHashEntity).save(new TxHashEntity({
    //   height: txInfo.height, txHash: txInfo.txhash, datetime: new Date(txInfo.timestamp)
    // }))

    await txTick(manager, new Date(txInfo.timestamp).getTime())
  })
}
