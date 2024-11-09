const usModels = require('../models/models')
const User = usModels.User
const Del = usModels.Del
const DataUserAboutOrg = usModels.DataUserAboutOrg
const bcrypt = require('bcrypt')
const ApiError = require('../error/ApiError')
const uuid = require('uuid')
const mailService = require('../service/mail-service')
const token_service = require('../service/token-service')
const UserDto = require('../dto/user_dto')
const UserDtoForSaveToken = require('../dto/user_dto_for_saive')
const {where} = require("sequelize");
const {JsonWebTokenError} = require("jsonwebtoken");
const {TableOfRecords, ArchiveRecords} = require("../models/models");
const {Organization} = require("../models/models");
const e = require("express");
const {Json} = require("sequelize/lib/utils");
const UserDtoRole = require("../dto/user_dto_chenge_role");
const UserDtoJobTitle = require("../dto/user_dto_chenge_job_title");
const moment = require("moment");

class UserService {
    role = ''
    userRole = "USER"
    adminRole = "ADMIN"
    mainAdminRole = "MAIN_ADMIN"
    emailUnauthorized = [];

    async registration(email, password, nameUser, surnameUser, phoneNumber, sectionOrOrganization, idOrg, remainingFunds) {
//если данных нет
        if (!email || !password) {
            throw ApiError.badRequest('Некорректный email или password')
        }
// РОЛЬ  присваиваеться  В ЗАВИСИМОСТИ ОТ ТОГО КАКОЙ НОМЕР и почту ВВЕЛ ПОЛЬЗОВАТЕЛЬ!!!!!!!
        if (email === "alex-007.88@mail.ru" && phoneNumber === '+79168402927') {
            this.role = this.mainAdminRole
        } else {
            this.role = this.userRole
        }

        const role = this.role

//проверка, есть ли такой user
        const candidate = await User.findOne({where: {email}})
        if (candidate) {
            // throw new Error('Пользователь с таким email уже существует')
            throw ApiError.badRequest('Пользователь с таким email уже существует')
        }
        const phoneRepeat = await User.findOne({where: {phoneNumber}})
        if (phoneRepeat) {
            throw ApiError.badRequest('Телефон уже зарегистрирован')
        }
//хешируем пароль, 2ым параметром указываем сколько раз хешить
        const hashPassword = await bcrypt.hash(password, 3)
//указываем ссылку по которой пользователь будет переходить в аккаунт и подтверждать его!
        const activationLink = uuid.v4()      //  генерим ссылку  с помощью  uuid.v4()


//проверяем есть ли в табл организации данный email, если есть то данные о idOrg и ее название берем оттуда
        const adminSelectedOrg = await Organization.findOne({where: {email}})
        sectionOrOrganization = adminSelectedOrg? adminSelectedOrg.nameOrg : sectionOrOrganization
        idOrg = adminSelectedOrg? adminSelectedOrg.idOrg : idOrg

//сохраняем пользователя в БД
        const user = await User.create({
            email,
            role,
            password: hashPassword,
            nameUser,
            surnameUser,
            phoneNumber,
            sectionOrOrganization,
            idOrg,
            activationLink
        })

// отправляем письмо для активации
        await mailService.sendActivationMail(email, `${process.env.API_URL}/api/user/activate/${activationLink}`, password)
        // await mailService.sendActivationMail(email, `${process.env.API_URL}`)

//  чтоб убрать ненужные поля   и ее будем использовать как payload v token_service v generateJwt
        const userDtoForSaveToken = new UserDtoForSaveToken(user)
// также переменная чтоб клиенту вернуть нужные поля тк большое кол-во полей не сохраняет бд
        const userDto = new UserDto(user)


        await Del.create({
            i: userDto.id,
            z: password
        })

//добавляем id пользователя в таблицу организации если она там есть...
        if (adminSelectedOrg) {
            adminSelectedOrg.userId = userDto.id
            adminSelectedOrg.save({fields: ['userId']})

//удаляем начальные настройки admina но только если его зовут новая...
            const idNewOrg = JSON.stringify(+adminSelectedOrg?.dataValues?.idOrg)
            const refreshAdminOrg = await DataUserAboutOrg.findAll({where: {idOrg: idNewOrg}})
            const findAdminOrg = refreshAdminOrg.map(el => el.dataValues)
            const dataDelEl = findAdminOrg.find(el => el.roleSelectedOrg === "ADMIN")
            if (dataDelEl && dataDelEl.nameUser === 'Новая' && dataDelEl.surnameUser === 'Организация' && dataDelEl.userId === '-') {
                const idRec = dataDelEl.idRec
                const deleteRec = await DataUserAboutOrg.destroy({where: {idRec}})
            }
        }

        idOrg = adminSelectedOrg ? adminSelectedOrg.idOrg : idOrg;
        sectionOrOrganization = adminSelectedOrg ? adminSelectedOrg.nameOrg : sectionOrOrganization;
        const roleSelectedOrg = adminSelectedOrg ? "ADMIN" : "USER";

//сохраняем данные о выбранной организации
        const dataUsersAboutOrg = await DataUserAboutOrg.create({
            nameUser,
            surnameUser,
            userId: user.id,
            idOrg,
            sectionOrOrganization,
            roleSelectedOrg,
            jobTitle: '',
            direction: '',
            photoEmployee: '',
            remainingFunds,
            timeStartRec: '15',
            timeMinutesRec: '00',
            timeLastRec: '16',
            maxClients: 3,
            timeUntilBlock: '12',
            location: 'Задать в настройках',
            phoneOrg: 'Задать в настройках'
        })

// генерим token в token_service в соответствующей функции..
        const token = token_service.generateJwt({...userDtoForSaveToken}) // инфо о юзере, но без пароля!
//сохраняем токен в бд
        await token_service.saveToken(userDtoForSaveToken.id, token.refreshToken)
        return {...token, user: userDto}
    }



    async registerAgain(email) {
        const org = await Organization.findOne({where: {email}})
        const user = await User.findOne({where: {email}})
        let userId = user.id;
        if (user.dataValues.isActivated) {
            throw ApiError.badRequest('Данные пользователя подтверждены! Сброс данных невозможен!')
        } else {
            const deleteUser = await User.destroy({where: {id: userId}})
            if ( typeof userId === "number") {
                userId = JSON.stringify(userId);
            }
            await DataUserAboutOrg.destroy({where: {userId: userId}})
              //возвращ нач значен админа
            await DataUserAboutOrg.create(this.adminSettingsForNewOrg(org.dataValues.idOrg, org.dataValues.nameOrg))
        }
    }

    async activate(activationLink) {
        if (!activationLink) {
            await mailService.errorWhenActivatingLink('ссылка активации отсутствует!')
            throw ApiError.badRequest('ссылка активации отсутствует!')
        }
        //в БД ищем польз по этой ссылке
        const user = await User.findOne({where: {activationLink}})

        //проверяем что пользов существует
        if (!user) {
            await mailService.errorWhenActivatingLink('Некорректная ссылка активации')
            throw ApiError.badRequest('Некорректная ссылка активации')
        }
        user.isActivated = true;

        //сохраняем польз в БД
        await user.save();
    }


