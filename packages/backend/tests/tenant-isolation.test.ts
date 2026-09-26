// ========================================================================
// Tenant Isolation Automated Verification Test
// Enforces that School A can NEVER access School B's data
// ========================================================================

import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/app.js';
import { authService } from '../src/services/auth.service.js';

describe('Strict Tenant Isolation Verification', () => {
  let app: any;
  let schoolAToken: string;
  let schoolBToken: string;
  let superAdminToken: string;

  before(async () => {
    app = createApp();

    // Login School A Director (Rajesh Sharma)
    const loginA = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    schoolAToken = loginA.token;

    // Login School B Director (Anita Desai)
    const loginB = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    schoolBToken = loginB.token;

    // Login Super Admin for School A
    const loginSuper = await authService.login('DPA-DEL-001', 'superadmin', 'password123');
    superAdminToken = loginSuper.token;
  });

  test('School A user can list only School A locations and not School B', async () => {
    const resA = await fetch('http://localhost:4000/api/v1/locations', {
      headers: { Authorization: `Bearer ${schoolAToken}` },
    }).catch(() => null);

    // If server is not listening on port yet, test via service layer or app request directly
    const userAContext = await authService.login('DPA-DEL-001', 'rajesh.sharma', 'password123');
    const { tenantService } = await import('../src/services/tenant.service.js');
    
    // School A Director gets School A's 2 branches
    const locsA = await tenantService.listLocations(userAContext.context.school_id!, userAContext.context);
    assert.strictEqual(locsA.length, 2, 'School A Director should see 2 branches for School A');
    assert.ok(locsA.every(l => l.school_id === userAContext.context.school_id));

    // School A Director attempting to list School B locations must be REJECTED
    const schoolBId = 'b0000000-0000-0000-0000-000000000001';
    await assert.rejects(
      async () => {
        await tenantService.listLocations(schoolBId, userAContext.context);
      },
      /Unauthorized cross-tenant location query/,
      'Cross-tenant location query must be strictly rejected'
    );
  });

  test('School B user attempting to access School A user record must be REJECTED', async () => {
    const userBContext = await authService.login('GWI-MUM-001', 'anita.desai', 'password123');
    const { userService } = await import('../src/services/user.service.js');
    
    const schoolAUserId = 'a2000000-0000-0000-0000-000000000001';
    await assert.rejects(
      async () => {
        await userService.getUserById(schoolAUserId, userBContext.context);
      },
      /Unauthorized cross-tenant access/,
      'Cross-tenant user access must be strictly rejected'
    );
  });

  test('School Super Admin is bounded to their school and cannot access another school', async () => {
    const superAContext = await authService.login('DPA-DEL-001', 'superadmin', 'password123');
    const { tenantService } = await import('../src/services/tenant.service.js');

    // School A Super Admin can list their school
    const schools = await tenantService.listSchools(superAContext.context);
    assert.strictEqual(schools.length, 1, 'School A Super Admin sees only School A');
    assert.strictEqual(schools[0].id, superAContext.context.school_id);

    // School A Super Admin cannot access School B locations
    const schoolBId = 'b0000000-0000-0000-0000-000000000001';
    await assert.rejects(
      async () => {
        await tenantService.listLocations(schoolBId, superAContext.context);
      },
      /Unauthorized cross-tenant location query/,
      'School A Super Admin cannot access School B locations'
    );
  });
});
