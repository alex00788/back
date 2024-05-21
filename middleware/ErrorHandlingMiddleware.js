const ApiError = require('../error/ApiError');

module.exports = function (err, req, res, next) {              // вызывая next передаем управление след по цепи
    console.log('3 см component -> ErrorHandlingMiddleware  err =', err)

    if (err.errors) {
        //проверка что телефон не повторяеться
        if (err.errors[0]?.message === "phoneNumber must be unique") {
            return res.status(500).json({message: "Телефон уже зарегистрирован!"})
        }
        if (err.errors[0]?.path === "phoneNumber" && err.errors[0].message === "Invalid value") {
            return res.status(500).json({message: "Номер телефона введен неверно!"})
        }
    }

    if (err instanceof ApiError) {
        return res.status(err.status).json({message: err.message, errors: err.errors})
    }

    //если вдруг условие не сработает    и ошибка будет не экземпляром класса  выбросим непредвиденную ошибку!
    return res.status(500).json({message: "Непредвиденная ошибка!"})
}