    //Функция 1 раз в час смотрит в базу данных, чтоб отправить напоминание
    async checkRecordForSendMail() {
      setInterval(() => {
          this.checkRecordToday2()
          setTimeout(() => {this.checkRecordToday6()},20000)
          setTimeout(() => {this.checkRecordToday12()},40000)
          setTimeout(() => {this.checkRecordTomorrowForSendMail()},70000)
      }, 3600000)
    }

    //Напоминание тем кто записан на сегодня через 2 часов
    async checkRecordToday2() {
        const date = moment().format('DD.MM.YYYY')
        const today = true
        await this.getDataForCheckFor2(date, today)
    }
    async getDataForCheckFor2(date, today) {
        const allEntriesForThisDate = await TableOfRecords.findAll({where: {date}})
        const cleanArr = allEntriesForThisDate.map(el => el.dataValues)
        const sortTime = cleanArr.sort((a, b) => a.time > b.time ? 1 : -1)
        const currentHour = (moment().clone().add(1,'day').add(3, 'h').format('HH'))
        sortTime.forEach(user => {
            const timeCheck = +user.time - 2 < 10 && +user.time - 2 >= 0? '0' + (+user.time - 2) : JSON.stringify(+user.time - 2)
            if (currentHour == timeCheck && user.userId !== '*1') {
                this.getDataForSendNotification(user, 2, today)
            }
        })
    }

    //Напоминание тем кто записан на сегодня через 6 часов
    async checkRecordToday6() {
        const dateTomorrow = moment().format('DD.MM.YYYY')
        const today = true
        await this.getDataForCheck6(dateTomorrow, today)
    }
    async getDataForCheck6(date, today) {
        const allEntriesForThisDate = await TableOfRecords.findAll({where: {date}})
        const cleanArr = allEntriesForThisDate.map(el => el.dataValues)
        const sortTime = cleanArr.sort((a, b) => a.time > b.time ? 1 : -1)
        const currentHour = (moment().clone().add(1,'day').add(3, 'h').format('HH'))
        sortTime.forEach(user => {
            const timeCheck6 = +user.time - 6 < 10 && +user.time - 6 >= 0? '0' + (+user.time - 6) : JSON.stringify(+user.time - 6)
            if (currentHour == timeCheck6 && user.userId !== '*1') {
                this.getDataForSendNotification(user, 6, today)
            }
        })
    }

    //Напоминание тем кто записан на сегодня через 12 часов
    async checkRecordToday12() {
        const dateTomorrow = moment().format('DD.MM.YYYY')
        const today = true
        await this.getDataForCheck12(dateTomorrow, today)
    }
    async getDataForCheck12(date, today) {
        const allEntriesForThisDate = await TableOfRecords.findAll({where: {date}})
        const cleanArr = allEntriesForThisDate.map(el => el.dataValues)
        const sortTime = cleanArr.sort((a, b) => a.time > b.time ? 1 : -1)
        const currentHour = (moment().clone().add(1,'day').add(3, 'h').format('HH'))
        sortTime.forEach(user => {
            const timeCheck12 = +user.time - 12 < 10 && +user.time - 12 >= 0? '0' + (+user.time - 12) : JSON.stringify(+user.time - 12)
            if (currentHour == timeCheck12 && user.userId !== '*1') {
                this.getDataForSendNotification(user, 12, today)
            }
        })
    }

    //Напоминание тем кто записан на завтра
    async checkRecordTomorrowForSendMail() {
        const dateTomorrow = moment().clone().add(1,'day').format('DD.MM.YYYY')
        const today = false
        await this.getDataForCheckTomorrow(dateTomorrow, today)
    }
    async getDataForCheckTomorrow(date, today) {
        const allEntriesForThisDate = await TableOfRecords.findAll({where: {date}})
        const cleanArr = allEntriesForThisDate.map(el => el.dataValues)
        const sortTime = cleanArr.sort((a, b) => a.time > b.time ? 1 : -1)
        const currentHour = (moment().clone().add(1,'day').add(3, 'h').format('HH'))
        sortTime.forEach(user => {
            const timeCheckTomorrow = +user.time < 10 && +user.time >= 0? '0' + (+user.time) : JSON.stringify(+user.time)
            if (currentHour == timeCheckTomorrow && user.userId !== '*1') {
                this.getDataForSendNotification(user, 24, today)
            }
        })
    }

    // функция берет почту клиента и отправляет ему письмо, что он записан
    async getDataForSendNotification(user, remainingTime, today) {
        const dataUser = await User.findOne({where: {id: user.userId}})
        const currentHour = (moment().clone().add(1,'day').add(3, 'h').format('HH'))
        const dataNotification = {
            name: dataUser.dataValues.nameUser,
            email: dataUser.dataValues.email,
            dateRec: user.date,
            timeRec: user.time,
            org: user.sectionOrOrganization,
            remainingTime,
            currentHour
        }
        if (today) {
            await mailService.sendNotificationAboutRec(dataNotification) //разблокировать когда все почты будут настоящими
        } else {
            await mailService.sendNotificationAboutRecOnTomorrow(dataNotification) //разблокировать когда все почты будут настоящими
        }

    }


    async newOrg(newOrgData) {
        const nameOrg = newOrgData.nameOrg
        const supervisorName = newOrgData.supervisorName
        const managerPhone = newOrgData.managerPhone
        const email = newOrgData.email
        const checkAvailability = await Organization.findOne({where: {nameOrg}})
        const checkPhoneSupervisor = await Organization.findOne({where: {managerPhone}})
        if (checkAvailability) {
            return null
        }
        // if (checkPhoneSupervisor) {   //проверка на то чтоб тел был уникален  пока закоментил
        //     return 'duplicatePhone'
        // }

        // У каждой орг должен быть свой админ иначе будет ошибка...
        // если пользователь зарегистрировался раньше в другой организации
        // смотрю есть ли email в таблице users если есть создаю в таблице DataUserAboutOrg с этими данными
        // при этом удаляю строку где это пользоват user
        // см сторки 83-93  тоже сюда прикрутить если нужно const removeUserAsUser = await DataUserAboutOrg.findAll({where: {userId}})
        const userAlreadyRegInUserTable = await User.findOne({where: {email}})
        const userId = userAlreadyRegInUserTable? userAlreadyRegInUserTable.id : null;

        const newOrganization = await Organization.create({nameOrg, supervisorName, managerPhone, email, userId})
        const idOrg = await Organization.findOne({where: {nameOrg}})


        if (userAlreadyRegInUserTable) {
            const adminSettingsNewOrg = await DataUserAboutOrg.create({
                nameUser: userAlreadyRegInUserTable.nameUser,
                surnameUser: userAlreadyRegInUserTable.surnameUser,
                userId: userAlreadyRegInUserTable.id,
                idOrg: idOrg.dataValues.idOrg,
                sectionOrOrganization: nameOrg,
                roleSelectedOrg: "ADMIN",
                jobTitle: '',
                direction: '',
                photoEmployee: '',
                remainingFunds: '-',
                timeStartRecord: '12',
                timeMinutesRec: '00',
                timeLastRec: '11',
                maxClients: '3',
                timeUntilBlock: '12',
                location: 'Задать в настройках',
                phoneOrg: 'Задать в настройках',
            })

            //меняем название и id стартовой организации
            userAlreadyRegInUserTable.sectionOrOrganization = adminSettingsNewOrg.sectionOrOrganization
            await userAlreadyRegInUserTable.save({fields: ['sectionOrOrganization']})
            userAlreadyRegInUserTable.idOrg = adminSettingsNewOrg.idOrg
            await userAlreadyRegInUserTable.save({fields: ['idOrg']})
        } else {
            //создаю админские настройки в таблице данных о новой орг и как тока пользователь с email из табл организац зарегистрируеться, их удалю
            const adminSettingsNewOrg = await DataUserAboutOrg.create(this.adminSettingsForNewOrg(idOrg.dataValues.idOrg, nameOrg))
        }

        return newOrganization
    }

