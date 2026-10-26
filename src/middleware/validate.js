// Validates req[source] with a zod schema. A failure throws a ZodError,
// which the central error handler turns into a 400 response.
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const parsed = schema.parse(req[source]);
    if (source === 'query') req.validatedQuery = parsed; // req.query is read-only in Express 5
    else req[source] = parsed;
    next();
  };
