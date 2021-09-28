import { getContractStore } from 'lib/terra'
import { num } from 'lib/num'
import {
  PairPool,
  OraclePrice,
  GovConfig,
  GovPoll,
  GovStaker,
  MintAssetConfig,
  TokenInfo,
  StakingConfig,
  StakingPool,
  DistributionInfo,
  CollateralAssetInfo,
  MintPosition,
} from './types'

export async function getPairPool(
  pair: string,
  height?: number
): Promise<{ assetAmount: string; collateralAmount: string; totalShare: string }> {
  const pool = await getContractStore<PairPool>(pair, { pool: {} }, height)
  const token = pool.assets.find((asset) => asset.info['token'])
  const nativeToken = pool.assets.find((asset) => asset.info['nativeToken'])

  return {
    assetAmount: token?.amount || '0',
    collateralAmount: nativeToken?.amount || '0',
    totalShare: pool.totalShare || '0',
  }
}

export async function getPairPrice(pair: string): Promise<string> {
  const pool = await getPairPool(pair)
  const price = num(pool.collateralAmount).dividedBy(pool.assetAmount).toString()
  return num(price).isNaN() ? undefined : price
}

export async function getOraclePrice(oracle: string, token: string): Promise<string> {
  const oraclePrice = await getContractStore<OraclePrice>(oracle, {
    price: { baseAsset: token, quoteAsset: 'uusd' },
  })

  if (!oraclePrice) return undefined

  return num(oraclePrice.rate).toString()
}

export async function getTokenBalance(
  token: string,
  address: string,
  height?: number
): Promise<string> {
  const { balance } = await getContractStore(token, { balance: { address } }, height)
  return balance
}

export async function getTokenInfo(token: string, height?: number): Promise<TokenInfo> {
  return getContractStore(token, { tokenInfo: {} }, height)
}

export async function getStakingConfig(staking: string): Promise<StakingConfig> {
  return getContractStore(staking, { config: {} })
}

export async function getStakingPool(staking: string, token: string): Promise<StakingPool> {
  return getContractStore(staking, { poolInfo: { assetToken: token } })
}

export async function getGovConfig(gov: string): Promise<GovConfig> {
  return getContractStore(gov, { config: {} })
}

export async function getGovPolls(gov: string, filter: string, limit: number): Promise<GovPoll[]> {
  const { polls } = await getContractStore(gov, { polls: { filter, limit } })
  return polls
}

export async function getGovStaker(gov: string, address: string): Promise<GovStaker> {
  return getContractStore<GovStaker>(gov, { staker: { address } })
}

export async function getMintAssetConfig(
  mint: string,
  token: string,
  height?: number
): Promise<MintAssetConfig> {
  return getContractStore(mint, { assetConfig: { assetToken: token } }, height)
}

export async function getDistributionInfo(factory: string): Promise<DistributionInfo> {
  return getContractStore<DistributionInfo>(factory, { distributionInfo: {} })
}

export async function getCollateralAssetInfo(
  collateralOracle: string,
  token: string,
  height?: number
): Promise<CollateralAssetInfo> {
  return getContractStore<CollateralAssetInfo>(
    collateralOracle,
    { collateralAssetInfo: { asset: token } },
    height
  )
}

export async function getMintPosition(
  mint: string,
  positionIdx: string,
  height?: number
): Promise<MintPosition> {
  return getContractStore<MintPosition>(mint, { position: { positionIdx } }, height)
}

export async function getMintPositions(
  mint: string,
  address?: string,
  height?: number
): Promise<MintPosition[]> {
  let totalPositions = []
  let startAfter = ''
  let finished = false
  const query: {
    positions: { ownerAddr: string; limit: number; startAfter?: string; orderBy: string }
  } = {
    positions: { ownerAddr: address, limit: 30, orderBy: 'asc' },
  }

  while (!finished) {
    if (startAfter) query.positions = { ...query.positions, startAfter }
    const { positions } = await getContractStore(mint, query, height)

    finished = positions.length < 1

    if (!finished) {
      totalPositions = [...totalPositions, ...positions]
      startAfter = positions[positions.length - 1].idx
    }
  }

  return totalPositions.map((position) => ({
    idx: position.idx,
    owner: position.owner,
    isShort: position.isShort,
    asset: {
      info: position.asset['info'],
      amount: position.asset.amount,
    },
    collateral: {
      info: position.collateral['info'],
      amount: position.collateral.amount,
    },
  }))
}
