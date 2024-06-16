const ApiError = require('../error/ApiError')
const user_service = require('../service/user-service')
const {validationResult} = require('express-validator');
const mailService = require("../service/mail-service");
const uuid = require("uuid");

class UserController {
    async registration(req, res, next) {
        try {
            const errors = validationResult(req)

            if (errors.array()[0]?.path === "email" && errors.array()[0].msg === "Invalid value") {
                return next(ApiError.badRequest(`некорректно введен email!`, errors.array()))
            }
            if (errors.array()[0]?.path === "password" && errors.array()[0].msg === "Invalid value") {
                return next(ApiError.badRequest(`некорректно введен пароль!`, errors.array()))
            }
            if (errors.array()[0]?.path === "phoneNumber" && errors.array()[0].msg === "Invalid value") {
                return next(ApiError.badRequest(`некорректно введен номер телефона!`, errors.array()))
            }
            if (!errors.isEmpty()) {
                return next(ApiError.badRequest(`ошибка при валидации`, errors.array()))
            }

            const {email, password, nameUser, surnameUser, phoneNumber, sectionOrOrganization, idOrg} = req.body
            const remainingFunds = '0'
            const userData = await user_service.registration(email, password, nameUser, surnameUser, phoneNumber, sectionOrOrganization, idOrg, remainingFunds)

            // хранение рефрешТокена в куках
            res.cookie('refreshToken', userData.refreshToken, {maxAge: 30, httpOnly: true})  //httpOnly: true, чтоб нельзя было изменить
            // 1ое ключь сохранения    2ое то что сохраняем   чтоб это работало нужно в index.js подключить  app.use(cookie_parser())
            return res.json(userData)
        } catch (e) {
            console.log('31!ERROR', e)
            next(e)
        }
    }


    //Функция меняющая роль пользователя в бд
    async changeRole(req, res, next) {
        try {
            const userId = req.body.userId
            const idOrg = req.body.idOrg
            //выносим логику в сервис
            const userRole = await user_service.changeRole(userId, idOrg)
            return res.status(200).json(userRole.userRole)
        } catch (e) {
            next(e)
        }
    }


    //функция добавляющая запись о текущей дате
    async changeWorkStatus(req, res, next) {
        try {
            const btnClicked = true;
            const data = await user_service.changeWorkStatus(req.body, btnClicked)
            return res.status(200).json({message: `запись ${data.data.date} в ${data.data.time}:00 ${data.workStatus}`, data:data})
        } catch (e) {
            next(e)
        }
    }



    //функция добавляющая запись о текущей дате
    async addEntry(req, res, next) {
        try {
            const newEntry = req.body
            const userSignedHimself = req.body.userSignedHimself
            //выносим логику в сервис
            const data = await user_service.newEntry(newEntry)
            if (data.userAlreadyRecorded) {
                return next(ApiError.badRequest(`${newEntry.user} 
                    уже записан(а) ${newEntry.date} в ${newEntry.time}:00  ${data.alreadyRec.dataValues.sectionOrOrganization}`));
            }

            if (data.newClient) {
                return next(ApiError.badRequest(`Похоже, что вы впервые в этой организации...для дальнейшей записи свяжитесь с администратором...`));
            }

            if (data.balance === 'off') {
                return next(ApiError.badRequest(`Пожалуйста, пополните баланс`));
            }


            if (!data.emailAdmin) {
                return next(ApiError.badRequest(`Администратор Организации еще не зарегистрирован`));
            }

            if (userSignedHimself) {
                //разблокировать когда все почты будут настоящими
                //тока если пользователь сам записался !!! отправляем письмо Админу
                // await mailService.notificationOfAnEntry(data.emailAdmin, newEntry.user,newEntry.sectionOrOrganization, newEntry.date, newEntry.time + ': 00')
            }

            const userData = data.userData
            return res.status(200).json({message: 'данные сохранены в бд', userData})
        } catch (e) {
            next(e)
        }
    }


//Функция записывающая настройки админов организаций
    async setSettings(req, res, next) {
        try {
            const settingsData = req.body
            //выносим логику в сервис
            const newSettings = await user_service.setSettings(settingsData)


            return res.status(200).json({message: 'данные сохранены в бд', newSettings})
        } catch (e) {
            next(e)
        }
    }


    //Добавление новой организации.
    async addOrg(req, res, next) {
        try {
            const newOrganization = req.body
            //выносим логику в сервис
            const newOrgData = await user_service.newOrg(newOrganization)
            if (!newOrgData) {
                return next(ApiError.badRequest(`Организация  ${newOrganization.nameOrg} уже добавлена`));
            }
            // if (newOrgData === 'duplicatePhone') {
            //     return next(ApiError.badRequest(`Телефон  ${newOrganization.managerPhone} уже добавлен`));
            // }
            return res.status(200).json({message: `организация ${newOrgData.nameOrg} добавлена и сохранена в бд`, newOrgData})
        } catch (e) {
            next(e)
        }
    }

