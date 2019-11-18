import { ISO0100Factory } from '../factories/iso-messages'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from '../factories/adaptor-services'

describe('Transaction Requests API', function () {

  // TODO: swap out for knexTransactionService once it's complete
  const services = AdaptorServicesFactory.build({
    transactionRequestService: {
      getById: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: '123' }),
      updatePayerFspId: jest.fn(),
      sendToMojaHub: jest.fn()
    }
  })

  let adaptor: Server
  beforeAll(async () => {
    adaptor = await createApp(services)
  })

  test('stores the ISO0100 message', async () => {
    const iso0100 = ISO0100Factory.build()

    const response = await adaptor.inject({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: iso0100
    })

    expect(response.statusCode).toBe(200)
    expect(services.isoMessagesService.create).toHaveBeenCalledWith({ transactionRequestId: '123', ...iso0100 })
  })

  test('creates a transaction request from the ISO0100 message', async () => {
    const iso0100 = ISO0100Factory.build()

    const response = await adaptor.inject({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: iso0100
    })

    expect(response.statusCode).toEqual(200)
    expect(services.transactionRequestService.create).toBeCalledWith({
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '9605968739'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: '12345678',
          partySubIdOrType: '123450000067890'
        }
      },
      amount: {
        amount: '000000010000',
        currency: '840'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '20180328'
    })
    expect(services.transactionRequestService.getById).toBeCalledWith({
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '2628529378534082744782193084'
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: 'wd1sbexj',
          partySubIdOrType: '5d8wu7jyldfxl1y'
        }
      },
      amount: {
        amount: '000000010000',
        currency: '820'
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: '1118042914'
    })

  })

  test('Requests an account lookup and uses the transactionRequestId as the traceId', async () => {
    const iso0100 = ISO0100Factory.build()

    const response = await adaptor.inject({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: iso0100
    })

    expect(response.statusCode).toEqual(200)
    expect(services.accountLookupService.requestFspIdFromMsisdn).toHaveBeenCalledWith('123', iso0100[102])
  })

})
