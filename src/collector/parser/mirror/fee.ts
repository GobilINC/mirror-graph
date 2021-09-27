import { TxInfo } from '@terra-money/terra.js'
import * as bluebird from 'bluebird'
import { EntityManager } from 'typeorm'
import { num } from 'lib/num'
import { accountService } from 'services'
import { BalanceEntity } from 'orm'

export async function parse(manager: EntityManager, txInfo: TxInfo, sender: string): Promise<void> {
  const account = await accountService().get({ address: sender })

  // only registered app user
  if (!account || !account.isAppUser) return

  const datetime = new Date(txInfo.timestamp)
  let uusdChange = '0'

  // calculate fee
  const feeCoins = txInfo.tx.auth_info.fee?.amount
  Array.isArray(feeCoins) &&
    (await bluebird.mapSeries(feeCoins, async (coin) => {
      if (coin.denom === 'uusd') {
        uusdChange = num(uusdChange).minus(coin.amount).toString()
      }
    }))

  uusdChange !== '0' &&
    (await accountService().addBalance(
      sender,
      'uusd',
      '1',
      uusdChange,
      datetime,
      manager.getRepository(BalanceEntity)
    ))
}
