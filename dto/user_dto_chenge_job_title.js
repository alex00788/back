module.exports = class UserDtoJobTitle {
    userId;
    jobTitle;
    direction;

    constructor(model) {
        this.jobTitle = model.jobTitle
        this.direction = model.direction
    }
}
