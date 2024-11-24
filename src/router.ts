import {Router} from "express";
import tables from "./handlers/tables";
import records from "./handlers/records";
import br from "./handlers/businessRules";
import metaData from "./handlers/metadata";

const router = Router();

router.use("/tables", tables);
router.use("/record", records);
router.use("/br/", br);
router.use("/meta/", metaData);

export default router;
