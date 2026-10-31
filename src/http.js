const { z } = require('zod');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message || 'Invalid input.');
  return r.data;
}

function errorHandler(err, req, res, next) { // eslint-disable-line
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This email is already registered.' });
  console.error(err); // technical details stay on the server
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { HttpError, ah, parse, errorHandler, z };
