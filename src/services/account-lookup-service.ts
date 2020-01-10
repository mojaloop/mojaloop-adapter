import { AxiosInstance } from 'axios'

export type AccountLookUpService = {
  requestFspIdFromMsisdn (traceId: string, msisdn: string): Promise<void>;
}

export class AccountLookupService implements AccountLookUpService {

  constructor (private _client: AxiosInstance) {
  }

  async requestFspIdFromMsisdn (traceId: string, msisdn: string): Promise<void> {
    // TODO: use mojaSDK
    await this._client.get(`/parties/MSISDN/${msisdn}`, {
      headers: {
        id: traceId,
        'fspiop-source': 'adaptor',
        'content-type': 'application/vnd.interoperability.parties+json;version=1.0',
        accept: 'application/vnd.interoperability.parties+json;version=1.0',
        date: new Date().toUTCString()
      }
    })
  }

}
