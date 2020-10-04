import { getContractStore } from 'lib/terra'
import { num } from 'lib/num'
import { PairPool, OraclePrice } from 'types'

export async function getPairPool(pair: string):
  Promise<{assetAmount: string; collateralAmount: string; totalShare: string}> {
  const pool = await getContractStore<PairPool>(pair, { pool: {} })
  const token = pool.assets.find((asset) => asset.info['token'])
  const nativeToken = pool.assets.find((asset) => asset.info['nativeToken'])

  return {
    assetAmount: token?.amount || '0',
    collateralAmount: nativeToken?.amount || '0',
    totalShare: pool.totalShare || '0'
  }
}

export async function getPairPrice(pair: string): Promise<string> {
  const pool = await getPairPool(pair)
  const price = num(pool.collateralAmount).dividedBy(pool.assetAmount).toFixed(6)

  return num(price).isNaN() ? undefined : price
}

export async function getOraclePrice(oracle: string, token: string): Promise<string> {
  const oraclePrice = await getContractStore<OraclePrice>(
    oracle, { price: { assetToken: token } }
  )

  if (!oraclePrice)
    return undefined

  return num(oraclePrice.price).multipliedBy(oraclePrice.priceMultiplier).toFixed(6)
}
