import { generateOTP } from '../src/utils/util'

describe('Example test', function () {

  test('can generate a random OTP', async () => {
    const otp = generateOTP()

    expect(otp).toBeDefined()
  })

})
