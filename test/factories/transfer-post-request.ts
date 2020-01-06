import { Factory } from 'rosie'
import Faker from 'faker'
// import { Transfer } from '../../src/services/transfers-service'
import { TransfersPostRequest } from '../../src/types/mojaloop'
import * as util from 'util'

const sdk = require('@mojaloop/sdk-standard-components')

const quoteRequest = {
  quoteId: '20508186-1458-4ac0-a824-d4b07e37d7b3',
  transactionId: '20508186-1458-4ac0-a824-d4b07e37d7b3',
  payee: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '123456789',
      fspId: 'MobileMoney'
    }
  },
  payer: {
    personalInfo: {
      complexName: {
        firstName: 'Mats',
        lastName: 'Hagman'
      }
    },
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '9876543',
      fspId: 'BankNrOne'
    }
  },
  amountType: 'RECEIVE',
  amount: {
    amount: '100',
    currency: 'USD'
  },
  transactionType: {
    scenario: 'TRANSFER',
    initiator: 'PAYER',
    initiatorType: 'CONSUMER',
    balanceOfPayments: '110'
  },
  geoCode: {
    latitude: '52.295971',
    longitude: '-0.038400'
  },
  note: 'From Mats',
  expiration: '2017-11-15T22:17:28.985-01:00'
}

const partialResponse = {
  transferAmount: {
    amount: '500',
    currency: 'USD'
  },
  payeeReceiveAmount: {
    amount: '490',
    currency: 'USD'
  },
  payeeFspFee: {
    amount: '5',
    currency: 'USD'
  },
  payeeFspCommission: {
    amount: '5',
    currency: 'USD'
  },
  geoCode: {
    latitude: '53.295971',
    longitude: '-0.038500'
  },
  expiration: '2017-11-15T14:17:09.663+01:00'
}

function getIlpPacketString (): string {
  const transactionObject = {
    transactionId: quoteRequest.transactionId,
    quoteId: quoteRequest.quoteId,
    payee: quoteRequest.payee,
    payer: quoteRequest.payer,
    amount: partialResponse.transferAmount,
    transactionType: quoteRequest.transactionType,
    note: quoteRequest.note
  }

  const ilpData = Buffer.from(sdk.base64url(JSON.stringify(transactionObject)))
  const packetInput = {
    amount: this._getIlpCurrencyAmount(partialResponse.transferAmount), // unsigned 64bit integer as a string
    account: this._getIlpAddress(quoteRequest.payee), // ilp address
    data: ilpData // base64url encoded attached data
  }

  const packet = sdk.ilpPacket.serializeIlpPayment(packetInput)

  const base64encodedIlpPacket = sdk.base64url.fromBase64(packet.toString('base64')).replace('"', '')

  // const generatedFulfilment = this.caluclateFulfil(base64encodedIlpPacket).replace('"', '')
  // const generatedCondition = this.calculateConditionFromFulfil(generatedFulfilment).replace('"', '')

  this.logger.log(`Generated ILP: transaction object: ${util.inspect(transactionObject)}\nPacket input: ${util.inspect(packetInput)}\nOutput: ${util.inspect(base64encodedIlpPacket)}`)

  return base64encodedIlpPacket
}

export const TransferPostRequestFactory = Factory.define<TransfersPostRequest>('TransferPostRequestFactory').attrs({
  transferId: () => Faker.random.uuid(),
  payeeFsp: () => Faker.random.uuid(),
  payerFsp: () => Faker.random.uuid(),
  amount: () => ({
    amount: Faker.random.number().toString(),
    currency: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 3)
  }),
  condition: () => Faker.random.uuid(),
  expiration: () => Faker.random.uuid(),
  ilpPacket: () => getIlpPacketString()
})

// transferPostRequest structure
//  transferId: string;
//  payeeFsp: string;
//  payerFsp: string;
//  amount: Money;
//  ilpPacket: string;
//  condition: string;
//  expiration: string;
//  extensionList?: ExtensionList;
