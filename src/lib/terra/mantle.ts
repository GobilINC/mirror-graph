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

export async function getContractStore<T>(
  address: string,
  query: unknown,
  height?: number
): Promise<T> {
  const response = await mantle.request(
    gql`
      query ($address: String!, $query: JSON!, $height: Float) {
        wasm {
          contractQuery(contractAddress: $address, query: $query, height: $height)
        }
      }
    `,
    {
      address,
      query: toSnakeCase(query),
      height: +height,
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
                  gas_limit
                  granter
                  amount {
                    denom
                    amount
                  }
                }
                signer_infos {
                  mode_info
                  public_key
                  sequence
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
    .filter((rawTx) => +rawTx['code'] === 0)
    .map((rawTx) => TxInfo.fromData(rawTx))
}