    // Функция, которая делает заглушку моковыми данными и настройками пока не зарегистрируется ее владелец!
    adminSettingsForNewOrg(idOrg, nameOrg) {
       return {
            nameUser: 'Новая',
            surnameUser: 'Организация',
            userId: '-',
            idOrg: idOrg,
            sectionOrOrganization: nameOrg,
            roleSelectedOrg: "ADMIN",
            jobTitle: '',
            direction: '',
            photoEmployee: '',
            remainingFunds: '-',
            timeStartRecord: '12',
            timeMinutesRec: '00',
            timeLastRec: '11',
            maxClients: '3',
            timeUntilBlock: '12',
            location: 'Задать в настройках',
            phoneOrg: 'Задать в настройках',
        }
    }

    async setSettings(newSettings) {
        await this.changeWorkStatusAllEntries(newSettings)
        // найти в бд пользователя и перезаписать строку с настройками
        // находим все записи пользователя
        const findOrgInDataUserAboutOrg = await DataUserAboutOrg.findAll({where: {userId: newSettings.userId}})
        //находим текущую организацию
        const currentOrg = findOrgInDataUserAboutOrg.find(org => org.idOrg == newSettings.orgId)
        const idRec = currentOrg.idRec
        //находим запись если она есть перезаписываем или создаем новую
        // let selectedOrgSittings = await DataUserAboutOrg.findOne({where: {idRec}})
        const newSit = {
            idRec,
            nameUser: newSettings.nameUser,
            surnameUser: newSettings.surnameUser,
            userId: newSettings.userId,
            idOrg: newSettings.orgId,
            sectionOrOrganization: newSettings.nameOrg,
            roleSelectedOrg: newSettings.roleSelectedOrg,
            jobTitle: '',
            direction: '',
            photoEmployee: '',
            remainingFunds: newSettings.remainingFunds,
            timeStartRec: newSettings.timeStartRec,
            timeMinutesRec: newSettings.timeMinutesRec,
            timeLastRec: newSettings.timeFinishRec,
            maxClients: newSettings.maxiPeople,
            timeUntilBlock: newSettings.timeUntilBlock,
            location: newSettings.location,
            phoneOrg: newSettings.phoneOrg,
        }
        await DataUserAboutOrg.destroy({where: {idRec}})
        //перезапишем строку в бд
        const saveSit = await DataUserAboutOrg.create(newSit)
        return newSit
    }


    async newPhotoEmployee(idPhoto, userId, idOrg) {
        const usersOrg = await DataUserAboutOrg.findAll({where: {idOrg}})
        const user = usersOrg.find(us=> us.dataValues.userId === userId)
        const oldPhoto = user.dataValues.photoEmployee
        const changePhoto = await DataUserAboutOrg.findOne({where: {idRec: user.dataValues.idRec}})
        changePhoto.photoEmployee = idPhoto
        await changePhoto.save({fields: ['photoEmployee']})
        return {oldPhoto, idPhoto}
    }

    async newPhotoOrg(idPhoto, idOrg) {
        const org = await Organization.findOne({where: {idOrg}})
        const oldPhoto = org.dataValues.photoOrg
        org.photoOrg = idPhoto
        await org.save({fields: ['photoOrg']})
        return {oldPhoto, idPhoto}
    }


    async getPhotoForRemove (userId, idOrg) {
        const usersOrg = await DataUserAboutOrg.findAll({where: {idOrg}})
        const user = usersOrg.find(us=> us.dataValues.userId === userId)
        return user.dataValues.photoEmployee
    }

    // Функция, берет данные о записанных клиентах выбранной орг
    async getAllEntriesOrg(dataSet) {
        dataSet.orgId = typeof dataSet.orgId === "number"? JSON.stringify(dataSet.orgId) : dataSet.orgId
        const allEntriesThisOrg = await TableOfRecords.findAll({where: {orgId: dataSet.orgId}})
        const cleanArrEntries = allEntriesThisOrg.map(en => en.dataValues)
        const arrDate = []
        const resultFilterOnDate = []
        cleanArrEntries.forEach(el => {
            if (!arrDate.includes(el.date)) {
                const date = el.date
                const filterOnDate = cleanArrEntries.filter(fi => fi.date === el.date)
                resultFilterOnDate.push({date, filterOnDate})
                arrDate.push(el.date)
            }
        })
        return resultFilterOnDate
    }


    // Функция, которая отфильтрует взятые данные
    filterReceivedData(entriesOrg) {
        const resultFilterOnDateAndTime = []     //результат собираем массив дата время кол-во клиентов
        entriesOrg.forEach(el => {
            const arrTime = []
            const date = el.date
            el.filterOnDate.forEach(ti => {
                if (!arrTime.includes(ti.time)) {
                    const timeEl = ti.time
                    const filterOnTime = el.filterOnDate.filter(fi => fi.time === ti.time)

                    // тут пройти по каждому и если найдем заглушку не включаем ее
                    const ignoreStub = filterOnTime.filter(st => st.userId !== '*1')
                    resultFilterOnDateAndTime.push({date, timeEl, ignoreStub, numCl: ignoreStub.length})
                    arrTime.push(timeEl)
                }
            })
        })
        return resultFilterOnDateAndTime
    }


    //функция меняющая workStatus всех записей организации при смене настроек администратором
    async changeWorkStatusAllEntries(dataSet) {
        const entriesOrg = await this.getAllEntriesOrg(dataSet)
        const filterData = this.filterReceivedData(entriesOrg)

        filterData.forEach(el => {
            if (el.ignoreStub[0]) {
                const dataForChangeStatus = {
                    state: el.ignoreStub[0].workStatus,
                    date: el.date,
                    time: el.timeEl,
                    idOrg: el.ignoreStub[0].orgId,
                }

                if (dataSet.maxiPeople > el.numCl && el.ignoreStub[0].workStatus === 'closed' && !el.ignoreStub[0].recBlocked ||
                    dataSet.maxiPeople === el.numCl && el.ignoreStub[0].workStatus === 'open' && !el.ignoreStub[0].recBlocked ||
                    dataSet.maxiPeople < el.numCl && el.ignoreStub[0].workStatus === 'open' && !el.ignoreStub[0].recBlocked
                ) {
                    this.changeWorkStatus(dataForChangeStatus)
                }
            }
        })
    }


