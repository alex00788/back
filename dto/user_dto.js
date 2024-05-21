module.exports = class UserDto {
    email;
    id;
    isActivated;
    role;
    nameUser;
    surnameUser;
    sectionOrOrganization;
    idOrg;
    remainingFunds;

    constructor(model) {
        this.email = model.email;
        this.id = model.id;
        this.isActivated = model.isActivated;
        this.role = model.role;
        this.nameUser = model.nameUser;
        this.surnameUser = model.surnameUser;
        this.remainingFunds = model.remainingFunds;
        this.sectionOrOrganization = model.sectionOrOrganization;
        this.idOrg = model.idOrg;

    }
}

//  если сюда добавить еще один класс, то тот что сверху будет перезатираться   ... поэтому создай новый файл!!!
