import express, { Request, Response } from 'express';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import {routes} from "./handlers/nemiRouters";
import 'dotenv/config';
import {protect} from "./modules/auth";
import router from './router';

const app = express();
app.use(express.json());

app.use("/api/v2/", protect, router);
// app.use("/api/v2/", router);

const sendJson = (res: Response) => (data: object): TE.TaskEither<unknown, void> =>
    TE.rightTask(() => new Promise<void>((resolve) => {
        res.json(data);
        resolve(); // Explicitly resolve void
    }));

const sendError = (res: Response) => (error: object): TE.TaskEither<unknown, void> =>
    TE.leftTask(() => new Promise<void>((resolve) => {
        res.status(500).json(error);
        resolve(); // Explicitly resolve void
    }));

app.get("/", async (req: Request, res: Response): Promise <void> => {
    const responseTaskEither: TE.TaskEither<unknown, void> = pipe(
        TE.right({ message: "Hello from Nemi!" }),
        TE.fold(
            sendError(res),
            sendJson(res)
        )
    );

    await responseTaskEither();
});

const port: string | number = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});