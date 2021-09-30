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
    const height = await getLatestBlockHeight()
    await syncCdpValues(height)
    await syncCdps(height)
  })

  program.command('sync-balances').action(async () => {
    await syncAccountBalances()
  })

  program.command('sync-all').action(async () => {
    const height = await getLatestBlockHeight()
    await syncAssetPositions(height)
    await syncCdpValues(height)
    await syncCdps(height)
    await syncAccountBalances()
  })
}
