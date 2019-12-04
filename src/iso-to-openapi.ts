import { Socket } from 'net'
import * as CONSTANTS from './utils/constant'
import { guid1 } from './utils/util'
const iso8583 = require('iso_8583')
const bcd = require('bcd')
const fetch = require('node-fetch')
const pad = require('./utils/util').pad

const sim_URL = 'http://APT-03:8444' // fs.readFileSync('Config.txt', 'utf8')
const HOST = process.env.HOST || sim_URL
const quotesEndpoint = HOST + '/payeefsp/quotes'
const otpEndpoint = HOST + '/accountlookup/authorizations'
const otpendpoint = HOST + '/otpendpoint/authorizations'
const checkParticipantEndpoint = HOST + '/accountlookup/correlationid'
const TransfersEndpoint = HOST + '/payerfsp/transfers'
const CompletionEndpoint = HOST + '/payerfsp/completion'

export async function handleISO (data: Buffer, sock: Socket) {

  const resp = data.slice(0, 2)
  const testdata = data.slice(2, data.length)
  // const testdata = new Buffer([0x01,0x46,0x31,0x32,0x30,0x30,0x49,0x53,0x4F,0x38,0x35,0x38,0x33,0x2D,0x31,0x39,0x39,0x33,0x30,0x32,0x31,0x30,0x30,0x30,0x30,0x30,0x30,0x12,0x00,0xF2,0x30,0xA5,0x41,0x08,0x00,0x80,0x00,0x00,0x00,0x00,0x00,0x06,0x00,0x00,0x00,0x10,0x00,0x02,0x02,0x09,0x75,0x82,0x68,0x72,0x40,0x10,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x08,0x21,0x07,0x48,0x22,0x00,0x18,0x70,0x19,0x08,0x21,0x09,0x48,0x22,0x08,0x21,0x08,0x94,0x30,0x30,0x30,0x30,0x31,0x30,0x5A,0x30,0x30,0x30,0x30,0x30,0x02,0x00,0x52,0x71,0x06,0x00,0x02,0x04,0x39,0x32,0x33,0x33,0x30,0x39,0x30,0x30,0x31,0x38,0x37,0x30,0x09,0x67,0x13,0x30,0x30,0x30,0x32,0x30,0x34,0x31,0x38,0x30,0x32,0x36,0x38,0x37,0x30,0x32,0x38,0x30,0x30,0x31,0x10,0x30,0x30,0x30,0x32,0x30,0x32,0x30,0x39,0x37,0x35,0x38,0x32,0x36,0x38,0x37,0x32]);
  // console.log('testdata')
  console.log(testdata)
  const header = testdata.slice(0, 21)
  const MTI = testdata.slice(21, 23)
  const msg_type = '' + bcd.decode(MTI)
  const headerdata = '' + header
  if (headerdata === 'ISO8583-1993021000000' && msg_type == '1200') {
    const MTI = testdata.slice(21, 23)
    const Field1 = testdata.slice(23, 39)
    const Field2 = testdata.slice(40, 48)
    const f2copy = testdata.slice(39, 48)
    const bb = bcd.decode(Field2)
    const Field3 = testdata.slice(48, 51)
    let processing_code = '' + bcd.decode(Field3)
    const length = processing_code.length
    if (length < 6) {
      processing_code = '0' + processing_code
    } else {
      processing_code = '' + bcd.decode(Field3)
    }
    const len = Field3.toString()
    const Field4 = testdata.slice(51, 57)
    const Field7 = testdata.slice(57, 62)
    const Field11 = testdata.slice(62, 65)
    const Field12 = testdata.slice(65, 71)
    const Field17 = testdata.slice(71, 73)
    const Field19 = testdata.slice(73, 75)
    const Field22 = testdata.slice(75, 87)
    const Field24 = testdata.slice(87, 89)
    const Field26 = testdata.slice(89, 91)
    const Field32 = testdata.slice(92, 95)
    const f32copy = testdata.slice(91, 95)
    const Field37 = testdata.slice(95, 107)
    const Field49 = testdata.slice(107, 109)
    const Field102 = testdata.slice(110, 129)
    const f102copy = testdata.slice(109, 129)
    const Field103 = testdata.slice(testdata.length - 16, testdata.length)
    const f103copy = testdata.slice(129, testdata.length)
    /***
     * iso 1993 1200.....
     */
    const ISOdata = {
      0: '' + bcd.decode(MTI),
      2: '000' + bcd.decode(Field2),
      3: processing_code,
      4: '00000' + bcd.decode(Field4),
      7: '0' + bcd.decode(Field7),
      11: '00' + bcd.decode(Field11),
      12: '' + bcd.decode(Field12),
      17: '0' + bcd.decode(Field17),
      19: '' + bcd.decode(Field19),
      22: Field22.toString(),
      24: '' + bcd.decode(Field24),
      26: '' + bcd.decode(Field26),
      32: '000' + bcd.decode(Field32),
      37: Field37.toString(),
      49: '' + bcd.decode(Field49),
      102: Field102.toString(),
      103: Field103.toString()
    }
    const customFormats = {
      2: {
        ContentType: 'n',
        Label: 'Time, local transaction (hhmmss)',
        LenType: 'llvar',
        MaxLen: 19
      },

      4: {
        ContentType: 'n',
        Label: 'Amount, transaction',
        LenType: 'llvar',
        MaxLen: 12
      },

      12: {
        ContentType: 'n',
        Label: 'Time, local transaction (hhmmss)',
        LenType: 'fixed',
        MaxLen: 12
      },

      22: {
        ContentType: 'an',
        Label: 'Point Of Service Data Code',
        LenType: 'fixed',
        MaxLen: 12
      },

      26: {
        ContentType: 'n',
        Label: 'Card Acceptor Business Type',
        LenType: 'fixed',
        MaxLen: 4
      },
      49: {
        ContentType: 'n',
        Label: 'Currency Code, Transaction',
        LenType: 'llvar',
        MaxLen: 4
      }
    }

    const isopack2 = new iso8583(ISOdata, customFormats)
    console.log('ISOdata')
    console.log(isopack2)

    const F2Value = '' + bcd.decode(Field2)
    // let phoneNo = F2Value.substring(F2Value.length-10,F2Value.length)
    const phoneNo = '27660119644'
    console.log('phoneNo :' + phoneNo)
    let stan = '' + bcd.decode(Field11)
    if (stan.length == 4) {
      stan = '00' + bcd.decode(Field11)
    }
    if (stan.length == 5) {
      stan = '0' + bcd.decode(Field11)
    }
    const currency = '' + bcd.decode(Field49)
    let F049 = ''
    if (currency === '356') {
      F049 = 'INR'
    } else if (currency === '840') {
      F049 = 'USD'
    } else if (currency === '710') {
      F049 = 'ZAR'
    } else if (currency === '967') {
      F049 = 'ZMW'
    }

    const uuid = guid1(stan)
    const amtIso = (bcd.decode(Field4) / 100).toFixed(2)
    const amtStr = amtIso.toString()

    const quote_request = {
      quoteId: '7c23e80c-d078-4077-8263-2c047876fcf6',
      transactionId: uuid,
      payee: {
        partyIdInfo: {
          partyIdType: 'IBAN',
          partyIdentifier: 'PTID1245',
          fspId: 'payerfsp'
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
          partyIdentifier: phoneNo,
          fspId: 'BankNrOne'
        }
      },
      amountType: 'RECEIVE',
      surcharge: 1,
      amount: {
        amount: amtStr,
        currency: F049
      },
      transactionType: {
        scenario: 'TRANSFER',
        initiator: 'PAYER',
        initiatorType: 'CONSUMER'
      },
      note: 'From Mats',
      expiration: new Date(new Date().getTime() + 10000)
    }

    const surcharge = 1
    quote_request.surcharge = surcharge

    const checkPayerUrl = `${checkParticipantEndpoint}/${phoneNo}`
    console.log(
      'SENDING TO ALS FOR CHECKING PARTICIPANT WITH PARTYID.' + phoneNo
    )
    /// console.log(phoneNo)
    console.log(checkPayerUrl)

    return fetch(checkPayerUrl, {
      method: 'GET'
    })
      .then((response: any) => response.text())
      .then((text: any) => {
        try {
          const data = JSON.parse(text)
          // console.log(data)
          // console.log('valid json')
          console.log('RESPONSE FROM ALS...')
          console.log(data)
          console.log('PARTICIPANT EXIST..')
          console.log('The OpenAPI Quote Request to PayeeFSP')
          console.log('-------------------------------------')
          console.log(quote_request)
          return fetch(quotesEndpoint, {
            headers: {
              Accept: 'application/vnd.interoperability.quotes+json;version=1',
              'Content-Type':
                'application/vnd.interoperability.quotes+json;version=1.0',
              'FSPIOP-Source': 'atm',
              'FSPIOP-Destination': 'payeefsp',
              Date: new Date().toISOString()
            },
            method: 'POST',
            body: JSON.stringify(quote_request)
          })
            .then((res: any) => res.json())
            .then((res: any) => {
              const quoteAmount = res.quoteAmount.amount
              const acquirerfee = res.payeeReceiveAmount.acquirerfee
              let payeefspfee = res.payeeReceiveAmount.payeefspfee
              payeefspfee = Number(payeefspfee) * 100
              payeefspfee = payeefspfee.toString()
              console.log('payeefspfee :')
              console.log(payeefspfee)
              // console.log('res.quoteAmount')
              // console.log(res.quoteAmount)
              // console.log(res.quoteAmount.amount)
              let amount = res.quoteAmount.amount
              amount = amount * 100
              const Quote_amt_buf = Buffer.from([
                0x00,
                0x07,
                0xa0,
                0x02,
                0x04,
                0x01,
                0x01,
                0x01,
                0x00
              ])

              //  console.log('Quote_amt_buf')
              //  console.log(Quote_amt_buf)

              const Quote_amt_buf1 = Buffer.from([0x01, 0x01, 0x01, 0x00])
              //  console.log('amount')
              //  console.log(bcd.decode(Quote_amt_buf1))

              //  console.log(res.quoteAmount.currency)
              // QuoteRes
              const Quote_res = Buffer.from([
                0x49,
                0x53,
                0x4f,
                0x38,
                0x35,
                0x38,
                0x33,
                0x2d,
                0x31,
                0x39,
                0x39,
                0x33,
                0x30,
                0x32,
                0x31,
                0x30,
                0x30,
                0x30,
                0x30,
                0x30,
                0x30,
                0x12,
                0x10,
                0xf6,
                0x70,
                0xa0,
                0x11,
                0x0a,
                0x01,
                0xa0,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x16,
                0x00,
                0x00,
                0x00,
                0x10,
                0x00,
                0x02,
                0x02,
                0x09,
                0x75,
                0x82,
                0x68,
                0x72,
                0x40,
                0x10,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x08,
                0x21,
                0x07,
                0x48,
                0x22,
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x18,
                0x70,
                0x19,
                0x08,
                0x21,
                0x09,
                0x48,
                0x22,
                0x08,
                0x21,
                0x08,
                0x94,
                0x19,
                0x08,
                0x21,
                0x06,
                0x00,
                0x02,
                0x04,
                0x39,
                0x32,
                0x33,
                0x33,
                0x30,
                0x39,
                0x30,
                0x30,
                0x31,
                0x38,
                0x37,
                0x30,
                0x00,
                0x00,
                0x00,
                0x04,
                0xa0,
                0x02,
                0x01,
                0x70,
                0x09,
                0x67,
                0x09,
                0x99,
                0x06,
                0x00,
                0x02,
                0x02,
                0x13,
                0x30,
                0x30,
                0x30,
                0x32,
                0x30,
                0x34,
                0x31,
                0x38,
                0x30,
                0x32,
                0x36,
                0x38,
                0x37,
                0x30,
                0x32,
                0x38,
                0x30,
                0x30,
                0x31,
                0x10,
                0x30,
                0x30,
                0x30,
                0x32,
                0x30,
                0x32,
                0x30,
                0x39,
                0x37,
                0x35,
                0x38,
                0x32,
                0x36,
                0x38,
                0x37,
                0x32
              ])

              //* ****************************************** Quote res handling*/

              console.log('Quote_res')
              console.log(Quote_res)
              const header = Quote_res.slice(0, 21)
              const headers = Quote_res.slice(0, 21)
              const headerdata = '' + header
              if (headerdata == 'ISO8583-1993021000000') {
                const MTI = Quote_res.slice(21, 23)
                const Field1 = Quote_res.slice(23, 39)
                const Field2 = Quote_res.slice(40, 48)
                const f2copy = Quote_res.slice(39, 48)
                const bb = bcd.decode(Field2)
                const Field3 = Quote_res.slice(48, 51)
                let processing_code = '' + bcd.decode(Field3)
                const length = processing_code.length
                if (length < 6) {
                  processing_code = '0' + processing_code
                } else {
                  processing_code = '' + bcd.decode(Field3)
                }
                const len = Field3.toString()
                // console.log(len.length);
                const Field4 = Quote_res.slice(51, 57)
                // console.log(Field4)
                // console.log('Field4')
                // console.log(bcd.decode(Field4))
                const Field6 = Quote_res.slice(57, 63)
                // console.log('Field6')
                // console.log(bcd.decode(Field6))

                const Field7 = Quote_res.slice(63, 68)
                // console.log(Field7)
                // console.log('Field7')
                // console.log(bcd.decode(Field7))
                const Field10 = Quote_res.slice(68, 72)
                const Field11 = Quote_res.slice(72, 75)
                //   console.log(Field11)
                //   console.log('Field11')
                //   console.log(bcd.decode(Field11))
                const Field12 = Quote_res.slice(75, 81)
                //   console.log(Field12)
                //   console.log('Field12')
                //   console.log(bcd.decode(Field12))
                const Field17 = Quote_res.slice(81, 83)
                //   console.log(Field17)
                //   console.log('Field17')
                //   console.log(bcd.decode(Field17))
                const Field19 = Quote_res.slice(83, 85)
                //   console.log(Field19)
                //   console.log('Field19')
                //   console.log(bcd.decode(Field19))
                const Field28 = Quote_res.slice(85, 88)
                const Field32 = Quote_res.slice(89, 92)
                const f32copy = Quote_res.slice(88, 92)
                const Field37 = Quote_res.slice(92, 104)
                const Field39 = Buffer.from([0x00, 0x00])
                const Field39res = '000'
                const Field48copy = Quote_res.slice(107, 112)
                const Field48 = Quote_res.slice(108, 112)
                const Field49 = Quote_res.slice(112, 114)
                const Field51 = Quote_res.slice(114, 116)
                const Field100copy = Quote_res.slice(116, 120)
                const Field100 = Quote_res.slice(117, 120)
                const Field102 = Quote_res.slice(121, 140)
                const f102copy = Quote_res.slice(120, 140)
                const Field103 = Quote_res.slice(
                  Quote_res.length - 16,
                  Quote_res.length
                )
                const f103copy = Quote_res.slice(140, Quote_res.length)
                const init_len = Buffer.from([0x00, 0xa0])
                var Quote_res_buf_arr = [
                  init_len,
                  header,
                  MTI,
                  Field1,
                  f2copy,
                  Field3,
                  Field4,
                  Field6,
                  Field7,
                  Field10,
                  Field11,
                  Field12,
                  Field17,
                  Field19,
                  Field28,
                  f32copy,
                  Field37,
                  Field39,
                  Quote_amt_buf,
                  Field49,
                  Field51,
                  Field100copy,
                  f102copy,
                  f103copy
                ]
                var Quote_res_buf = Buffer.concat(Quote_res_buf_arr)
                const Quote_res_ISOdata = {
                  0: '' + bcd.decode(MTI),
                  2: '000' + bcd.decode(Field2),
                  3: processing_code,
                  4: '00000' + bcd.decode(Field4),
                  6: '00000' + bcd.decode(Field6),
                  7: '0' + bcd.decode(Field7),
                  10: '0000000' + bcd.decode(Field10),
                  11: '00' + bcd.decode(Field11),
                  12: '' + bcd.decode(Field12),
                  17: '0' + bcd.decode(Field17),
                  19: '' + bcd.decode(Field19),
                  28: '' + bcd.decode(Field28),
                  32: '000' + bcd.decode(Field32),
                  37: Field37.toString(),
                  39: Field39res,
                  48: '0' + bcd.decode(Quote_amt_buf1),
                  49: '' + bcd.decode(Field49),
                  51: '' + bcd.decode(Field51),
                  100: '000' + bcd.decode(Field100),
                  102: Field102.toString(),
                  103: Field103.toString()
                }
                const customFormats = {
                  2: {
                    ContentType: 'n',
                    Label: 'Time, local transaction (hhmmss)',
                    LenType: 'llvar',
                    MaxLen: 19
                  },

                  4: {
                    ContentType: 'n',
                    Label: 'Amount, transaction',
                    LenType: 'llvar',
                    MaxLen: 12
                  },

                  12: {
                    ContentType: 'n',
                    Label: 'Time, local transaction (hhmmss)',
                    LenType: 'fixed',
                    MaxLen: 12
                  },

                  22: {
                    ContentType: 'an',
                    Label: 'Point Of Service Data Code',
                    LenType: 'fixed',
                    MaxLen: 12
                  },

                  26: {
                    ContentType: 'n',
                    Label: 'Card Acceptor Business Type',
                    LenType: 'fixed',
                    MaxLen: 4
                  },
                  49: {
                    ContentType: 'n',
                    Label: 'Currency Code, Transaction',
                    LenType: 'llvar',
                    MaxLen: 4
                  }
                }

                //* ***************************************End of Quote res handling */

                const Quote_res_pack = new iso8583(
                  Quote_res_ISOdata,
                  customFormats
                )
                console.log('Quote_res_pack')
                console.log(Quote_res_pack)
                sock.write(Quote_res_buf)
              }
            })
        } catch (err) {
          console.log('invalid json')
          console.log(err)
        }
      })
      .catch((err: any) => console.log(err))
  } else {
    //* ********************************************** */

    const isoUnpacked = new iso8583().getIsoJSON(data)
    const isopack1 = new iso8583(isoUnpacked)
    if (isopack1.validateMessage()) {
      console.log(' iso message :')
      console.log(isoUnpacked)
      if (isopack1.validateMessage()) {
        // console.log(` iso message type: ${isoUnpacked[0]}`)

        //* ******************************************************************/

        const amtIso = (+isoUnpacked[4] / 100).toFixed(2)
        const amtStr = amtIso.toString()
        let F049 = ''
        if (isoUnpacked[49] === 356) {
          F049 = 'INR'
        } else if (isoUnpacked[49] === 840) {
          F049 = 'USD'
        } else if (isoUnpacked[49] === 710) {
          F049 = 'ZAR'
        }

        const phoneNo = isoUnpacked[2].substr(0, 11)
        const uuid = guid1(isoUnpacked[11])

        const quote_request = {
          quoteId: '7c23e80c-d078-4077-8263-2c047876fcf6',
          transactionId: uuid,
          payee: {
            partyIdInfo: {
              partyIdType: 'IBAN',
              partyIdentifier: isoUnpacked[41],
              fspId: 'payerfsp'
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
              partyIdentifier: phoneNo,
              fspId: 'BankNrOne'
            }
          },
          amountType: 'RECEIVE',
          surcharge: '',
          amount: {
            amount: amtStr,
            currency: F049
          },
          transactionType: {
            scenario: 'TRANSFER',
            initiator: 'PAYER',
            initiatorType: 'CONSUMER'
          },
          note: 'From Mats',
          expiration: new Date(new Date().getTime() + 10000)
        }

        if (isoUnpacked[0] === '0100') {
          const c = isoUnpacked[28]
          const a = c.split('D')
          const phoneNo = isoUnpacked[2].substr(0, 11)
          const surcharge = a[1]
          quote_request.surcharge = surcharge
          // console.log("The OpenAPI Quote Request to PayeeFSP")
          // console.log("-------------------------------------")
          // console.log(quote_request)

          const checkPayerUrl = `${checkParticipantEndpoint}/${phoneNo}`
          console.log(
            'SENDING TO ALS FOR CHECKING PARTICIPANT WITH PARTYID.' + phoneNo
          )
          /// console.log(phoneNo)
          console.log(checkPayerUrl)
          return fetch(checkPayerUrl, {
            method: 'GET'
          })
            .then((response: any) => response.text())
            .then((text: any) => {
              try {
                const data = JSON.parse(text)
                console.log('RESPONSE FROM ALS...')
                console.log(data)
                console.log('PARTICIPANT EXIST..')
                console.log('The OpenAPI Quote Request to PayeeFSP')
                console.log('-------------------------------------')
                console.log(quote_request)

                return fetch(quotesEndpoint, {
                  headers: {
                    Accept:
                      'application/vnd.interoperability.quotes+json;version=1',
                    'Content-Type':
                      'application/vnd.interoperability.quotes+json;version=1.0',
                    'FSPIOP-Source': 'atm',
                    'FSPIOP-Destination': 'payeefsp',
                    Date: new Date().toISOString()
                  },
                  method: 'POST',
                  body: JSON.stringify(quote_request)
                })
                  .then((res: any) => res.json())
                  .then((res: any) => {
                    let quoteAmount = res.quoteAmount.amount
                    let acquirerfee = res.payeeReceiveAmount.acquirerfee
                    let payeefspfee = res.payeeReceiveAmount.payeefspfee
                    payeefspfee = Number(payeefspfee) * 100
                    payeefspfee = payeefspfee.toString()

                    console.log('payeefspfee :')
                    console.log(payeefspfee)

                    console.log(res.quoteAmount)
                    console.log(isopack1)
                    console.log(
                      'isoUnpacked after receiving quotes----------------'
                    )
                    console.log(isoUnpacked[0])
                    if (isoUnpacked[0] === '0100') {
                      const isoUnpackedCopy = isoUnpacked
                      isoUnpackedCopy[0] = '0110'
                      // isoUnpackedCopy[28] = acquirerfee;
                      isoUnpackedCopy[30] = 'D00000' + payeefspfee
                      isoUnpackedCopy[39] = '00'
                      const quotenoSend = pad(+quoteAmount * 100, 7)
                      isoUnpackedCopy[48] = quoteAmount.toString()
                      // isoUnpackedCopy[48] = Math.floor(quoteAmount).toString();
                      const isopack = new iso8583(isoUnpackedCopy)
                      console.log('isopacked----------------')
                      console.log(isopack)
                      console.log(isopack.getBmpsBinary)
                      sock.write(isopack.getBufferMessage())
                    }
                  })
              } catch (err) {
                console.log('invalid json')
                console.log(err)
                const isoUnpackedCopy = isoUnpacked
                isoUnpackedCopy[0] = '0110'
                isoUnpackedCopy[39] = '56'
                const isopack = new iso8583(isoUnpackedCopy)
                console.log('isopacked----------------')
                console.log(isopack)
                console.log(isopack.getBmpsBinary)
                console.log('sending 0110 message with resp code 56')
                sock.write(isopack.getBufferMessage())
              }
            })
            .catch((err: any) => console.log(err))
        }
        const transaction_request = {
          quoteId: '7c23e80c-d078-4077-8263-2c047876fcf6',
          transactionId: uuid,
          payee: {
            partyIdInfo: {
              partyIdType: 'IBAN',
              partyIdentifier: isoUnpacked[41],
              fspId: 'payerfsp'
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
              partyIdentifier: phoneNo,
              fspId: 'BankNrOne'
            }
          },
          amountType: 'RECEIVE',
          surcharge: '',
          amount: {
            amount: amtStr,
            currency: F049
          },
          transactionType: {
            scenario: 'TRANSFER',
            initiator: 'PAYER',
            initiatorType: 'CONSUMER'
          },
          note: 'From Mats',
          expiration: new Date(new Date().getTime() + 10000)
        }

        if (isoUnpacked[0] === '0200') {
          const isoUnpackedCopy = isoUnpacked
          isoUnpackedCopy[0] = '0210'
          isoUnpackedCopy[39] = '00'
          const otp_request = {
            phoneNo: isoUnpackedCopy[102],
            inputOtp: isoUnpackedCopy[103]
          }

          console.log('Sending to otp verification to ' + otpendpoint)
          console.log(otp_request)
          return fetch(otpEndpoint, {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(otp_request)
          })
            .then((res: any) => res.json())
            .then((res: any) => {
              if (res.status === CONSTANTS.OTP_VERIFIED) {
                console.log('otp verified')

                // transfer req
                const TransactionUrl = `${TransfersEndpoint}/${phoneNo}`
                console.log('Sending Transaction request to ' + TransactionUrl)

                fetch(TransactionUrl, {
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                  },
                  method: 'PUT',
                  body: JSON.stringify(transaction_request)
                }).then((res: any) => {
                  console.log(res)
                  if (res.status === 200) {
                    // isoUnpackedCopy[0] = '0210';
                    isoUnpackedCopy[39] = '00'
                    const isopack = new iso8583(isoUnpackedCopy)
                    console.log('isopacked----------------')
                    console.log(isopack)
                    console.log(isopack.getBmpsBinary)
                    sock.write(isopack.getBufferMessage())
                  }
                })
              } else {
                console.log('otp failed')
                console.log(res.response)
                isoUnpackedCopy[39] = '12'
                const isopack = new iso8583(isoUnpackedCopy)
                console.log('isopacked----------------')
                console.log(isopack)
                console.log(isopack.getBmpsBinary)
                sock.write(isopack.getBufferMessage())
              }
            })
        }
        // ---------------------------------------------------------------------------------

        // completion message

        if (isoUnpacked[0] === '0202') {
          const isoUnpackedCopy = isoUnpacked

          const completion_msg = {
            quoteId: '7c23e80c-d078-4077-8263-2c047876fcf6',
            transactionId: uuid,
            payee: {
              partyIdInfo: {
                partyIdType: 'IBAN',
                partyIdentifier: isoUnpacked[41],
                fspId: 'payerfsp'
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
                partyIdentifier: phoneNo,
                fspId: 'BankNrOne'
              }
            },
            amountType: 'RECEIVE',
            surcharge: '',
            amount: {
              amount: amtStr,
              currency: F049
            },
            transactionType: {
              scenario: 'TRANSFER',
              initiator: 'PAYER',
              initiatorType: 'CONSUMER'
            },
            note: 'From Mats',
            expiration: new Date(new Date().getTime() + 10000)
          }
          const checkCompletionUrl = `${CompletionEndpoint}/${phoneNo}`
          return fetch(checkCompletionUrl, {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(completion_msg)
          }).then((res: any) => console.log(res))
        }

        // end of completion message
      }
    } else {
      console.log('Connected to nginx')
    }
  }
}
