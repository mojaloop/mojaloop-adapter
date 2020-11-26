import { Request, Response } from 'express'

exports.processConsent = async (req: Request, res: Response) => {
  /**
   * Here we will need to get consent
   * For now, we are assuming the consent is successful
   * Simulating the webhook and returning a consent id
   */
  // console.log('HTTP_PORT', process.env.HTTP_PORT)
  return res.send({ consentId: '8e34f91d-d078-4077-8263-2c047876fcf6' })
}
