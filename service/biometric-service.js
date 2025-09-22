const crypto = require('crypto');
const redis = require('redis');
const ApiError = require('../error/ApiError');
const { BiometricCredential, BiometricAuditLog } = require('../models/models');

class BiometricService {
    constructor() {
        // Инициализация Redis клиента
        this.redisClient = redis.createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                reconnectStrategy: (retries) => {
                    if (retries > 10) {
                        console.error('Redis max retry attempts reached');
                        return false;
                    }
                    return Math.min(retries * 100, 3000);
                }
            },
            password: process.env.REDIS_PASSWORD || undefined
        });

        this.redisClient.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.redisClient.on('connect', () => {
            console.log('Redis Client Connected');
        });

        // Подключаемся к Redis
        this.redisClient.connect().catch(err => {
            console.error('Failed to connect to Redis:', err);
        });
    }

    // Генерация challenge для биометрической аутентификации
    async generateChallenge(email, action = 'verify') {
        try {
            const userService = require('./user-service');
            const user = await userService.getUserByEmail(email);
            if (!user) {
                throw ApiError.badRequest('Пользователь не найден');
            }

            // Получаем зарегистрированные биометрические данные пользователя
            const credentials = await BiometricCredential.findAll({
                where: { userId: user.id, isActive: true }
            });

            // Генерируем случайный challenge
            const challenge = crypto.randomBytes(32);
            const challengeId = crypto.randomUUID();
            
            // Сохраняем challenge в Redis на 5 минут
            const challengeData = {
                challenge: challenge.toString('base64'),
                email: email,
                action: action,
                timestamp: Date.now()
            };
            
            await this.redisClient.setEx(`challenge:${challengeId}`, 300, JSON.stringify(challengeData));
            
            // Логируем попытку получения challenge
            await this.logBiometricAction(email, user.id, 'challenge', true, null, null);

            return {
                challengeId,
                challenge: Array.from(challenge),
                allowCredentials: credentials.map(cred => ({
                    id: cred.credentialId,
                    type: 'public-key',
                    transports: ['internal', 'hybrid']
                }))
            };
        } catch (error) {
            console.error('Error generating challenge:', error);
            throw error;
        }
    }

    // Получение и валидация challenge
    async getAndValidateChallenge(challengeId) {
        try {
            const challengeData = await this.redisClient.get(`challenge:${challengeId}`);
            if (!challengeData) {
                throw ApiError.badRequest('Challenge не найден или истек');
            }

            const parsed = JSON.parse(challengeData);
            
            // Проверяем, что challenge не старше 5 минут
            if (Date.now() - parsed.timestamp > 300000) {
                await this.redisClient.del(`challenge:${challengeId}`);
                throw ApiError.badRequest('Challenge истек');
            }

            return parsed;
        } catch (error) {
            console.error('Error validating challenge:', error);
            throw error;
        }
    }

    // Полная верификация биометрической аутентификации
    async verifyBiometricAuth(email, credential, challengeId, req) {
        try {
            const userService = require('./user-service');
            const user = await userService.getUserByEmail(email);
            if (!user) {
                throw ApiError.badRequest('Пользователь не найден');
            }

            // Проверяем, что пользователь активирован
            if (!user.isActivated) {
                throw ApiError.badRequest('Аккаунт не активирован. Проверьте почту и перейдите по ссылке активации.');
            }

            // Получаем и валидируем challenge
            const challengeData = await this.getAndValidateChallenge(challengeId);
            
            // Находим биометрические данные
            const biometricCred = await BiometricCredential.findOne({
                where: { credentialId: credential.id, userId: user.id, isActive: true }
            });

            if (!biometricCred) {
                await this.logBiometricAction(email, user.id, 'verify', false, 'Credential not found', credential.id, req);
                throw ApiError.badRequest('Биометрические данные не найдены или неактивны');
            }

            // Проверяем clientDataJSON
            const clientDataJSON = Buffer.from(credential.response.clientDataJSON, 'base64');
            const clientData = JSON.parse(clientDataJSON.toString());
            
            // Проверяем challenge
            const expectedChallenge = Buffer.from(challengeData.challenge, 'base64');
            const receivedChallenge = Buffer.from(clientData.challenge, 'base64');
            
            if (!expectedChallenge.equals(receivedChallenge)) {
                await this.logBiometricAction(email, user.id, 'verify', false, 'Invalid challenge', credential.id, req);
                throw ApiError.badRequest('Неверный challenge');
            }

            // Проверяем origin
            const expectedOrigins = [
                process.env.CLIENT_URL || 'http://localhost:4200',
                'http://62.76.90.163:63420',
                'https://62.76.90.163:63420'
            ];
            
            if (!expectedOrigins.includes(clientData.origin)) {
                await this.logBiometricAction(email, user.id, 'verify', false, `Invalid origin: ${clientData.origin}`, credential.id, req);
                throw ApiError.badRequest(`Неверный origin: ${clientData.origin}. Ожидался один из: ${expectedOrigins.join(', ')}`);
            }

            // Проверяем type
            if (clientData.type !== 'webauthn.get') {
                await this.logBiometricAction(email, user.id, 'verify', false, 'Invalid type', credential.id, req);
                throw ApiError.badRequest('Неверный тип операции');
            }

            // Проверяем authenticatorData
            const authenticatorData = Buffer.from(credential.response.authenticatorData, 'base64');
            
            // Проверяем flags (bit 0 должен быть установлен для user presence)
            const flags = authenticatorData[32];
            if (!(flags & 0x01)) {
                await this.logBiometricAction(email, user.id, 'verify', false, 'User presence not verified', credential.id, req);
                throw ApiError.badRequest('Пользователь не подтвердил присутствие');
            }

            // Проверяем counter (должен быть больше предыдущего)
            const counter = authenticatorData.readUInt32BE(33);
            if (counter <= biometricCred.counter) {
                await this.logBiometricAction(email, user.id, 'verify', false, 'Invalid counter', credential.id, req);
                throw ApiError.badRequest('Неверный счетчик');
            }

            // Проверяем подпись
            const signature = Buffer.from(credential.response.signature, 'base64');
            const publicKey = await this.getPublicKeyFromAttestation(biometricCred.publicKey);
            
            const verificationData = Buffer.concat([
                authenticatorData,
                crypto.createHash('sha256').update(clientDataJSON).digest()
            ]);

            const isValid = crypto.createVerify('SHA256')
                .update(verificationData)
                .verify(publicKey, signature);

            if (!isValid) {
                await this.logBiometricAction(email, user.id, 'verify', false, 'Invalid signature', credential.id, req);
                throw ApiError.badRequest('Неверная подпись');
            }

            // Обновляем счетчик использования
            biometricCred.counter = counter;
            await biometricCred.save({ fields: ['counter'] });

            // Удаляем использованный challenge
            await this.redisClient.del(`challenge:${challengeId}`);

            // Логируем успешную верификацию
            await this.logBiometricAction(email, user.id, 'verify', true, null, credential.id, req);

            return {
                success: true,
                user: user
            };

        } catch (error) {
            console.error('Error verifying biometric auth:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw ApiError.internal('Ошибка верификации биометрических данных');
        }
    }

    // Регистрация биометрических данных
    async registerBiometric(email, credential, challengeId, req) {
        try {
            const userService = require('./user-service');
            const user = await userService.getUserByEmail(email);
            if (!user) {
                throw ApiError.badRequest('Пользователь не найден');
            }

            // Получаем и валидируем challenge
            const challengeData = await this.getAndValidateChallenge(challengeId);
            
            // Проверяем, не зарегистрированы ли уже биометрические данные
            const existingCred = await BiometricCredential.findOne({
                where: { credentialId: credential.id }
            });

            if (existingCred) {
                await this.logBiometricAction(email, user.id, 'register', false, 'Credential already exists', credential.id, req);
                throw ApiError.badRequest('Биометрические данные уже зарегистрированы');
            }

            // Проверяем clientDataJSON
            const clientDataJSON = Buffer.from(credential.response.clientDataJSON, 'base64');
            const clientData = JSON.parse(clientDataJSON.toString());
            
            // Проверяем challenge
            const expectedChallenge = Buffer.from(challengeData.challenge, 'base64');
            const receivedChallenge = Buffer.from(clientData.challenge, 'base64');
            
            if (!expectedChallenge.equals(receivedChallenge)) {
                await this.logBiometricAction(email, user.id, 'register', false, 'Invalid challenge', credential.id, req);
                throw ApiError.badRequest('Неверный challenge');
            }

            // Проверяем origin
            const expectedOrigins = [
                process.env.CLIENT_URL || 'http://localhost:4200',
                'http://62.76.90.163:63420',
                'https://62.76.90.163:63420'
            ];
            
            if (!expectedOrigins.includes(clientData.origin)) {
                await this.logBiometricAction(email, user.id, 'register', false, `Invalid origin: ${clientData.origin}`, credential.id, req);
                throw ApiError.badRequest(`Неверный origin: ${clientData.origin}. Ожидался один из: ${expectedOrigins.join(', ')}`);
            }

            // Проверяем type
            if (clientData.type !== 'webauthn.create') {
                await this.logBiometricAction(email, user.id, 'register', false, 'Invalid type', credential.id, req);
                throw ApiError.badRequest('Неверный тип операции');
            }

            // Определяем тип устройства
            let deviceType = 'fingerprint';
            if (credential.response.attestationObject) {
                deviceType = 'fingerprint'; // Touch ID / Face ID
            }

            // Сохраняем биометрические данные
            await BiometricCredential.create({
                userId: user.id,
                credentialId: credential.id,
                publicKey: credential.response.attestationObject || JSON.stringify(credential.response.publicKey),
                deviceType: deviceType,
                userAgent: req.get('User-Agent') || 'unknown',
                isActive: true
            });

            // Удаляем использованный challenge
            await this.redisClient.del(`challenge:${challengeId}`);

            // Логируем успешную регистрацию
            await this.logBiometricAction(email, user.id, 'register', true, null, credential.id, req);

            return {
                success: true,
                message: 'Биометрические данные успешно зарегистрированы'
            };

        } catch (error) {
            console.error('Error registering biometric:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw ApiError.internal('Ошибка регистрации биометрических данных');
        }
    }

    // Проверка статуса биометрических данных
    async checkBiometricStatus(email) {
        try {
            const userService = require('./user-service');
            const user = await userService.getUserByEmail(email);
            if (!user) {
                throw ApiError.badRequest('Пользователь не найден');
            }

            const biometricCreds = await BiometricCredential.findAll({
                where: { userId: user.id, isActive: true }
            });

            return {
                hasBiometric: biometricCreds.length > 0,
                credentialsCount: biometricCreds.length,
                deviceTypes: biometricCreds.map(cred => cred.deviceType)
            };
        } catch (error) {
            console.error('Error checking biometric status:', error);
            throw error;
        }
    }

    // Логирование биометрических действий
    async logBiometricAction(email, userId, action, success, errorMessage, credentialId, req) {
        try {
            await BiometricAuditLog.create({
                email: email,
                userId: userId,
                ip: req ? req.ip || req.connection.remoteAddress : 'unknown',
                userAgent: req ? req.get('User-Agent') : 'unknown',
                action: action,
                success: success,
                errorMessage: errorMessage,
                credentialId: credentialId
            });
        } catch (error) {
            console.error('Error logging biometric action:', error);
        }
    }

    // Получение публичного ключа из attestation object
    async getPublicKeyFromAttestation(attestationObject) {
        try {
            // Это упрощенная версия - в реальном приложении нужно парсить CBOR
            // Для демонстрации возвращаем mock ключ
            const mockPublicKey = crypto.createPublicKey({
                key: Buffer.from(attestationObject, 'base64'),
                format: 'der',
                type: 'spki'
            });
            return mockPublicKey;
        } catch (error) {
            // Если не удалось распарсить, создаем mock ключ для тестирования
            console.warn('Could not parse attestation object, using mock key for testing');
            return crypto.createPublicKey({
                key: Buffer.from('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...', 'base64'),
                format: 'der',
                type: 'spki'
            });
        }
    }

    // Проверка rate limit для биометрических попыток
    async checkRateLimit(email, ip) {
        try {
            const key = `biometric_rate_limit:${email}:${ip}`;
            const attempts = await this.redisClient.get(key);
            
            if (attempts && parseInt(attempts) >= 5) {
                throw ApiError.badRequest('Слишком много попыток биометрической аутентификации. Попробуйте позже.');
            }
            
            // Увеличиваем счетчик попыток
            await this.redisClient.incr(key);
            await this.redisClient.expire(key, 900); // 15 минут
            
            return true;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            console.error('Error checking rate limit:', error);
            return true; // В случае ошибки Redis разрешаем попытку
        }
    }

    // Сброс rate limit (для успешных попыток)
    async resetRateLimit(email, ip) {
        try {
            const key = `biometric_rate_limit:${email}:${ip}`;
            await this.redisClient.del(key);
        } catch (error) {
            console.error('Error resetting rate limit:', error);
        }
    }
}

module.exports = new BiometricService();
