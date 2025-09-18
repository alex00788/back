const Router = require('express')                        //получаем роутер из  express
const router = new Router()                              //создаем объект роутера
const userRouter = require('./userRouter')
const seedRouter = require('./seedRouter')


router.use('/user', userRouter)                      //подключаем роут др маршрута
router.use('/seed', seedRouter)                      //подключаем роут для инициализации системы

module.exports = router
