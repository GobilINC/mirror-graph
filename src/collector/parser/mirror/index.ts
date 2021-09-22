import * as bluebird from 'bluebird'
import { MsgExecuteContract, TxLog, Coins } from '@terra-money/terra.js'
import { EntityManager } from 'typeorm'
import { parseContractEvents, MantleTx } from 'lib/terra'
import { contractService } from 'services'
import { ContractType } from 'types'
import { ContractEntity } from 'orm'
import { ParseArgs } from './parseArgs'
import * as factory from './factory'
import * as oracle from './oracle'
import * as pair from './pair'
import * as token from './token'
import * as limitOrder from './limitOrder'
import * as mint from './mint'
import * as staking from './staking'
import * as gov from './gov'
import * as collector from './collector'
import * as uusdTransfer from './uusdTransfer'
import * as fee from './fee'
import * as airdrop from './airdrop'
import * as lock from './lock'

export async function parseMirrorMsg(
  manager: EntityManager,
  txInfo: MantleTx,
  msg: MsgExecuteContract,
  index: number,
  log: TxLog
): Promise<void> {
  const contractRepo = manager.getRepository(ContractEntity)
  const contractEvents = parseContractEvents(log.events)
  if (!contractEvents) {
    return
  }

  const args: ParseArgs = {
    manager,
    height: txInfo.height,
    txHash: txInfo.txhash,
    timestamp: txInfo.timestamp,
    fee: Coins.fromAmino(txInfo.tx.fee.amount).toString(),
    sender: msg.sender,
    coins: msg.coins,
    msg: msg.execute_msg,
    log,
    contract: undefined,
    contractEvent: undefined,
    contractEvents,
  }

  await bluebird.mapSeries(contractEvents, async (event) => {
    const contract = await contractService().get(
      { address: event.address },
      undefined,
      contractRepo
    )
    if (!contract) {
      return
    }

    args.contract = contract
    args.contractEvent = event
    args.sender = event.sender

    switch (contract.type) {
      case ContractType.GOV:
        await gov.parse(args)
        break

      case ContractType.FACTORY:
        await factory.parse(args)
        break

      case ContractType.ORACLE:
        await oracle.parse(args)
        break

      case ContractType.PAIR:
        await pair.parse(args)
        break

      case ContractType.TOKEN:
      case ContractType.LP_TOKEN:
        await token.parse(args)
        break

      case ContractType.MINT:
        await mint.parse(args)
        break

      case ContractType.STAKING:
        await staking.parse(args)
        break

      case ContractType.COLLECTOR:
        await collector.parse(args)
        break

      case ContractType.AIRDROP:
        await airdrop.parse(args)
        break

      case ContractType.LIMIT_ORDER:
        await limitOrder.parse(args)
        break

      case ContractType.LOCK:
        await lock.parse(args)
        break
    }
  })

  args.contract = undefined
  args.contractEvent = undefined
  args.sender = msg.sender

  // tracking uusd balance
  await uusdTransfer.parse(manager, txInfo, log)
  // tracking fee
  await fee.parse(manager, txInfo, msg.sender)
}
