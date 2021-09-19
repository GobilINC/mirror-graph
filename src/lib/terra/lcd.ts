import { LCDClient, TxInfo, Wallet, Msg, Coins, Coin } from '@terra-money/terra.js'
import { delay } from 'bluebird'
import nodeFetch from 'node-fetch'
import { toSnakeCase, toCamelCase } from 'lib/caseStyles'
import { num } from 'lib/num'

export let lcd: LCDClient = undefined

function getFcdUrl() {
  if (process.env.TERRA_CHAIN_ID.includes('columbus')) {
    return 'https://fcd.terra.dev'
  } else if (process.env.TERRA_CHAIN_ID.includes('tequila')) {
    return 'https://tequila-fcd.terra.dev'
  } else if (process.env.TERRA_CHAIN_ID.includes('moonshine')) {
    return 'https://moonshine-fcd.terra.dev'
  } else if (process.env.TERRA_CHAIN_ID.includes('bombay')) {
    return 'https://bombay-fcd.terra.dev'
  }
}

export async function initLCD(URL: string, chainID: string): Promise<LCDClient> {
  const gasPrices = await nodeFetch(`${getFcdUrl()}/v1/txs/gas_prices`).then((res) => res.json())

  lcd = new LCDClient({ URL, chainID, gasPrices: { uusd: +gasPrices['uusd'] } })

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
    .createAndSignTx({ msgs, accountNumber, sequence, fee })
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
  const coin = await lcd.oracle.exchangeRate('uusd')

  return coin.toData().amount
}

export async function getBalance(address: string): Promise<Coins> {
  let coins: Coins = new Coins()
  let nextKey

  do {
    const [result, pagination] = await lcd.bank.balance(address)
    coins = coins.add(result)

    nextKey = pagination?.next_key
  } while (nextKey)

  return coins
}
