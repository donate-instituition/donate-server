import { BadRequestException } from '@nestjs/common';

import { assertPasswordPolicy } from './password-policy';

describe('assertPasswordPolicy', () => {
  it('accepts strong passwords', () => {
    expect(() => assertPasswordPolicy('Secret123')).not.toThrow();
  });

  it.each([
    ['short', 'Abc12'],
    ['missing lowercase', 'SECRET123'],
    ['missing uppercase', 'secret123'],
    ['missing number', 'Secretxxx'],
  ])('rejects %s passwords', (_caseName, password) => {
    expect(() => assertPasswordPolicy(password)).toThrow(BadRequestException);
  });
});
