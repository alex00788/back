const Router = require('express')
const router = new Router()
const userController = require('../controllers/user.Controller')
const {body, validationResult} = require('express-validator');                            //нужна для валидации тела запроса  используем в /registration
const authMiddleware = require('../middleware/AuthMiddleware')
const rateLimit = require('express-rate-limit')

router.post('/registration',
    body('email').isEmail(),                                 //вызываем как мидлвеер и внутри название поля которое хотим провалидировать
    body('phoneNumber').isMobilePhone(),                    // проверка тел
    userController.registration
)
router.post('/login', userController.login)
router.post('/logout', userController.logout)
router.get('/activate/:link', userController.activate)      //для активации по ссылки
router.post('/refresh', userController.refresh)               //для обновления токена чтоб автоматом обновлялся и не редеректил но логин стр


// в видео Продвинутая JWT авторизация на React и Node js    этого  Middleware  нету
router.get('/auth', authMiddleware, userController.check)  // тут Middleware для проверки токена на валидность
// Разобраться   почему   в   authMiddleware   не видит  токена


//Продвинутая JWT авторизация на React и Node js.   пересмотреть начиная с 60 мин

router.post('/addEntry', authMiddleware, userController.addEntry)
router.post('/loadPhotoEmployee', authMiddleware, userController.loadPhotoEmployee)
router.post('/loadPhotoLabelOrg', authMiddleware, userController.loadPhotoLabelOrg)
router.delete('/deletePhotoOrg', authMiddleware, userController.deletePhotoOrg)
router.post('/changeWorkStatus', authMiddleware, userController.changeWorkStatus)
router.post('/setSettings', authMiddleware, userController.setSettings)
router.post('/addOrg', authMiddleware, userController.addOrg)
router.post('/addNewOrg', userController.addNewOrg)
router.post('/resendLink', userController.resendLink)
router.post('/generateTempPassword', userController.generateTempPassword)
// Rate limiting для биометрических операций
const biometricRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 10 попыток за 15 минут
  message: 'Слишком много попыток биометрической аутентификации. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Валидация для биометрических данных
const validateBiometricCredential = [
  body('email').isEmail().normalizeEmail(),
  body('credential.id').isLength({ min: 1 }),
  body('credential.response.authenticatorData').isBase64(),
  body('credential.response.clientDataJSON').isBase64(),
  body('credential.response.signature').isBase64(),
  body('challengeId').isUUID(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
]

const validateBiometricChallenge = [
  body('email').isEmail().normalizeEmail().withMessage('Неверно введен email. Проверьте правильность написания адреса электронной почты.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Некоректные данные',
        errors: errors.array() 
      });
    }
    next();
  }
]

router.post('/biometric/challenge', biometricRateLimit, validateBiometricChallenge, userController.getBiometricChallenge)
router.post('/biometric/verify', biometricRateLimit, validateBiometricCredential, userController.verifyBiometricAuth)
router.post('/biometric/register', biometricRateLimit, validateBiometricCredential, userController.registerBiometric)
router.post('/biometric/status', validateBiometricChallenge, userController.checkBiometricStatus)
router.post('/sendInSupport', userController.sendInSupport)
router.post('/clearTableRec', authMiddleware, userController.clearTableRec)
router.post('/changeAllowed', authMiddleware, userController.changeAllowed)
router.post('/addSubscription', authMiddleware, userController.addSubscription)
router.post('/changeRole', authMiddleware, userController.changeRole)
router.post('/changeJobTitle', authMiddleware, userController.changeJobTitle)
router.put('/fireFromOrg', authMiddleware, userController.fireFromOffice)
router.put('/renameUser', authMiddleware, userController.renameUser)
router.put('/renameOrg', authMiddleware, userController.renameOrg)
router.put('/registerAgain', userController.registerAgain)

// router.get('/getAllEntry', userController.getAllEntry)
router.get('/getAllEntryAllUsers', authMiddleware, userController.getAllEntryAllUsers)
router.get('/getAllEntryCurrentUser', authMiddleware, userController.getAllEntryCurrentUser)
router.get('/getAllOrg', userController.getAllOrg)
router.get('/getOrgLink/:idOrg', authMiddleware, userController.getOrgLink)
router.get('/getAllUsers', authMiddleware, userController.getAllUsersToFillInput)
router.get('/getPhoneClient', authMiddleware, userController.getPhoneClient)
router.get('/getAllUsersCurrentOrganization', authMiddleware, userController.getAllUsersCurrentOrganization)
router.get('/getAllDataAboutResetSelectedUser', authMiddleware, userController.getAllDataAboutResetSelectedUser)
router.delete('/deleteEntry/:id/:userId/:orgId/:userCancelHimselfRec/:workStatus', authMiddleware, userController.deleteOwnEntry)
router.delete('/deleteTestData/:email', authMiddleware, userController.deleteTestData)
router.get('/getAllEntryInCurrentTimes', authMiddleware, userController.getAllEntryInCurrentTimes)





module.exports = router
