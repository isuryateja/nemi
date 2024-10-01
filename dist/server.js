"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const E = __importStar(require("fp-ts/Either"));
const function_1 = require("fp-ts/function");
const prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const sendJson = (res) => (data) => () => new Promise((resolve) => {
    res.resolve(data);
    resolve();
});
const sendError = (res) => (error) => () => new Promise((resolve) => {
    res.status(500).json(error);
    resolve();
});
app.get("/", (req, res) => {
    const responseTask = (0, function_1.pipe)(E.right({ message: "Hello from Nemi!" }), E.fold(sendError(res), sendJson(res)));
    responseTask().catch(() => res.status(500).send({ body: "Something went wrong" }));
});
const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
