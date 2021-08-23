import * as bluebird from 'bluebird'
import { Not } from 'typeorm'
import { Coins, MsgExecuteContract, StdFee } from '@terra-money/terra.js'
import { TxWallet, getBlunaToken, getAustToken, getGasAmount } from 'lib/terra'
import { toSnakeCase } from 'lib/caseStyles'
import * as logger from 'lib/logger'
import { getTokenBalance, getDistributionInfo } from 'lib/mirror'
import { govService, assetService, accountService } from 'services'
import { num } from 'lib/num'
import { Updater } from 'lib/Updater'

const updater = new Updater(5 * 60000) // 5min
const gas = 4000000

export async function distributeRewards(wallet: TxWallet): Promise<void> {
  if (!updater.needUpdate(Date.now())) {
    return
  }

  const { factory, collector, mirrorToken } = govService().get()
  const assets = await assetService().getListedAssets({ symbol: Not('MIR')})
  const sender = wallet.key.accAddress

  // MIR inflation distribute every 1hour
  const distributionInfo = await getDistributionInfo(factory)
  if (Date.now() - (+distributionInfo.lastDistributed * 1000) >= 60000 * 60) {
    await wallet.execute(
      factory,
      { distribute: {} },
      new Coins([]),
      new StdFee(gas, getGasAmount(gas, 'uusd'))
    )
  }

  // collector has mAsset(fee) > convert mir
  const convertMsgs = await bluebird
    .map(assets, async (asset) => {
      const balance = await getTokenBalance(asset.token, collector)

      if (num(balance).isGreaterThan(10000)) {
        return new MsgExecuteContract(
          sender, collector, toSnakeCase({ convert: { assetToken: asset.token } }), new Coins([])
        )
      }
    })
    .filter(Boolean)

  // collector has uusd > convert mir
  const { balance: uusdBalance } = await accountService().getBalance(collector, 'uusd')
  if (num(uusdBalance).isGreaterThan(10000000)) {
    convertMsgs.push(new MsgExecuteContract(
      sender, collector, toSnakeCase({ convert: { assetToken: mirrorToken } }), new Coins([])
    ))
  }

  // collector has uluna or bluna > convert mir
  const bLunaToken = getBlunaToken()
  if (bLunaToken) {
    const bLunaBalance = await getTokenBalance(bLunaToken, collector)
    const { balance: lunaBalance } = await accountService().getBalance(collector, 'uluna')

    if (num(lunaBalance).isGreaterThan(10000000) || num(bLunaBalance).isGreaterThan(10000000)) {
      convertMsgs.push(new MsgExecuteContract(
        sender, collector, toSnakeCase({ convert: { assetToken: bLunaToken } }), new Coins([])
      ))
    }
  }

  // collector has aust > convert mir
  const aUstToken = getAustToken()
  if (aUstToken && num(await getTokenBalance(aUstToken, collector)).isGreaterThan(10000000)) {
    convertMsgs.push(new MsgExecuteContract(
      sender, collector, toSnakeCase({ convert: { assetToken: aUstToken } }), new Coins([])
    ))
  }

  if (convertMsgs.length > 0) {
    // execute convert fee
    await wallet.executeMsgs(convertMsgs, new StdFee(gas, getGasAmount(gas, 'uusd')))

    // execute distribute converted fee
    await wallet.execute(collector, { distribute: {} })
  }

  logger.info('rewards distributed')
}
