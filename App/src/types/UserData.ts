import "express-session";
import {Users} from "../db/Models/User";

declare module "express-session" {
    interface SessionData {
        user: Users
    }
}