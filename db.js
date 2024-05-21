const {Sequelize} = require('sequelize')

//  на выходе экспортируем obj  котор создаем  из класса sequelize
module.exports = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        dialect: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT
    }
)
