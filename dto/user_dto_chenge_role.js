module.exports = class UserDtoRole {
    userId;
    userRole;

    constructor(model) {
        this.userRole = model.roleSelectedOrg
    }
}
