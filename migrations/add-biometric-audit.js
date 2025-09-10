const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Подключение к базе данных
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'auto_admin',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  logging: false
});

// Создание таблицы аудита биометрии
async function createBiometricAuditTable() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "biometricAuditLogs" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR(255) NOT NULL,
        "userId" INTEGER,
        "ip" VARCHAR(255) NOT NULL,
        "userAgent" TEXT,
        "action" VARCHAR(255) NOT NULL,
        "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "success" BOOLEAN NOT NULL,
        "errorMessage" TEXT,
        "credentialId" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Создание индексов для оптимизации
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_biometric_audit_email" ON "biometricAuditLogs" ("email");
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_biometric_audit_timestamp" ON "biometricAuditLogs" ("timestamp");
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "idx_biometric_audit_success" ON "biometricAuditLogs" ("success");
    `);

    console.log('✅ Таблица biometricAuditLogs создана успешно');
  } catch (error) {
    console.error('❌ Ошибка создания таблицы biometricAuditLogs:', error);
    throw error;
  }
}

// Удаление старого поля biometricChallenge из таблицы users
async function removeOldBiometricChallengeField() {
  try {
    // Проверяем, существует ли поле
    const result = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'biometricChallenge';
    `);

    if (result[0].length > 0) {
      await sequelize.query(`
        ALTER TABLE "users" DROP COLUMN IF EXISTS "biometricChallenge";
      `);
      console.log('✅ Поле biometricChallenge удалено из таблицы users');
    } else {
      console.log('ℹ️ Поле biometricChallenge не найдено в таблице users');
    }
  } catch (error) {
    console.error('❌ Ошибка удаления поля biometricChallenge:', error);
    throw error;
  }
}

// Основная функция миграции
async function runMigration() {
  try {
    console.log('🚀 Начинаем миграцию биометрической аутентификации...');
    
    // Проверяем подключение к базе данных
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено');

    // Создаем таблицу аудита
    await createBiometricAuditTable();

    // Удаляем старое поле
    await removeOldBiometricChallengeField();

    console.log('🎉 Миграция завершена успешно!');
    console.log('');
    console.log('📋 Что было сделано:');
    console.log('  ✅ Создана таблица biometricAuditLogs для аудита');
    console.log('  ✅ Добавлены индексы для оптимизации запросов');
    console.log('  ✅ Удалено устаревшее поле biometricChallenge');
    console.log('');
    console.log('🔧 Следующие шаги:');
    console.log('  1. Установите Redis: sudo apt install redis-server');
    console.log('  2. Запустите Redis: sudo systemctl start redis-server');
    console.log('  3. Перезапустите сервер приложения');
    console.log('  4. Протестируйте биометрическую аутентификацию');

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Запуск миграции
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };

