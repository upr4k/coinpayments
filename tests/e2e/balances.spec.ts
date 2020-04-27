import {
  prepareHTTPInterceptor,
  mockCredentials,
  assertDefaultResponseCallback,
} from '../helpers'
import CoinpaymentsClient from '../../src'

import { CMDS } from '../../src/constants'

describe('Balances e2e test', () => {
  let client
  beforeAll(() => {
    client = new CoinpaymentsClient(mockCredentials)
  })
  it('Should catch valid payload - no args', async () => {
    const VALID_PAYLOAD_MOCK = {
      cmd: CMDS.BALANCES,
    }
    const scope = prepareHTTPInterceptor(mockCredentials, VALID_PAYLOAD_MOCK)
    const { balances } = client
    await balances()
    expect(scope.isDone()).toBeTruthy()
  })
  it('Should catch valid payload - only callback', done => {
    const VALID_PAYLOAD_MOCK = {
      cmd: CMDS.BALANCES,
    }
    const scope = prepareHTTPInterceptor(mockCredentials, VALID_PAYLOAD_MOCK)
    const { balances } = client
    const mockCallback = assertDefaultResponseCallback(scope, done)
    return balances(mockCallback)
  })
  it('Should catch valid payload - args & callback', done => {
    const VALID_API_PAYLOAD = {
      all: 1,
    }
    const VALID_PAYLOAD_MOCK = {
      cmd: CMDS.BALANCES,
      ...VALID_API_PAYLOAD,
    }

    const scope = prepareHTTPInterceptor(mockCredentials, VALID_PAYLOAD_MOCK)
    const { balances } = client
    const mockCallback = assertDefaultResponseCallback(scope, done)
    return balances(VALID_API_PAYLOAD, mockCallback)
  })
})
