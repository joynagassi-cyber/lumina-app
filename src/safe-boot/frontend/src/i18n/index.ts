/**
 * i18next initialization skeleton.
 * ITS-V1: Multi-language support with locale detection.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'en',
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  resources: {
    fr: {},
    en: {},
  },
});

export default i18n;
