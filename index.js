require('dotenv').config()
const express = require('express')
const path = require('path')
const sequelize = require('./db')
const usServ = require('./service/user-service')
// const models = require('./models/models')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const router = require('./routes/rout_index')
const PORT = process.env.PORT || 3200

const errorHandler = require('./middleware/ErrorHandlingMiddleware')
const cookieParser = require('cookie-parser')


const app = express()   // приложение

// Настройка trust proxy для корректной работы с reverse proxy и rate limiting
app.set('trust proxy', 1)

//настройки приложения
app.use(express.json())
app.use(express.static(path.resolve(__dirname, 'static')))   // чтоб сервак мог показать фотки из папки статик
//чтобы проверить что фотки раздаються    http://localhost:3000/6ded70ab-c74f-48c2-b28c-cb6296f7ede3.jpg
app.use(fileUpload({}))   //подключили работу с файлами ... сперва установив npm i  express-fileupload
app.use(cookieParser())
app.use(cors(
    {
    // credentials: true,
    // origin: process.env.CLIENT_URL
}
));
app.use('/api', router)

// if (process.env.NODE_ENV === 'production') {
    app.use(express.static('client/dist/client/browser'))
    app.get('*', (req, res)=> {
        res.sendFile(
            path.resolve(
                __dirname, 'client', 'dist', 'client', 'browser', 'index.html'
            )
        )
    })
// }

// Обработка ошибок, последний Middleware
app.use(errorHandler)


const start = async () => {
    try {
        await sequelize.authenticate()     //подключение к postgresql
        
        // приводит таблицу в соответствие с моделью   //меняем при добавлении колонки
        await sequelize.sync({ alter: true })
// создает таблицу при отсутствии
//         await sequelize.sync()

// await sequelize.sync({ force: true })   // не включать!!!!!!!!!!удаляет все!!!!! и создает новые

        // Инициализация главного админа при первом запуске
        const seedService = require('./service/seed-service')
        try {
            await seedService.initializeSystem()
        } catch (error) {
            console.error('ОШИБКА при инициализации системы:', error)
        }

        await usServ.checkRecordForSendMail()   // запускает таймер отправки сообщения тем кто записан за 5 ч

        // Периодическая очистка истекших токенов (каждый день в 2:00)
        const tokenService = require('./service/token-service')
        const cleanupInterval = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
        setInterval(async () => {
            try {
                await tokenService.cleanupExpiredTokens()
            } catch (error) {
                console.error('Ошибка при периодической очистке токенов:', error)
            }
        }, cleanupInterval)

        app.listen(PORT, ()=> console.log(`!!!server started on port: ${PORT}`))
    } catch (e) {
        console.log(e)
    }
}

start();


// //webSocketServer на порту 3500
// const WebSocket = require('ws');    //подключаем ws после установки пакетов    npm install ws
// const connectedUsers = []       //пользователи, которые подключились
// // const PORT_WS = process.env.PORT_WS_LOCAL || 3700   // меняем при деплое
// const PORT_WS = process.env.PORT_WS || 3700
// const wsServer = new WebSocket.WebSocketServer({ port: PORT_WS });
// wsServer.on('connection', (socket) => {
//     //socket.send(`connected`)                          //отправляю сообщение на фронт что сойдинился
//     connectedUsers.push(socket)                        // добавляю в массив подключенных онлайн
//     socket.on('message', (message) => {                  //когда получу сообщение
//         console.log(`67 !!!!!!Получено сообщение: ${message}`);
//         connectedUsers.forEach(s => {                        //иду по всем кто подключен
//             s.send(JSON.stringify(`${message}`))    // говорю что данные изменились
//         })
//     });
//     socket.on('close', () => {
//         console.log('73close!!!!')
//         socket.send(`Соединение закрыто`);
//     });
// });

