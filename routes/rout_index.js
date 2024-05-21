const Router = require('express')                        //получаем роутер из  express
const router = new Router()                              //создаем объект роутера
const userRouter = require('./userRouter')


router.use('/user', userRouter)                      //подключаем роут др маршрута

module.exports = router
