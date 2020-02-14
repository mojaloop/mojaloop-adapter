import { Factory } from 'rosie'
import { AdaptorServices } from '../../src/adaptor'

export const AdaptorServicesFactory = Factory.define<AdaptorServices>('AdaptorServicesFactory').attrs({
  mojaClient: {
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
    putTransfersError: jest.fn(),

    postTransactionRequests: jest.fn(),
    putTransactionRequests: jest.fn(),
    putTransactionRequestsError: jest.fn()
  },
  calculateAdaptorFees: () => jest.fn().mockResolvedValue({ amount: '0', currency: 'USD' }),
  quotesService: {
    create: jest.fn(),
    get: jest.fn(),
    calculateAdaptorFees: jest.fn()
  },
  transfersService: {
    get: jest.fn(),
    create: jest.fn(),
    updateTransferState: jest.fn(),
    calculateFulfilment: jest.fn()
  },
  authorizationsService: {
    sendAuthorizationsResponse: jest.fn().mockResolvedValue(undefined),
    sendAuthorizationsErrorResponse: jest.fn().mockResolvedValue(undefined)
  },
  queueService: {
    addToQueue: jest.fn(),
    shutdown: jest.fn()
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  ilpService: {
    caluclateFulfil: jest.fn(),
    getQuoteResponseIlp: jest.fn().mockReturnValue({ condition: 'condition', ilpPacket: 'ilpPacket' })
  }
})
