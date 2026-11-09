import {Global,Module} from "@nestjs/common";
import {InboxChangeBus} from "./realtime.js";
import {InboxController,InboxHost} from "./inbox.controller.js";
@Global()
@Module({controllers:[InboxController],providers:[InboxHost,
 {provide:"SYNDES_INBOX_EVENTS",useFactory:()=>new InboxChangeBus()}],exports:["SYNDES_INBOX_EVENTS"]})
export class InboxHttpModule{}
