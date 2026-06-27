import { createServer } from 'node:http';
import { handler } from './index.mjs';

const port = Number(process.env.PORT || 8787);

const server = createServer(async (req, res) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf-8');
  const result = await handler({
    httpMethod: req.method,
    body,
  });

  res.statusCode = result.statusCode;
  for (const [key, value] of Object.entries(result.headers || {})) {
    res.setHeader(key, value);
  }

  if (result.statusCode === 204) {
    res.end();
    return;
  }

  res.end(result.body);
});

server.listen(port, () => {
  console.log(`[relay] http://localhost:${port}`);
});
