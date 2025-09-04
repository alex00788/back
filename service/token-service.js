const jwt = require('jsonwebtoken')
const usModels = require('../models/models')
const {where} = require("sequelize");
const tokenModel = usModels.Token

class TokenService {

    // функция генерирующая пару токенов...чтоб использовать и в логине и в регистрации
    generateJwt = (paiload) => {     //payload, берем из токена, те данные что вшиваются в токен
                                    // SECRET_KEY_ACCESS выносим в переменную окружения...тут храним секретный ключ

        const accessToken = jwt.sign(paiload, process.env.SECRET_KEY_ACCESS, {expiresIn: '30m'} )
                                                                                //время жизни токена после которого пропадет авторизация


        // если юзер не заходил 24 часа то логиниться заново!
        const refreshToken = jwt.sign(paiload, process.env.SECRET_KEY_REFRESH, {expiresIn: '24h'} )

        return {
            accessToken,
            refreshToken,
            expiresIn: '1800'  // 30 минут в секундах
        }
    }




    validateAccessToken(token) {
        try {
            //после верификации возвращ payload который вшивали внего
            const userData = jwt.verify(token, process.env.SECRET_KEY_ACCESS);
            return userData;
        } catch (e) {
            return null;
        }
    }

    validateRefreshToken(token) {
        try {
            const userData = jwt.verify(token, process.env.SECRET_KEY_REFRESH);
            return userData;
        } catch (e) {
            return null;
        }
    }







//функция сохранения токена
    //при таком подходе заходя с др устройства происоди разлогин на старом
    // ... если это править нужно продумать механизм   котоый будет удалять токены из базы в какойто момент чтоб там не скопилось их помойка
    async saveToken(userId, refreshToken){
        const tokenData = await tokenModel.findOne({user: userId})  //ищем в БД  юзера по такому id!

        //если есть перезатираем
        if (tokenData) {
            tokenData.refreshToken = refreshToken
            return tokenData.save();
        }

        //если нет создаем
        const token = await tokenModel.create({user: userId, refreshToken})
        return token;
    }

    async removeToken(refreshToken) {
        const tokenData = await tokenModel.destroy({where: {refreshToken}})
        return tokenData;
    }

    async findToken(refreshToken) {
        const tokenData = await tokenModel.findOne({refreshToken})
        return tokenData;
    }


}

module.exports = new TokenService()


