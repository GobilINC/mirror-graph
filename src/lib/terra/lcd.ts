import { LCDClient, TxInfo, Wallet, Msg, Coins, Coin } from '@terra-money/terra.js'
import { delay } from 'bluebird'
import nodeFetch from 'node-fetch'
import { toSnakeCase, toCamelCase } from 'lib/caseStyles'
import { num } from 'lib/num'

export let lcd: LCDClient = undefined

const fcdUrl = process.env.TERRA_CHAIN_ID.includes('columbus')
  ? 'https://fcd.terra.dev/'
  : 'https://tequila-fcd.terra.dev/'

export async function initLCD(URL: string, chainID: string): Promise<LCDClient> {
  const gasPrices = await nodeFetch(`${fcdUrl}/v1/txs/gas_prices`)
    .then((res) => res.json())

  lcd = new LCDClient({ URL, chainID, gasPrices })

  return lcd
}

export async function checkTx(txHash: string, timeout = 60000): Promise<TxInfo> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeout) {
    const txInfo = await lcd.tx.txInfo(txHash).catch(() => undefined)

    if (txInfo) {
      return txInfo
    }

    await delay(1000)
  }
}

export async function transaction(
  wallet: Wallet,
  msgs: Msg[],
  fee: undefined,
  accountNumber = undefined,
  sequence = undefined,
  timeout = 60000
): Promise<TxInfo> {
  return wallet
    .createAndSignTx({ msgs, account_number: accountNumber, sequence, fee })
    .then((signed) => lcd.tx.broadcast(signed))
    .then(async (broadcastResult) => {
      if (broadcastResult['code']) {
        throw new Error(broadcastResult.raw_log)
      }
      return checkTx(broadcastResult.txhash, timeout)
    })
}

export async function contractInfo<T>(address: string): Promise<T> {
  if (!address) {
    throw new Error('wrong address')
  }
  return toCamelCase(await lcd.wasm.contractInfo(address)) as T
}

export async function contractQuery<T>(
  address: string,
  query: Record<string, unknown>
): Promise<T> {
  if (!address) {
    throw new Error('wrong address')
  }
  return toCamelCase(await lcd.wasm.contractQuery<T>(address, toSnakeCase(query))) as T
}

export function getGasPrice(denom: string): string {
  return lcd.config.gasPrices[denom]
}

export function getGasAmount(gas: number, denom: string): Coins.Input {
  return [new Coin(denom, num(gas).multipliedBy(getGasPrice(denom)).toFixed(0))]
}

export async function getOraclePrice(quote: string): Promise<string> {
  const coin = await lcd.oracle.exchangeRate(quote)

  return coin.toData().amount
}
