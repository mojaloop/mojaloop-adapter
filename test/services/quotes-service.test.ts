import Knex from 'knex'
import Axios, { AxiosInstance } from 'axios'
import { KnexQuotesService, DBQuote } from '../../src/services/quotes-service'
import { Money } from '../../src/types/mojaloop'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'

describe('Quotes service', function () {
  let knex: Knex
  let quotesService: KnexQuotesService
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })
    const fakeLogger = { log: jest.fn() }
    quotesService = new KnexQuotesService(knex, fakeHttpClient, 'secret', fakeLogger)
  })

  beforeEach(async () => {
    await knex.migrate.latest()
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  describe('create', () => {
    test('stores quote', async () => {
      Date.now = jest.fn().mockReturnValue(0)
      const quoteRequest = QuotesPostRequestFactory.build({
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })
      const fees: Money = { amount: '1', currency: 'USD' }
      const commission: Money = { amount: '2', currency: 'USD' }
      const transferAmount: Money = { amount: '103', currency: 'USD' }

      await quotesService.create(quoteRequest, fees, commission)

      const dbQuote = await knex<DBQuote>('quotes').where('id', quoteRequest.quoteId).first()

      if (!dbQuote) {
        fail('dbQuote does not exist')
      }
      expect(dbQuote.id).toBe(quoteRequest.quoteId)
      expect(dbQuote.transactionId).toBe(quoteRequest.transactionId)
      expect(dbQuote.amount).toBe(quoteRequest.amount.amount)
      expect(dbQuote.amountCurrency).toBe(quoteRequest.amount.currency)
      expect(dbQuote.feeAmount).toBe(fees.amount)
      expect(dbQuote.feeCurrency).toBe(fees.currency)
      expect(dbQuote.commission).toBe(commission.amount)
      expect(dbQuote.commissionCurrency).toBe(commission.currency)
      expect(dbQuote.transferAmount).toBe(transferAmount.amount)
      expect(dbQuote.transferAmountCurrency).toBe(transferAmount.currency)
      expect(dbQuote.expiration).toEqual((new Date(Date.now() + 10000)).toUTCString())
      expect(dbQuote.condition).toBeDefined()
      expect(dbQuote.ilpPacket).toBeDefined()
    })

    test('calculates transferAmount', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })
      const fees: Money = { amount: '1', currency: 'USD' }
      const commission: Money = { amount: '2', currency: 'USD' }
      const transferAmount: Money = { amount: '103', currency: 'USD' }

      const quote = await quotesService.create(quoteRequest, fees, commission)

      expect(quote.transferAmount).toMatchObject(transferAmount)
    })

    test('generates ilpPacket and condition', async () => {
      const quoteRequest = QuotesPostRequestFactory.build({
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })
      const fees: Money = { amount: '1', currency: 'USD' }
      const commission: Money = { amount: '2', currency: 'USD' }

      const quote = await quotesService.create(quoteRequest, fees, commission)

      expect(quote.condition).toBeDefined()
      expect(quote.ilpPacket).toBeDefined()
    })
  })

  test('can get a quote', async () => {
    const quoteRequest = QuotesPostRequestFactory.build({
      amount: {
        amount: '100',
        currency: 'USD'
      }
    })
    const fees: Money = { amount: '1', currency: 'USD' }
    const commission: Money = { amount: '2', currency: 'USD' }
    const transferAmount: Money = { amount: '103', currency: 'USD' }
    await quotesService.create(quoteRequest, fees, commission)

    const quote = await quotesService.get(quoteRequest.quoteId, 'id')

    expect(quote.amount).toMatchObject(quoteRequest.amount)
    expect(quote.fees).toMatchObject(fees)
    expect(quote.commission).toMatchObject(commission)
    expect(quote.id).toEqual(quoteRequest.quoteId)
    expect(quote.transactionId).toEqual(quoteRequest.transactionId)
    expect(quote.transferAmount).toEqual(transferAmount)
  })

  test('calculates adaptor fees as 0 if calculateAdaptorFees is not registered', async () => {
    const amount: Money = {
      amount: '100',
      currency: 'USD'
    }

    const adaptorFees = await quotesService.calculateAdaptorFees(amount)

    expect(adaptorFees).toEqual({ amount: '0', currency: 'USD' })
  })
})
