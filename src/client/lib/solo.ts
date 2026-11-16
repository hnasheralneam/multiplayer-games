import { randInt } from '../../shared/engine/crypto';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/types';

/** Four characters, same alphabet as server rooms. Solo codes never leave
 *  this browser, so no collision check is needed. */
export function makeSoloCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randInt(0, CODE_ALPHABET.length)];
  }
  return code;
}
