import {Module} from "@nestjs/common";
import {SupportHost,SupportController} from "./controller.js";
@Module({controllers:[SupportController],providers:[SupportHost]})
export class SupportHttpModule{}
