import { AxiosInstance } from 'axios'
import Knex from 'knex'
import { AuthorizationsIDPutResponse, ErrorInformation } from '../types/mojaloop'
import { Logger } from '../adaptor'

export interface AuthorizationsService {
  sendAuthorizationsResponse (transactionRequestId: string, response: AuthorizationsIDPutResponse, headers: { [k: string]: string | undefined }): Promise<void>;
  sendAuthorizationsErrorResponse (transactionRequestId: string, error: ErrorInformation, headers: { [k: string]: string }): Promise<void>;
}

export type AuthorizationsServiceOptions = {
  knex: Knex;
  client: AxiosInstance;
  logger?: Logger;
}

export class KnexAuthorizationsService implements AuthorizationsService {
  private _knex: Knex
  private _client: AxiosInstance
  private _logger: Logger = console
  constructor (options: AuthorizationsServiceOptions) {
    this._knex = options.knex
    this._client = options.client
    this._logger = options.logger || console
  }

  async sendAuthorizationsResponse (transactionRequestId: string, request: AuthorizationsIDPutResponse, headers: { [k: string]: string }): Promise<void> {
    this._logger.debug('Authorizations Service: sending Authorizations Response: ' + transactionRequestId)
    await this._client.put(`/authorizations/${transactionRequestId}`, request, { headers })
  }

  async sendAuthorizationsErrorResponse (transactionRequestId: string, error: ErrorInformation, headers: { [k: string]: string | undefined }): Promise<void> {
    this._logger.debug('Authorizations Service: sending Authorizations Error Response: ' + transactionRequestId)
    await this._client.put(`/authorizations/${transactionRequestId}/error`, { errorInformation: error }, { headers })
  }
}
