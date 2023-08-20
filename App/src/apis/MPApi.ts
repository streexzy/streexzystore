import {Payments} from "../db/Models/Payments";
import {client, mp, sockets} from "../../index";
import {Categories, getFirstStock, parseCategories} from "../db/Models/Categories";
import EmailAPI from "./EmailAPI";
import {EmbedBuilder, TextChannel} from "discord.js";

export const onReady = async () => {
    setInterval(() => {
        updatePayments()
    }, 15000)
}

export const updatePayments = async () => {
    const payments = await Payments.findAll({
        where: {
            approved: false
        }
    })

    for (const payment of payments) {
        const mpPayment = await mp.payment.get(payment.mpId)

        if (mpPayment.body.status == "approved") {
            await payment.update({
                approved: true
            })

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
                                    value: `\`${payment.mpId}\``,
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

            await payment.update({approved: true, stock: stock.value})
        }
    }
}