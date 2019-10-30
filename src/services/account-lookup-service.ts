import { AxiosInstance } from 'axios'

export type AccountLookUpService = {
  requestFspIdFromMsisdn (traceId: string, msisdn: string): Promise<void>;
}

export class AccountLookupService implements AccountLookUpService {

  constructor (private _client: AxiosInstance) {
  }

  async requestFspIdFromMsisdn (traceId: string, msisdn: string): Promise<void> {
    await this._client.get(`/parties/msisdn/${msisdn}`, { headers: { ID: traceId } })
  }

}
