import { GraphQLClient, gql } from 'graphql-request'
import { toSnakeCase, toCamelCase } from 'lib/caseStyles'

export let mantle: GraphQLClient
export interface MantleTx {
  height: number
  txhash: string
  codespace: string
  code: number
  raw_log: string
  logs: {
    msg_index: number
    events: {
      type: string
      attributes: {
        key: string
        value: string
      }[]
    }[]
  }[]
  gas_wanted: string
  gas_used: string
  tx: {
    fee: {
      amount: {
        amount: string
        denom: string
      }[]
      gas: string
    }
    memo?: string
    msg: {
      type: string
      value: unknown
    }[]
  }
  timestamp: string
}

export function initMantle(URL: string): GraphQLClient {
  mantle = new GraphQLClient(URL, {
    timeout: 60000,
    keepalive: true,
  })

  return mantle
}

export async function getLatestBlockHeight(): Promise<number> {
  const response = await mantle.request(
    gql`
      query {
        tendermint {
          blockInfo {
            block {
              header {
                height
              }
            }
          }
        }
      }
    `
  )

  return response?.tendermint?.blockInfo?.block?.header?.height
}

export async function getContractStore<T>(address: string, query: unknown): Promise<T> {
  const response = await mantle.request(
    gql`
      query ($address: String!, $query: JSON!) {
        wasm {
          contractQuery(contractAddress: $address, query: $query)
        }
      }
    `,
    {
      address,
      query: toSnakeCase(query),
    }
  )

  if (!response?.wasm?.contractQuery) {
    return undefined
  }

  return toCamelCase(response?.wasm?.contractQuery)
}

export async function getTxs(height: number): Promise<MantleTx[]> {
  const response = await mantle.request(
    gql`
      query ($height: Float!) {
        tx {
          byHeight(height: $height) {
            height
            txhash

            code
            gas_wanted
            gas_used
            timestamp

            raw_log
            logs {
              msg_index
              events {
                type
                attributes {
                  key
                  value
                }
              }
            }
            tx {
              fee {
                gas
                amount {
                  denom
                  amount
                }
              }
              msg {
                type
                value
              }
              memo
            }
          }
        }
      }
    `,
    {
      height,
    }
  )

  return response?.tx?.byHeight || []
}

export async function getContractStoreWithHeight<T>(
  address: string,
  query: unknown
): Promise<{ height: number; result: T }> {
  const response = await mantle.request(
    gql`
      query ($address: String!, $query: JSON!) {
        wasm {
          contractQuery(contractAddress: $address, query: $query)
        }
        tendermint {
          blockInfo {
            block {
              header {
                height
              }
            }
          }
        }
      }
    `,
    {
      address,
      query: toSnakeCase(query),
    }
  )

  if (!response?.wasm?.contractQuery) {
    return undefined
  }

  return {
    height: +response?.tendermint?.blockInfo?.block?.header?.height,
    result: toCamelCase(response?.wasm?.contractQuery),
  }
}
