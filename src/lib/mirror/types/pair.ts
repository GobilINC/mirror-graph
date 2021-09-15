import { AssetInfo } from './asset'

export interface PairPool {
  totalShare: string // lp token supply
  assets: AssetInfo[]
}