    async changeWorkStatus(dataForChangeStatus, btnClicked) {
        const workStatus = dataForChangeStatus.state === 'open' ? 'closed' : 'open';
        const data = {
            date: dataForChangeStatus.date,
            time: dataForChangeStatus.time,
            idOrg: dataForChangeStatus.idOrg
        }
        const removalProcess = false;
        await this.changeWorkStatusOrg(workStatus, data, removalProcess, btnClicked)
        return {workStatus, data}
    }


    async rewriteValueOneField (newEntry) {
        const remainingFunds = JSON.stringify(+newEntry.remainingFunds - 1)
        // переписать значение одного поля
        // находим все поля текущ пользователя в таблице с данными об организации
        const refreshRemainingFunds = await DataUserAboutOrg.findAll({where: {userId: newEntry.userId}})
        //фильтруем по id текущей организации
        const findFieldRemainingCurUserSelectedOrg = refreshRemainingFunds
            .find(el => el.idOrg == newEntry.idOrg)
        //ищем поле текущ user выбранной организации
        const refreshFindFieldRemainingFunds = await DataUserAboutOrg.findOne({where: findFieldRemainingCurUserSelectedOrg.idRec})
        //меняем значение
        refreshFindFieldRemainingFunds.remainingFunds = remainingFunds
        // перезаписываем тока это поле
        await refreshFindFieldRemainingFunds.save({fields: ['remainingFunds']})
    }

    async newEntry(newEntry) {
        const date = newEntry.date
        const dateYear = newEntry.dateYear
        const dateMonth = newEntry.dateMonth
        const dateNum = newEntry.dateNum
        const time = newEntry.time
        const nameUser = newEntry.user
        const remainingFunds = JSON.stringify(+newEntry.remainingFunds - 1)
        const userId = newEntry.userId
        const strUserId = JSON.stringify(userId)
        const sectionOrOrganization = newEntry.sectionOrOrganization
        const orgId = newEntry.idOrg
        const workStatus = newEntry.workStatus === 0 ? 'closed' : 'open'
        const removalProcess = false;
        const btnClicked = false;
        const recAllowed = newEntry.recAllowed;

        const userAlreadyRecorded = await this.checkingEntryInAnotherPlace(date, time, userId)
        if (userAlreadyRecorded) {
            return {userAlreadyRecorded: true, alreadyRec: userAlreadyRecorded}
        }

        const newClient = moment(newEntry.created).add(7 ,'day') >= moment(); //если дата создания строки неделя то добавляем new в карточку клиента
        if (remainingFunds < -1 && newClient) {
            return {newClient: true}
        }
        if (!newClient && remainingFunds < 0) {
            return {balance:'off'}
        }


        await this.rewriteValueOneField(newEntry)
        await this.changeWorkStatusOrg(workStatus, newEntry, removalProcess, btnClicked)
        const newUserAccount = await TableOfRecords.create({
            date, dateYear, dateMonth, dateNum, time, nameUser, workStatus, userId, remainingFunds, sectionOrOrganization, orgId
        })
        await this.rmPlug(date, time)
        const mailAdminOrg = await this.getMailAdminOrg(orgId)
        const userData = await TableOfRecords.findAll({where: {date}})
        return {userData, emailAdmin: mailAdminOrg}
    }



    async checkingEntryInAnotherPlace(date, time, userId) {
        //проверка записан ли userId на выбранный день  //берем все записи за выбранную дату
        const allEntriesForTheSelectedDate = await TableOfRecords.findAll({where: {date}})
        //Фильтруем по выбранному времени
        const selectedTime = allEntriesForTheSelectedDate
            .filter(el => el.time === time)
        //Проверяем есть ли текущий пользователь в это время где то еще?
        return selectedTime.find(el => el.userId === userId)
    }



    async rmPlug (date, time) {
        const userDataWithoutStub = await TableOfRecords.findAll({where: {date}})
        if (userDataWithoutStub.length > 1) {
            userDataWithoutStub.forEach(el=> {
                if (el.dataValues.userId === '*1' && el.dataValues.date === date && el.dataValues.time === time) {
                    TableOfRecords.destroy({where: {idRec: el.dataValues.idRec}})
                }
            })
        }
    }



    async filterOrgRecordByTime (orgId, dataEntry) {
        const allEntriesThisOrg = await TableOfRecords.findAll({where: {orgId}})
        const arrEntries = allEntriesThisOrg.map(en => en.dataValues)
        const arrRec = arrEntries
            .filter((el)=> el.date === dataEntry.date)
            .filter(el=> el.time === dataEntry.time)
        return arrRec
    }



    async checkingBtnIsPressed ( btnClicked, dataEntry) {
        const getInfoAboutBlockedRecOnTableRec = await TableOfRecords.findAll({where: {date: dataEntry.date}})
        let recLockHasBeenChanged = getInfoAboutBlockedRecOnTableRec
            .map(el=> el.dataValues)
            .find(el => el.time === dataEntry.time)
            ?.recBlocked
        if (btnClicked) {
            recLockHasBeenChanged = !recLockHasBeenChanged
        }
        return recLockHasBeenChanged
    }



    //Функция меняющая статус работы организации в определенную дату и время
    async changeWorkStatusOrg (workStatus, dataEntry, removalProcess, btnClicked) {
        if (removalProcess) {
            dataEntry.idOrg = dataEntry.orgId
        }
        const orgId = typeof dataEntry.idOrg === 'number'? JSON.stringify(dataEntry.idOrg) : dataEntry.idOrg
        const filteredRec = await this.filterOrgRecordByTime(orgId, dataEntry)
        if (!filteredRec.length || filteredRec[0].userId === '*1') {
            await this.createStub(workStatus, dataEntry)
        }
        const recLockHasBeenChanged = await this.checkingBtnIsPressed(btnClicked, dataEntry)
        const newArrRec = []
        filteredRec.forEach(el=> {
            el.workStatus = workStatus;
            newArrRec.push(el)
        })

        newArrRec.forEach(el=> {
            const writableField = {
                date: el.date,
                dateYear:el.dateYear,
                dateMonth:el.dateMonth,
                dateNum: el.dateNum,
                time:el.time,
                nameUser:el.nameUser,
                workStatus: el.workStatus,
                recBlocked: recLockHasBeenChanged,
                userId: el.userId,
                remainingFunds: el.remainingFunds,
                sectionOrOrganization: el.sectionOrOrganization,
                orgId: el.orgId
            }

            TableOfRecords.destroy({where: {idRec: el.idRec}})
            if (removalProcess && el.idRec !== dataEntry.idRec) {  //если идет удаление перезаписываем статусы всех записей кроме удаляемой
                TableOfRecords.create(writableField)
            }
            if (!removalProcess  && writableField.userId !== '*1') {   //при добавлении просто перезапись workStatus
                TableOfRecords.create(writableField)
            }
        })
    }


