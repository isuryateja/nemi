


export type TableCreationInput = {
    "tableName": string,
    "columns": TableColumn[]
}

export type TableColumn = {
    name: string,
    type: string,
    label: string,
    reference?: string
}

export type TableColumns = TableColumn[]
