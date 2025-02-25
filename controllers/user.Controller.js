const ApiError = require('../error/ApiError')
const user_service = require('../service/user-service')
const {validationResult} = require('express-validator');
const mailService = require("../service/mail-service");
const uuid = require("uuid");
const path = require("path");
const {rm} = require("node:fs");
let fs = require('fs');

class UserController {
    async registration(req, res, next) {
        try {
            const {email, password, nameUser, surnameUser, phoneNumber, sectionOrOrganization, idOrg} = req.body
            const errors = validationResult(req)

            const sendMail = await mailService.checkingMailExists(email)
            if (sendMail === 'errSend') {           //проверка, что почта вообще существует
                throw ApiError.badRequest('Что-то с email, похоже он не существует!!!')
            }
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



    //Функция удалит пользователя из всех таб..., но только если почта не подтверждена!
    async registerAgain(req, res, next) {
        try {
            const {email} = req.body
            //выносим логику в сервис
            await user_service.registerAgain(email)
            return res.status(200).json({message: 'Убедитесь что Email и другие данные введены верно! И после нажмите еще раз кнопку зарегистрироваться'})
        } catch (e) {
            next(e)
        }
    }




    //Функция меняющая названия организации во всех таблицах бд по id
    async renameOrg(req, res, next) {
        try {
            const orgId = req.body.orgId
            const newNameOrg = req.body.newNameOrg
            //выносим логику в сервис
            const renamingProcess = await user_service.renameOrg(orgId, newNameOrg)
            return res.status(200).json({newNameOrg})
        } catch (e) {
            next(e)
        }
    }

    //Функция меняющая имя и фамилию во всех таблицах бд по id
    async renameUser(req, res, next) {
        try {
            const userId = req.body.userId
            const newName = req.body.newName
            const newSurname = req.body.newSurname
            //выносим логику в сервис
            const renamingProcess = await user_service.rename(userId, newName, newSurname)
            return res.status(200).json({message: `${renamingProcess} ${newName} ${newSurname}`})
        } catch (e) {
            next(e)
        }
    }


    //Функция меняющая должность текущей организации
    async changeJobTitle(req, res, next) {
        try {
            const {userId, idOrg, jobTitle, direction, photoEmployee} = req.body
            //выносим логику в сервис
            const fireFromOfficeProcess = false
            const userJobTitle = await user_service.changeJobTitle(userId, idOrg, jobTitle, direction, photoEmployee)
            return res.status(200).json(userJobTitle)
        } catch (e) {
            next(e)
        }
    }


    //Снятие с должности указанного пользователя
    async fireFromOffice(req, res, next) {
        try {
            const userId = req.body.userId
            const idOrg = req.body.orgId
            const jobTitle = ""
            const direction = ""
            const photoEmployee = ""

//удаление фото из папки статика на сервере
            const dataEmployeeAboutPhoto = await user_service.getPhotoForRemove(userId, idOrg)
            if (dataEmployeeAboutPhoto && dataEmployeeAboutPhoto.length >= 1) {
                fs.unlink('static/' + dataEmployeeAboutPhoto, err => {
                    if(err) throw err; // не удалось удалить файл
                    console.log('старое фото успешно удалёно');
                });
            }

            //выносим логику в сервис
            const fireFromOfficeProcess = true
            const fireFromOrg= await user_service.changeJobTitle(userId, idOrg, jobTitle, direction, photoEmployee, fireFromOfficeProcess)
            return res.status(200).json({message: `Клиент снят с должности`})
        } catch (e) {
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


            if (!data.emailAdmin && newEntry.openEmployeeForRec) {
                return next(ApiError.badRequest(`Администратор Организации еще не зарегистрирован`));
            }

            if (userSignedHimself && !newEntry.openEmployeeForRec) {
                //разблокировать когда все почты будут настоящими
                //тока если пользователь сам записался !!! отправляем письмо Админу
                await mailService.notificationOfAnEntry(data.emailAdmin, newEntry.user,newEntry.sectionOrOrganization, newEntry.date, newEntry.time + ': 00')
            }
            if (userSignedHimself && newEntry.openEmployeeForRec) {
                // тогда отправляем письмо сначала админу потом сотруднику
                await mailService.notificationOfAnEntry(data.emailAdmin, newEntry.user,newEntry.sectionOrOrganization, newEntry.date, newEntry.time + ': 00')
                await mailService.notificationOfAnEntry(data.mailEmployeeOrg, newEntry.user,newEntry.sectionOrOrganization, newEntry.date, newEntry.time + ': 00')
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

    //Функция добавления фото
    async loadPhotoEmployee(req, res, next) {
        try {
            const selectedUserId = req.body.userId
            const orgId = req.body.orgId
            const filePhoto = req.files                   //Картинку получаем из req.files
            let idPhoto =  uuid.v4() + ".jpg"      //генерим id по которому будем эту фотку искать
            await filePhoto.file.mv(path.resolve(__dirname, '..', 'static', idPhoto))   // перемещаем фото в папку статик
            //__dirname текущая дериктория .. выход на уровень выше ...

//выносим логику в сервис
            const newPhotoEmployee = await user_service.newPhotoEmployee(idPhoto, selectedUserId, orgId)

//удаление старой фотки из папки статика
            if (newPhotoEmployee.oldPhoto.length >= 1) {
                fs.unlink('static/' + newPhotoEmployee.oldPhoto, err => {
                    if(err) throw err; // не удалось удалить файл
                    console.log('старое фото успешно удалёно');
                });
            }
            return res.status(200).json(idPhoto);
        } catch (e) {
            next(e)
        }
    }



    //Функция добавления фото организации
    async loadPhotoLabelOrg(req, res, next) {
        try {
            const orgId = req.body.orgId
            const filePhoto = req.files                   //Картинку получаем из req.files
            let idPhoto =  uuid.v4() + ".jpg"      //генерим id по которому будем эту фотку искать
            await filePhoto.file.mv(path.resolve(__dirname, '..', 'static', idPhoto))   // перемещаем фото в папку статик
            //__dirname текущая дериктория .. выход на уровень выше ...

//выносим логику в сервис
            const newPhotoOrg = await user_service.newPhotoOrg(idPhoto, orgId)

//удаление старой фотки из папки статика
            if (newPhotoOrg.oldPhoto.length >= 1) {
                fs.unlink('static/' + newPhotoOrg.oldPhoto, err => {
                    if(err) throw err; // не удалось удалить файл
                    console.log('старое фото успешно удалёно');
                });
            }
            return res.status(200).json(idPhoto);
        } catch (e) {
            next(e)
        }
    }



    //Добавление новой организации.
    async addOrg(req, res, next) {
        try {
            const newOrganization = req.body

            //проверка, что почта существует
            const sendMail = await mailService.checkingMailExists(newOrganization.email)
            if (sendMail === 'errSend') {
                throw ApiError.badRequest('Что-то с email, похоже он не существует!')
            }

            //выносим логику в сервис
            const newOrgData = await user_service.newOrg(newOrganization)
            if (!newOrgData) {
                return next(ApiError.badRequest(`Организация  ${newOrganization.nameOrg} уже добавлена`));
            }
            // if (newOrgData === 'duplicatePhone') {
            //     return next(ApiError.badRequest(`Телефон  ${newOrganization.managerPhone} уже добавлен`));
            // }

            //отправит письмо владельцу орг о том что орг добавлена
            await mailService.sendNotificationAboutSuccessfulAddNewOrg(newOrganization.email, newOrganization.nameOrg, newOrgData.dataValues.idOrg)

            return res.status(200).json({message: `организация ${newOrgData.nameOrg} добавлена и сохранена в бд`, newOrgData})
        } catch (e) {
            next(e)
        }
    }

    //Отправит письмо мне на почту с уведомлением, что хотят новую орг добавить
    async addNewOrg(req, res, next) {
        try {
            const sendMail = await mailService.checkingMailExists(req.body.email)
            if (sendMail === 'errSend') {           //проверка, что почта вообще существует
                throw ApiError.badRequest('Что-то с email, похоже он не существует!!!')
            }
            const addNewOrg = req.body
            const email = process.env.EMAIL_MY
            await mailService.sendNewOrg(email, addNewOrg)
            return res.status(200).json({message: `${addNewOrg.nameSectionOrOrganization} скоро будет доступна, вам придет сообщение на почту.`})
        } catch (e) {
            next(e)
        }
    }

    //повторная отправка ссылки
    async resendLink(req, res, next) {
        try {
            const userEmail = req.body.email
            const password = req.body.password
            const userResendLink = await user_service.resendLink(userEmail)
            const activationLink = userResendLink.dataValues.activationLink
            await mailService.sendActivationMail({userEmail}, `${process.env.API_URL}/api/user/activate/${activationLink}`, req.body.password)
            return res.status(200).json({message: `ссылка отправлена на адрес ${userEmail}`})
        } catch (e) {
            next(e)
        }
    }


    //отправка пароля на почту пользователя
    async rememberPas(req, res, next) {
        try {
            const userEmail = req.body.email
            if (!userEmail) {
                throw ApiError.badRequest('email не указан!')
            }
            const p = await user_service.rememberPasThisUser(userEmail)
            await mailService.rememberP(userEmail, p.z)
            return res.status(200).json({message: ` пароль отправлен на почту ${userEmail}`})
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
            const clearingUnauthorizedUsers = await user_service.clearingUnauthorized()
            return res.status(200).json({message: `БД очищена, данные таблицы записей перенесены в архив`})
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
            const employee = JSON.parse(req.query.employee)
            const clickedByAdmin = JSON.parse(req.query.clickedByAdmin)
            //выносим логику в сервис
            const allUsersOrganization = await user_service.getAllUsersOrganization(idOrg, userId, employee, clickedByAdmin)
            return res.status(200).json(allUsersOrganization)
        } catch (e) {
            next(e)
        }
    }

    //функция вернет админу данные о направлениях пользователя в тек орг
    async getAllDataAboutResetSelectedUser(req, res, next) {
        try {
            const idOrg = req.query.idOrg
            const userId = req.query.userId

            const dataAboutDirection = await user_service.getAllDataAboutResetSelectedUser(idOrg, userId)
            return res.status(200).json(dataAboutDirection)
        } catch (e) {
            next(e)
        }
    }



    //Функция удалит все что связано с этой почтой из всех таблиц
    async deleteTestData(req, res, next) {
        try {
            const email = req.params.email
            //выносим логику в сервис
            const deleteDataConnectedWithEmail= await user_service.removeDataConnectedWithEmail(email)

            return res.status(200).json({message: `Все данные связанные с ${email} удалены!`})
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
            const idOrgWhereEmployeeWorks = await user_service.getIdOrgWhereEmployeeWorks(orgId)
            const dataAboutDeleteRec = await user_service.dataAboutDeleteRec(deleteEntryId, workStatus)
            const emailUser = dataAboutDeleteRec.dataValues.emailUser
            const deleteUserId = await user_service.deleteEntry(deleteEntryId, restoreBalance, orgId)
            const mailAdmin = idOrgWhereEmployeeWorks?
                await user_service.getMailAdminOrg(idOrgWhereEmployeeWorks):
                await user_service.getMailAdminOrg(orgId)
            const mailEmployeeOrg = idOrgWhereEmployeeWorks?
                await user_service.getMailEmployeeOrg(orgId) : null;
//если пользователь сам отменил запись...отправим письмо админу, что отписался...
            if (userCancelHimselfRec == 1) {           // тут при отмене записи клиентом сообщаем админу об отмене
                //разблокировать когда все почты будут настоящими
                if (idOrgWhereEmployeeWorks) {
                    await mailService.clientCanceledRecording(mailAdmin, dataAboutDeleteRec.nameUser,
                        dataAboutDeleteRec.sectionOrOrganization, dataAboutDeleteRec.date, dataAboutDeleteRec.time)
                    await mailService.clientCanceledRecording(mailEmployeeOrg, dataAboutDeleteRec.nameUser,
                        dataAboutDeleteRec.sectionOrOrganization, dataAboutDeleteRec.date, dataAboutDeleteRec.time)
                } else {
                    await mailService.clientCanceledRecording(mailAdmin, dataAboutDeleteRec.nameUser,
                        dataAboutDeleteRec.sectionOrOrganization, dataAboutDeleteRec.date, dataAboutDeleteRec.time)
                }
//иначе если админ удалил клиента то письмо клиенту об отмене
            } else {
                //разблокировать когда все почты будут настоящими  // тут при отмене записи админом сообщаем пользователю об отмене
                await mailService.adminCanceledRecording(emailUser, dataAboutDeleteRec.nameUser,
                    dataAboutDeleteRec.sectionOrOrganization, dataAboutDeleteRec.date, dataAboutDeleteRec.time)
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
