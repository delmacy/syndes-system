import express from 'express';
import request from 'supertest';
import { registerCsvBodyParser } from './csv-body-parser';
import { MAX_CSV_BYTES } from './csv-parser';

describe('CSV HTTP body boundary (CRM-08)', () => {
  function buildApp() {
    const app = express();
    registerCsvBodyParser(app);
    app.post('/api/v1/crm/csv/import', (incoming, response) => {
      const body = incoming.body as unknown;
      if (Buffer.isBuffer(body)) {
        response.json({ isBuffer: true, text: body.toString('utf8') });
      } else {
        response.json({ isBuffer: false, text: null });
      }
    });
    return app;
  }

  it('keeps the request bytes intact instead of decoding them', async () => {
    const response = await request(buildApp())
      .post('/api/v1/crm/csv/import')
      .set('content-type', 'text/csv')
      .send('name\n\uFFFD');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      isBuffer: true,
      text: 'name\n\uFFFD',
    });
  });

  it('answers an over-limit body with exactly 413 csv_too_large', async () => {
    const response = await request(buildApp())
      .post('/api/v1/crm/csv/import')
      .set('content-type', 'text/csv')
      .send(Buffer.alloc(MAX_CSV_BYTES + 1, 0x61));
    expect(response.status).toBe(413);
    const responseBody = response.body as {
      status?: number;
      code?: string;
      detail?: string;
    };
    expect(responseBody).toMatchObject({ status: 413, code: 'csv_too_large' });
    expect(response.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(responseBody.detail ?? '').not.toContain('a'.repeat(64));
  });

  it('leaves other content types unparsed', async () => {
    const response = await request(buildApp())
      .post('/api/v1/crm/csv/import')
      .set('content-type', 'application/json')
      .send({ fullName: 'Maria' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ isBuffer: false });
  });
});
