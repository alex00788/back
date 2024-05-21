const ApiError = require('../error/ApiError')
const tokenService = require('../service/token-service')

module.exports = function (req, res, next) {
    if (req.method === "OPTIONS") {      //тк тут интересно тока POST PUT GET DELETE
        next()
    }
    try {
        //обычно токен указывается в заголовке authorization, если его нет кидаем ошибку
        const authorizationHeader = req.headers.authorization;

        //из хедера выцепляем токен                                       Bearer -тип токена потом сам токен
        const token = req.headers.authorization.split(' ')[1] // Bearer asfasnfkajsfnjk

        //если нет токена или зоголовка... кидаем ошибку
        if (!token || !authorizationHeader) {
            return next(ApiError.UnauthorizedError());
        }

        // если есть токен  то валидируем его в функции которую  есть в token_service  передаем туда accessToken
        const userData = tokenService.validateAccessToken(token)
        if (!userData) {
            return next(ApiError.UnauthorizedError());
        }

        // к реквесту добавляем  в поле юзер данные из токена он будет доступен во всех функциях
        req.user = userData


        // вызываем следущий по цепи middleware
        next()


    } catch (e) {
        // res.status(401).json({message: "Не авторизован"})
        return next(ApiError.UnauthorizedError());
    }
};

