// ========================================================================
// Configuration Service
// School Settings, School Features, Platform Settings, Platform Features
// ZERO hardcoded configuration
// ========================================================================

import { configRepository } from '../repositories/config.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { schoolRepository } from '../repositories/school.repository.js';
import { UserContext, SchoolFeature, SchoolSetting, School } from '../types/index.js';

export class ConfigService {
  // ----------------------------------------------------------------------
  // School Features (Dynamic Feature Toggles & Module Config)
  // ----------------------------------------------------------------------
  async getSchoolFeatures(schoolId: string, userContext: UserContext): Promise<SchoolFeature[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant features query');
    }
    return configRepository.getSchoolFeatures(schoolId);
  }

  async updateSchoolFeature(
    schoolId: string,
    featureKey: string,
    isEnabled: boolean,
    configuration: Record<string, any> = {},
    userContext: UserContext
  ): Promise<SchoolFeature> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant feature configuration update');
    }

    const oldFeature = await configRepository.getSchoolFeature(schoolId, featureKey);
    const updated = await configRepository.setSchoolFeature(schoolId, featureKey, isEnabled, configuration);

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'UPDATE_FEATURE',
      module: 'CONFIG',
      entity_name: 'school_feature',
      record_id: featureKey,
      old_values: oldFeature ? { is_enabled: oldFeature.is_enabled, config: oldFeature.configuration } : null,
      new_values: { is_enabled: isEnabled, config: configuration },
    });

    return updated;
  }

  // ----------------------------------------------------------------------
  // School Settings (Structured Dynamic Configurations)
  // ----------------------------------------------------------------------
  async getSchoolSettings(schoolId: string, userContext: UserContext): Promise<SchoolSetting[]> {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant settings query');
    }
    return configRepository.getSchoolSettings(schoolId);
  }

  async updateSchoolSetting(
    schoolId: string,
    settingKey: string,
    settingValue: string,
    category?: string,
    dataType?: 'STRING' | 'BOOLEAN' | 'NUMBER' | 'JSON',
    userContext?: UserContext
  ): Promise<SchoolSetting> {
    if (userContext && !userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant setting update');
    }

    if (settingKey === 'brand_color') {
      const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
      if (!hexRegex.test(settingValue.trim())) {
        throw new Error('Invalid Brand Color format. Must be a valid HEX color code (e.g. #0D9488 or #2563EB).');
      }
      settingValue = settingValue.trim().toUpperCase();
    }

    const oldSetting = await configRepository.getSchoolSetting(schoolId, settingKey);
    const updated = await configRepository.setSchoolSetting(schoolId, settingKey, settingValue, category, dataType);

    if (userContext) {
      await auditRepository.log({
        school_id: schoolId,
        user_id: userContext.user_id,
        action: 'UPDATE_SETTING',
        module: 'CONFIG',
        entity_name: 'school_setting',
        record_id: settingKey,
        old_values: oldSetting ? { value: oldSetting.setting_value } : null,
        new_values: { value: settingValue },
      });
    }

    return updated;
  }

  // ----------------------------------------------------------------------
  // Platform Level Master Catalog
  // ----------------------------------------------------------------------
  async getPlatformFeatures() {
    return configRepository.getPlatformFeatures();
  }

  async getPlatformSettings() {
    return configRepository.getPlatformSettings();
  }

  // ----------------------------------------------------------------------
  // School General & Localization Settings
  // ----------------------------------------------------------------------
  async getLocalizationSettings(schoolId: string, userContext: UserContext) {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant localization settings query');
    }
    const school = await schoolRepository.findById(schoolId);
    if (!school) throw new Error('School not found');

    return {
      currency: school.currency || 'INR',
      currency_symbol: school.currency_symbol || (school.currency === 'USD' ? '$' : '₹'),
      currency_position: school.currency_position || 'BEFORE',
      decimal_places: school.decimal_places ?? 2,
      date_format: school.date_format || 'DD/MM/YYYY',
      time_format: school.time_format || '12h',
      timezone: school.timezone || 'Asia/Kolkata',
      locale: school.locale || (school.currency === 'USD' ? 'en-US' : 'en-IN'),
      country: school.country || 'India',
    };
  }

  async updateLocalizationSettings(
    schoolId: string,
    data: {
      currency?: string;
      currency_symbol?: string;
      currency_position?: 'BEFORE' | 'AFTER';
      decimal_places?: number;
      date_format?: string;
      time_format?: string;
      timezone?: string;
      locale?: string;
    },
    userContext: UserContext
  ) {
    if (!userContext.is_super_admin && userContext.school_id !== schoolId) {
      throw new Error('Unauthorized cross-tenant localization settings update');
    }
    const oldSchool = await schoolRepository.findById(schoolId);
    if (!oldSchool) throw new Error('School not found');

    const updates: Partial<School> = {};
    if (data.currency) updates.currency = data.currency.trim().toUpperCase();
    if (data.currency_symbol) updates.currency_symbol = data.currency_symbol.trim();
    if (data.currency_position) updates.currency_position = data.currency_position;
    if (typeof data.decimal_places === 'number') updates.decimal_places = data.decimal_places;
    if (data.date_format) updates.date_format = data.date_format.trim();
    if (data.time_format) updates.time_format = data.time_format.trim();
    if (data.timezone) updates.timezone = data.timezone.trim();
    if (data.locale) updates.locale = data.locale.trim();

    const updated = await schoolRepository.update(schoolId, updates);

    // Also sync structured keys into school_settings table
    if (updates.currency) await this.updateSchoolSetting(schoolId, 'currency_code', updates.currency, 'GENERAL', 'STRING');
    if (updates.currency_symbol) await this.updateSchoolSetting(schoolId, 'currency_symbol', updates.currency_symbol, 'GENERAL', 'STRING');
    if (updates.currency_position) await this.updateSchoolSetting(schoolId, 'currency_position', updates.currency_position, 'GENERAL', 'STRING');
    if (typeof updates.decimal_places === 'number') await this.updateSchoolSetting(schoolId, 'decimal_places', String(updates.decimal_places), 'GENERAL', 'NUMBER');
    if (updates.date_format) await this.updateSchoolSetting(schoolId, 'date_format', updates.date_format, 'GENERAL', 'STRING');
    if (updates.time_format) await this.updateSchoolSetting(schoolId, 'time_format', updates.time_format, 'GENERAL', 'STRING');
    if (updates.timezone) await this.updateSchoolSetting(schoolId, 'timezone', updates.timezone, 'GENERAL', 'STRING');
    if (updates.locale) await this.updateSchoolSetting(schoolId, 'locale', updates.locale, 'GENERAL', 'STRING');

    await auditRepository.log({
      school_id: schoolId,
      user_id: userContext.user_id,
      action: 'UPDATE_LOCALIZATION',
      module: 'CONFIG',
      entity_name: 'school_localization',
      record_id: schoolId,
      old_values: {
        currency: oldSchool.currency,
        currency_symbol: oldSchool.currency_symbol,
        currency_position: oldSchool.currency_position,
        decimal_places: oldSchool.decimal_places,
        timezone: oldSchool.timezone,
      },
      new_values: updates,
    });

    return {
      currency: updated?.currency || updates.currency || 'INR',
      currency_symbol: updated?.currency_symbol || updates.currency_symbol || '₹',
      currency_position: updated?.currency_position || updates.currency_position || 'BEFORE',
      decimal_places: updated?.decimal_places ?? updates.decimal_places ?? 2,
      date_format: updated?.date_format || updates.date_format || 'DD/MM/YYYY',
      time_format: updated?.time_format || updates.time_format || '12h',
      timezone: updated?.timezone || updates.timezone || 'Asia/Kolkata',
      locale: updated?.locale || updates.locale || 'en-IN',
    };
  }
}

export const configService = new ConfigService();
