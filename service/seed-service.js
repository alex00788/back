const usModels = require('../models/models')
const User = usModels.User
const Organization = usModels.Organization
const DataUserAboutOrg = usModels.DataUserAboutOrg
const bcrypt = require('bcrypt')
const uuid = require('uuid')
const ApiError = require('../error/ApiError')
const { getMainUrl } = require("../config/domain.config");

class SeedService {
    // Данные главного админа
    mainAdminData = {
        nameUser: 'Александр',
        surnameUser: 'Фоничев',
        email: 'alex-007.88@mail.ru',
        phoneNumber: '89168402927',
        sectionOrOrganization: 'Акро-клуб TRAMPOLINE',
        role: 'MAIN_ADMIN',
        tariff: 'PREMIUM',
        isActivated: true,
        userBlocked: false,
        reasonForBlocking: 'нет причин',
        password: '', // Будет сгенерирован при первом входе
        activationLink: uuid.v4()
    }

    // Данные организации главного админа
    mainOrgData = {
        nameOrg: 'Акро-клуб TRAMPOLINE',
        supervisorName: 'Александр Фоничев',
        managerPhone: '89168402927',
        email: 'alex-007.88@mail.ru', // Должен совпадать с email пользователя
        userId: '', // Будет заполнен после создания пользователя
        orgLink: '',
        photoOrg: '',
        linkActive: true
    }

    // Настройки главного админа в организации
    mainAdminOrgSettings = {
        nameUser: 'Александр',
        surnameUser: 'Фоничев',
        userId: '', // Будет заполнен после создания пользователя
        idOrg: '', // Будет заполнен после создания организации
        idOrgAdmin: '',
        sectionOrOrganization: 'Акро-клуб TRAMPOLINE',
        roleSelectedOrg: 'ADMIN',
        jobTitle: '', // Пустая должность для главного админа, чтобы не показывать кнопку "Направления"
        direction: '',
        photoEmployee: '',
        remainingFunds: '999999', // Неограниченный баланс
        timeStartRec: '08',
        timeMinutesRec: '00',
        timeLastRec: '22',
        maxClients: 50,
        timeUntilBlock: 24,
        recAllowed: true,
        recordingDays: 'пн, вт, ср, чт, пт, сб, вс',
        location: 'Москва, ул. Примерная, д. 1',
        phoneOrg: '89168402927'
    }

    /**
     * Проверяет, существует ли главный админ в системе
     */
    async checkMainAdminExists() {
        try {
            const mainAdmin = await User.findOne({
                where: {
                    email: this.mainAdminData.email
                }
            })
            return !!mainAdmin
        } catch (error) {
            console.error('Ошибка при проверке существования главного админа:', error)
            return false
        }
    }

    /**
     * Проверяет, существует ли главная организация в системе
     */
    async checkMainOrgExists() {
        try {
            const mainOrg = await Organization.findOne({
                where: {
                    nameOrg: this.mainOrgData.nameOrg
                }
            })
            return !!mainOrg
        } catch (error) {
            console.error('Ошибка при проверке существования главной организации:', error)
            return false
        }
    }

    /**
     * Создает главного админа
     */
    async createMainAdmin() {
        try {
            const mainAdmin = await User.create({
                nameUser: this.mainAdminData.nameUser,
                surnameUser: this.mainAdminData.surnameUser,
                email: this.mainAdminData.email,
                phoneNumber: this.mainAdminData.phoneNumber,
                sectionOrOrganization: this.mainAdminData.sectionOrOrganization,
                role: this.mainAdminData.role,
                tariff: this.mainAdminData.tariff,
                isActivated: this.mainAdminData.isActivated,
                userBlocked: this.mainAdminData.userBlocked,
                reasonForBlocking: this.mainAdminData.reasonForBlocking,
                password: this.mainAdminData.password,
                activationLink: this.mainAdminData.activationLink,
                idOrg: '' // Будет заполнен после создания организации
            })

            return mainAdmin
        } catch (error) {
            console.error('Ошибка при создании главного админа:', error)
            throw error
        }
    }

    /**
     * Создает главную организацию
     */
    async createMainOrganization(adminId) {
        try {
            const mainOrg = await Organization.create({
                nameOrg: this.mainOrgData.nameOrg,
                supervisorName: this.mainOrgData.supervisorName,
                managerPhone: this.mainOrgData.managerPhone,
                email: this.mainOrgData.email,
                userId: adminId,
                orgLink: this.mainOrgData.orgLink,
                photoOrg: this.mainOrgData.photoOrg,
                linkActive: this.mainOrgData.linkActive
            })

            return mainOrg
        } catch (error) {
            console.error('Ошибка при создании главной организации:', error)
            throw error
        }
    }

    /**
     * Создает настройки главного админа в организации
     */
    async createMainAdminOrgSettings(adminId, orgId) {
        try {
            const adminSettings = await DataUserAboutOrg.create({
                nameUser: this.mainAdminOrgSettings.nameUser,
                surnameUser: this.mainAdminOrgSettings.surnameUser,
                userId: adminId,
                idOrg: orgId,
                idOrgAdmin: this.mainAdminOrgSettings.idOrgAdmin,
                sectionOrOrganization: this.mainAdminOrgSettings.sectionOrOrganization,
                roleSelectedOrg: this.mainAdminOrgSettings.roleSelectedOrg,
                jobTitle: this.mainAdminOrgSettings.jobTitle,
                direction: this.mainAdminOrgSettings.direction,
                photoEmployee: this.mainAdminOrgSettings.photoEmployee,
                remainingFunds: this.mainAdminOrgSettings.remainingFunds,
                timeStartRec: this.mainAdminOrgSettings.timeStartRec,
                timeMinutesRec: this.mainAdminOrgSettings.timeMinutesRec,
                timeLastRec: this.mainAdminOrgSettings.timeLastRec,
                maxClients: this.mainAdminOrgSettings.maxClients,
                timeUntilBlock: this.mainAdminOrgSettings.timeUntilBlock,
                recAllowed: this.mainAdminOrgSettings.recAllowed,
                recordingDays: this.mainAdminOrgSettings.recordingDays,
                location: this.mainAdminOrgSettings.location,
                phoneOrg: this.mainAdminOrgSettings.phoneOrg
            })

            return adminSettings
        } catch (error) {
            console.error('Ошибка при создании настроек главного админа:', error)
            throw error
        }
    }

