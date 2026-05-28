"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const errors_1 = require("./lib/errors");
const routes_1 = __importDefault(require("./api/routes"));
const config_1 = __importDefault(require("./config"));
const app = (0, express_1.default)();
const port = config_1.default.port;
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.use((err, req, res, next) => {
    if (err instanceof errors_1.ApiError) {
        res.status(err.statusCode).json({ message: err.message });
    }
    else {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
