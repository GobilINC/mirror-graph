import { program } from 'commander'
import { getLatestBlockHeight } from 'lib/terra'
import { syncAssetPositions } from './assetPositions'
import { syncCdpValues, syncCdps } from './cdp'
import { syncAccountBalances } from './accountBalance'

export function registSyncCommands(): void {
  program.command('sync-asset-positions').action(async () => {
    await syncAssetPositions(await getLatestBlockHeight())
  })

  program.command('sync-cdps').action(async () => {
    await syncCdpValues()
    await syncCdps()
  })

  program.command('sync-balances').action(async () => {
    await syncAccountBalances()
  })

  program.command('sync-all').action(async () => {
    await syncAssetPositions(await getLatestBlockHeight())
    await syncCdpValues()
    await syncCdps()
    await syncAccountBalances()
  })
}
