import express, {Request, Response} from "express";
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {AuthRequest} from "../types/globalTypes";
import {processDeleteRecord, processGetRecord, processInsertRecord, processUpdateRecord} from "../modules/nemiRecord";

const router = express.Router();

router.post("/create/", async (req:Request, res: Response) => {
    const user = (req as AuthRequest).user;
    let {table, values} = req.body;

    const result = await processInsertRecord(user, table, values)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );

})

router.post("/update/", async (req:Request, res: Response) => {
    const user = (req as AuthRequest).user;
    let {table, values} = req.body;

    const result = await processUpdateRecord(user, table, values.nid, values)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );

})

router.delete("/:table/:nid", async (req: Request, res: Response) => {
    const { table, nid } = req.params;
    const user = (req as AuthRequest).user;

    const result = await processDeleteRecord(user, table, nid)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );
});

router.get("/:table/:nid", async (req: Request, res: Response) => {
    const { table, nid } = req.params;
    const user =(req as AuthRequest).user;

    const result = await processGetRecord(user, table, nid)();

    pipe(
        result,
        E.fold(
            (error) => res.status(500).send(error.message),
            (finalContext) => res.status(200).send({...finalContext.current})
        )
    );
});

export default router;
