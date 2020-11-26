import { Request, Response } from 'express'
import axios from 'axios'
import xml from 'xml2js'
const builder = new xml.Builder({
  renderOpts: { pretty: false }
})

const thirdpartySchemeAdapterOutbound = 'http://pisp-thirdparty-scheme-adapter-outbound:7006'

exports.transfer = async (req: Request, res: Response) => {
  res.set('Content-Type', 'text/xml')
  try {
    const transactionRequestId = req.body.FIToFICstmrCdtTrf.GrpHdr.MsgId
    const payerPartyIdentifier = req.body.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.CtctDtls.MobNb
    const payeePartyIdentifier = req.body.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.CtctDtls.MobNb
    const amount = req.body.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.amount

    // LOOKUP PHASE
    const lookupRequest = {
      payee: {
        partyIdType: 'MSISDN',
        partyIdentifier: payeePartyIdentifier
      },
      transactionRequestId: transactionRequestId
    }
    const lookupResponse = await axios.post(`${thirdpartySchemeAdapterOutbound}/thirdpartyTransaction/partyLookup`, lookupRequest)
    console.log('lookupResponse', lookupResponse.status, lookupResponse.data)
    if (lookupResponse.status !== 200 || lookupResponse.data.currentState !== 'partyLookupSuccess') {
      throw new Error(lookupResponse.data.errorInformation.errorDescription)
    }

    // INITIATE PHASE
    const initiateURI = `${thirdpartySchemeAdapterOutbound}/thirdpartyTransaction/${transactionRequestId}/initiate`
    const initiateRequest = {
      sourceAccountId: 'dfspa.alice.1234',
      consentId: '8e34f91d-d078-4077-8263-2c047876fcf6',
      payee: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: payeePartyIdentifier,
          fspId: 'dfspb'
        }
      },
      payer: {
        personalInfo: {
          complexName: {
            firstName: 'Alice',
            lastName: 'K'
          }
        },
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: payerPartyIdentifier,
          fspId: 'dfspa'
        }
      },
      amountType: 'SEND',
      amount: {
        amount: amount,
        currency: 'USD'
      },
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      },
      expiration: '2020-07-15T22:17:28.985-01:00'
    }

    const initiateresponse = await axios.post(initiateURI, initiateRequest)
    console.log('initiateresponse', initiateresponse.data)
    if (initiateresponse.status !== 200 || initiateresponse.data.currentState !== 'authorizationReceived') {
      throw new Error('Initial transation error')
    }

    const approveURI = `${thirdpartySchemeAdapterOutbound}/thirdpartyTransaction/${transactionRequestId}/approve`
    const approveRequest = {
      authorizationResponse: {
        authenticationInfo: {
          authentication: 'U2F',
          authenticationValue: {
            pinValue: 'xxxxxxxxxxx',
            counter: '1'
          }
        },
        responseType: 'ENTERED'
      }
    }
    const approveResponse = await axios.post(approveURI, approveRequest)
    console.log('approveResponse', approveResponse.data)
    if (approveResponse.status !== 200 || approveResponse.data.currentState !== 'transactionStatusReceived' || approveResponse.data.transactionStatus.transactionRequestState !== 'ACCEPTED') {
      throw new Error('Approve request error')
    }

    return res.send(builder.buildObject({
      response: {
        code: 3000,
        message: 'Success'
      }
    }))
  } catch (error) {
    return res.send(builder.buildObject({
      response: {
        code: 3032,
        message: error.message
      }
    }))
  }
}
