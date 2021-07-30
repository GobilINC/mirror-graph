import { getManager, EntityManager } from 'typeorm'
import * as logger from 'lib/logger'
import { cdpService } from 'services'
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

export async function updateCdps(): Promise<void> {
  if (!updater.needUpdate(Date.now())) {
    return
  }

  await getManager().transaction(async (manager: EntityManager) => {
    await removeClosedCdps(manager)
    await manager.query('SELECT public.calculateCdpRatio()')
  })

  logger.info('cdp ratio updated')
}
