import { QuotesIDPutResponse, QuotesPostRequest, Party, Money } from '../types/mojaloop'
import { AxiosInstance } from 'axios'
import Knex from 'knex'

export type DBQuote = {
  id: string;
  transactionId: string;
  state: string;
  amount: string;
  amountCurrency: string;
  transferAmount: string;
  transferAmountCurrency: string;
  feeAmount: string;
  feeCurrency: string;
  condition: string;
  expiration: string;
}

export type Quote = {
  id: string;
  transactionId: string;
  state: string;
  amount: Money;
  feeAmount: Money;
  transferAmount: Money;
  condition: string;
  expiration?: string;
}

export interface QuotesService {
  create (request: QuotesPostRequest, condition: string): Promise<Quote>;
  get (id: string, idType: string): Promise<Quote>;
  sendQuoteResponse (quoteId: string, response: QuotesIDPutResponse, headers: { [k: string]: string }): Promise<void>;
}

export class KnexQuotesService implements QuotesService {
  constructor (private _knex: Knex, private _client: AxiosInstance) {
  }

  async create (request: QuotesPostRequest, condition: string): Promise<Quote> {
    await this._knex<DBQuote>('quotes').insert({
      id: request.quoteId,
      transactionId: request.transactionId,
      amount: request.amount.amount,
      amountCurrency: request.amount.currency,
      expiration: request.expiration,
      condition
    }).then(results => results[0])

    return this.get(request.quoteId, 'id')
  }

  async get (id: string, idType: string): Promise<Quote> {
    const dbQuote = await this._knex<DBQuote>('quotes').where(idType, id).first()

    if (!dbQuote) {
      throw new Error(`Cannot find quote with ${idType}: ${id}`)
    }

    const quote: Quote = {
      id: dbQuote.id,
      transactionId: dbQuote.transactionId,
      amount: {
        amount: dbQuote.amount,
        currency: dbQuote.amountCurrency
      },
      feeAmount: {
        amount: dbQuote.feeAmount,
        currency: dbQuote.feeCurrency
      },
      transferAmount: {
        amount: dbQuote.transferAmount,
        currency: dbQuote.transferAmountCurrency
      },
      condition: dbQuote.condition,
      state: dbQuote.state,
      expiration: dbQuote.expiration
    }

    return quote
  }

  async sendQuoteResponse (quoteId: string, request: QuotesIDPutResponse, headers: { [k: string]: string }): Promise<void> {
    await this._client.put(`/quotes/${quoteId}`, request, { headers })
  }
}
