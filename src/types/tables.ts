
export type tableColumn = {
    "name": string,
    "type": string,
    "reference"? : string,
    "attributes": [string]
}

export type tableCreationInput = {
    "tableName": string,
    "columns": [tableColumn]
}
