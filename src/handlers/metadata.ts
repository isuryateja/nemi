import express, {Request, Response} from "express";
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as O from "fp-ts/Option";
import {TaskEither, tryCatch} from 'fp-ts/TaskEither';
import { sequenceT } from 'fp-ts/Apply';
import * as A from 'fp-ts/Array';
import {pipe} from 'fp-ts/lib/function';
import {map} from "fp-ts/Map"
import * as E from 'fp-ts/Either';
import {Either, fold} from 'fp-ts/Either';
import {db} from '../kysely.db';
import {Error, trace} from "../utils/globalutils";
import * as J from "fp-ts/Json";
import {getNemiRecord} from "../utils/tableUtils";
import vm from 'node:vm';
import {Dict} from "../constants/dictionary";
import {AuthRequest} from "../types/globalTypes";
import multer from 'multer';
import {insertIntoTable, RecordCreationInput} from "./records";
import {PathReporter} from "io-ts/PathReporter";

const router = express.Router();

const RecordValidator = t.type({
    tableName: t.string,
    nid: t.string
}, 'NemiRecord');

const JSONArrayValidator = t.array(RecordValidator);

type NemiJsonRecords = t.TypeOf<typeof JSONArrayValidator>;

const validateNemiJsonStructure = (json: unknown): Either<any, any> => {
    return pipe(
        JSONArrayValidator.decode(json),
        E.mapLeft(errors => PathReporter.report(E.left(errors)).join('\n'))
    );
};

const upload = multer({ storage: multer.memoryStorage() });
const createJSONRepresentation = (tableName: string, nid: string) => {
    let recordValues = getNemiRecord(tableName, nid);
    return pipe(
        recordValues,
        TE.map(record => {
            return {tableName, ...record};
        })
    );
}

router.get("/json", async (req: Request, res: Response): Promise<void> => {
    let {tableName, nid} = req.query;
    if (!tableName || !nid) {
        res.status(400).send("Invalid request");
        return;
    }
    const responseTaskEither = pipe(
        createJSONRepresentation(tableName as string, nid as string),
        TE.match(
            (error) => res.status(500).json({ error }),
            (record) => res.json(record)
        )
    );

    // Execute the TaskEither
    await responseTaskEither();
});

const transformForInsert = (NemiJson: NemiJsonRecords) : Either<any, any> =>
    E.right(
        NemiJson.map(record => {
            let {tableName, ...values} = record;
            return {tableName, values}
        })
    )

const insertNemiRecords = ( JsonRecords: RecordCreationInput[] ): TE.TaskEither<Error, string> => {
    return pipe(
        JsonRecords,
        A.map(insertIntoTable), // Map each record to a TaskEither
        A.sequence(TE.ApplicativeSeq), // Sequence the array of TaskEithers
        TE.map(() => 'Inserted records') // Map the successful result to a message
    );
};

const processJSONFile = (buffer: Buffer): TE.TaskEither<string, string> => {
    return pipe(
        J.parse(buffer.toString()),
        E.mapLeft((err) => (`Error parsing JSON: ${err}`)),
        TE.fromEither,
        TE.chain((parsedJson) =>
            pipe(
                parsedJson,
                validateNemiJsonStructure,
                E.chain(transformForInsert),
                TE.fromEither,
                TE.chain(insertNemiRecords),
                TE.mapLeft((error) => `Error inserting the values into Database -code : ${error}` )
            )
        )
    );
};

router.post("/json/upload", upload.single('file') ,async (req: Request, res: Response): Promise<void> => {
    await pipe(
        O.fromNullable(req.file),
        O.match(
            async () => res.status(400).send("No file uploaded"),
            async (file) => await pipe(
                processJSONFile(file.buffer),
                TE.match(
                    (error) => res.status(500).send({error}),
                    (json) => res.status(200).send(json)
                )
            ) ()
        )
    )

});

export default router;

