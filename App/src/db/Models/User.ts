import {AutoIncrement, Column, CreatedAt, DataType, Model, PrimaryKey, Table} from "sequelize-typescript";

@Table({
    tableName: "StreexzyUsers"
})
export class Users extends Model<UsersAttributes> implements Users {
    @PrimaryKey
    @AutoIncrement
    @Column
    id: number

    @Column
    email: string

    @Column
    password: string

    @Column
    discordId: string

    @CreatedAt
    createdAt: Date
}

interface UsersAttributes {
    id: number
    email: string
    password: string
    discordId: string
    createdAt: Date
}