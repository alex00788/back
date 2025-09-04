const ApiError = require('../error/ApiError')
const tokenService = require('../service/token-service')

module.exports = function (req, res, next) {
    if (req.method === "OPTIONS") {      //тк тут интересно тока POST PUT GET DELETE
        next()
    }
    try {
        //обычно токен указывается в заголовке authorization, если его нет кидаем ошибку
        const authorizationHeader = req.headers.authorization;

        // Проверяем наличие заголовка авторизации
        if (!authorizationHeader) {
            return next(ApiError.UnauthorizedError());
        }

        // Проверяем формат заголовка (должен начинаться с "Bearer ")
        if (!authorizationHeader.startsWith('Bearer ')) {
            return next(ApiError.UnauthorizedError());
        }

        //из хедера выцепляем токен                                       Bearer -тип токена потом сам токен
        const token = authorizationHeader.split(' ')[1]; // Bearer asfasnfkajsfnjk

        //если нет токена... кидаем ошибку
        if (!token) {
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
        // Логируем ошибку для отладки, но не возвращаем детали клиенту
        console.error('Ошибка в AuthMiddleware:', e.message);
        return next(ApiError.UnauthorizedError());
    }
};

