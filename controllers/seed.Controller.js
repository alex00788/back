const seedService = require('../service/seed-service')
const ApiError = require('../error/ApiError')

class SeedController {
    /**
     * Инициализация системы (создание главного админа и организации)
     */
    async initializeSystem(req, res, next) {
        try {
            const result = await seedService.initializeSystem()
            
            if (result.success) {
                return res.status(200).json({
                    message: result.message,
                    adminExists: result.adminExists,
                    orgExists: result.orgExists,
                    adminId: result.adminId || null,
                    orgId: result.orgId || null
                })
            } else {
                return next(ApiError.internal(result.message))
            }
        } catch (e) {
            console.error('Ошибка при инициализации системы:', e)
            next(e)
        }
    }

    /**
     * Проверка статуса инициализации системы
     */
    async checkSystemStatus(req, res, next) {
        try {
            const adminExists = await seedService.checkMainAdminExists()
            const orgExists = await seedService.checkMainOrgExists()
            
            return res.status(200).json({
                systemInitialized: adminExists && orgExists,
                adminExists: adminExists,
                orgExists: orgExists,
                message: adminExists && orgExists ? 
                    'Система инициализирована' : 
                    'Система требует инициализации'
            })
        } catch (e) {
            console.error('Ошибка при проверке статуса системы:', e)
            next(e)
        }
    }

    /**
     * Валидация данных главного админа
     */
    async validateMainAdmin(req, res, next) {
        try {
            const validation = await seedService.validateMainAdminData()
            
            if (validation.valid) {
                return res.status(200).json({
                    valid: true,
                    message: validation.message,
                    admin: {
                        id: validation.admin.id,
                        name: validation.admin.nameUser,
                        surname: validation.admin.surnameUser,
                        email: validation.admin.email,
                        phone: validation.admin.phoneNumber,
                        role: validation.admin.role,
                        organization: validation.admin.sectionOrOrganization
                    },
                    orgSettings: {
                        idRec: validation.orgSettings.idRec,
                        roleSelectedOrg: validation.orgSettings.roleSelectedOrg,
                        jobTitle: validation.orgSettings.jobTitle,
                        remainingFunds: validation.orgSettings.remainingFunds
                    }
                })
            } else {
                return res.status(400).json({
                    valid: false,
                    message: validation.message,
                    error: validation.error || null
                })
            }
        } catch (e) {
            console.error('Ошибка при валидации главного админа:', e)
            next(e)
        }
    }

    /**
     * Получение информации о главном админе
     */
    async getMainAdminInfo(req, res, next) {
        try {
            const adminExists = await seedService.checkMainAdminExists()
            
            if (!adminExists) {
                return res.status(404).json({
                    message: 'Главный админ не найден в системе'
                })
            }

            const validation = await seedService.validateMainAdminData()
            
            if (validation.valid) {
                return res.status(200).json({
                    admin: {
                        id: validation.admin.id,
                        nameUser: validation.admin.nameUser,
                        surnameUser: validation.admin.surnameUser,
                        email: validation.admin.email,
                        phoneNumber: validation.admin.phoneNumber,
                        role: validation.admin.role,
                        tariff: validation.admin.tariff,
                        sectionOrOrganization: validation.admin.sectionOrOrganization,
                        isActivated: validation.admin.isActivated,
                        userBlocked: validation.admin.userBlocked
                    },
                    organization: {
                        idOrg: validation.admin.idOrg,
                        nameOrg: seedService.mainOrgData.nameOrg,
                        supervisorName: seedService.mainOrgData.supervisorName,
                        managerPhone: seedService.mainOrgData.managerPhone,
                        linkActive: seedService.mainOrgData.linkActive
                    },
                    settings: {
                        jobTitle: validation.orgSettings.jobTitle,
                        direction: validation.orgSettings.direction,
                        remainingFunds: validation.orgSettings.remainingFunds,
                        timeStartRec: validation.orgSettings.timeStartRec,
                        timeLastRec: validation.orgSettings.timeLastRec,
                        maxClients: validation.orgSettings.maxClients,
                        location: validation.orgSettings.location,
                        phoneOrg: validation.orgSettings.phoneOrg
                    }
                })
            } else {
                return res.status(400).json({
                    message: 'Данные главного админа некорректны',
                    error: validation.message
                })
            }
        } catch (e) {
            console.error('Ошибка при получении информации о главном админе:', e)
            next(e)
        }
    }
}

module.exports = new SeedController()







