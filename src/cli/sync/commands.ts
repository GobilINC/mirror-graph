import { program } from 'commander'
import { getLatestBlockHeight } from 'lib/terra'
import { syncAssetPositions } from './assetPositions'
import { syncCdps } from './cdp'

export function registSyncCommands(): void {
  program.command('sync-asset-positions').action(async () => {
    await syncAssetPositions(await getLatestBlockHeight())
  })

  program.command('sync-cdps').action(async () => {
    await syncCdps()
  })
}
