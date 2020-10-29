import { Resolver, Query, Arg } from 'type-graphql'
import { Tx } from 'graphql/schema'
import { TxService } from 'services'

@Resolver((of) => Tx)
export class TxResolver {
  constructor(private readonly txService: TxService) {}

  @Query((returns) => [Tx])
  async txs(
    @Arg('account') account: string,
    @Arg('offset', { defaultValue: 0 }) offset: number,
    @Arg('limit', { defaultValue: 100 }) limit: number,
  ): Promise<Tx[]> {
    return this.txService.getAll({
      where: { address: account },
      order: { id: 'DESC' },
      skip: offset,
      take: limit,
    })
  }
}