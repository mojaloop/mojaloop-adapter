import { QuotesIDPutResponse } from '../types/mojaloop'
import { AxiosInstance } from 'axios'

export interface QuotesService {
  sendQuoteResponse (quoteId: string, response: QuotesIDPutResponse, headers: { [k: string]: string }): Promise<void>;
}

export class MojaloopQuotesService implements QuotesService {
  constructor (private _client: AxiosInstance) {
  }

  async sendQuoteResponse (quoteId: string, request: QuotesIDPutResponse, headers: { [k: string]: string }): Promise<void> {
    await this._client.put(`/quotes/${quoteId}`, request, { headers })
  }
}
