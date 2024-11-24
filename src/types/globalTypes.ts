import {JwtPayload} from "jsonwebtoken";
import {Request} from "express";


export interface UserPayload extends JwtPayload {
    id: string;
    username: string;
}

export interface AuthRequest extends Request {
    user: UserPayload;
}

export type AuthenticatedRequest = Request & { user?: UserPayload };