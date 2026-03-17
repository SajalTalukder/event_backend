import AppError from "../utils/appError.js";

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Not authenticated", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("Access denied: insufficient permissions", 403));
    }

    next();
  };
};

export default authorizeRoles;
