import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Either, fold} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {Error} from "../utils/globalutils";
import {insertIntoTable} from "./records";

const router = express.Router();

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

export type BR_bulk_input = BRCreationRecord[]
export const getBRs = async (table:string ): Promise< BRFetchRecord[] > => {
    return await db.selectFrom('businessRules')
        .select(['script', 'when', 'operation', 'order'])
        .where('table', '=', table)
        .execute()
}


const createBrs = async (brs: BR_bulk_input) => {
    await db.insertInto('businessRules')
        .values(brs)
        .execute();
}
router.get("/:table", async (req:Request, res:Response) => {
    let table = req.params.table as string;
    let brs = await getBRs(table);

    console.log(JSON.stringify(brs))

    res.status(200).send(JSON.stringify(brs))
})



router.post("/bulk-create/:table", async (req:Request, res: Response) => {
    let brs = req.body as BR_bulk_input;
    await createBrs(brs);

    res.status(200).send("br created")

})
export default router
