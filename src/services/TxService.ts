import { Repository, FindConditions, FindOneOptions, FindManyOptions, EntityManager } from 'typeorm'
import { InjectRepository } from 'typeorm-typedi-extensions'
import { Container, Service, Inject } from 'typedi'
import { AccountService } from 'services'
import { AccountEntity, TxEntity } from 'orm'

@Service()
export class TxService {
  constructor(
    @Inject((type) => AccountService) private readonly accountService: AccountService,
    @InjectRepository(TxEntity) private readonly repo: Repository<TxEntity>
  ) {}

  async get(
    conditions: FindConditions<TxEntity>,
    options?: FindOneOptions<TxEntity>,
    repo = this.repo
  ): Promise<TxEntity> {
    return repo.findOne(conditions, options)
  }

  async getAll(options?: FindManyOptions<TxEntity>, repo = this.repo): Promise<TxEntity[]> {
    return repo.find(options)
  }

  async newTx(manager: EntityManager, tx: Partial<TxEntity>): Promise<TxEntity> {
    await this.accountService.newAccount(
      { address: tx.address, govId: tx.govId }, manager.getRepository(AccountEntity)
    )

    return manager.save(new TxEntity(tx))
  }
}

export function txService(): TxService {
  return Container.get(TxService)
}