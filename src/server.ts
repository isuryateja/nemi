import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';
import { Task } from 'fp-ts/Task';

const prisma: PrismaClient = new PrismaClient();
const app = express();
app.use(express.json());

const sendJson = (res: Response) => (data: object): Task<void> => () =>
    new Promise<void>((resolve) => {
        res.json(data);
        resolve(); // Explicitly resolve void
    });

const sendError = (res: Response) => (error: object): Task<void> => () =>
    new Promise<void>((resolve) => {
        res.status(500).json(error);
        resolve(); // Explicitly resolve void
    });

app.get("/", (req: Request, res: Response): void => {
    const responseTask: Task<void> = pipe(
        E.right({ message: "Hello from Nemi!" }),
        E.fold(
            sendError(res),
            sendJson(res)
        )
    );

    responseTask().catch(() =>
        res.status(500).send({ body: "Something went wrong" })
    );
});

const port: string | number = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});