import * as bluebird from 'bluebird'
import { TxWallet } from 'lib/terra'
import { errorHandler as errorHandleWithSentry } from 'lib/error'
import { sendSlack } from 'lib/slack'
import {
  adjustPremium,
  distributeRewards,
  updatePolls,
  updateNews,
  // updateAirdrop,
  updateStatistic,
  updateCollateralPrice,
} from './jobs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorHandler(job: string, error?: Error & { [key: string]: any }): void {
  if (error) {
    if (error.message) {
      sendSlack('mirror-bot', `${job} failed: ${error.message}`)
    } else if (error.response?.status) {
      sendSlack(
        'mirror-bot',
        `${job} failed: Request failed with status code ${error.response.status}`
      )
    } else if (error.response?.errors) {
      sendSlack('mirror-bot', `${job} failed: ${JSON.stringify(error.response.errors)}`)
    }

    errorHandleWithSentry(error)
  }
}

async function tick(now: number, wallet: TxWallet): Promise<void> {
  await adjustPremium(wallet).catch((error) => errorHandler('adjustPremium', error))

  await distributeRewards(wallet).catch((error) => errorHandler('distributeRewards', error))

  await updateCollateralPrice().catch((error) => errorHandler('updateCollateralPrice', error))

  await updatePolls(wallet).catch((error) => errorHandler('updatePolls', error))

  await updateStatistic().catch((error) => errorHandler('updateStatistic', error))

  await updateNews().catch((error) => errorHandler('updateNews', error))

  // await updateAirdrop(wallet).catch((error) => errorHandler('updateAirdrop', error))
}

export async function loop(wallet: TxWallet): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await tick(Date.now(), wallet)

    await bluebird.delay(100)
  }
}
