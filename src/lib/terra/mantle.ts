import { TxInfo } from '@terra-money/terra.js'
import { GraphQLClient, gql } from 'graphql-request'
import { toSnakeCase, toCamelCase } from 'lib/caseStyles'

export let mantle: GraphQLClient

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

export async function getTxs(height: number): Promise<TxInfo[]> {
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
              log
              events {
                type
                attributes {
                  key
                  value
                }
              }
            }
            tx {
              auth_info {
                fee {
                  payer
                  amount {
                    denom
                    amount
                  }
                }
                signer_infos {
                  mode_info
                }
              }
              body {
                messages
              }
            }
          }
        }
      }
    `,
    {
      height,
    }
  )

  return response?.tx?.byHeight
    .filter((rawTx) => rawTx.code > 0)
    .map((rawTx) => TxInfo.fromData(rawTx))
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
