import jwt from 'jsonwebtoken';
import * as O from "fp-ts/Option";
import {pipe} from "fp-ts/function";
import { Either, right, left, match, fromNullable, bind, tryCatch, map } from "fp-ts/Either";
import {Response, NextFunction} from "express";
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

const checkForToken = (bearer: string): Either<string, string> => {
    const [, token] = bearer.split(" ");
    return token ? right(token) : left("Un authorized; no token");
}

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {

    const bearer = req.headers.authorization as any;

    pipe(
        fromNullable("Un authorized; no bearer")(bearer || null),
        bind('token', checkForToken),
        bind('jwtSecret', () => fromNullable("Invalid token")(process.env.JWT_SECRET || null)),
        map(({token, jwtSecret}) =>
            tryCatch(
                () => {
                    const payload = jwt.verify(token, jwtSecret);
                    typeof payload !== 'string' ? right(payload) : left("Invalid token");
                },
                () => {
                    left("Not authorized");
                }
            )
        ),
        match(
            (err) => res.status(401).send(err),
            (payload: any) => {
                req.user = payload as UserPayload;
                next();
            }
        )
    )

}