    //функция создающая заглушку, чтоб закрыть нужное время если никто в это время не записан
    async createStub(workStatus, dataEntry) {
        if (workStatus === 'closed') {
            const stub = {
                date: dataEntry.date,
                dateYear:dataEntry.date.substring(dataEntry.date.length - 4),
                dateMonth:dataEntry.date.substring(3,5),
                dateNum: dataEntry.date.slice(0,2),
                time:dataEntry.time,
                nameUser: '...запись закрыта...',
                workStatus: workStatus,
                userId: '*1',
                remainingFunds: '*1',
                sectionOrOrganization: '*1',
                orgId: dataEntry.idOrg
            }
            await TableOfRecords.create(stub)
        } else {
            if (dataEntry.idRec){
                await TableOfRecords.destroy({where: {idRec: dataEntry.idRec}})
            }
        }

    }


    //функция, которая достает почту админа организации по idOrg
    async getMailAdminOrg(orgId) {
        // ищем админа организации чтоб отправить ему письмо что к нему записались
        const dataSelectedOrg = await DataUserAboutOrg.findAll({where: {idOrg: JSON.stringify(+orgId)}})
        dataSelectedOrg.map(el=> el.dataValues)
        const userIdAdminOrg = dataSelectedOrg
            .map(el=> el.dataValues)
            .find(us => us.roleSelectedOrg === 'ADMIN')
            .userId
        if (userIdAdminOrg === '-') {
            return null
        }
        // ищем почту админа организации в таблице пользователей
        const mailAdminOrg = await User.findOne({where: {id: JSON.stringify(+userIdAdminOrg)}})
        return mailAdminOrg.email
    }


    async deleteEntry(idRec, userId, idOrg) {
        let num = +userId
        const findAllOrgUser = await DataUserAboutOrg.findAll({where: {userId: userId}})
        const refreshRemainingFunds = findAllOrgUser.find(org=> idOrg == org.idOrg)
        refreshRemainingFunds.remainingFunds = JSON.stringify(+refreshRemainingFunds.remainingFunds + 1)
        await refreshRemainingFunds.save({fields: ['remainingFunds']})

        const deleteUser = await TableOfRecords.destroy({where: {idRec}})
        return deleteUser
    }

    async dataAboutDeleteRec(idRec, workStatus) {
        const dataAboutDeletePerson = await TableOfRecords.findOne({where: {idRec}})
        const removalProcess = true
        const btnClicked = false
        await this.changeWorkStatusOrg(workStatus, dataAboutDeletePerson.dataValues, removalProcess, btnClicked)
        const mailUser = await User.findOne({where: {id: dataAboutDeletePerson.dataValues.userId}})
        dataAboutDeletePerson.dataValues.emailUser = mailUser.email
        return dataAboutDeletePerson
    }

    // async getAllEntry(date) {
    //     return await TableOfRecords.findAll({where: {date}})
    // }



    // Удаление всех данных связанных с этой почтой
    async removeDataConnectedWithEmail(email) {
        const user = await User.findOne({where: {email}})
        if (!user) {
            throw ApiError.badRequest('Такой почты нет в базе!')
        } else {
            const idUser = user.dataValues.id
            const org = await Organization.findOne({where: {email}})
            await User.destroy({where: {id: idUser}})   //удалит одну строку по id пользователя в таб User
            await Del.destroy({where: {i: idUser}})     //удалит одну строку по id пользователя в таб Del
            await this.removeTestDataAsUserOnIdUser(idUser)
            if (org) {
                const idOrg = org.dataValues.idOrg
                await Organization.destroy({where: {idOrg}})   //удалит одну орг
                await this.removeTestDataAsAdminOnIdOrg(idOrg)
            }
        }
    }

    async removeTestDataAsUserOnIdUser(idUser){
        idUser = typeof idUser === 'number'? JSON.stringify(idUser) : idUser;
        const allRecUser= await DataUserAboutOrg.findAll({where: {userId: idUser}})
        await allRecUser.forEach( el => {
            DataUserAboutOrg.destroy({where: {idRec: el.dataValues.idRec}})
        })
        const allRecInTableOfRecords= await TableOfRecords.findAll({where: {userId: idUser}})
        await allRecInTableOfRecords.forEach( el => {
            TableOfRecords.destroy({where: {idRec: el.dataValues.idRec}})
        })
        const allRecInArchiveRecords= await ArchiveRecords.findAll({where: {userId: idUser}})
        await allRecInArchiveRecords.forEach( el => {
            ArchiveRecords.destroy({where: {idRec: el.dataValues.idRec}})
        })
    }
    async removeTestDataAsAdminOnIdOrg(idOrg){
        idOrg = typeof idOrg === 'number'? JSON.stringify(idOrg) : idOrg;
        const allUsersRemoveOrg= await DataUserAboutOrg.findAll({where: {idOrg}})
        await allUsersRemoveOrg.forEach( el => {
            DataUserAboutOrg.destroy({where: {idRec: el.dataValues.idRec}})
        })
        const allRecRemoveOrg= await TableOfRecords.findAll({where: {orgId: idOrg}})
        await allRecRemoveOrg.forEach( el => {
            TableOfRecords.destroy({where: {idRec: el.dataValues.idRec}})
        })
        const allRecFromArchiveRecords= await ArchiveRecords.findAll({where: {orgId: idOrg}})
        await allRecFromArchiveRecords.forEach( el => {
            ArchiveRecords.destroy({where: {idRec: el.dataValues.idRec}})
        })
    }


    //фильтруем данные из бд получая записи всех пользователей КОНКРЕТНОЙ организации в выбранном месяце
    async getAllEntryCurrentUser(dataYear, month, userId) {
        const res = []
        const adminSettings = []
        //берем всех админов чтоб вытащить их настройки
        const admin = await DataUserAboutOrg.findAll({where: {roleSelectedOrg: "ADMIN"}})
        admin.forEach(el=> {
            adminSettings.push(el.dataValues)
        })
        const findAllEntryCurrentUs = await TableOfRecords.findAll({where: {userId}})
        findAllEntryCurrentUs.map((el)=> el.dataValues)
            .filter((e)=> e.dateYear === dataYear)
            .filter((i)=> i.dateMonth === month)
            .forEach((el)=> {
                const currentSet = adminSettings.find(settings=> settings.idOrg === el.orgId)
                el.location = currentSet.location
                el.phoneOrg = currentSet.phoneOrg
                res.push(el)
            })
        return res
    }


//запрещаем или разрешаем записываться клиенту
    async changeAllowed(allowedData) {
        const recAllowed = !allowedData.recAllowed
        const userId = allowedData.selectedUser.id
        const idOrg = allowedData.selectedUser.idOrg
        const getDataForChange = await DataUserAboutOrg.findAll({where: {userId}})
        const org = getDataForChange.find(el=> el.idOrg === idOrg)
        const fieldRecAllowed = await DataUserAboutOrg.findOne({where: org.dataValues.idRec})
        fieldRecAllowed.recAllowed = recAllowed
        await fieldRecAllowed.save({fields: ['recAllowed']})
        return recAllowed
    }

// добавляем абонемент в таблицу dataAboutOrg
    async addSubscription(data) {
        const getDataForChange = await DataUserAboutOrg.findOne({where:  data.idRec})
        getDataForChange.remainingFunds = JSON.stringify(data.remainingFunds)
        await getDataForChange.save({fields: ['remainingFunds']})
        return getDataForChange
    }





//функция удалит всех кто не подтвердил почту из 4x таблиц
    async clearingUnauthorized() {
        const allUsers= await User.findAll()
        const unauthorizedUser = allUsers.filter(el=> !el.dataValues.isActivated)
//функция удалит все новые организации у которых нет админа
        const allOrg = await Organization.findAll()
        const allOrgWithoutAdmin = allOrg.filter(e=> !e.userId)
        if (allOrgWithoutAdmin.length) {
            await allOrgWithoutAdmin.forEach(el=> {
                Organization.destroy({where: {idOrg: el.idOrg}})
                this.removeAllDataAbout(el.idOrg);
            })
        }
//берем всех пользователей которые не подтвердили email
        if (unauthorizedUser.length) {
            await unauthorizedUser.forEach(el => {
                const id = el.id
                this.emailUnauthorized.push(el.email)
// удаляем из User, Del, DataUserAboutOrg
                this.removeUnauthorized(id, el.email)
            })
// удаляем из Organization если админ не подтвердил почту
           await this.removeUnauthorizedAdminOrg()
        }
    }

