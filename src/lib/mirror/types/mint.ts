import { AssetInfo } from './asset'

export interface MintAssetConfig {
  auctionDiscount: string
  minCollateralRatio: string
  token: string
}

export interface MintPosition {
  idx: string
  owner: string
  collateral: AssetInfo
  asset: AssetInfo
  isShort: boolean
}
