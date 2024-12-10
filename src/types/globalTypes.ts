import {JwtPayload} from "jsonwebtoken";
import {Request} from "express";


export interface UserPayload extends JwtPayload {
    id: string;
    username: string;
}

export type ScriptContext = {
    [key: string]: any;
};

export interface AuthRequest extends Request {
    user: UserPayload;
}

export type AuthenticatedRequest = Request & { user?: UserPayload };

export type BRFetchRecord = {
    script: string,
    when: string,
    operation: string,
    order: number
}
export type BRCreationRecord = {
    name: string,
    table: string,
    scope: string,
    script: string,
    when: string,
    operation: string,
    order: number
}