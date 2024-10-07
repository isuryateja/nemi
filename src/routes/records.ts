import express, {Request, Response} from "express";
import { PrismaClient as MongoClient } from '@prisma/client';
import db from '../knex.db';
import vm from 'node:vm';

const mongoClient = new MongoClient({
    datasources: { db: { url: "mongodb+srv://admin:62892@cluster0.mrqbgzw.mongodb.net/nemidb" } },
});
const router = express.Router();

class Car {
    name: string;
    year: string;
    constructor(name: string, year: string) {
        this.name = name;
        this.year = year;
    }
    getYear(): string {
        return (this.year);
    }
}

const context = {
    Car: Car,
    console: console
};


async function getBusinessRules(tableName:string, operation: string) {
    const conditions = {
        tableName: tableName
    }
    try {
        return await db(tableName).where(conditions).select('*');
    } catch (error) {
        console.error('Error fetching data from table:', error);
        throw error;
    }
}

async function getRecordFromDynamicTable(tableName: string, conditions: object) {
    try {
        return await db(tableName).where(conditions).select('*');
    } catch (error) {
      console.error('Error fetching data from table:', error);
      throw error;
    }
  }

async function createRecord(tableName: string) {
    try {
        return await db.insert({username: 'test user', email: 'test@email.com'}).into('hrcase');
        return await db.insert({
            tableName: 'hrcase', name: "test br", script: 'console.log("i m br")',
            description: "sdfd"
        }).into(tableName);
    } catch (error) {
        console.error('Error fetching data from table:', error);
        throw error;
    }
}

router.get("/:tableName/:nemiId", async (req: Request, res: Response) => {
    const { tableName, nemiId } = req.params;
    const conditions = { nid: nemiId };
    try {
        const record = await getRecordFromDynamicTable(tableName, conditions);
        console.log('Record:', record);
        if(record) {
           const brs =  await getBusinessRules (tableName, "");
           console.log(brs)
        }
      } catch (error) {
        res.status(404).send({"message": "not found"})
        console.error('Error:', error);
      }

    res.status(200).send("OK")

})

router.post("/:tableName/", async (req: Request, res: Response) => {
    const { tableName} = req.params;
    console.log("post - " , tableName)
    try {
        const record = await createRecord(tableName);
        console.log('Record:', record);
        res.status(200).send({message: record})
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({error: error})
    }


})


router.get("/script", async (req: Request, res: Response) => {
    const { data } = req.body;
    // console.log(data);
    res.status(200).send("OK")
    const script = new vm.Script(data);

    try {
        script.runInNewContext(context);
    } catch (error) {
        console.error('Error executing script:', error);
    }


})


export default router;