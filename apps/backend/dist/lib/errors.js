"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleErrors = exports.ApiError = void 0;
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}
exports.ApiError = ApiError;
const handleErrors = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.handleErrors = handleErrors;
