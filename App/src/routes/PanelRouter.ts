import bcrypt from "bcrypt";
import {NextFunction, Request, Response, Router} from "express";
import {Categories, createCategory, getFirstStock, parseCategories, Product} from "../db/Models/Categories";
import {client, mp, ngrokUrl, sockets} from "../../index";
import {Payments} from "../db/Models/Payments";
import EmailAPI from "../apis/EmailAPI";
import {EmbedBuilder, TextChannel} from "discord.js";
import {Users} from "../db/Models/User";
import {Coupons} from "../db/Models/Coupons";
import axios from "axios";
import * as fs from "fs";
import * as process from "process";

export default Router()
    .get("/login", isNotLogged, async (req: Request, res: Response) => {
        res.render("panel/login-page.ejs", {
            error: undefined,
            success: false
        })
    })
    .post("/login", isNotLogged, async (req: Request, res: Response) => {
        const {username, password} = req.body

        if (!username || !password) return res.render("panel/login-page.ejs", {
            error: "Missing parameters",
            success: false
        })

        const findUser = await Users.findOne({where: {email: username}})

        if (!findUser) return res.render("panel/login-page.ejs", {
            error: "User not found",
            success: false
        })

        const compare = await bcrypt.compare(password, findUser.password)
        if (!compare) return res.render("panel/login-page.ejs", {
            error: "Invalid password",
            success: false
        })

        req.session.user = findUser
        return res.render("panel/login-page.ejs", {
            error: undefined,
            success: true
        })
    })
    .get("/", isLogged, async (req: Request, res: Response) => {
        const payments = (await Payments.findAll({
            include: [
                Categories
            ]
        })).filter(p => p.approved);

        const currentDate = new Date();
        const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - (currentDate.getDay() - 1));
        const lastDayOfWeek = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate() + 6);

        const dayRevenue = payments.filter(p => p.createdAt.getDate() === new Date().getDate()).reduce((a, b) => a + b.price, 0)
        const weekRevenue = payments.filter(p => p.createdAt >= firstDayOfWeek && p.createdAt <= lastDayOfWeek).reduce((a, b) => a + b.price, 0)
        const monthRevenue = payments.filter(p => p.createdAt.getMonth() === new Date().getMonth()).reduce((a, b) => a + b.price, 0)

        const daySales = payments.filter(p => p.createdAt.getDate() === new Date().getDate()).length
        const weekSales = payments.filter(p => p.createdAt >= firstDayOfWeek && p.createdAt <= lastDayOfWeek).length
        const monthSales = payments.filter(p => p.createdAt.getMonth() === new Date().getMonth()).length

        const sortedRecentPayments = payments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        res.render("panel/home.ejs", {
            ngrokUrl, mp: req.query.mp,
            dayRevenue, weekRevenue, monthRevenue,
            daySales, weekSales, monthSales,
            payments: sortedRecentPayments.map(p => ({
                ...p.dataValues,
                product: parseCategories(p.category.dataValues).products.find(pr => pr.id === p.productId)
            }))
        })
    })
    .get("/categories", isLogged, async (req: Request, res: Response) => {
        const categories = (await Categories.findAll())
            .map(c => parseCategories(c.dataValues))

        res.render("panel/categories.ejs", {
            ngrokUrl, success: req.query.success,
            error: req.query.error, action: req.query.action,
            categories: categories
        })
    })
    .post("/categories/create", isLogged, async (req: Request, res: Response) => {
        const {categoryName} = req.body

        if (!categoryName) return res.redirect("/panel/categories?error=Faltam parâmetros&action=create&succes=false")

        await createCategory({
            id: null,
            name: categoryName,
            products: [],
            createdAt: new Date()
        })

        return res.redirect("/panel/categories?error=Sucesso&action=create&success=true")
    })
    .post("/categories/delete", isLogged, async (req: Request, res: Response) => {
        const {categoryId} = req.body

        if (!categoryId) return res.redirect("/panel/categories?error=Faltam parâmetros&action=delete&success=false")

        await Categories.destroy({where: {id: categoryId}})

        return res.redirect("/panel/categories?error=Sucesso&action=delete&success=true")
    })
    .get("/products", isLogged, async (req: Request, res: Response) => {
        const categories = await Categories.findAll()

        res.render("panel/products.ejs", {
            ngrokUrl, success: req.query.success,
            error: req.query.error, action: req.query.action,
            categories: categories
                .map(c => parseCategories(c.dataValues))
                .map(c => ({
                    ...c,
                    products: c.products.map(p => ({
                        ...p,
                        categoryId: c.id
                    }))
                }))
        })
    })
    .post("/product/create", isLogged, async (req: Request, res: Response) => {
        const {
            categoryId,
            productName,
            productImage,
            productExtend,
            productPrice,
            productStocks,
            productBenefits
        } = req.body

        if (!categoryId || !productName || !productImage || !productExtend || !productPrice || !productStocks || !productBenefits) return res.redirect("/panel/products")

        const rawCategory = await Categories.findOne({where: {id: categoryId}})
        if (!rawCategory) return res.redirect("/panel/products?error=Categoria inválida&action=create&success=false")

        const category = parseCategories(rawCategory.dataValues)

        category.products.push({
            id: getNextId(category.products),
            name: productName,
            image: productImage,
            extend: JSON.parse(productExtend),
            price: parseFloat(productPrice),
            stocks: JSON.parse(productStocks),
            benefits: JSON.parse(productBenefits)
        })

        await Categories.update({products: JSON.stringify(category.products)}, {where: {id: categoryId}})

        return res.redirect("/panel/products?error=Sucesso&action=create&success=true")
    })
    .post("/product/delete", isLogged, async (req: Request, res: Response) => {
        const {productId} = req.body

        if (!productId) return res.redirect("/panel/products");

        const realProductId = productId.split(";")[1]
        const categoryId = productId.split(";")[0]

        const rawCategory = await Categories.findOne({where: {id: parseInt(categoryId)}})
        if (!rawCategory) return res.redirect("/panel/products")

        const category = parseCategories(rawCategory.dataValues)

        category.products = category.products.filter(p => p.id !== parseInt(realProductId))

        await Categories.update({products: JSON.stringify(category.products)}, {where: {id: categoryId}})

        return res.redirect("/panel/products")
    })
    .post("/product/edit", isLogged, async (req: Request, res: Response) => {
        const {
            productId,
            productName,
            productImage,
            productExtend,
            productPrice,
            productStocks,
            productBenefits
        } = req.body

        if (!productId || !productName || !productImage || !productExtend || !productPrice || !productStocks || !productBenefits) return res.redirect("/panel/products");

        const realProductId = productId.split(";")[1]
        const categoryId = productId.split(";")[0]

        const rawCategory = await Categories.findOne({where: {id: parseInt(categoryId)}})
        if (!rawCategory) return res.redirect("/panel/products")

        const category = parseCategories(rawCategory.dataValues)

        category.products = category.products.map(p => {
            if (p.id !== parseInt(realProductId)) return p

            return {
                ...p,
                name: productName,
                image: productImage,
                extend: JSON.parse(productExtend),
                price: parseFloat(productPrice),
                stocks: JSON.parse(productStocks),
                benefits: JSON.parse(productBenefits)
            }
        })

        await Categories.update({products: JSON.stringify(category.products)}, {where: {id: categoryId}})

        return res.redirect("/panel/products")
    })
    .get("/stocks", isLogged, async (req: Request, res: Response) => {
        const categories = (await Categories.findAll())
            .map(c => parseCategories(c.dataValues))
            .map((c) => ({
                id: c.id,
                name: c.name,
                products: c.products.map((p) => {
                    return {
                        ...p,
                        categoryId: c.id,
                        stocks: p.stocks.map((s) => ({
                            value: s.value
                        }))
                    };
                }),
                createdAt: c.createdAt,
            }))

        console.log(
            categories
                .filter((c) => c.products.find((p) => p.stocks.length > 0))
                .map((c) => c.products)
                .flat()
                .map((p) => ({
                    name: p.name,
                    stocks: p.stocks
                })).flat()
        )

        res.render("panel/stocks.ejs", {
            ngrokUrl,
            categories: categories
        })
    })
    .post("/stocks/create", isLogged, async (req: Request, res: Response) => {
        const {productId, stocks} = req.body

        if (!productId || !stocks) return res.redirect("/panel/stocks")

        const realProductId = productId.split(";")[1]
        const categoryId = productId.split(";")[0]

        const rawCategory = await Categories.findOne({where: {id: parseInt(categoryId)}})
        if (!rawCategory) return res.redirect("/panel/stocks?t=1")

        const category = parseCategories(rawCategory.dataValues)

        category.products = category.products.map(p => {
            if (p.id !== parseInt(realProductId)) return p

            return {
                ...p,
                stocks: [...p.stocks, ...JSON.parse(stocks)]
            }
        })

        await Categories.update({products: JSON.stringify(category.products)}, {where: {id: categoryId}})

        return res.redirect("/panel/stocks?t=2")
    })
    .post("/stocks/delete", isLogged, async (req: Request, res: Response) => {
        const {productId, stockId} = req.body

        if (!productId || !stockId) return res.redirect("/panel/stocks")

        const realProductId = productId.split(";")[1]
        const categoryId = productId.split(";")[0]

        const rawCategory = await Categories.findOne({where: {id: parseInt(categoryId)}})
        if (!rawCategory) return res.redirect("/panel/stocks?t=1")

        const category = parseCategories(rawCategory.dataValues)

        category.products = category.products.map(p => {
            if (p.id !== parseInt(realProductId)) return p

            return {
                ...p,
                stocks: p.stocks.filter(s => s.value !== stockId)
            }
        })

        await Categories.update({products: JSON.stringify(category.products)}, {where: {id: categoryId}})

        return res.redirect("/panel/stocks?t=2")
    })
    .get("/coupons", isLogged, async (req: Request, res: Response) => {
        const coupons = await Coupons.findAll()

        res.render("panel/coupons.ejs", {
            ngrokUrl,
            coupons: coupons.map(c => c.dataValues)
        })
    })
    .post("/coupons/create", isLogged, async (req: Request, res: Response) => {
        const {couponName, couponValue} = req.body

        if (!couponName || !couponValue) return res.redirect("/panel/coupons")

        await Coupons.create({
            code: couponName,
            discount: parseFloat(couponValue)
        })

        return res.redirect("/panel/coupons")
    })
    .post("/coupons/delete", isLogged, async (req: Request, res: Response) => {
        const {couponId} = req.body

        if (!couponId) return res.redirect("/panel/coupons")

        await Coupons.destroy({where: {id: couponId}})

        return res.redirect("/panel/coupons")
    })
    .get("/oauth2/mp", isLogged, async (req: Request, res: Response) => {
        const {code} = req.query

        if (!code) return res.redirect("/panel")

        try {
            const {data} = await axios.post("https://api.mercadopago.com/oauth/token", {
                client_id: "1493841716166577",
                client_secret: "1dFhQxYOPDyPhr8uVTN5t4GlhItl4cpQ",
                grant_type: "authorization_code",
                code,
                redirect_uri: ngrokUrl + "/oauth2/mp"
            });

            fs.writeFileSync(`${process.cwd()}/App/src/utils/mptoken.txt`, JSON.stringify(data))

            mp.configure({
                access_token: data.access_token,
                sandbox: false
            })
        } catch (e) {
            console.log(e)
        }

        return res.redirect("/panel?mp=1")
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