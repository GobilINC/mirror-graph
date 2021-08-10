import { getManager, EntityManager } from 'typeorm'
import * as bluebird from 'bluebird'
import { assetService, oracleService, priceService } from 'services'
import { CdpEntity } from 'orm'

async function removeClosedCdps(manager: EntityManager): Promise<void> {
  await manager
    .createQueryBuilder()
    .delete()
    .from(CdpEntity)
    .where('collateral_amount = 0 AND mint_amount = 0')
    .execute()
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
    [...assets, ...collateralAssets],
    async (asset) => {
      const { token, symbol } = asset
      let tokenPrice

      if (symbol === 'MIR') {
        tokenPrice = await priceService().getPrice(token)
      } else if (symbol === 'uusd') {
        tokenPrice = '1'
      } else {
        tokenPrice = await oracleService().getPrice(token)
      }

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
    .where('collateral_value > 0 AND mint_value > 0')
    .execute()
}

export async function updateCdps(): Promise<void> {
  await getManager().transaction(async (manager: EntityManager) => {
    await removeClosedCdps(manager)
    await updateCdpRatio(manager)
  })
}
