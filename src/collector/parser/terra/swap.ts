import * as bluebird from 'bluebird'
import { TxLog, MsgSwap, Coins } from '@terra-money/terra.js'
import { EntityManager } from 'typeorm'
import { findAttributes, findAttribute, MantleTx } from 'lib/terra'
import { splitTokenAmount } from 'lib/utils'
import { num } from 'lib/num'
import { govService, txService, accountService } from 'services'
import { TxType } from 'types'
import { BalanceEntity } from 'orm'

export async function parse(
  manager: EntityManager,
  txInfo: MantleTx,
  msg: MsgSwap,
  log: TxLog
): Promise<void> {
  const account = await accountService().get({ address: msg.trader })

  // only registered account
  if (!account) return

  const datetime = new Date(txInfo.timestamp)
  const tx = {
    height: txInfo.height,
    txHash: txInfo.txhash,
    datetime,
    govId: govService().get().id,
    memo: txInfo.tx.memo,
  }

  const attributes = findAttributes(log.events, 'swap')
  const offer = findAttribute(attributes, 'offer')
  const swapCoin = findAttribute(attributes, 'swap_coin')

  const offerTokenAmount = splitTokenAmount(offer)
  const swapTokenAmount = splitTokenAmount(swapCoin)

  let uusdChange = '0'
  if (offerTokenAmount.token === 'uusd') uusdChange = `-${offerTokenAmount.amount}`
  else if (swapTokenAmount.token === 'uusd') uusdChange = swapTokenAmount.amount

  // calculate fee
  const feeCoins = txInfo.tx.fee?.amount
  Array.isArray(feeCoins) &&
    (await bluebird.mapSeries(feeCoins, async (coin) => {
      if (coin.denom === 'uusd') {
        uusdChange = num(uusdChange).minus(coin.amount).toString()
      }
    }))

  await txService().newTx(
    {
      ...tx,
      type: TxType.TERRA_SWAP,
      address: msg.trader,
      data: {
        offer,
        trader: findAttribute(attributes, 'trader'),
        recipient: findAttribute(attributes, 'recipient'),
        swapCoin,
        swapFee: findAttribute(attributes, 'swap_fee'),
      },
      uusdChange,
      fee: Coins.fromAmino(txInfo.tx.fee.amount).toString(),
      tags: [offerTokenAmount.token, swapTokenAmount.token],
    },
    manager
  )

  // if uusd token and app user, record balance history
  if (account.isAppUser && uusdChange !== '0') {
    await accountService().addBalance(
      msg.trader,
      'uusd',
      '1',
      uusdChange,
      datetime,
      manager.getRepository(BalanceEntity)
    )
  }
}
