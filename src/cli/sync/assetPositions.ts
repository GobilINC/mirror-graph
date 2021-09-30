import * as bluebird from 'bluebird'
import { getRepository } from 'typeorm'
import * as logger from 'lib/logger'
import { getPairPool, getTokenInfo, getTokenBalance } from 'lib/mirror'
import { assetService, govService } from 'services'
import { AssetPositionsEntity } from 'orm'

export async function syncAssetPositions(height: number): Promise<void> {
  const assets = await assetService().getListedAssets()
  const stakingContract = govService().get().staking

  logger.info('sync asset positions')

  await bluebird.map(assets, async (asset) => {
    const { lpToken } = asset
    let isChanged = false

    const pairPool = await getPairPool(asset.pair, height)
    if (pairPool) {
      const { assetAmount, collateralAmount } = pairPool
      const { pool, uusdPool } = asset.positions

      if (assetAmount !== pool || collateralAmount !== uusdPool) {
        logger.info(
          `sync ${asset.symbol} pool. ${pool}-${assetAmount}, ${uusdPool}-${collateralAmount}`
        )

        asset.positions.pool = assetAmount
        asset.positions.uusdPool = collateralAmount

        isChanged = true
      }
    }

    const tokenInfo = await getTokenInfo(lpToken, height)
    if (tokenInfo && asset.positions.lpShares !== tokenInfo.totalSupply) {
      logger.info(
        `sync ${asset.symbol} lpShares. ${asset.positions.lpShares}-${tokenInfo.totalSupply}`
      )

      asset.positions.lpShares = tokenInfo.totalSupply

      isChanged = true
    }

    const tokenBalance = await getTokenBalance(lpToken, stakingContract, height)
    if (tokenBalance && asset.positions.lpStaked !== tokenBalance) {
      logger.info(`sync ${asset.symbol} lpStaked. ${asset.positions.lpStaked}-${tokenBalance}`)

      asset.positions.lpStaked = tokenBalance

      isChanged = true
    }

    isChanged && (await getRepository(AssetPositionsEntity).save(asset.positions))
  })

  logger.info('completed')
}
