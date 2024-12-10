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
const TE = __importStar(require("fp-ts/TaskEither"));
const function_1 = require("fp-ts/function");
require("dotenv/config");
const auth_1 = require("./modules/auth");
const messages_1 = require("./cool/messages");
const router_1 = __importDefault(require("./router"));
const authRouter_1 = __importDefault(require("./authRouter"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use("/api/v2/auth", authRouter_1.default);
app.use("/api/v2/", auth_1.protect, router_1.default);
const sendJson = (res) => (data) => TE.rightTask(() => new Promise((resolve) => {
    res.json(data);
    resolve(); // Explicitly resolve void
}));
const sendError = (res) => (error) => TE.leftTask(() => new Promise((resolve) => {
    res.status(500).json(error);
    resolve(); // Explicitly resolve void
}));
app.get("/", async (req, res) => {
    const responseTaskEither = (0, function_1.pipe)(TE.right({ message: "Hello from Nemi!" }), TE.fold(sendError(res), sendJson(res)));
    await responseTaskEither();
});
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log((0, messages_1.getMessage)(port));
});
