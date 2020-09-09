import { Wallet, Msg, TxInfo } from '@terra-money/terra.js'
import { delay } from 'bluebird'
import { lcd } from '.'

export async function checkTx(txHash: string, timeout = 120000): Promise<TxInfo> {
  const startedAt = Date.now()

  for (;;) {
    const txInfo = await lcd.tx.txInfo(txHash).catch(() => undefined)

    if (txInfo) {
      return txInfo
    }

    if (timeout > 0 && Date.now() - startedAt > timeout) {
      throw new Error('lcd timeout')
    }

    await delay(1000)
  }
}

export async function transaction(
  wallet: Wallet,
  msgs: Msg[],
  sequence = undefined,
  timeout = 60000
): Promise<TxInfo> {
  return wallet
    .createAndSignTx({ msgs })
    .then((signed) => lcd.tx.broadcast(signed))
    .then((broadcastResult) => {
      if (broadcastResult.code) {
        throw new Error(broadcastResult.raw_log)
      }
      return checkTx(broadcastResult.txhash, timeout)
    })
}
