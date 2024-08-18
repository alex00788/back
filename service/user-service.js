const usModels = require('../models/models')
const User = usModels.User
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
const moment = require("moment");

class UserService {
    role = ''
    userRole = "USER"
    adminRole = "ADMIN"
    mainAdminRole = "MAIN_ADMIN"

    async registration(email, password, nameUser, surnameUser, phoneNumber, sectionOrOrganization, idOrg, remainingFunds) {
//если данных нет
        if (!email || !password) {
            throw ApiError.badRequest('Некорректный email или password')
        }
// РОЛЬ  присваиваеться  В ЗАВИСИМОСТИ ОТ ТОГО КАКОЙ НОМЕР и почту ВВЕЛ ПОЛЬЗОВАТЕЛЬ!!!!!!!
        if (email === "alex-007.88@mail.ru" || phoneNumber === '+79168402927') {
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
            throw ApiError.badRequest('телефон уже зарегистрирован')
        }
//хешируем пароль, 2ым параметром указываем сколько раз хешить
        const hashPassword = await bcrypt.hash(password, 3)
//указываем ссылку по которой пользователь будет переходить в аккаунт и подтверждать его!
        const activationLink = uuid.v4()      //  генерим ссылку  с помощью  uuid.v4()
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

        const adminSelectedOrg = await Organization.findOne({where: {email}})
        const idNewOrg = JSON.stringify(+adminSelectedOrg?.dataValues?.idOrg)
        const roleNewUser = adminSelectedOrg ? "ADMIN" : "USER"
        //удаляем начальные настройки admina но только если его зовут новая...
        if (adminSelectedOrg) {
            const refreshAdminOrg = await DataUserAboutOrg.findAll({where: {idOrg: idNewOrg}})
            const findAdminOrg = refreshAdminOrg.map(el => el.dataValues)
            const dataDelEl = findAdminOrg.find(el => el.roleSelectedOrg === "ADMIN")
            if (dataDelEl && dataDelEl.nameUser === 'Новая' && dataDelEl.surnameUser === 'Организация' && dataDelEl.userId === '-') {
                const idRec = dataDelEl.idRec
                const deleteRec = await DataUserAboutOrg.destroy({where: {idRec}})
            }
        }

//сохраняем данные о выбранной организации
        const dataUsersAboutOrg = await DataUserAboutOrg.create({
            nameUser,
            surnameUser,
            userId: user.id,
            idOrg,
            sectionOrOrganization,
            roleSelectedOrg: roleNewUser,
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


    async activate(activationLink) {
        //в БД ищем польз по этой ссылке
        const user = await User.findOne({where: {activationLink}})

        //проверяем что пользов существует
        if (!user) {
            throw ApiError.badRequest('Некорректная ссылка активации')
        }
        user.isActivated = true;

        //сохраняем польз в БД
        await user.save();
    }


    //Функция 1 раз в час смотрит в базу данных, чтоб отправить напоминание
    async checkRecordForSendMail() {
        let interval = setInterval(() => {
            const date = moment().format('DD.MM.YYYY')
            this.getDataForCheck(date)
        }, 3600000)
    }

    //берем записи на сегодняшний день
    async getDataForCheck(date) {
        const allEntriesForThisDate = await TableOfRecords.findAll({where: {date}})
        const cleanArr = allEntriesForThisDate.map(el => el.dataValues)
        const sortTim = cleanArr.sort((a, b) => a.time > b.time ? 1 : -1)
        const currentHour = moment().add(1,'day').format('HH')
        sortTim.forEach(el => {
            setTimeout(() => {                         // если осталось 12 6 2 часа до записи
                if (
                    currentHour === JSON.stringify(+el.time - 12) && el.userId !== '*1' ||
                    currentHour === JSON.stringify(+el.time - 6) && el.userId !== '*1'  ||
                    currentHour === JSON.stringify(+el.time - 2) && el.userId !== '*1'
                ) {
                    this.getDataForSendNotification(el)
                }
            }, 2000)
        })
    }

    // функция берет почту клиента и отправляет ему письмо, что он записан
    async getDataForSendNotification(user) {
        const dataUser = await User.findOne({where: {id: user.userId}})
        const dataNotification = {
            name: dataUser.dataValues.nameUser,
            email: dataUser.dataValues.email,
            dateRec: user.date,
            timeRec: user.time,
            org: user.sectionOrOrganization
        }
        //разблокировать когда все почты будут настоящими
        await mailService.sendNotificationAboutRec(dataNotification)
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
        const newOrganization = await Organization.create({nameOrg, supervisorName, managerPhone, email})
        const idOrg = await Organization.findOne({where: {nameOrg}})

        // У каждой орг должен быть свой админ иначе будет ошибка...
        //создаю админские настройки в таблице данных о новой орг и как тока пользователь с email из табл организац зарегистрируеться, их удалю
        const adminSettingsNewOrg = await DataUserAboutOrg.create({
            nameUser: 'Новая',
            surnameUser: 'Организация',
            userId: '-',
            idOrg: idOrg.dataValues.idOrg,
            sectionOrOrganization: nameOrg,
            roleSelectedOrg: "ADMIN",
            remainingFunds: '-',
            timeStartRecord: '12',
            timeMinutesRec: '00',
            timeLastRec: '11',
            maxClients: '3',
            timeUntilBlock: '12',
            location: 'Задать в настройках',
            phoneOrg: 'Задать в настройках',
        })

        return newOrganization
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
            remainingFunds: newSettings.remainingFunds,
            timeStartRec: newSettings.timeStartRec,
            timeMinutesRec: newSettings.timeMinutesRec,
            timeLastRec: newSettings.timeFinishRec,
            maxClients: newSettings.maxiPeople,
            timeUntilBlock: newSettings.timeUntilBlock,
            location: newSettings.location,
            phoneOrg: newSettings.phoneOrg,
        }
        console.log('231!!!!!!!!!!!!!!dddddddddddddddddd', idRec)
        await DataUserAboutOrg.destroy({where: {idRec}})
        //перезапишем строку в бд
        const saveSit = await DataUserAboutOrg.create(newSit)
        return newSit
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

    async getAllOrg() {
        const allOrg = await Organization.findAll()
        return allOrg.map((el) => {
            return {name: el.nameOrg, id: el.idOrg}
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
        return dataClient.dataValues.phoneNumber
    }


    //функция, которая будет возвращать роли админ, пользователей организации админом которой он являеться
    async getAllUsersOrganization(currentOrgId, currentUserId) {
        //нахожу все записи текущей организации, чтоб понять кто админ и взять его настройки
        const findDataSettings = await DataUserAboutOrg.findAll({where: {idOrg: currentOrgId}})
        const dataSettingsAdmin = []
        findDataSettings.forEach(el=> dataSettingsAdmin.push(el.dataValues))
        const dataSettings = dataSettingsAdmin.find(el=> el.roleSelectedOrg === 'ADMIN')

        //преобразую чтоб проверить есть ли в таблице данных организаций данные о тек пользователе или он входит первый раз...
        const firstEnterOrg = dataSettingsAdmin.map(i=>i.userId)
        // если пользователь переключился на эту организацию в первый раз добавим данные о нем в таблицу
        if (!firstEnterOrg.includes(currentUserId)) {
            //получаем текущего польз для получения имени фамилии и др данных из таблицы всех пользователей
            const currentUser = await User.findOne({where: {id: currentUserId}})
            //получаем имя выбранной организац
            const currentOrg = await Organization.findOne({where: {idOrg: currentOrgId}})
            const nameOrg = currentOrg.dataValues.nameOrg

            const dataUsersAboutOrg = await DataUserAboutOrg.create({
                nameUser: currentUser.nameUser,
                surnameUser: currentUser.surnameUser,
                userId: currentUserId,
                idOrg: currentOrgId,
                sectionOrOrganization: nameOrg,
                roleSelectedOrg: 'USER',
                remainingFunds: '0',
                timeStartRec: dataSettings.timeStartRec,
                timeMinutesRec: dataSettings.timeMinutesRec,
                timeLastRec: dataSettings.timeLastRec,
                maxClients: dataSettings.maxClients,
                location: dataSettings.location + ' ..dubl',
                phoneOrg: dataSettings.phoneOrg
            })
        }
        const dataRemainingFundsAndRoleSelectedOrg = await DataUserAboutOrg.findAll()
        return dataRemainingFundsAndRoleSelectedOrg
            .filter(el=> el.idOrg === currentOrgId)
            .map(i=> {
                return{
                    id: i.userId,
                    idOrg: i.idOrg,
                    idRec: i.idRec,
                    nameUser: i.nameUser,
                    surnameUser: i.surnameUser,
                    remainingFunds: i.remainingFunds,
                    role: i.roleSelectedOrg,
                    sectionOrOrganization: i.sectionOrOrganization,
                    timeStartRec: i.timeStartRec,
                    timeMinutesRec: i.timeMinutesRec,
                    timeLastRec: i.timeLastRec,
                    recAllowed: i.recAllowed,
                    created: moment(i.createdAt),
                    maxClients: i.maxClients,
                    location: i.location,
                    phoneOrg: i.phoneOrg
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
        const users = await User.findAll()
        return users;
    }

    //функция, которая переключает роль пользователя и перезаписывает в базе данных
    async changeRole(userId, idOrg) {
        const userIdAndRole = await DataUserAboutOrg.findAll({where: {userId}})  //ищем все орг пользователя по id
        const res = [];
        userIdAndRole.forEach(el=> res.push(el.dataValues))
        const findUserOrgData= res.find(currOrg => currOrg.idOrg === idOrg )
        const requiredField = await DataUserAboutOrg.findOne({where: {idRec:findUserOrgData.idRec}})
        requiredField.roleSelectedOrg = requiredField.roleSelectedOrg === 'USER'?  this.adminRole : this.userRole  //переключаем роль
        await requiredField.save({fields: ['roleSelectedOrg']})                                  //сохраняем ее в бд
        const userDtoRole = new UserDtoRole(requiredField)                                   //возвращаем нужные поля
        return userDtoRole;
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

        const dataUser = await DataUserAboutOrg.findOne({where: {userId}})
        dataUser.nameUser = newName
        await dataUser.save({fields: ['nameUser']})
        dataUser.surnameUser = newSurname
        await dataUser.save({fields: ['surnameUser']})

        // пкрезаписываем по очереди вси записи таблици записей в календаре
        const dataTableOfRecords = await TableOfRecords.findAll({where: {userId}})
        const resForRecordsTab = []
        dataTableOfRecords.forEach(el=> resForRecordsTab.push(el.dataValues))
        resForRecordsTab.forEach((el) => {
             this.renameAllRecTableOfRecords(userId, newName, newSurname, el.idRec)
        })

        // пкрезаписываем по очереди вси записи таблици Архив
        const dataArchiveRecords = await ArchiveRecords.findAll({where: {userId}})
        const resForArchiveRecordsTab = []
        dataArchiveRecords.forEach(el=> resForArchiveRecordsTab.push(el.dataValues))
        resForArchiveRecordsTab.forEach((el) => {
            this.renameAllArchiveRecordsTab(userId, newName, newSurname, el.idRec)
        })

        return 'Имя успешно изменено на'
    }


}

module.exports = new UserService();