    //Отправит письмо мне на почту с уведомлением, что хотят новую орг добавить
    async addNewOrg(req, res, next) {
        try {
            const addNewOrg = req.body
            const email = process.env.EMAIL_MY
            await mailService.sendNewOrg(email, addNewOrg)
            return res.status(200).json({message: `организация ${addNewOrg.nameSectionOrOrganization} будет доступна в течении 5-10 минут`})
        } catch (e) {
            next(e)
        }
    }

    //повторная отправка ссылки
    async resendLink(req, res, next) {
        try {
            const userEmail = req.body.email
            const userResendLink = await user_service.resendLink(userEmail)
            const activationLink = userResendLink.dataValues.activationLink
            await mailService.sendActivationMail({userEmail}, `${process.env.API_URL}/api/user/activate/${activationLink}`, null)
            return res.status(200).json({message: `ссылка отправлена на адрес ${userEmail}`})
        } catch (e) {
            next(e)
        }
    }

    //отправка сообщения о доработки функционала от пользователей мне на почту
    async sendInSupport(req, res, next) {
        try {
            const descriptions = req.body.description
            const emailForFeedback = req.body.email                            //добавить отправку письма тому кто отправил запрос если он ввел почту
            await mailService.sendInSupport(descriptions)
            return res.status(200).json({message: `Запрос на доработку получен!`})
        } catch (e) {
            next(e)
        }
    }


    async clearTableRec(req, res, next) {
        try {
            const date = req.body.threeMonthsAgo
            const clearRec = await user_service.clearTableRec(date)
            return res.status(200).json({message: `данные таблицы записей перенесены в архив`})
        } catch (e) {
            next(e)
        }
    }

    async changeAllowed(req, res, next) {
            try {
                const data = req.body
                const changeAllowed = await user_service.changeAllowed(data)
                return res.status(200).json({message: `настройки сохранены`, allowed:changeAllowed})
            } catch (e) {
                next(e)
            }
        }

        async addSubscription(req, res, next) {
            try {
                const data = req.body
                const changeRemain = await user_service.addSubscription(data)
                return res.status(200).json({message: `абонемент добавлен`, changeRemain})
            } catch (e) {
                next(e)
            }
        }

    //функция, которая берет все записи по указанной дате
    // async getAllEntry(req, res, next) {
    //     try {
    //         const data = req.query.date
    //         //выносим логику в сервис
    //         const userData = await user_service.getAllEntry(data)
    //         return res.status(200).json(userData)
    //     } catch (e) {
    //         next(e)
    //     }
    // }



    //функция, которая берет Из указанной Организации все записи всех пользователей за указанный месяц
    async getAllEntryAllUsers(req, res, next) {
        try {
            const {year, month, org, orgId,userId, roleSelectedOrg, remainingFunds} = req.query
            //выносим логику в сервис
            const allEntryAllUsers = await user_service.getAllEntryAllUsers(year, month, org, orgId,userId, roleSelectedOrg, remainingFunds)
            return res.status(200).json(allEntryAllUsers)
        } catch (e) {
            next(e)
        }
    }


    //функция, которая берет все записи текущего user во всех организациях для блока мои записи в месяце
    async getAllEntryCurrentUser(req, res, next) {
        try {
            const {year, month, userId} = req.query
            //выносим логику в сервис
            const allEntryCurrentUser = await user_service.getAllEntryCurrentUser(year, month, userId)
            return res.status(200).json(allEntryCurrentUser)
        } catch (e) {
            next(e)
        }
    }



    //функция, которая берет все существующие в базе организации
    async getAllOrg(req, res, next) {
        try {
            const allOrg = await user_service.getAllOrg()
            return res.status(200).json({allOrg})
        } catch (e) {
            next(e)
        }
    }

    //функция, которая берет все записи по указанной дате в конкретное время
    async getAllEntryInCurrentTimes(req, res, next) {
        try {
            const data = req.query.dateRec
            const time = req.query.timeRec
            //выносим логику в сервис
            const usersRecInCurrentTime = await user_service.getAllEntryInCurTimes(data, time)
            return res.status(200).json(usersRecInCurrentTime)
        } catch (e) {
            next(e)
        }
    }


    //функция вернет на фронт всех пользователей
    async getAllUsersToFillInput(req, res, next) {
        try {
            //выносим логику в сервис
            const allUsers = await user_service.getAllUsersToFillInput()
            return res.status(200).json(allUsers)
        } catch (e) {
            next(e)
        }
    }


