import {Module} from "@nestjs/common";
import {CrmController,CrmHost} from "./crm.controller.js";

/** The API controller is part of the CRM package, not the Core Host. */
@Module({controllers:[CrmController],providers:[CrmHost]})
export class CrmHttpModule {}
