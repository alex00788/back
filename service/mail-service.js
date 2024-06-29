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
                        <h3>Для завершения активации нажмите: <a href="${link}">подтвердить Email</a></h3>
                    </div>
                    <div>
                      <p> Если вы не создавали учетную запись, проигнорируйте это письмо... </p>   
                      <p *ngIf="pas"> 
                            <strong> Это ваш пароль: </strong>
                            <span style="color: #2630f1">${pas}</span>
                             сохраните его чтобы не забыть! 
                      </p>   
                      <p> Пароль знаете тока вы ...без него данные будут потеряны!</p>   
                      <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
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
                        <h1>данные новой организации: </h1>
                        <p>организация</p>
                        ${newOrg.nameSectionOrOrganization}
                        <p>тел</p>
                        ${newOrg.phoneNumber}
                        <p>руководитель</p>
                        ${newOrg.nameSupervisor}
                    
                        <p> С уважением, команда 
                        <strong style="color: #2630f1; cursor: pointer">
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
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
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
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
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
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
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
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
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
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
                          <a href="http://62.76.90.163:63420"> ЗаписьКпрофи.рф </a>
                        </strong>
                    </p>  `
            },
        )
    }


}

module.exports = new MailService()


