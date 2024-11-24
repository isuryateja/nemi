import jwt, {JwtPayload} from 'jsonwebtoken';
import * as O from "fp-ts/Option";
import {pipe} from "fp-ts/function";
import {Request, Response, NextFunction} from "express";
import * as bcrypt from "bcrypt";
import {UserPayload, AuthenticatedRequest} from "../types/globalTypes";



export const comparePasswords = (password: any, hash: any) => {
    return bcrypt.compare(password, hash);
};

export const hashPassword = (password: any) => {
    return bcrypt.hash(password, 5);
};

export const createJWT = (user: any) : O.Option<string> => {
    return pipe (
        O.fromNullable(process.env.JWT_SECRET),
        O.map(secret =>
             jwt.sign( {id: user.id, username: user.username}, secret )
        )
    )
};


export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {

    const bearer = req.headers.authorization;

    if (!bearer) {
        res.status(401).send("Un authorized; no bearer");
        return;
    }

    const [, token] = bearer.split(" ");
    if (!token) {
        res.status(401).send("Un authorized; no token");
        return;
    }

    if (! process.env.JWT_SECRET) {
        res.status(401).send("Invalid token");
        return;
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (typeof payload !== 'string') {
            req.user = payload as UserPayload;
            next();
        } else {
            res.status(401).send("Invalid token");
        }
    } catch (e) {
        res.status(401);
        res.send("Not authorized");
        return;
    }

}