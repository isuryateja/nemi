import { PrismaClient as PostgresPrismaClient } from '@prisma/client';
import express, { Request, Response } from "express";
import {tableCreationInput, tableColumn} from "../types/tables"

const postgresClient : PostgresPrismaClient = new PostgresPrismaClient({
    datasources: { db: { url: "postgresql://surya:nemi@localhost:5432/nemi" } },
});

const router = express.Router();
interface ColumnDefinition {
    name: string;
    type: string;
}

function isValidName (name: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function isValidColumnType(type: string): boolean {
    const validTypes = [
        'integer',
        'string',
        'text',
        'boolean',
        'reference',
    ];
    return validTypes.includes(type);
}


const validateColumns = (columns: tableColumn[]) => {
    for (const col of columns) {
        if (! isValidName(col.name) || !isValidColumnType(col.type) ) {
            return false
        }
    }
    return true
}

const getNemiID = () => " nid CHAR(32) PRIMARY KEY DEFAULT REPLACE(gen_random_uuid()::text, '-', '')"
const mapColumns = (columns: tableColumn[])=> {
    let postgresColumns = columns.map(column => {
        let colString = column.name + "";
        if (column.type === "string") {
            colString = colString + " " + "VARCHAR(100)"
        } else if (column.type === "integer"){
            colString = colString + " " + "INTEGER"
        } else if(column.type === "text"){
            colString = colString + " " + "TEXT"
        }else if(column.type === "boolean") {
            colString = colString + " " + "BOOLEAN"
        } else if (column.type === "reference") {
            colString = colString + " " + "CHAR(32) REFERENCES " + column.reference + "(nid)"
        }
        return colString
    })

    return [getNemiID()].concat(postgresColumns)
}

router.post("/create", async (req: Request, res: Response) => {
    const { tableName, columns } = req.body as tableCreationInput;

    if (!validateColumns(columns) || !isValidName(tableName)) {
        res.status(500).send('Error creating table. || Invalid table name or col type');
        return
    }

    const columnsDefinition = mapColumns(columns).join(', ');
    console.log(columnsDefinition)
    const sql = `CREATE TABLE "${tableName}" (${columnsDefinition});`;
    try {
        await postgresClient.$executeRawUnsafe(sql);
        res.status(200).send(`Table ${tableName} created successfully.`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating table.');
    }
})



export default router;
