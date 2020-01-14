import { AxiosInstance } from 'axios'
import Knex from 'knex'
import { AuthorizationsIDPutResponse } from '../types/mojaloop'

export interface AuthorizationsService {
  sendAuthorizationsResponse (transactionRequestId: string, response: AuthorizationsIDPutResponse, headers: { [k: string]: string }): Promise<void>;
}

export class KnexAuthorizationsService implements AuthorizationsService {
  constructor (private _knex: Knex, private _client: AxiosInstance) {
  }

  async sendAuthorizationsResponse (transactionRequestId: string, request: AuthorizationsIDPutResponse, headers: { [k: string]: string }): Promise<void> {
    await this._client.put(`/authorizations/${transactionRequestId}`, request, { headers })
  }
}
