require('dotenv').config()
const express = require('express')
const path = require('path')
const sequelize = require('./db')
// const models = require('./models/models')
const cors = require('cors')
const router = require('./routes/rout_index')
const PORT = process.env.PORT || 3200

const errorHandler = require('./middleware/ErrorHandlingMiddleware')
const cookieParser = require('cookie-parser')


const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(cors(
    {
    // credentials: true,
    // origin: process.env.CLIENT_URL
}
));
app.use('/api', router)

app.use(express.static('client/dist/client'))
app.get('*', (req, res)=> {
    res.sendFile(
        path.resolve(
            __dirname, 'client', 'dist', 'client', 'index.html'
        )
    )
})

// Обработка ошибок, последний Middleware
app.use(errorHandler)


const start = async () => {
    try {
        await sequelize.authenticate()     //подключение к postgresql
        await sequelize.sync()             //   сверяет состояние бд со схемой

        app.listen(PORT, ()=> console.log(`!!!server started on port: ${PORT}`))
    } catch (e) {
        console.log(e)
    }
}

start();
