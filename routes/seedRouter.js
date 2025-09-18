const Router = require('express')
const router = new Router()
const seedController = require('../controllers/seed.Controller')
const authMiddleware = require('../middleware/AuthMiddleware')

// Маршруты для управления инициализацией системы
router.post('/initialize', seedController.initializeSystem)
router.get('/status', seedController.checkSystemStatus)
router.get('/validate-admin', authMiddleware, seedController.validateMainAdmin)
router.get('/admin-info', authMiddleware, seedController.getMainAdminInfo)

module.exports = router







