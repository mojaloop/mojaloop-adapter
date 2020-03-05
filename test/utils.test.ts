import { assertExists } from '../src/utils/util'

describe('Utils', () => {
  test('assertExists throws error if value is null', async () => {
    expect(() => { assertExists<string>(null, 'Does not exist') }).toThrowError('Does not exist')
  })

  test('assertExists throws error if value is undefined', async () => {
    expect(() => { assertExists<string>(undefined, 'Does not exist') }).toThrowError('Does not exist')
  })

  test('returns correctly typed value if it does exist', async () => {
    const value = assertExists<string>('test', 'Does not exist')

    expect(typeof value).toBe('string')
  })
})
