export interface NativeTokenInfo {
  nativeToken: { denom: string }
}

export interface AssetTokenInfo {
  token: { contractAddr: string }
}

export interface AssetInfo {
  info: NativeTokenInfo | AssetTokenInfo
  amount: string
}
