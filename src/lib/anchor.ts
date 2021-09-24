import { getContractStore, getAnchorMarket } from 'lib/terra'

export async function getaUSTPrice(blockHeight: number): Promise<string> {
  const { exchangeRate } = await getContractStore(getAnchorMarket(), {
    epochState: { blockHeight },
  })

  return exchangeRate
}
