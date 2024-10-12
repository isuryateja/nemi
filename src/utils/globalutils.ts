import { Either, left, right } from 'fp-ts/Either';
import {TableColumn} from "../types/tables";
import {CreateTableBuilder} from "kysely";

type TableBuilder = CreateTableBuilder<any, never>;

export const GLOBAL_SCOPE: string = "963e76ad-95c8-464d-aea3-ad6e08571094";
export type Error = string;
export const validateIdentifier= (name: string): Either<string, string> => {
    let isValid = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
    return isValid ? right(name): left(`Invalid identifier : ${name}`)
}

export const typeMap:
    Record< string, (column: TableColumn) => (schemaBuilder:TableBuilder) => TableBuilder > = {

    string: (column) => (schemaBuilder) =>
        schemaBuilder.addColumn(column.name, 'varchar(100)'),
    integer: (column) => (schemaBuilder) =>
        schemaBuilder.addColumn(column.name, 'integer'),
    text: (column) => (schemaBuilder) =>
        schemaBuilder.addColumn(column.name, 'text'),
    boolean: (column) => (schemaBuilder) =>
        schemaBuilder.addColumn(column.name, 'boolean'),
    reference: (column) => (schemaBuilder) =>
        schemaBuilder.addColumn(column.name, 'uuid', (col :any) =>
            col.references(`${column.reference}.nid`)
        )
};

export const trace = (tag: string) => (x: string) =>{
    console.log(tag, x)
    return x
}
