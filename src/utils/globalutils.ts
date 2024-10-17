import { Either, left, right } from 'fp-ts/Either';
import {TableColumn} from "../types/tables";
import {CreateTableBuilder} from "kysely";

type TableBuilder = CreateTableBuilder<any, never>;

export const GLOBAL_SCOPE: string = "ffb44ff4-54c1-49a1-bea7-b60d05c34859";
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
