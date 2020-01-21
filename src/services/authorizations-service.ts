import { AxiosInstance } from 'axios'
import Knex from 'knex'
import { AuthorizationsIDPutResponse } from '../types/mojaloop'
import { Logger } from 'adaptor'

export interface AuthorizationsService {
  sendAuthorizationsResponse (transactionRequestId: string, response: AuthorizationsIDPutResponse, headers: { [k: string]: string }): Promise<void>;
}

export class KnexAuthorizationsService implements AuthorizationsService {
  constructor (private _knex: Knex, private _client: AxiosInstance, private _logger: Logger = console) {
  }

  async sendAuthorizationsResponse (transactionRequestId: string, request: AuthorizationsIDPutResponse, headers: { [k: string]: string }): Promise<void> {
    this._logger.debug('Authorizations Service: sending Authorizations Response: ' + transactionRequestId)
    await this._client.put(`/authorizations/${transactionRequestId}`, request, { headers })
  }
}
