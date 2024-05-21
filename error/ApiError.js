class ApiError extends Error{
    constructor(status, message, errors = []) {
        super();
        this.status = status
        this.message = message
        this.errors = errors
    }


    // статические функции можно вызывать без создания объекта  !!!!
    // те можно обращаться на прямую к классу и вызывать ту или иную функцию!!!
    static UnauthorizedError(message) {
        return new ApiError(401, 'Пользователь не авторизован')
    }

    static badRequest(message, errors) {
        console.log(message, '17')
        console.log(errors, '18')
        return new ApiError(404, message, errors)
    }

    static internal(message) {
        return new ApiError(500, message)
    }

    static forbidden(message) {
        return new ApiError(403, message)
    }
}

module.exports = ApiError

