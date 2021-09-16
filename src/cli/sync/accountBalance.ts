import * as bluebird from 'bluebird'
import * as logger from 'lib/logger'
import { accountService } from 'services'

export async function syncAccountBalances(): Promise<void> {
  const accounts = await accountService().getAll()

  logger.info('sync account balances')

  await bluebird.mapSeries(accounts, async (account) => {
    await accountService().syncBalances(account.address)
  })

  console.log('completed')
}
