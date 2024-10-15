require('dotenv').config()
const express = require('express')
const path = require('path')
const sequelize = require('./db')
const usServ = require('./service/user-service')
// const models = require('./models/models')
const cors = require('cors')
const router = require('./routes/rout_index')
const PORT = process.env.PORT || 3200

const errorHandler = require('./middleware/ErrorHandlingMiddleware')
const cookieParser = require('cookie-parser')


const app = express()   // приложение
//настройки приложения
app.use(express.json())
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
        await sequelize.sync()             //   сверяет состояние бд со схемой

        await usServ.checkRecordForSendMail()   // запускает таймер отправки сообщения тем кто записан за 5 ч

        app.listen(PORT, ()=> console.log(`!!!server started on port: ${PORT}`))
    } catch (e) {
        console.log(e)
    }
}

start();


//webSocketServer на порту 3500
const WebSocket = require('ws');    //подключаем ws после установки пакетов    npm install ws
const connectedUsers = []       //пользователи, которые подключились
const PORT_WS = process.env.PORT_WS || 3700
const wsServer = new WebSocket.WebSocketServer({ port: PORT_WS });
wsServer.on('connection', (socket) => {
    //socket.send(`connected`)                          //отправляю сообщение на фронт что сойдинился
    connectedUsers.push(socket)                        // добавляю в массив подключенных онлайн
    socket.on('message', (message) => {                  //когда получу сообщение
        console.log(`67 !!!!!!Получено сообщение: ${message}`);
        connectedUsers.forEach(s => {                        //иду по всем кто подключен
            s.send(JSON.stringify(`${message}`))    // говорю что данные изменились
        })
    });
    socket.on('close', () => {
        console.log('73close!!!!')
        socket.send(`Соединение закрыто`);
    });
});

