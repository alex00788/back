const nodemailer = require('nodemailer')
const ApiError = require("../error/ApiError");

class MailService {
    constructor() {
        //с помощ следущего поля отправим письма
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD

            }
        })
    }

     sendActivationMail(emailTo, link, pas) {         //парам почта по котор отправляем письмо и ссылка
         if (emailTo.userEmail) {
             emailTo =  emailTo.userEmail
         }
         this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: emailTo,
                subject: 'Активация аккаунта',
                text: 'Текст письма',
                html:
                    `<div>
                        <h1>Здравствуйте! </h1>
                        <h3>Для завершения активации нажмите: 
                        <br>
                        <br>
                            <a style="border: solid 1px red; padding: 10px; margin: 20px 0; border-radius: 10px" href="${link}">
                                подтвердить Email
                            </a>
                        </h3>
                        <br>
                    </div>
                    <div>
                      <p *ngIf="pas"> 
                            <strong> Это ваш пароль: </strong>
                            <span style="color: #2630f1">${pas}</span>
                             сохраните его чтобы не забыть! 
                      </p>   
                      <strong style="text-decoration: underline"> 
                        Пароль знаете тока вы! 
                      </strong> 
                      ...без него данные будут потеряны!  
                      <br>
                      <p> Если вы не создавали учетную запись, проигнорируйте это письмо... </p>   
                      <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                      </p>   
                    </div>`
            }, (err, data) => {                   //если почта указана неверно перехватываем ошибку

                if (err) {
                    console.log('30', err)
                    return ApiError.badRequest('Такого email не существует', err)
                } else {
                    console.log('31', data)
                }
            }
        )
    }



    sendNewOrg(emailTo, newOrg) {         //парам почта по котор отправляем письмо и ссылка
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: emailTo,
                subject: 'Запрос на добавление новой организации',
                text: JSON.stringify(newOrg),
                html:
                    `<div>
                        <h1>Данные новой организации: </h1>
                        <p>организация</p>
                        ${newOrg.nameSectionOrOrganization}
                        <p>Email</p>
                        ${newOrg.email}
                        <p>Тел</p>
                        ${newOrg.phoneNumber}
                        <p>Руководитель</p>
                        ${newOrg.nameSupervisor}
                    
                        <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                        </p>  
                    </div>`
            },
        )
    }


//добавить переход на сайт в тексте письма
    notificationOfAnEntry(emailTo, nameUser,sectionOrOrganization, date, time) {
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: emailTo,
                subject: 'Новая запись ' + date +' в ' + time,
                text: nameUser,
                html:
                    `<div>
                        <h1>Новая запись:</h1>
                        <p>Клиент: ${nameUser}</p>
                        <p>запись: ${date} в ${time}</p>
                        <p>${sectionOrOrganization}</p>
                    </div>
                    <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                       <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>`
            },
        )
    }


    //письмо админу, что клиент отменил запись...
    clientCanceledRecording(emailTo, nameUser,sectionOrOrganization, date, time) {
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: emailTo,
                subject: 'Отмена записи ' + date +' в ' + time,
                text: nameUser,
                html:
                    `<div>
                        <h1>Отмена записи!</h1>
                        <p>Клиент: ${nameUser}</p>
                        <p>Отменил запись: ${date} в ${time}</p>
                        <p>${sectionOrOrganization}</p>
                    </div>
                    <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                         <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>`
            },
        )
    }


    //письмо клиенту об отмене записи...
    adminCanceledRecording(emailTo, nameUser,sectionOrOrganization, date, time) {
        nameUser = nameUser.split(' ')[1]
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: emailTo,
                subject: 'Отмена записи ' + date +' в ' + time,
            text: nameUser,
                html:
                    `<div>
                        <h3>Уважаемый(-ая) ${nameUser}</h3>
                        <p>К сожалению, по техническим причинам ваша запись </p>
                        <p>${date} в ${time} : 00</p>
                        <p>${sectionOrOrganization}</p>
                        <p> ОТМЕНЕНА!</p>
                        <p> Приносим извинения за доставленные неудобства!</p>
                        <p> Пожалуйста, выберите любое другое удобное для вас время! </p>
                    </div>
                    <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>  `
            },
        )
    }


    sendInSupport(descriptions) {         //отправка мне на почту предложений
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: process.env.EMAIL_MY,
                subject: 'Предложение о доработке приложения авто админ',
                text: 'textNull',
                html:
                    `<div>
                        <p>
                          ${descriptions} 
                        </p>
                    </div>
                    <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                         <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>  `
            },
        )
    }


    sendNotificationAboutRec(dataNotification) {     // отправка пользователю напоминания о записи
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: dataNotification.email,
                subject: `Напоминание о записи ${dataNotification.org}`,
                text: 'textNull',
                html:
                    `<div>
                        <h3>Уважаемый(-ая) ${dataNotification.name}</h3>
                        <p>Напоминаем вам, что вы записаны</p>
                        <p>${dataNotification.dateRec} в ${dataNotification.timeRec} : 00</p>
                        <p>${dataNotification.org}</p>
                        <p> Если у вас изменились планы,</p>
                        <p> Пожалуйста, отмените запись в личном кабинете,</p>
                        <p> Чтобы, избежать блокировки в дальнейшем!</p>
                    </div>
                    <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>  `
            },
        )
    }


    sendNotificationAboutSuccessfulAddNewOrg (emailNewOrg, nameOrg) {  // оповещение пользователю о том что организация добавлена
        this.transporter.sendMail({
                from: process.env.SMTP_USER,
                to: emailNewOrg,
                subject: `Организация ${nameOrg} успешно добавлена`,
                text: 'textNull',
                html:
                    `<div>
                        <p> Организация ${nameOrg} успешно добавлена </p>
                        <p> Если вы этого не делали,</p>
                        <p> Просто проигнорируйте это письмо</p>
                        <p> Созданно автоматически отвечать не нужно...</p>
                    </div>
                    <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href= 'https://xn--80aneajyecjh1b5f.xn--p1ai/'> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>  `
            },
        )

    }


}

module.exports = new MailService()


