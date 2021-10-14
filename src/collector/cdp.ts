import { getManager, EntityManager } from 'typeorm'
import * as bluebird from 'bluebird'
import { Updater } from 'lib/Updater'
import { assetService, oracleService, collateralService } from 'services'
import { CdpEntity } from 'orm'

const updater = new Updater(60000 * 5) // 5mins

async function removeClosedCdps(manager: EntityManager): Promise<void> {
  await manager
    .createQueryBuilder()
    .delete()
    .from(CdpEntity)
    .where('collateral_amount = 0 AND mint_amount = 0')
    .execute()
}

async function updateCdpRatio(manager: EntityManager, maxDiffRatio?: number): Promise<void> {
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

      let qb = manager
        .createQueryBuilder()
        .update(CdpEntity)
        .set({ mintValue: () => `mint_amount * ${oraclePrice}` })
        .where('token = :token', { token })
        .andWhere('mint_amount > 0')

      if (maxDiffRatio) {
        qb = qb.andWhere('collateral_ratio - min_collateral_ratio < :maxDiffRatio', {
          maxDiffRatio,
        })
      }

      await qb.execute()
    }
  )

  // update collateral value
  await bluebird.mapSeries(
    [...assets, ...collateralAssets].filter((asset) => asset.symbol !== 'uusd'),
    async (asset) => {
      const { token } = asset
      const collateralPrice = await collateralService().getPrice(token)
      if (!collateralPrice) {
        return
      }

      let qb = manager
        .createQueryBuilder()
        .update(CdpEntity)
        .set({ collateralValue: () => `collateral_amount * ${collateralPrice}` })
        .where('collateral_token = :token', { token })
        .andWhere('collateral_amount > 0 AND mint_value > 0')

      if (maxDiffRatio) {
        qb = qb.andWhere('collateral_ratio - min_collateral_ratio < :maxDiffRatio', {
          maxDiffRatio,
        })
      }

      await qb.execute()
    }
  )

  // update collateral ratio
  let qb = manager
    .createQueryBuilder()
    .update(CdpEntity)
    .set({ collateralRatio: () => `collateral_value / mint_value` })
    .where('collateral_value > 0 AND mint_value > 0')

  if (maxDiffRatio) {
    qb = qb.andWhere('collateral_ratio - min_collateral_ratio < :maxDiffRatio', { maxDiffRatio })
  }

  await qb.execute()
}

export async function updateCdps(): Promise<void> {
  const now = Date.now()

  await getManager().transaction(async (manager: EntityManager) => {
    if (updater.needUpdate(now)) {
      // remove closed cdps
      await removeClosedCdps(manager)

      // update all cdps every 5mins
      await updateCdpRatio(manager)
    } else {
      // close to liquidation(< 15%) cdps update every block
      await updateCdpRatio(manager, 0.15)
    }
  })
}
