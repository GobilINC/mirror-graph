import { getManager, EntityManager } from 'typeorm'
import * as bluebird from 'bluebird'
import * as logger from 'lib/logger'
import { assetService, cdpService, oracleService, priceService } from 'services'
import { CdpEntity } from 'orm'
import { Updater } from 'lib/Updater'

const updater = new Updater(60000) // 1min

async function removeClosedCdps(manager: EntityManager): Promise<void> {
  const cdpRepo = manager.getRepository(CdpEntity)
  const closedCdps = await cdpService().getAll(
    {
      select: ['id'], where: { mintAmount: 0, collateralAmount: 0 },
      lock: { mode: 'pessimistic_write' }
    },
    cdpRepo
  )

  await cdpRepo.remove(closedCdps)
}

async function updateCdpRatio(manager: EntityManager): Promise<void> {
  const assets = await assetService().getListedAssets()
  const collateralAssets = await assetService().getCollateralAssets()

  // update mint value
  await bluebird.mapSeries(
    assets.filter((asset) => asset.symbol != 'MIR'),
    async (asset) => {
      const { token } = asset
      const oraclePrice = await oracleService().getPrice(token)
      if (!oraclePrice) {
        return
      }

      await manager
        .createQueryBuilder()
        .update(CdpEntity)
        .set({ mintValue: () => `mint_amount * ${oraclePrice}` })
        .where('token = :token', { token })
        .andWhere('collateral_amount > 0 AND mint_amount > 0')
        .execute()
    }
  )

  // update collateral value
  await bluebird.mapSeries(
    [...assets, ...collateralAssets].filter((asset) => asset.symbol != 'uusd'),
    async (asset) => {
      const { token, symbol } = asset
      const tokenPrice = symbol !== 'MIR'
        ? await oracleService().getPrice(token)
        : await priceService().getPrice(token)

      if (!tokenPrice) {
        return
      }

      await manager
        .createQueryBuilder()
        .update(CdpEntity)
        .set({ collateralValue: () => `collateral_amount * ${tokenPrice}` })
        .where('collateral_token = :token', { token })
        .andWhere('collateral_amount > 0 AND mint_amount > 0')
        .execute()
    }
  )

  // update collateral ratio
  await manager
    .createQueryBuilder()
    .update(CdpEntity)
    .set({ collateralRatio: () => `collateral_value / mint_value` })
    .where('collateral_amount > 0 AND mint_amount > 0')
    .execute()
}

export async function updateCdps(): Promise<void> {
  if (!updater.needUpdate(Date.now())) {
    return
  }

  await getManager().transaction(async (manager: EntityManager) => {
    await removeClosedCdps(manager)
    await updateCdpRatio(manager)
  })

  logger.info('cdp ratio updated')
}
