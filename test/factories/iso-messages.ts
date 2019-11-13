import { Factory } from 'rosie'
import Faker from 'faker'
import { ISO0100, ISO0110 } from '../../src/types/iso-messages'

function pad (value: string, length: number, char: string) {
  if (value.length >= length) {
    return value.substring(0, length)
  }

  const diff = length - value.length
  let padding = ''

  for (let i = 0; i < diff; i++) {
    padding += char
  }

  return padding + value
}

function generateField7 (): string {
  const now = new Date(Date.now())
  const month = (now.getUTCMonth() + 1).toString()
  const day = now.getUTCDate().toString()
  const minutes = now.getUTCMinutes().toString()
  const hours = now.getUTCHours().toString()
  const seconds = now.getUTCSeconds().toString()

  return pad(month, 2, '0') + pad(day, 2, '0') + pad(hours, 2, '0') + pad(minutes, 2, '0') + pad(seconds, 2, '0')
}

export const ISO0100Factory = Factory.define<Partial<ISO0100>>('Iso0100Factory').attrs({
  3: '012000',
  4: '000000010000',
  49: '820',
  7: generateField7(),
  37: Faker.internet.password(12, false, /[0-9a-z]/),
  41: Faker.internet.password(8, false, /[0-9a-z]/),
  42: Faker.internet.password(15, false, /[0-9a-z]/),
  102: () => '26' + Faker.internet.password(26, false, /[0-9]/),
  28: 'C00000001',
  103: () => '04' + Faker.internet.password(6, false, /[0-9]/),
  11: Faker.internet.password(6, false, /[0-9]/)
})

export const ISO0110Factory = Factory.define<Partial<ISO0110>>('Iso0110Factory').attrs({
  0: '0110',
  3: '012000',
  7: generateField7(),
  11: Faker.internet.password(6, false, /[0-9]/),
  28: 'C00000001',
  30: 'C00000001',
  39: '00',
  41: Faker.internet.password(8, false, /[0-9a-z]/),
  42: Faker.internet.password(15, false, /[0-9a-z]/),
  48: '012000',
  49: '840',
  102: () => '26' + Faker.internet.password(26, false, /[0-9]/)
})
