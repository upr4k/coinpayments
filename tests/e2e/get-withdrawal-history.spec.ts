import {
  prepareHTTPInterceptor,
  mockCredentials,
  assertDefaultResponseCallback,
} from '../helpers'
import CoinpaymentsClient from '../../src'

import { CMDS } from '../../src/constants'

describe('Get withdrawal history e2e test', () => {
  let client
  beforeAll(() => {
    client = new CoinpaymentsClient(mockCredentials)
  })
  it('Should catch valid payload', async done => {
    const VALID_PAYLOAD_MOCK = {
      cmd: CMDS.GET_WITHDRAWAL_HISTORY,
    }

    const scope1 = prepareHTTPInterceptor(mockCredentials, VALID_PAYLOAD_MOCK)
    await client.getWithdrawalHistory()
    expect(scope1.isDone()).toBeTruthy()

    const scope2 = prepareHTTPInterceptor(mockCredentials, VALID_PAYLOAD_MOCK)
    await client.getWithdrawalHistory({})
    expect(scope2.isDone()).toBeTruthy()

    const scope3 = prepareHTTPInterceptor(mockCredentials, VALID_PAYLOAD_MOCK)
    await client.getWithdrawalHistory(
      assertDefaultResponseCallback(scope3, done)
    )
  })
})
