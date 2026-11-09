import {Module} from "@nestjs/common";
import {OrganizationController,OrganizationHost} from "./controller.js";

@Module({controllers:[OrganizationController],providers:[OrganizationHost]})
export class OrganizationHttpModule {}
