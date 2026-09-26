// ========================================================================
// Audit Logging Automated Verification Test
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';
import { auditService } from '../src/services/audit.service.js';
import { configService } from '../src/services/config.service.js';

describe('Audit Logging Verification', () => {
  let directorContext: any;

  before(async () => {
    createApp();
    const login = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    directorContext = login.context;
  });

  test('Mutations automatically log action, actor, and values to audit logs', async () => {
    // Perform a configuration mutation
    await configService.updateSchoolSetting(
      directorContext.school_id,
      'attendance_cutoff_time',
      '09:00',
      'OPERATIONS',
      'STRING',
      directorContext
    );

    // Fetch audit logs
    const result = await auditService.listAuditLogs({ module: 'CONFIG' }, directorContext);
    assert.ok(result.total > 0);

    const logEntry = result.logs.find(l => l.record_id === 'attendance_cutoff_time');
    assert.ok(logEntry, 'Audit log entry for setting change must exist');
    assert.strictEqual(logEntry.action, 'UPDATE_SETTING');
    assert.strictEqual(logEntry.user_id, directorContext.user_id);
    assert.strictEqual(logEntry.new_values?.value, '09:00');
  });
});
