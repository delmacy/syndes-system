import {Module} from "@nestjs/common";
import {InboxController,InboxHost} from "./inbox.controller.js";
@Module({controllers:[InboxController],providers:[InboxHost]})
export class InboxHttpModule{}
