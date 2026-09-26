// ========================================================================
// Configuration Repository
// ZERO hardcoded business rules - dynamic settings and feature flags
// ========================================================================

import { getMemoryDbClient } from '../db/client.js';
import {
  PlatformSetting,
  PlatformFeature,
  SchoolFeature,
  SchoolSetting,
} from '../types/index.js';

export class ConfigRepository {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // Platform Settings & Features (SaaS Level)
  // ----------------------------------------------------------------------
  async getPlatformSettings(): Promise<PlatformSetting[]> {
    return this.mem.findAll('platform_settings');
  }

  async getPlatformSetting(key: string): Promise<PlatformSetting | null> {
    const list = this.mem.findAll('platform_settings', (row: PlatformSetting) => row.key === key);
    return list[0] || null;
  }

  async setPlatformSetting(key: string, value: string): Promise<PlatformSetting> {
    const existing = await this.getPlatformSetting(key);
    if (existing) {
      return this.mem.update('platform_settings', existing.id, { value }) as PlatformSetting;
    }
    return this.mem.insert('platform_settings', {
      key,
      value,
      data_type: 'STRING',
      is_public: false,
    }) as PlatformSetting;
  }

  async getPlatformFeatures(): Promise<PlatformFeature[]> {
    return this.mem.findAll('platform_features');
  }

  // ----------------------------------------------------------------------
  // School Features (Module Toggles per Tenant)
  // ----------------------------------------------------------------------
  async getSchoolFeatures(schoolId: string): Promise<SchoolFeature[]> {
    return this.mem.findAll('school_features', (row: SchoolFeature) => row.school_id === schoolId);
  }

  async getSchoolFeature(schoolId: string, featureKey: string): Promise<SchoolFeature | null> {
    const list = this.mem.findAll(
      'school_features',
      (row: SchoolFeature) => row.school_id === schoolId && row.feature_key === featureKey
    );
    return list[0] || null;
  }

  async setSchoolFeature(
    schoolId: string,
    featureKey: string,
    isEnabled: boolean,
    configuration: Record<string, any> = {}
  ): Promise<SchoolFeature> {
    const existing = await this.getSchoolFeature(schoolId, featureKey);
    if (existing) {
      return this.mem.update('school_features', existing.id, {
        is_enabled: isEnabled,
        configuration,
      }) as SchoolFeature;
    }
    return this.mem.insert('school_features', {
      school_id: schoolId,
      feature_key: featureKey,
      is_enabled: isEnabled,
      configuration,
    }) as SchoolFeature;
  }

  // ----------------------------------------------------------------------
  // School Settings (Configurable Structured Settings)
  // ----------------------------------------------------------------------
  async getSchoolSettings(schoolId: string): Promise<SchoolSetting[]> {
    return this.mem.findAll('school_settings', (row: SchoolSetting) => row.school_id === schoolId);
  }

  async getSchoolSetting(schoolId: string, settingKey: string): Promise<SchoolSetting | null> {
    const list = this.mem.findAll(
      'school_settings',
      (row: SchoolSetting) => row.school_id === schoolId && row.setting_key === settingKey
    );
    return list[0] || null;
  }

  async setSchoolSetting(
    schoolId: string,
    settingKey: string,
    settingValue: string,
    category = 'GENERAL',
    dataType: 'STRING' | 'BOOLEAN' | 'NUMBER' | 'JSON' = 'STRING'
  ): Promise<SchoolSetting> {
    const existing = await this.getSchoolSetting(schoolId, settingKey);
    if (existing) {
      return this.mem.update('school_settings', existing.id, {
        setting_value: settingValue,
        category,
        data_type: dataType,
      }) as SchoolSetting;
    }
    return this.mem.insert('school_settings', {
      school_id: schoolId,
      setting_key: settingKey,
      setting_value: settingValue,
      category,
      data_type: dataType,
    }) as SchoolSetting;
  }
}

export const configRepository = new ConfigRepository();