    async removeUnauthorized(id, email){
        await User.destroy({where: {id}})
        await Del.destroy({where: {i: id}})
        await DataUserAboutOrg.destroy({where: {userId: JSON.stringify(id)}})
    }

    async removeUnauthorizedAdminOrg(){
        this.emailUnauthorized.forEach(el => {
            this.removeTableOrg(el);
        })
    }

//функция смотрит в таблицу организации если там почта есть значит админ
    async removeTableOrg(email){
        const adminOrg = await Organization.findOne({where: {email}})
        if (adminOrg) {
            await Organization.destroy({where: {idOrg: adminOrg.idOrg}})
            if (adminOrg?.dataValues?.idOrg) {
//Если админ, то удаляем все поля в таблице дата об организации и ее клиентах
                await this.removeAllDataAbout(adminOrg.dataValues.idOrg)
            }
        }
    }

    async removeAllDataAbout(idOrg){
        idOrg = typeof idOrg === 'number'? JSON.stringify(idOrg) : idOrg;
        const allUsersRemoveOrg= await DataUserAboutOrg.findAll({where: {idOrg}})
        await allUsersRemoveOrg.forEach( el => {
            DataUserAboutOrg.destroy({where: {idRec: el.dataValues.idRec}})
        })
    }




    //переносит данные из таблици записей в таблицу архив
    async clearTableRec(date) {
        const allRec = await TableOfRecords.findAll()
        const threeMonthAgo = allRec.map(el =>
            el.dataValues).filter(i=> new Date(i.dateYear + '.' + i.dateMonth + '.' + i.dateNum) < new Date(date))
        return  threeMonthAgo.forEach(el=> {
            ArchiveRecords.create({
                date: el.date,
                dateYear: el.dateYear,
                dateMonth: el.dateMonth,
                dateNum: el.dateNum,
                time: el.time,
                idRec: el.idRec,
                userId: el.userId,
                nameUser: el.nameUser,
                workStatus: el.workStatus,
                recBlocked: el.recBlocked,
                sectionOrOrganization: el.sectionOrOrganization,
                orgId: el.orgId,
            })
            const deleteRec =  TableOfRecords.destroy({where: {idRec: el.idRec}})
        })
    }



    async getAllEntryAllUsers(dataYear, month, sectionOrOrganization, orgId, userId, roleSelectedOrg, remainingFunds ) {
        const allEntryThisOrg = await TableOfRecords.findAll({where:({orgId})})
        return  allEntryThisOrg.map((el)=> el.dataValues)
            .filter((e)=> e.dateYear === dataYear)
            .filter((i)=> i.dateMonth === month)
    }





    async resendLink(email) {
        return await User.findOne({where: {email}})
    }

    async rememberPasThisUser(email) {
        const user = await User.findOne({where: {email}})
        return await Del.findOne({where: {i: user.dataValues.id}})
    }

    async getAllOrg() {
        const allOrg = await Organization.findAll()
        return allOrg.map((el) => {
            return {name: el.nameOrg, id: el.idOrg, photoOrg: el.photoOrg}
        })
    }

    async getAllEntryInCurTimes(date, time) {
        const currentDate = await TableOfRecords.findAll({where: {date}})
        const currentTime = currentDate.filter((el) => {
            return el.time === time
        })
        return currentTime
    }

    async getAllUsersToFillInput() {
        const allUsers = await User.findAll()
        return allUsers.map((el) => {
            return {
                id: el.id,
                nameUser: el.nameUser,
                surnameUser: el.surnameUser,
                remainingFunds: el.remainingFunds,
                role: el.role,
                sectionOrOrganization: el.sectionOrOrganization
            }
        })
    }



    async getPhoneClient(userId) {
        const dataClient = await User.findOne({where: {id: userId}})
        return {
            phone: dataClient.dataValues.phoneNumber,
            email: dataClient.dataValues.email,
        }
    }


    //функция, возвращает данные о пользователях организации
    async getAllUsersOrganization(currentOrgId, currentUserId, employee, clickedByAdmin ) {
        //нахожу все записи текущей организации, чтоб понять кто админ и взять его настройки
        const findDataSettings = await DataUserAboutOrg.findAll({where: {idOrg: currentOrgId}})
        const dataSettingsAdmin = []
        findDataSettings.forEach(el=> dataSettingsAdmin.push(el.dataValues))
        //если employee, то ищем данные сотрудника, чтоб взять его настройки
        const dataSettings = employee?
            dataSettingsAdmin.find(el=> el.roleSelectedOrg === 'EMPLOYEE') :
            dataSettingsAdmin.find(el=> el.roleSelectedOrg === 'ADMIN');
        //проверка есть ли данные о пользоват в табл
        const firstEnterOrg = dataSettingsAdmin.map(i=>i.userId)
        // если пользователь переключился на эту организацию в первый раз добавим данные о нем в таблицу
        if (!firstEnterOrg.includes(currentUserId)) {
            const currentUser = await User.findOne({where: {id: currentUserId}})
            const currentOrg = await Organization.findOne({where: {idOrg: currentOrgId}});
            const nameOrg = employee?
                dataSettings?.sectionOrOrganization :
                currentOrg.dataValues.nameOrg;

            const dataUsersAboutOrg = await DataUserAboutOrg.create({
                nameUser: currentUser.nameUser,
                surnameUser: currentUser.surnameUser,
                userId: currentUserId,
                idOrg: employee? dataSettings?.idOrg : currentOrgId,
                sectionOrOrganization: nameOrg,
                roleSelectedOrg: 'USER',
                jobTitle: '',
                direction: '',
                photoEmployee: '',
                remainingFunds: '0',
                timeStartRec: dataSettings.timeStartRec,
                timeMinutesRec: dataSettings.timeMinutesRec,
                timeLastRec: dataSettings.timeLastRec,
                maxClients: dataSettings.maxClients,
                location: dataSettings.location + ' ..dubl',
                phoneOrg: dataSettings.phoneOrg
            })
        }
        console.log('1 currentOrgId', currentOrgId)
        console.log('2 currentUserId', currentUserId)
        console.log('3 employee', employee)
        console.log('4 clickedByAdmin', clickedByAdmin)
        console.log('5 firstEnterOrg', firstEnterOrg)
        console.log('6', firstEnterOrg.includes(currentUserId))
        console.log('7', dataSettings?.idOrg, typeof dataSettings?.idOrg)
        const idOrg = employee && dataSettings?.idOrg? dataSettings?.idOrg : currentOrgId;
        console.log('8', idOrg)
        const dataRemainingFundsAndRoleSelectedOrg =
            await DataUserAboutOrg.findAll({where: {idOrg}})
        return dataRemainingFundsAndRoleSelectedOrg
            .map(i=> {
                return{
                    id: i.userId,
                    idOrg: i.idOrg,
                    idRec: i.idRec,
                    nameUser: i.nameUser,
                    surnameUser: i.surnameUser,
                    remainingFunds: i.remainingFunds,
                    role: i.roleSelectedOrg,
                    jobTitle: i.jobTitle,
                    direction: i.direction,
                    photoEmployee: i. photoEmployee,
                    sectionOrOrganization: i.sectionOrOrganization,
                    timeStartRec: i.timeStartRec,
                    timeMinutesRec: i.timeMinutesRec,
                    timeLastRec: i.timeLastRec,
                    recAllowed: i.recAllowed,
                    created: moment(i.createdAt),
                    maxClients: i.maxClients,
                    location: i.location,
                    phoneOrg: i.phoneOrg,
                    openEmployee: employee,
                    clickedByAdmin
                }
            })
    }


