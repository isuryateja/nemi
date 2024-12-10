import express, {Request, Response} from "express";
import {db} from '../kysely.db';
import {Dict} from "../constants/dictionary";
import {BRCreationRecord, BRFetchRecord} from "../types/globalTypes";

const router = express.Router();

export type BR_bulk_input = BRCreationRecord[]
export const getBRsImp = async (table:string ): Promise< BRFetchRecord[] > => {
    return await db.selectFrom(Dict.NEMI_BUSINESS_RULE)
        .select(['script', 'when', 'operation', 'order'])
        .where('table', '=', table)
        .execute()
}

const createBrs = async (brs: BR_bulk_input) => {
    await db.insertInto(Dict.NEMI_BUSINESS_RULE)
        .values(brs)
        .execute();
}

router.get("/:table", async (req:Request, res:Response) => {
    let table = req.params.table as string;
    let brs = await getBRsImp(table);

    console.log(JSON.stringify(brs))

    res.status(200).send(JSON.stringify(brs))
})

router.post("/bulk-create/:table", async (req:Request, res: Response) => {
    let brs = req.body as BR_bulk_input;
    await createBrs(brs);

    res.status(200).send("br created")

})
export default router
