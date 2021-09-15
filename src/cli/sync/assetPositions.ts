import * as bluebird from 'bluebird'
import { getRepository } from 'typeorm'
import * as logger from 'lib/logger'
import { getPairPool, getTokenInfo, getTokenBalance } from 'lib/mirror'
import { assetService, govService } from 'services'
import { AssetPositionsEntity } from 'orm'

export async function syncAssetPositions(height: number): Promise<void> {
  const assets = await assetService().getListedAssets()
  const stakingContract = govService().get().staking

  logger.info('try to sync asset positions')

  await bluebird.map(assets, async (asset) => {
    const { lpToken } = asset
    let changed = false

    const pairPool = await getPairPool(asset.pair).catch(() => undefined)
    if (pairPool) {
      const { assetAmount, collateralAmount } = pairPool
      const { pool, uusdPool } = asset.positions

      if (assetAmount !== pool || collateralAmount !== uusdPool) {
        logger.info(
          `${asset.symbol} pool not synced. ${pool}-${assetAmount}, ${uusdPool}-${collateralAmount}`
        )

        asset.positions.pool = assetAmount
        asset.positions.uusdPool = collateralAmount

        changed = true
      }
    }

    const tokenInfo = await getTokenInfo(lpToken).catch(() => undefined)
    if (tokenInfo && asset.positions.lpShares !== tokenInfo.totalSupply) {
      logger.info(
        `${asset.symbol} lpShares not synced. ${asset.positions.lpShares}-${tokenInfo.totalSupply}`
      )

      asset.positions.lpShares = tokenInfo.totalSupply

      changed = true
    }

    const tokenBalance = await getTokenBalance(lpToken, stakingContract).catch(() => undefined)
    if (tokenBalance && asset.positions.lpStaked !== tokenBalance.balance) {
      logger.info(
        `${asset.symbol} lpStaked not synced. ${asset.positions.lpStaked}-${tokenBalance.balance}`
      )

      asset.positions.lpStaked = tokenBalance.balance

      changed = true
    }

    changed && (await getRepository(AssetPositionsEntity).save(asset.positions))
  })

  logger.info('complete')
}
