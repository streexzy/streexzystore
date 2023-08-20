import bcrypt from "bcrypt";
import {NextFunction, Request, Response, Router} from "express";
import {Categories, createCategory, getFirstStock, parseCategories, Product} from "../db/Models/Categories";
import {client, mp, sockets, ngrokUrl} from "../../index";
import {Payments} from "../db/Models/Payments";
import EmailAPI from "../apis/EmailAPI";
import {EmbedBuilder, TextChannel} from "discord.js";
import {Users} from "../db/Models/User";
import {Coupons} from "../db/Models/Coupons";

export default Router()
    .get("/", async (req, res) => {
        const categories = await Categories.findAll()

        res.render("home.ejs", {
            categories: categories.map((c) => parseCategories(c.dataValues)),
            ngrokUrl
        })
    })
    .post("/api/ipn/mp", async (req, res) => {
        const {id, topic} = req.query;

        if (id == undefined || topic == undefined) return res.status(400).send("Missing parameters");

        const ipnResponse = (await mp.ipn.manage(req)).body;

        if (ipnResponse.status == 'approved') {
            const payment = await Payments.findOne({
                where: {
                    id: ipnResponse.external_reference.split("#")[1],
                    approved: false
                }
            })

            if (!payment) return res.status(400).send("Payment not found");

            sockets.filter((s) => s.paymentsId.includes(payment.id)).forEach((s) => {
                s.socket.emit("buyEvent", {
                    status: "approved",
                    paymentId: payment.id,
                    productId: payment.productId,
                    categoryId: payment.categoryId
                })
            })

            const c = await Categories.findOne({where: {id: payment.categoryId}})

            const stock = await getFirstStock(c, payment.productId)
            await EmailAPI(
                payment.email, stock,
            )

            const category = parseCategories(c.dataValues)

            const product = category.products.find((p) => p.id == payment.productId)

            const channel = client.channels.cache.get("1131") as TextChannel

            if (channel) {

                await channel.send({
                    content: "<@908963575169691692> <@1050939301686423592>",
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Nova compra")
                            .addFields([
                                {
                                    name: "📦 Numero do pedido",
                                    value: `\`${ipnResponse.id}\``,
                                    inline: true
                                },
                                {
                                    name: "📩 Email",
                                    value: `\`${payment.email}\``,
                                    inline: true
                                },
                                {
                                    name: "📝 Categoria",
                                    value: `\`${category.name}\``,
                                    inline: true
                                },
                                {
                                    name: "📦 Produto",
                                    value: `\`${product.name}\``,
                                    inline: true
                                },
                                {
                                    name: "🤑 Preço",
                                    value: `\`${product.price}\``,
                                    inline: true
                                }
                            ])
                            .setColor("Green")
                            .setTimestamp()
                            .setFooter({
                                text: "©️ Streexzy ©️ - 2023"
                            })
                    ]
                });
            }

            await payment.update({approved: true, mpId: ipnResponse.id, stock: stock.value})
        }
    })

function isLogged(req: Request, res: Response, next: NextFunction) {
    if (req.session.user) return next()

    return res.redirect("/panel/login")
}

function isNotLogged(req: Request, res: Response, next: NextFunction) {
    if (!req.session.user) return next()

    return res.redirect("/panel")
}

function getNextId(products: Product[]) {
    // vc deve ordenar os produtos por id e pegar o ultimo id e somar 1
    return products.sort((a, b) => a?.id - b?.id)[products.length - 1]?.id + 1 || 1
}