import {
    AutoIncrement,
    BelongsTo,
    Column,
    CreatedAt, DataType,
    Default,
    ForeignKey,
    Model,
    Length,
    PrimaryKey,
    Table
} from "sequelize-typescript";
import {Categories} from "./Categories";

@Table({
    tableName: "StreexzyPayments"
})
export class Payments extends Model<PaymentAttributes> implements Payments {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number

    @Column
    email: string

    @Column(DataType.DOUBLE)
    price: number

    @ForeignKey(() => Categories)
    @Column
    categoryId: number

    @BelongsTo(() => Categories)
    category: Categories

    @Default(false)
    @Column
    approved: boolean

    @Column
    productId: number


    @Length({max: 65535})
	@Default(null)
    @Column({
        allowNull: true,
        type: DataType.DOUBLE
    })
    mpId: number

    @Default(null)
    @Column({
        allowNull: true,
    })
    stock: string

    @CreatedAt
    createdAt: Date;
}

interface PaymentAttributes {
    id: number
    email: string
    price: number
    categoryId: number
    productId: number
    mpId: number
    stock?: string
    approved: boolean
    createdAt: Date
}