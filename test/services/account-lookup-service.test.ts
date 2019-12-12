import { AccountLookUpService, AccountLookupService } from '../../src/services/account-lookup-service'
import Axios, { AxiosInstance } from 'axios'

describe('Account Lookup Service', function () {
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const accountLookupService: AccountLookUpService = new AccountLookupService(fakeHttpClient)

  test('gets party by msisdn and sets the ID header field to the traceId', async () => {
    await accountLookupService.requestFspIdFromMsisdn('test-id', '1234')

    expect(fakeHttpClient.get).toHaveBeenCalledTimes(1)
    expect((fakeHttpClient.get as jest.Mock).mock.calls[0][0]).toEqual('/parties/MSISDN/1234')
  })
})
