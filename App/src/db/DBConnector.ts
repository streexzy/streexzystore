import {Sequelize} from 'sequelize-typescript';
import {Categories} from "./Models/Categories";
import {Payments} from "./Models/Payments";
import {Coupons} from "./Models/Coupons";
import {Users} from "./Models/User";
import {hash} from "bcrypt";

const DBConnector = new Sequelize("streexzy", "root", "",{
    dialect: 'mysql',
    storage: './db.sql',
    host: "127.0.0.1",
    logging: false,
    models: [
        Categories,
        Payments,
        Coupons,
        Users
    ]
});

export default DBConnector;

export const setupDB = async () => {
    await DBConnector.authenticate()
    await DBConnector.sync({ force: false })

    await Users.findOrCreate({
        where: {
            email: "streexzy@outlook.com"
        },
        defaults: {
            email: "streexzy@outlook.com",
            password: await hash("Adryan.Miguel03!", 10),
            discordId: "855848589364035604"
        }
    });
}