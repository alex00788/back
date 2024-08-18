const Router = require('express')
const router = new Router()
const userController = require('../controllers/user.Controller')
const {body} = require('express-validator');                            //нужна для валидации тела запроса  используем в /registration
const authMiddleware = require('../middleware/AuthMiddleware')

router.post('/registration',
    body('email').isEmail(),                                 //вызываем как мидлвеер и внутри название поля которое хотим провалидировать
    body('password').isLength({min: 3, max: 10}),     // есть много валидаторов
    body('phoneNumber').isMobilePhone(),                    // проверка тел
    userController.registration
)
router.post('/login', userController.login)
router.post('/logout', userController.logout)
router.get('/activate/:link', userController.activate)      //для активации по ссылки
router.get('/refresh', userController.refresh)               //для обновления токена чтоб автоматом обновлялся и не редеректил но логин стр


// в видео Продвинутая JWT авторизация на React и Node js    этого  Middleware  нету
router.get('/auth', authMiddleware, userController.check)  // тут Middleware для проверки токена на валидность
// Разобраться   почему   в   authMiddleware   не видит  токена


//Продвинутая JWT авторизация на React и Node js.   пересмотреть начиная с 60 мин

router.post('/addEntry', userController.addEntry)
router.post('/changeWorkStatus', userController.changeWorkStatus)
router.post('/setSettings', userController.setSettings)
router.post('/addOrg', userController.addOrg)
router.post('/addNewOrg', userController.addNewOrg)
router.post('/resendLink', userController.resendLink)
router.post('/sendInSupport', userController.sendInSupport)
router.post('/clearTableRec', userController.clearTableRec)
router.post('/changeAllowed', userController.changeAllowed)
router.post('/addSubscription', userController.addSubscription)
router.post('/changeRole', userController.changeRole)
router.put('/renameUser', userController.renameUser)

// router.get('/getAllEntry', userController.getAllEntry)
router.get('/getAllEntryAllUsers', userController.getAllEntryAllUsers)
router.get('/getAllEntryCurrentUser', userController.getAllEntryCurrentUser)
router.get('/getAllOrg', userController.getAllOrg)
router.get('/getAllUsers', userController.getAllUsersToFillInput)
router.get('/getPhoneClient', userController.getPhoneClient)
router.get('/getAllUsersCurrentOrganization', userController.getAllUsersCurrentOrganization)
router.delete('/deleteEntry/:id/:userId/:orgId/:userCancelHimselfRec/:workStatus', userController.deleteOwnEntry)
router.get('/getAllEntryInCurrentTimes', userController.getAllEntryInCurrentTimes)





module.exports = router
