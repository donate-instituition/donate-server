import {
  sanitizeExternalApiRequest,
  sanitizeExternalApiResponse,
  sanitizeValue,
} from './sanitization';

describe('sanitization', () => {
  it('redacts sensitive values recursively', () => {
    expect(
      sanitizeValue({
        email: 'user@example.com',
        password: 'secret',
        profile: {
          cpf: '11111111111',
          nested: [{ refreshToken: 'refresh-token' }],
        },
      }),
    ).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      profile: {
        cpf: '[REDACTED]',
        nested: [{ refreshToken: '[REDACTED]' }],
      },
    });
  });

  it('sanitizes external api requests', () => {
    expect(
      sanitizeExternalApiRequest({
        method: 'POST',
        url: 'https://payments.example.test/charges?token=url-token&page=1',
        headers: {
          Authorization: 'Bearer token',
          'X-Api-Key': 'api-key',
          Accept: 'application/json',
        },
        query: {
          cnpj: '99999999000191',
          page: 1,
        },
        body: {
          amount: 100,
          cardNumber: '4111111111111111',
          customer: {
            name: 'Ana',
          },
        },
      }),
    ).toEqual({
      method: 'POST',
      url: 'https://payments.example.test/charges?token=%5BREDACTED%5D&page=1',
      headers: {
        Authorization: '[REDACTED]',
        'X-Api-Key': '[REDACTED]',
        Accept: 'application/json',
      },
      query: {
        cnpj: '[REDACTED]',
        page: 1,
      },
      body: {
        amount: 100,
        cardNumber: '[REDACTED]',
        customer: {
          name: 'Ana',
        },
      },
    });
  });

  it('sanitizes external api responses', () => {
    expect(
      sanitizeExternalApiResponse(
        {
          statusCode: 200,
          headers: {
            'set-cookie': 'session=secret',
            'content-type': 'application/json',
          },
          body: {
            access_token: 'access-token',
            message: 'ok',
            payload: 'abcdef',
          },
        },
        {
          maxStringLength: 3,
        },
      ),
    ).toEqual({
      statusCode: 200,
      headers: {
        'set-cookie': '[REDACTED]',
        'content-type': 'app...[TRUNCATED]',
      },
      body: {
        access_token: '[REDACTED]',
        message: 'ok',
        payload: 'abc...[TRUNCATED]',
      },
    });
  });
});
