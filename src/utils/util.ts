import { ErrorInformationResponse } from 'types/mojaloop'

/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Renjith Palamattom  <renjith@coil.com>
 --------------
 ******/

export function pad (value: string, length: number, char: string): string {
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

export function buildMojaloopErrorResponse (errorCode: string, errorDescription: string): ErrorInformationResponse {
  return {
    errorInformation: {
      errorCode,
      errorDescription
    }
  }
}

// based on https://github.com/Microsoft/TypeScript/issues/8655#issuecomment-373864014
export function assertExists<T> (value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message)
  }

  return value
}
