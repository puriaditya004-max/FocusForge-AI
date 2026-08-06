// ---------------------------------------------------------
// middleware/validate.middleware.js
// Generic validation middleware — pass it a Zod schema and
// it validates req.body before the controller ever runs.
//
// Usage on any route:
//   const validate = require("../middleware/validate.middleware");
//   const { loginSchema } = require("../validators/auth.validator");
//   router.post("/login", validate(loginSchema), login);
//
// This same pattern can be reused later for task.routes.js,
// studyroom.routes.js, mentor.routes.js, etc. — just write a
// new Zod schema per route and wrap it with validate(schema).
// ---------------------------------------------------------
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || "Invalid input.",
        field: firstIssue?.path?.join(".") || undefined,
      });
    }

    // Replace req.body with the parsed & type-coerced version
    req.body = result.data;
    next();
  };
}

module.exports = validate;