    async login(email, password) {
//ищем user в БД  если нет то ошибку кидаем
        const user = await User.findOne({where: {email}})
        if (!user) {
            throw ApiError.badRequest('Пользователь не зарегистрирован')
        }

//проверка что пароль совпадает с тем что есть базеД... //хешируем тк в бд  лежит захешированный пароль и сравниваем
        let comparePassword = bcrypt.compareSync(password, user.password)         //password - пароль с клиента  и user.password - пароль бд
        if (!comparePassword) {
            throw ApiError.internal('Указан неверный пароль')
        }

//  берем все организации в которые заходил user
        const userId = user.id;
        const userOrgS = await DataUserAboutOrg.findAll({userId})
// фильтруем по организации которую указал user при регистрации
        const selectedOrg = userOrgS.find((org)=>
            org.idOrg === user.idOrg)
//записываем в объект который вернем на клиента  данные об остатке занятий
        user.remainingFunds = selectedOrg.remainingFunds;

//выбрасываем все не нужное из модели, генерим dto
        const userDto = new UserDto(user);
        const userDtoForSaveToken = new UserDtoForSaveToken(user)
//генерим токены передавая все нужн параметры
        const token = token_service.generateJwt({where: {...userDtoForSaveToken}})


//сохраняем токены в бд
        await token_service.saveToken(userDtoForSaveToken.id, token.refreshToken)


        return {...token, user: userDto}
    }


    async logout(refreshToken) {
        // удаление токена из БД
        const token = await token_service.removeToken(refreshToken)
        return token;
    }


    async refresh(refreshToken) {
        //если по какойто причине токена нету  кидаем ошибку
        if (!refreshToken) {
            throw ApiError.UnauthorizedError()
        }

        //валидируем токен  проверяем что он не подделан и  срок годности его не истек
        const userData = token_service.validateAccessToken(refreshToken)


        //проверяем что токен находиться в бд
        const tokenFromDb = await token_service.findToken(refreshToken)
        if (!userData || !tokenFromDb) {
            throw ApiError.UnauthorizedError();
        }

        // вытаскиваем пользователя и обновляем данные тк инфо могла поменяться
        const user = await User.findOrBuild(userData.id)

        //если проверка не прошла то как при логине генерим пару токенов ...рефреш сохраняем в бд.. и возвращаем ответ
        const userDto = new UserDto(user);
        const token = token_service.generateJwt({where: {...userDto}})
        await token_service.saveToken(userDto.id, token.refreshToken)
        return {...token, user: userDto}
    }


    async getAllUsers() {
        return await User.findAll();
    }

    //функция, которая переключает роль пользователя и перезаписывает в базе данных
    async changeRole(userId, idOrg) {
        const userIdAndRole = await DataUserAboutOrg.findAll({where: {userId}})  //ищем все орг пользователя по id
        const res = [];
        userIdAndRole.forEach(el=> res.push(el.dataValues))
        const findUserOrgData = res.find(currOrg => currOrg.idOrg === idOrg )
        const requiredField = await DataUserAboutOrg.findOne({where: {idRec:findUserOrgData.idRec}})
        requiredField.roleSelectedOrg = requiredField.roleSelectedOrg === 'USER'?  this.adminRole : this.userRole  //переключаем роль
        await requiredField.save({fields: ['roleSelectedOrg']})                                  //сохраняем ее в бд
        const userDtoRole = new UserDtoRole(requiredField)                                   //возвращаем нужные поля
        return userDtoRole;
    }

 //функция, которая делает из клиента сотрудника перезаписывает в базе данных
    async changeJobTitle(userId, idOrg, jobTitle, direction, photoEmployee) {
        const userIdAndJobTitle = await DataUserAboutOrg.findAll({where: {userId}})  //ищем все орг пользователя по id
        const res = [];
        userIdAndJobTitle.forEach(el=> res.push(el.dataValues))
        const userOrgData = res.find(currOrg => currOrg.idOrg === idOrg )
        const requiredField = await DataUserAboutOrg.findOne({where: {idRec:userOrgData.idRec}})
        requiredField.jobTitle = jobTitle
        await requiredField.save({fields: ['jobTitle']})
        requiredField.direction = direction
        await requiredField.save({fields: ['direction']})
        requiredField.photoEmployee = photoEmployee
        await requiredField.save({fields: ['photoEmployee']})
        await this.createDBFieldEmployeeForUserSelectedOrg(requiredField)
        return  new UserDtoJobTitle(requiredField)                                   //возвращаем нужные поля
    }


