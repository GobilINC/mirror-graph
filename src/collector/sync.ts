import * as bluebird from 'bluebird'
import { getRepository } from 'typeorm'
import { getPairPool, getTokenInfo, getTokenBalance } from 'lib/mirror'
import { assetService, govService } from 'services'
import { AssetPositionsEntity } from 'orm'

export async function syncPairs(height: number): Promise<void> {
  const assets = await assetService().getListedAssets()
  const stakingContract = govService().get().staking

  await bluebird.map(assets, async (asset) => {
    const { lpToken } = asset
    let changed = false

    const pairPool = await getPairPool(asset.pair, height).catch(() => undefined)
    if (pairPool) {
      const { assetAmount, collateralAmount } = pairPool
      const { pool, uusdPool } = asset.positions

      if (assetAmount !== pool || collateralAmount !== uusdPool) {
        asset.positions.pool = assetAmount
        asset.positions.uusdPool = collateralAmount

        changed = true
      }
    }

    const tokenInfo = await getTokenInfo(lpToken, height).catch(() => undefined)
    if (tokenInfo && asset.positions.lpShares !== tokenInfo.totalSupply) {
      asset.positions.lpShares = tokenInfo.totalSupply

      changed = true
    }

    const tokenBalance = await getTokenBalance(lpToken, stakingContract, height).catch(
      () => undefined
    )
    if (tokenBalance && asset.positions.lpStaked !== tokenBalance.balance) {
      asset.positions.lpStaked = tokenBalance.balance

      changed = true
    }

    changed && (await getRepository(AssetPositionsEntity).save(asset.positions))
  })
}
