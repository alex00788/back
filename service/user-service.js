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
      await mailService.sendActivationMail(email, `${process.env.API_URL}/api/user/activate/${activationLink}`)
        // await mailService.sendActivationMail(email, `${process.env.API_URL}`)

//  чтоб убрать ненужные поля   и ее будем использовать как payload v token_service v generateJwt
      const userDtoForSaveToken = new UserDtoForSaveToken(user)
// также переменная чтоб клиенту вернуть нужные поля тк большое кол-во полей не сохраняет бд
      const userDto = new UserDto(user)

      const adminSelectedOrg = await Organization.findOne({where: {managerPhone: phoneNumber}})
      const idNewOrg = JSON.stringify(+adminSelectedOrg?.dataValues?.idOrg)
      const roleNewUser =  adminSelectedOrg? "ADMIN" : "USER"
      //удаляем начальные настройки admina но только если его зовут новая...
        if (adminSelectedOrg) {
          const refreshAdminOrg = await DataUserAboutOrg.findAll( {where:{idOrg: idNewOrg}})
            const findAdminOrg = refreshAdminOrg.map(el=> el.dataValues)
            const dataDelEl = findAdminOrg.find(el=> el.roleSelectedOrg === "ADMIN")
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
        timeLastRec: '16',
        maxClients: 3,
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


    async newOrg(newOrgData) {
        const nameOrg = newOrgData.nameOrg
        const supervisorName = newOrgData.supervisorName
        const managerPhone = newOrgData.managerPhone
        const checkAvailability = await Organization.findOne({where: {nameOrg}})
        const checkPhoneSupervisor = await Organization.findOne({where: {managerPhone}})
        if (checkAvailability) {
            return null
        }
        // if (checkPhoneSupervisor) {   //проверка на то чтоб тел был уникален  пока закоментил
        //     return 'duplicatePhone'
        // }
        const newOrganization = await Organization.create({nameOrg, supervisorName, managerPhone})
        const idOrg = await Organization.findOne({where: {nameOrg}})

        // У каждой орг должен быть свой админ иначе будет ошибка...
        //создаю админские настройки в таблице данных о новой орг и как тока пользователь с телефоном из табл организац зарегистрируеться, их удалю
        const adminSettingsNewOrg = await DataUserAboutOrg.create({
            nameUser: 'Новая',
            surnameUser: 'Организация',
            userId: '-',
            idOrg: idOrg.dataValues.idOrg,
            sectionOrOrganization: nameOrg,
            roleSelectedOrg: "ADMIN",
            remainingFunds: '-',
            timeStartRecord: '12',
            timeLastRec: '11',
            maxClients: '3',
            location: 'Задать в настройках',
            phoneOrg: 'Задать в настройках',
        })

        return newOrganization
    }




    async setSettings(newSettings) {
        // найти в бд пользователя и перезаписать строку с настройками
        // находим все записи пользователя
        const findOrgInDataUserAboutOrg = await DataUserAboutOrg.findAll({where: {userId: newSettings.userId}})
        //находим текущую организацию
        const currentOrg = findOrgInDataUserAboutOrg.find(org=> org.idOrg === newSettings.orgId)
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
            timeLastRec: newSettings.timeFinishRec,
            maxClients: newSettings.maxiPeople,
            location: newSettings.location,
            phoneOrg: newSettings.phoneOrg,
        }
        await DataUserAboutOrg.destroy({where: {idRec}})
        //перезапишем строку в бд
        const saveSit = await DataUserAboutOrg.create(newSit)
        return newSit
    }


    async changeWorkStatus(dataForChangeStatus) {
        const workStatus = dataForChangeStatus.state === 'open' ? 'closed' : 'open';
        const data = {
            date: dataForChangeStatus.date,
            time: dataForChangeStatus.time,
            idOrg: dataForChangeStatus.idOrg
        }
        await this.changeWorkStatusOrg(workStatus, data)
        return {workStatus, data}
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
        const workStatus = newEntry.workStatus === 0? 'closed': 'open'
                                     //проверка записан ли userId на выбранный день  //берем все записи за выбранную дату
        const allEntriesForTheSelectedDate = await TableOfRecords.findAll({where: {date}})
                                                                        //Фильтруем по выбранному времени
        const selectedTime = allEntriesForTheSelectedDate
            .filter(el=> el.time === time)
                                                                        //Проверяем есть ли текущий пользователь в это время где то еще?
        const userAlreadyRecorded = selectedTime.find(el=> el.userId === userId)

        if (userAlreadyRecorded) {
            return {userAlreadyRecorded: true, alreadyRec: userAlreadyRecorded}
        }

        // переписать значение одного поля
        // находим все поля текущ пользователя в таблице с данными об организации
        const refreshRemainingFunds = await DataUserAboutOrg.findAll({where: {userId: newEntry.userId}})
        //фильтруем по id текущей организации
        const findFieldRemainingCurUserSelectedOrg =  refreshRemainingFunds
            .find(el=> el.idOrg == orgId)
        //ищем поле текущ user выбранной организации
        const refreshFindFieldRemainingFunds = await DataUserAboutOrg.findOne({where: findFieldRemainingCurUserSelectedOrg.idRec})
        //меняем значение
        refreshFindFieldRemainingFunds.remainingFunds = remainingFunds
        // перезаписываем тока это поле
        await refreshFindFieldRemainingFunds.save({fields: ['remainingFunds']})

        await this.changeWorkStatusOrg(workStatus, newEntry)
        //на фронте принимаем эти данные и добавляем в иф условие показавать когда открыто

        //новая запись в календаре
        const newUserAccount = await TableOfRecords.create({date, dateYear, dateMonth,dateNum, time, nameUser,workStatus, userId, remainingFunds, sectionOrOrganization, orgId})
        const mailAdminOrg = await this.getMailAdminOrg(orgId)
        const userData = await TableOfRecords.findAll({where: {date}})
        return {userData, emailAdmin: mailAdminOrg}
    }



    //Функция меняющая статус работы организации
    async changeWorkStatusOrg (workStatus, dataEntry) {
        const deleted = !dataEntry.idOrg   // при удалении idOrg называется orgId  поэтому такая проверка
        if (!dataEntry.idOrg) {                     //  значит идет процесс удаления
            dataEntry.idOrg = dataEntry.orgId
        }
        const orgId = dataEntry.idOrg
        const allEntriesThisOrg = await TableOfRecords.findAll({where: {orgId}})
        const arrEntries = allEntriesThisOrg.map(en => en.dataValues)
        const arrRec = arrEntries
            .filter((el)=> el.date === dataEntry.date)
            .filter(el=> el.time === dataEntry.time)

        if (!arrRec.length || arrRec[0].userId === '*1') {
            await this.createStub(workStatus, dataEntry)
        }

        const newArrRec = []
          arrRec.forEach(el=> {
            el.workStatus = workStatus;
            newArrRec.push(el)
        })

        newArrRec.forEach(el=> {
            const writableField = {    //данные перезаписываемых полей
                date: el.date,
                dateYear:el.dateYear,
                dateMonth:el.dateMonth,
                dateNum: el.dateNum,
                time:el.time,
                nameUser:el.nameUser,
                workStatus: el.workStatus,
                userId: el.userId,
                remainingFunds: el.remainingFunds,
                sectionOrOrganization: el.sectionOrOrganization,
                orgId: el.orgId
            }

            TableOfRecords.destroy({where: {idRec: el.idRec}})
            if (deleted && el.idRec !== dataEntry.idRec) {  //если идет удаление перезаписываем статусы всех записей кроме удаляемой
                TableOfRecords.create(writableField)
            }
            if (!deleted  && writableField.userId !== '*1') {   //при добавлении просто перезапись workStatus
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
        await this.changeWorkStatusOrg(workStatus, dataAboutDeletePerson.dataValues)
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
                sectionOrOrganization: el.sectionOrOrganization,
                orgId: el.orgId,
            })
            const deleteRec =  TableOfRecords.destroy({where: {idRec: el.idRec}})
        })
    }



    async getAllEntryAllUsers(dataYear, month, sectionOrOrganization, orgId, userId, roleSelectedOrg, remainingFunds ) {
        // const findOrgInDataUserAboutOrg = await DataUserAboutOrg.findAll({where: {userId}})
        // const currentUser = await User.findOne({where: {id: userId}})
        // const  alreadyRecords = findOrgInDataUserAboutOrg
        //     .find(el=>el.idOrg === orgId )
        // if (!alreadyRecords) {
        //     const dataUsersAboutOrg = await DataUserAboutOrg.create({
        //         nameUser: currentUser.nameUser,
        //         surnameUser: currentUser.surnameUser,
        //         userId,
        //         idOrg: orgId,
        //         sectionOrOrganization,
        //         roleSelectedOrg: 'USER',
        //         remainingFunds: '0',
        //         timeStartRec: '17',
        //         timeLastRec: '18',
        //         maxClients: 3,
        //         location: 'getUsers253'
        //     })
        // }

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
                    nameUser: i.nameUser,
                    surnameUser: i.surnameUser,
                    remainingFunds: i.remainingFunds,
                    role: i.roleSelectedOrg,
                    sectionOrOrganization: i.sectionOrOrganization,
                    timeStartRec: i.timeStartRec,
                    timeLastRec: i.timeLastRec,
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


}

module.exports = new UserService();