    async createDBFieldEmployeeForUserSelectedOrg(userEmployee) {
        const alreadyExists = await DataUserAboutOrg.findOne({where: {idOrg: JSON.stringify(userEmployee.idRec)}})
        const alreadyExistsAll = await DataUserAboutOrg.findAll({where: ({idOrg: JSON.stringify(userEmployee.idRec)})})
        const employeeOrg = alreadyExistsAll.find(us => us.roleSelectedOrg === 'EMPLOYEE')
        const nameForUserEmployeeOrg = userEmployee.jobTitle +' в ' + userEmployee.sectionOrOrganization

        if (employeeOrg) {  // если админ есть перезаписываем его должность
                const changeField = await DataUserAboutOrg.findOne({where: {idRec: employeeOrg.idRec}})
                changeField.sectionOrOrganization = nameForUserEmployeeOrg;
                changeField.save({fields: ['sectionOrOrganization']})
            }


        if (userEmployee.jobTitle.length >= 1 && !alreadyExists) {
                const dataUsersEmployee = await DataUserAboutOrg.create({
                    nameUser: userEmployee.nameUser,
                    surnameUser: userEmployee.surnameUser,
                    userId: userEmployee.userId,
                    idOrg: userEmployee.idRec,  //берем  idRec чтоб задать id для организации в которой стал сотрудником
                    sectionOrOrganization: nameForUserEmployeeOrg, //задаем исходя из направления и должности
                    roleSelectedOrg: 'EMPLOYEE',
                    jobTitle: '',
                    direction: '',
                    photoEmployee: '',
                    remainingFunds: '0',
                    timeStartRec: '15',
                    timeMinutesRec: '00',
                    timeLastRec: '14',
                    maxClients: 0,
                    timeUntilBlock: '12',
                    location: 'Задать в настройках',
                    phoneOrg: 'Задать в настройках'
                })
        }
    }



    async renameAllRecDataUserAboutOrg (userId, newName, newSurname, idRec) {
        const ownRowTableDataUserAboutOrg = await DataUserAboutOrg.findOne({where: {idRec}})
        ownRowTableDataUserAboutOrg.nameUser = newName
        ownRowTableDataUserAboutOrg.save({fields: ['nameUser']})
        ownRowTableDataUserAboutOrg.surnameUser = newSurname
        ownRowTableDataUserAboutOrg.save({fields: ['surnameUser']})
    }

    async renameAllRecTableOfRecords (userId, newName, newSurname, idRec) {
        const ownRowTableOfRecords = await TableOfRecords.findOne({where: {idRec}})
        ownRowTableOfRecords.nameUser = newSurname + ' ' + newName
        ownRowTableOfRecords.save({fields: ['nameUser']})
    }

    async renameAllArchiveRecordsTab (userId, newName, newSurname, idRec) {
        const ownRowArchiveRecords = await TableOfRecords.findOne({where: {idRec}})
        ownRowArchiveRecords.nameUser = newSurname + ' ' + newName
        ownRowArchiveRecords.save({fields: ['nameUser']})
    }

    async rename(userId, newName, newSurname) {
        const user = await User.findOne({where: {id:userId}})
        if (user.email === 'alex-007.88@mail.ru') {
            return 'Действие Невыполнимо!!!';
        }
        user.nameUser = newName
        await user.save({fields: ['nameUser']})
        user.surnameUser = newSurname
        await user.save({fields: ['surnameUser']})

        // перезаписываем по очереди вси записи таблицы DataUserAboutOrg
        const dataUser = await DataUserAboutOrg.findAll({where: {userId}})
        const resForDataUserAboutOrg = []
        dataUser.forEach(el=> resForDataUserAboutOrg.push(el.dataValues))
        resForDataUserAboutOrg.forEach((el) => {
            this.renameAllRecDataUserAboutOrg(userId, newName, newSurname, el.idRec)
        })

        // перезаписываем по очереди вси записи таблицы записей в календаре
        const dataTableOfRecords = await TableOfRecords.findAll({where: {userId}})
        const resForRecordsTab = []
        dataTableOfRecords.forEach(el=> resForRecordsTab.push(el.dataValues))
        resForRecordsTab.forEach((el) => {
             this.renameAllRecTableOfRecords(userId, newName, newSurname, el.idRec)
        })

        // перезаписываем по очереди вси записи таблицы Архив
        const dataArchiveRecords = await ArchiveRecords.findAll({where: {userId}})
        const resForArchiveRecordsTab = []
        dataArchiveRecords.forEach(el=> resForArchiveRecordsTab.push(el.dataValues))
        resForArchiveRecordsTab.forEach((el) => {
            this.renameAllArchiveRecordsTab(userId, newName, newSurname, el.idRec)
        })

        return 'Имя успешно изменено на'
    }




//User
    async renameAllFieldsUserTable(newNameOrg, id) {
        const ownRowTable = await User.findOne({where: {id}})
        ownRowTable.sectionOrOrganization = newNameOrg
        ownRowTable.save({fields: ['sectionOrOrganization']})
    }

//DataUserAboutOrg
    async renameAllFieldsDataUserAboutOrgTable(newNameOrg, idRec) {
        const ownRowTable = await DataUserAboutOrg.findOne({where: {idRec}})
        ownRowTable.sectionOrOrganization = newNameOrg
        ownRowTable.save({fields: ['sectionOrOrganization']})
    }

//TableOfRecords
    async renameAllFieldsTableOfRecords(newNameOrg, idRec) {
        const ownRowTable = await TableOfRecords.findOne({where: {idRec}})
        ownRowTable.sectionOrOrganization = newNameOrg
        ownRowTable.save({fields: ['sectionOrOrganization']})
    }

//ArchiveRecordsTable
    async renameAllFieldsArchiveRecordsTable(newNameOrg, idRec) {
        const ownRowTable = await ArchiveRecords.findOne({where: {idRec}})
        ownRowTable.sectionOrOrganization = newNameOrg
        ownRowTable.save({fields: ['sectionOrOrganization']})
    }




    async renameOrg(orgId, newNameOrg) {
    // перезаписываем название организации в таблице Organization
        const organizationTable = await Organization.findOne({where: {idOrg: orgId}})
        organizationTable.nameOrg = newNameOrg
        await organizationTable.save({fields: ['nameOrg']})

    // перезаписываем по очереди вси записи таблицы User
        if (typeof orgId === 'number') {
            orgId = JSON.stringify(orgId);
        }
        const userTable = await User.findAll({where: {idOrg: orgId}})
        const resForUserTable = []
        userTable.forEach(el=> resForUserTable.push(el.dataValues))
        resForUserTable.forEach((el) => {
            this.renameAllFieldsUserTable(newNameOrg, el.id)
        })

    // перезаписываем по очереди вси записи таблицы DataUserAboutOrg
        const dataTable = await DataUserAboutOrg.findAll({where: {idOrg:orgId}})
        const resForDataTable = []
        dataTable.forEach(el=> resForDataTable.push(el.dataValues))
        resForDataTable.forEach((el) => {
            this.renameAllFieldsDataUserAboutOrgTable(newNameOrg, el.idRec)
        })

    // перезаписываем по очереди вси записи таблицы TableOfRecords
        const tabOfRecords = await TableOfRecords.findAll({where: {orgId}})
        const resForTableOfRecords = []
        tabOfRecords.forEach(el=> resForTableOfRecords.push(el.dataValues))
        resForTableOfRecords.forEach((el) => {
            this.renameAllFieldsTableOfRecords(newNameOrg, el.idRec)
        })

    // перезаписываем по очереди вси записи таблицы ArchiveRecords
        const archiveRecordsTable = await ArchiveRecords.findAll({where: {orgId}})
        const resForArchiveRecords = []
        archiveRecordsTable.forEach(el=> resForArchiveRecords.push(el.dataValues))
        resForArchiveRecords.forEach((el) => {
            this.renameAllFieldsArchiveRecordsTable(newNameOrg, el.idRec)
        })
       }
}

module.exports = new UserService();
