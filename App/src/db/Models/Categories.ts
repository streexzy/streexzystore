import {AutoIncrement, Column, CreatedAt, DataType, Length, Model, PrimaryKey, Table} from "sequelize-typescript";

@Table({
    tableName: "StreexzyCategories"
})
export class Categories extends Model<RawCategoriesAttributes> implements Categories {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number

    @Column
    name: string

    @Length({
        max: 65536
    })
    @Column(DataType.TEXT)
    products: string

    @CreatedAt
    createdAt: Date
}


interface RawCategoriesAttributes {
    id: number
    name: string
    products: string
    createdAt: Date
}

interface CategoriesAttributes {
    id: number
    name: string
    products: Product[]
    createdAt: Date
}

export type Product = {
    id: number
    name: string
    image: string
    extend: boolean
    benefits: Benefit[]
    price: number
    stocks: Stock[]
}

export type Benefit = {
    name: string
    image: string
}

export type Stock = {
    value: string
}

export type RawCategory = {
    id: number
    name: string
    products: string
    createdAt: Date
}

export function parseCategories(category: RawCategory): CategoriesAttributes {
    const products = JSON.parse(category.products)

    return {
        id: category.id,
        name: category.name,
        products,
        createdAt: category.createdAt
    }
}

export async function createCategory(category: CategoriesAttributes & { id: number | null }): Promise<Categories> {
    return await Categories.create({
        name: category.name,
        products: JSON.stringify(category.products),
        createdAt: new Date()
    })
}

export async function getFirstStock(category: Categories, productId: number): Promise<Stock> {

    const categoryData = parseCategories(category)
    const findP = categoryData.products.find((p) => p.id == productId)

    if (!findP) return {
        value: "Sem stock. Entre em contato com o suporte."
    }

    const stock = findP.stocks[0]

    if (!stock) return {
        value: "Sem stock. Entre em contato com o suporte."
    }

    findP.stocks = findP.stocks.filter((s) => s.value != stock.value)

    await category.update({
        products: JSON.stringify(categoryData.products)
    })

    return stock
}