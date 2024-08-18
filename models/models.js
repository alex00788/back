const sequelize = require('../db')
const {DataTypes} = require('sequelize')


const User = sequelize.define('user', {
    nameUser: {type: DataTypes.STRING, require: true},
    surnameUser: {type: DataTypes.STRING, require: true},
    email: {type: DataTypes.STRING, unique: true},
    isActivated: {type: DataTypes.BOOLEAN, defaultValue: false},
    phoneNumber: {type: DataTypes.STRING, unique: true, require: true},
    id: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    sectionOrOrganization: {type: DataTypes.STRING, require: true},
    idOrg: {type: DataTypes.STRING, require: true},
    role: {type: DataTypes.STRING, defaultValue: "USER"},
    tariff: {type: DataTypes.STRING, defaultValue: "FREE"},    // В ЗАВИСИМОСТИ от тарифа добавляем платные услуги
    userBlocked: {type: DataTypes.BOOLEAN, defaultValue: false},
    reasonForBlocking: {type: DataTypes.STRING, defaultValue: 'нет причин'},
    password: {type: DataTypes.STRING},
    activationLink: {type: DataTypes.STRING},
})

//  isActivated       для подтверждения активации
//  activationLink     ссылка для активации

//схема для хранения токена,  id пользователя ,   ip адреса  и тд
                               //   ref    ссылка на объект
const Token = sequelize.define('token', {
    user: {type: DataTypes.STRING, ref: 'User' },
    refreshToken: {type: DataTypes.STRING, require: true}
})



const TableOfRecords = sequelize.define('tableOfRecords', {
    date: {type: DataTypes.STRING, require: true },
    dateYear: {type: DataTypes.STRING, require: true },
    dateMonth: {type: DataTypes.STRING, require: true },
    dateNum: {type: DataTypes.STRING, require: true },
    time: {type: DataTypes.STRING, require: true},
    userId: {type: DataTypes.STRING, require: true },
    orgId: {type: DataTypes.STRING, require: true },
    idRec: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    workStatus: {type: DataTypes.STRING, require: true},
    recBlocked: {type: DataTypes.BOOLEAN, defaultValue: false},
    nameUser: {type: DataTypes.STRING, require: true},
    sectionOrOrganization: {type: DataTypes.STRING, require: true},
})


const ArchiveRecords = sequelize.define('ArchiveRecords', {
    date: {type: DataTypes.STRING, require: true },
    dateYear: {type: DataTypes.STRING, require: true },
    dateMonth: {type: DataTypes.STRING, require: true },
    dateNum: {type: DataTypes.STRING, require: true },
    time: {type: DataTypes.STRING, require: true},
    userId: {type: DataTypes.STRING, require: true },
    orgId: {type: DataTypes.STRING, require: true },
    idRec: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    workStatus: {type: DataTypes.STRING, require: true},
    recBlocked: {type: DataTypes.BOOLEAN, defaultValue: false},
    nameUser: {type: DataTypes.STRING, require: true},
    sectionOrOrganization: {type: DataTypes.STRING, require: true},
})


const Organization = sequelize.define('organization', {
    idOrg: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    nameOrg: {type: DataTypes.STRING, require: true},
    supervisorName: {type: DataTypes.STRING, require: true},
    managerPhone: {type: DataTypes.STRING, require: true},
    email: {type: DataTypes.STRING},
    userId: {type: DataTypes.STRING, require: true, defaultValue: "USER"},
    orgLink: {type: DataTypes.STRING, defaultValue: null},
    linkActive: {type: DataTypes.BOOLEAN, defaultValue: false},  //нужны чтоб кликая по организации переходить на их сайт или рекламную страницу 2500 мес
})


const DataUserAboutOrg = sequelize.define('dataUserAboutOrg', {
    idRec: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true},
    nameUser: {type: DataTypes.STRING, require: true},
    surnameUser: {type: DataTypes.STRING, require: true},
    userId: {type: DataTypes.STRING, require: true },
    idOrg: {type: DataTypes.STRING, require: true },
    sectionOrOrganization: {type: DataTypes.STRING, require: true},
    roleSelectedOrg: {type: DataTypes.STRING, require: true, defaultValue: "USER"},
    remainingFunds: {type: DataTypes.STRING, defaultValue: "0"},
    timeStartRec: {type: DataTypes.STRING, defaultValue: "17"},
    timeMinutesRec: {type: DataTypes.STRING, defaultValue: "00"},
    timeLastRec: {type: DataTypes.STRING, defaultValue: "21"},
    maxClients: {type: DataTypes.INTEGER, defaultValue: 1},
    timeUntilBlock: {type: DataTypes.INTEGER, defaultValue: 12},
    recAllowed: {type: DataTypes.BOOLEAN, defaultValue: false},
    location: {type: DataTypes.STRING},
    phoneOrg: {type: DataTypes.STRING},
})



module.exports = {
    User,
    Token,
    TableOfRecords,
    ArchiveRecords,
    Organization,
    DataUserAboutOrg
}
