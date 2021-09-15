import * as bluebird from 'bluebird'
import { getRepository } from 'typeorm'
import {
  getMintPosition,
  getMintPositions,
  getMintAssetConfig,
  getCollateralAssetInfo,
} from 'lib/mirror'
import { num } from 'lib/num'
import * as logger from 'lib/logger'
import { govService, cdpService } from 'services'
import { CdpEntity } from 'orm'

export async function syncCdps(): Promise<void> {
  const { mint, collateralOracle } = govService().get()
  const cdps = await cdpService().getAll({ order: { id: 'ASC' } })

  logger.info('try to sync cdps')

  await bluebird.mapSeries(cdps, async (cdp) => {
    const position = await getMintPosition(mint, cdp.id).catch(() => undefined)
    if (!position) {
      logger.info(`${cdp.id} is not exists!`)
      await getRepository(CdpEntity).remove(cdp)
      return
    }
    if (cdp.collateralAmount !== position.collateral.amount) {
      logger.info(`${cdp.id}: collateral ${cdp.collateralAmount}-${position.collateral.amount}`)

      cdp.collateralAmount = position.collateral.amount
      await getRepository(CdpEntity).save(cdp)
    }
    if (cdp.mintAmount !== position.asset.amount) {
      logger.info(`${cdp.id}: collateral ${cdp.collateralAmount}-${position.collateral.amount}`)

      cdp.mintAmount = position.asset.amount
      await getRepository(CdpEntity).save(cdp)
    }

    const assetConfig = await getMintAssetConfig(mint, cdp.token)

    const collateralInfo =
      cdp.collateralToken !== 'uusd' &&
      (await getCollateralAssetInfo(collateralOracle, cdp.collateralToken).catch(() => undefined))
    const multiplier = collateralInfo?.multiplier || '1'

    cdp.minCollateralRatio = num(assetConfig.minCollateralRatio).multipliedBy(multiplier).toString()
    await getRepository(CdpEntity).save(cdp)
  })

  const positions = await getMintPositions(mint)

  await bluebird.mapSeries(positions, async (position) => {
    const { idx, owner, collateral, asset, isShort } = position
    const cdp = await this.get({ id: idx })

    if (!cdp) {
      const token = asset.info['token']
        ? asset.info['token']['contractAddr']
        : asset.info['nativeToken']['denom']
      const collateralToken = collateral.info['token']
        ? collateral.info['token']['contractAddr']
        : collateral.info['nativeToken']['denom']
      const assetConfig = await getMintAssetConfig(mint, token)
      const collateralInfo =
        collateralToken !== 'uusd' &&
        (await getCollateralAssetInfo(collateralOracle, collateralToken).catch((error) => {
          console.log(error)
          return undefined
        }))
      const multiplier = collateralInfo?.multiplier || '1'

      const cdp = new CdpEntity({
        id: idx,
        address: owner,
        token,
        mintAmount: asset.amount,
        collateralToken,
        collateralAmount: collateral.amount,
        minCollateralRatio: num(assetConfig.minCollateralRatio).multipliedBy(multiplier).toString(),
        isShort,
      })

      await getRepository(CdpEntity).save(cdp)
      logger.info(`${idx} cdp recovered`)
    }
  })

  console.log('complete')
}

export async function syncChainToDB(): Promise<void> {
  const { mint, collateralOracle } = govService().get()
  const positions = await getMintPositions(mint)

  logger.info(`positions: ${positions.length}`)

  await bluebird.mapSeries(positions, async (position) => {
    const { idx, owner, collateral, asset, isShort } = position
    const cdp = await this.get({ id: idx })

    if (!cdp) {
      const token = asset.info['token']
        ? asset.info['token']['contractAddr']
        : asset.info['nativeToken']['denom']
      const collateralToken = collateral.info['token']
        ? collateral.info['token']['contractAddr']
        : collateral.info['nativeToken']['denom']
      const assetConfig = await getMintAssetConfig(mint, token)
      const collateralInfo =
        collateralToken !== 'uusd' &&
        (await getCollateralAssetInfo(collateralOracle, collateralToken).catch((error) => {
          console.log(error)
          return undefined
        }))
      const multiplier = collateralInfo?.multiplier || '1'

      const cdp = new CdpEntity({
        id: idx,
        address: owner,
        token,
        mintAmount: asset.amount,
        collateralToken,
        collateralAmount: collateral.amount,
        minCollateralRatio: num(assetConfig.minCollateralRatio).multipliedBy(multiplier).toString(),
        isShort,
      })

      await getRepository(CdpEntity).save(cdp)
      logger.info(`${idx} cdp recovered`)
    }
  })

  console.log('complete')
}