    async getPhoneClient (req, res, next) {
        try {
            const userId = req.query.userId
            const phoneCl = await user_service.getPhoneClient(userId)
            return res.status(200).json(phoneCl)
        } catch (e) {
            next(e)
        }
    }


    //функция вернет на фронт всех пользователей текущей организации
    async getAllUsersCurrentOrganization(req, res, next) {
        try {
            const idOrg = req.query.idOrg
            const userId = req.query.userId
            //выносим логику в сервис
            const allUsersOrganization = await user_service.getAllUsersOrganization(idOrg, userId)
            return res.status(200).json(allUsersOrganization)
        } catch (e) {
            next(e)
        }
    }

    //функция, которая удалит выбранную запись
    async deleteOwnEntry(req, res, next) {
        try {
            const deleteEntryId = req.params.id
            const restoreBalance = req.params.userId
            const orgId = req.params.orgId
            const userCancelHimselfRec = req.params.userCancelHimselfRec
            const workStatus = req.params.workStatus === 0? 'closed' : 'open'
        //выносим логику в сервис
            const dataAboutDeleteRec = await user_service.dataAboutDeleteRec(deleteEntryId, workStatus)
            const emailUser = dataAboutDeleteRec.userEmail
            const deleteUserId = await user_service.deleteEntry(deleteEntryId, restoreBalance, orgId)
            const mailAdmin = await user_service.getMailAdminOrg(orgId)
        //если пользователь сам отменил запись...отправим письмо админу что отписался...
            if (userCancelHimselfRec == 1) {

                //разблокировать когда все почты будут настоящими
                // await mailService.clientCanceledRecording(mailAdmin, dataAboutDeleteRec.nameUser,
                //     dataAboutDeleteRec.sectionOrOrganization, dataAboutDeleteRec.date, dataAboutDeleteRec.time)
        //иначе если админ удалил клиента то письмо клиенту об отмене
            } else {
                //разблокировать когда все почты будут настоящими
                // await mailService.adminCanceledRecording(emailUser, dataAboutDeleteRec.nameUser,
                //     dataAboutDeleteRec.sectionOrOrganization, dataAboutDeleteRec.date, dataAboutDeleteRec.time)
            }

            return res.status(200).json({message: `удалена запись с id = ${deleteUserId}`})
        } catch (e) {
            next(e)
        }
    }



    async login(req, res, next) {
        try {
            const {email, password} = req.body
            //выносим логику в сервис
            const userData = await user_service.login(email, password)

            // хранение рефрешТокена в куках
            // чтобы куки сохранялись нужно подключить в индексе  app.use(cookie_parser())   npm install cookie-parser
            res.cookie('refreshToken', userData.refreshToken, {maxAge: 30, httpOnly: true})  //httpOnly: true  чтоб нельзя было изменить // maxAge время жизни куки
            return res.json(userData)
        } catch (e) {
            next(e)
        }
    }



    async refresh(req, res, next) {
        //функция перезаписи токена
        try {
            //из куки вытаскиваем рефреш токен                    почему то нету его там
            const {refreshToken} = req.cookies;
            // console.log('43refreshToken', req)
            // console.log('44refreshToken', refreshToken)

            //повторяем логику логина   генерируем - установим в куки - и вернем на клиент
            const userData = await user_service.refresh(refreshToken)   // тока  передаем refreshToken  и метод меняем
            res.cookie('refreshToken', userData.refreshToken, {maxAge: 30, httpOnly: true})
            return res.json(userData)
        } catch (e) {
            next(e)
        }
    }



    async logout(req, res, next) {
        try {
            //из куки вытаскиваем рефреш токен   ... и выносим логику в сервис
            const {refreshToken} = req.cookies;
            console.log('43', req.cookies)

            //идем в сервис передаем туда токен  там метод который идет в токен сервис и удаляет из бд токен
            // const token = await user_service.logout(refreshToken)

            // удаляем саму куку
            res.clearCookie('refreshToken');
            return res.status(200).json('token11111')

        } catch (e) {
            next(e)
        }
    }



    async check(req, res, next) {
        try {
            //получаем список
            const users = await user_service.getAllUsers();
            res.json(users)
        } catch (e) {

        }
    }

    //функция срабатывает при клике в почте
    async activate(req, res, next) {
        try {
            // получаем ссылку из строки запроса
            const activationLink = req.params.link;

            //вызываем функц в сервисе
            await user_service.activate(activationLink)

            //в CLIENT_URL  указываем ссылку клиента
            return res.redirect(process.env.CLIENT_URL)
        } catch (e) {
            console.log(e)
        }
    }


}


module.exports = new UserController()
