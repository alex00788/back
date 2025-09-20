/**
 * Централизованная конфигурация доменов и названий проекта для серверной части
 * При изменении домена измените только этот файл
 */

const DOMAIN_CONFIG = {
  /** Основной домен в кириллице */
  mainDomain: 'записькпрофи.рф',
  /** IDN версия домена (Punycode) */
  idnDomain: 'xn--80aneajyecjh1b5f.xn--p1ai',
  /** Название проекта */
  projectName: 'ЗаписьКпрофи.рф',
  /** Полный URL с протоколом */
  fullUrl: 'https://записькпрофи.рф',
  /** IDN URL с протоколом */
  idnUrl: 'https://xn--80aneajyecjh1b5f.xn--p1ai'
};

/**
 * Получить конфигурацию домена
 */
function getDomainConfig() {
  return DOMAIN_CONFIG;
}

/**
 * Получить название проекта
 */
function getProjectName() {
  return DOMAIN_CONFIG.projectName;
}

/**
 * Получить основной URL (с учетом переменной окружения FRONTEND_URL)
 */
function getMainUrl() {
  return process.env.FRONTEND_URL || DOMAIN_CONFIG.fullUrl;
}

/**
 * Получить IDN URL
 */
function getIdnUrl() {
  return DOMAIN_CONFIG.idnUrl;
}

/**
 * Получить домен для проверок hostname
 */
function getMainDomain() {
  return DOMAIN_CONFIG.mainDomain;
}

/**
 * Получить IDN домен для проверок hostname
 */
function getIdnDomain() {
  return DOMAIN_CONFIG.idnDomain;
}

module.exports = {
  getDomainConfig,
  getProjectName,
  getMainUrl,
  getIdnUrl,
  getMainDomain,
  getIdnDomain,
  DOMAIN_CONFIG
};
