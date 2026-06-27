import { createServer } from 'node:http';
import { handler, warmUp } from './index.mjs';

const port = Number(process.env.PORT || 8788);

console.log('[inference] загрузка vision-модели…');
await warmUp();
console.log('[inference] модель готова');

const server = createServer(async (req, res) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const bodyBuffer = Buffer.concat(chunks);
  const result = await handler({
    method: req.method,
    bodyBuffer,
    contentType: req.headers['content-type'],
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
  console.log(`[inference] http://127.0.0.1:${port}`);
});
