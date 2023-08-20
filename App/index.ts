import express from "express";
import session from "express-session";
import http from "http";
import Discord from "discord.js";
import mp from "mercadopago";
import socket from "socket.io";
import cloudflared from "cloudflared";
import connectSequelize from "connect-session-sequelize";
import "colors";
import "./src/types/UserData"

import ShopRouter from "./src/routes/ShopRouter";
import PanelRouter from "./src/routes/PanelRouter";

import DBConnector, {setupDB} from "./src/db/DBConnector";
import {Categories, parseCategories} from "./src/db/Models/Categories";
import {Payments} from "./src/db/Models/Payments";
import {Coupons} from "./src/db/Models/Coupons";
import * as process from "process";
import {Users} from "./src/db/Models/User";
import bcrypt, {hash} from "bcrypt";
import * as fs from "fs";
import {onReady} from "./src/apis/MPApi";

const app = express();
const server = http.createServer(app);
const client = new Discord.Client({
    intents: [
        "Guilds",
        "GuildMembers",
        "GuildMessages",
    ]
});
const io = new socket.Server(server, {
    cors: {
        origin: 'https://streexzy.com.br',
        methods: ['GET', 'POST'],
        allowedHeaders: ["ngrok-skip-browser-warning"],
    	credentials: true
    }
});
const SequelizeStore = connectSequelize(session.Store)

const sockets: StreexzySocket[] = []
const mpToken = JSON.parse(fs.readFileSync(`${process.cwd()}/App/src/utils/mptoken.txt`, "utf-8")) as {access_token: string}

if (mpToken.access_token != undefined) {
    mp.configure({
        access_token: mpToken.access_token,
        sandbox: false
    })
}

app.set("view-engine", "ejs")
app.set("views", `${process.cwd()}/App/src/views`)

app.use(express.json({limit: "50mb"}))
app.use(express.urlencoded({extended: true, limit: "50mb"}))
app.use(session({
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    secret: "RJKWEDSGOWU@*7482", // isso é usado para assinar o cookie
    saveUninitialized: false, // isso faz com que a sessão não seja salva em disco se não houver nada para salvar
    resave: true,
    store: new SequelizeStore({
        db: DBConnector,
        tableName: "StreexzySessions"
    })
}))

app.use("/public", express.static(`${process.cwd()}/App/src/public`))
app.use("/", ShopRouter)
app.use("/panel", PanelRouter)

let ngrokUrl = "https://streexzy.com.br"

server.listen(25571, async () => {
        await setupDB()

        await client.login("MTA5OTA5Njg3MDk0NjYyMzU0OA.G1Y6b4.HtS4nDsHa2Onhrx_n2fOkydHRSFPYXCFxf4ea8")
        await onReady()

        if (process.cwd().startsWith("/home")) {
            cloudflared
        }

        console.log("[Express]".cyan, "Server started on port 25571".green)
    }
)

io.on("connection", (socket) => {
    sockets.push({
        socket,
        paymentsId: []
    })

    socket.on("buyEvent", async (data) => {
        const {categoryId, productId, email, cupom} = data;

        if (!categoryId || !productId || !email) return

        const findC = parseCategories((await Categories.findOne({where: {id: categoryId}})).dataValues)
        const findP = findC.products.find((p) => p.id == productId)

        if (!findP) return

        let subTotal = findP.price
        let total = findP.price
        let discount = 0

        if (cupom) {
            const findCupom = await Coupons.findOne({where: {code: cupom}})

            if (!findCupom) {
                socket.emit("buyEvent", {
                    error: "Cupom não encontrado"
                })
                return
            }

            // findCupom.discount -> 0.5, 0.99 (50%, 99%)

            total = parseFloat((findP.price - (findP.price * findCupom.discount)).toFixed(2))
            discount = parseFloat((findP.price * findCupom.discount).toFixed(2))
        }

        const payment = await Payments.create({
            email,
            categoryId,
            productId: findP.id,
            price: total,
            createdAt: new Date()
        })

        const mpPayment = await mp.payment.create({
            transaction_amount: total,
            description: findP.name,
            payment_method_id: "pix",
            payer: {
                email: email
            },
            installments: 1,
            external_reference: `StreetPay#${payment.id}`
        });

        await payment.update({
            mpId: mpPayment.body.id
        })

        socket.emit("buyEvent", {
            payment: {
                qrCode: mpPayment.body.point_of_interaction.transaction_data.qr_code_base64,
                qrCodeUrl: mpPayment.body.point_of_interaction.transaction_data.qr_code,
                subTotal,
                total,
                discount,
                id: payment.id
            },
            categoryId,
            productId
        })

        sockets.find((s) => s.socket == socket).paymentsId.push(payment.id)
    })
})


type StreexzySocket = {
    socket: socket.Socket
    paymentsId: number[]
}

export {
    mp, sockets, client, ngrokUrl
}