    /**
     * Обновляет ID организации у главного админа
     */
    async updateMainAdminOrgId(adminId, orgId) {
        try {
            await User.update(
                { idOrg: orgId },
                { where: { id: adminId } }
            )
        } catch (error) {
            console.error('Ошибка при обновлении ID организации у главного админа:', error)
            throw error
        }
    }

    /**
     * Генерирует ссылку для регистрации клиентов в главной организации
     */
    generateMainOrgLink(orgId) {
        return `${process.env.FRONTEND_URL || getMainUrl()}?organization=${encodeURIComponent(this.mainOrgData.nameOrg)}&i=${orgId}`
    }

    /**
     * Обновляет ссылку организации в базе данных
     */
    async updateMainOrgLink(orgId) {
        try {
            const orgLink = this.generateMainOrgLink(orgId)
            await Organization.update(
                { orgLink: orgLink },
                { where: { idOrg: orgId } }
            )
        } catch (error) {
            console.error('Ошибка при обновлении ссылки главной организации:', error)
            throw error
        }
    }

    /**
     * Основная функция инициализации данных при первом запуске
     */
    async initializeSystem() {
        try {
            // Проверяем, существует ли уже главный админ
            const adminExists = await this.checkMainAdminExists()
            
            const orgExists = await this.checkMainOrgExists()
            
            if (adminExists && orgExists) {
                return {
                    success: true,
                    message: 'Система уже инициализирована',
                    adminExists: true,
                    orgExists: true
                }
            }

            // Если админ существует, но организация нет - создаем организацию
            if (adminExists && !orgExists) {
                const admin = await User.findOne({ where: { email: this.mainAdminData.email } })
                const mainOrg = await this.createMainOrganization(admin.id)
                await this.createMainAdminOrgSettings(admin.id, mainOrg.idOrg)
                await this.updateMainAdminOrgId(admin.id, mainOrg.idOrg)
                await this.updateMainOrgLink(mainOrg.idOrg)
                
                return {
                    success: true,
                    message: 'Организация создана для существующего главного админа',
                    adminExists: true,
                    orgExists: true
                }
            }

            // Если организация существует, но админ нет - создаем админа
            if (!adminExists && orgExists) {
                const org = await Organization.findOne({ where: { nameOrg: this.mainOrgData.nameOrg } })
                const mainAdmin = await this.createMainAdmin()
                await this.updateMainAdminOrgId(mainAdmin.id, org.idOrg)
                await this.createMainAdminOrgSettings(mainAdmin.id, org.idOrg)
                
                return {
                    success: true,
                    message: 'Главный админ создан для существующей организации',
                    adminExists: true,
                    orgExists: true
                }
            }

            // Если ничего не существует - создаем все с нуля
            
            // Создаем главного админа
            const mainAdmin = await this.createMainAdmin()
            
            // Создаем главную организацию
            const mainOrg = await this.createMainOrganization(mainAdmin.id)
            
            // Обновляем ID организации у админа
            await this.updateMainAdminOrgId(mainAdmin.id, mainOrg.idOrg)
            
            // Создаем настройки админа в организации
            await this.createMainAdminOrgSettings(mainAdmin.id, mainOrg.idOrg)
            
            // Обновляем ссылку организации
            await this.updateMainOrgLink(mainOrg.idOrg)
            
            return {
                success: true,
                message: 'Система успешно инициализирована',
                adminExists: true,
                orgExists: true,
                adminId: mainAdmin.id,
                orgId: mainOrg.idOrg
            }
            
        } catch (error) {
            console.error('Ошибка при инициализации системы:', error)
            return {
                success: false,
                message: 'Ошибка при инициализации системы',
                error: error.message
            }
        }
    }

    /**
     * Проверяет целостность данных главного админа
     */
    async validateMainAdminData() {
        try {
            const admin = await User.findOne({
                where: { email: this.mainAdminData.email },
                include: [{
                    model: Organization,
                    as: 'organization',
                    where: { nameOrg: this.mainOrgData.nameOrg }
                }]
            })

            if (!admin) {
                return { valid: false, message: 'Главный админ не найден' }
            }

            const orgSettings = await DataUserAboutOrg.findOne({
                where: {
                    userId: admin.id,
                    idOrg: admin.idOrg,
                    roleSelectedOrg: 'ADMIN'
                }
            })

            if (!orgSettings) {
                return { valid: false, message: 'Настройки главного админа не найдены' }
            }

            return {
                valid: true,
                message: 'Данные главного админа корректны',
                admin: admin,
                orgSettings: orgSettings
            }
        } catch (error) {
            console.error('Ошибка при валидации данных главного админа:', error)
            return { valid: false, message: 'Ошибка при валидации данных', error: error.message }
        }
    }
}

module.exports = new SeedService()

