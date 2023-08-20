import {AutoIncrement, Column, CreatedAt, DataType, Model, PrimaryKey, Table} from "sequelize-typescript";

@Table({
    tableName: "StreexzyCoupons"
})
export class Coupons extends Model<CouponsAttributes> implements Coupons {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number

    @Column
    code: string

    @Column(DataType.DOUBLE)
    discount: number

    @CreatedAt
    createdAt: Date
}

interface CouponsAttributes {
    id: number
    code: string
    discount: number
    createdAt: Date
}