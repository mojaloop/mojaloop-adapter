import { Factory } from 'rosie'
import { AdaptorServices } from '../../src/adaptor'

export const AdaptorServicesFactory = Factory.define<AdaptorServices>('AdaptorServicesFactory').attrs({
  MojaClient: {
    getParties: jest.fn().mockResolvedValue(undefined),
    putParties: jest.fn(),
    putPartiesError: jest.fn(),

    postParticipants: jest.fn(),
    putParticipants: jest.fn(),
    putParticipantsError: jest.fn(),

    postQuotes: jest.fn(),
    putQuotes: jest.fn().mockResolvedValue(undefined),
    putQuotesError: jest.fn(),

    postTransfers: jest.fn(),
    putTransfers: jest.fn(),
    putTransfersError: jest.fn()
  },
  isoMessagesService: {
    create: jest.fn(),
    get: jest.fn()
  },
  transactionsService: {
    get: jest.fn(),
    create: jest.fn(),
    updatePayerFspId: jest.fn(),
    updateTransactionId: jest.fn(),
    sendToMojaHub: jest.fn().mockResolvedValue(undefined),
    updateState: jest.fn().mockResolvedValue(undefined),
    getByLpsKeyAndState: jest.fn(),
    getByPayerMsisdn: jest.fn()
  },
  quotesService: {
    create: jest.fn(),
    get: jest.fn(),
    calculateAdaptorFees: jest.fn()
  },
  authorizationsService: {
    sendAuthorizationsResponse: jest.fn().mockResolvedValue(undefined)
  }
})
