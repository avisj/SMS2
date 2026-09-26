// ========================================================================
// Supabase Data Synchronizer
// Upserts all seed data into live Supabase tables via Service Role API
// ========================================================================

import { getSupabaseClient, getMemoryDbClient } from './client.js';
import { seedInMemoryDatabase } from './seed.js';

export async function syncToSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    return;
  }

  console.log('\x1b[36m[Supabase Sync]\x1b[0m Seeding memory database to extract master templates...');
  seedInMemoryDatabase();
  const mem = getMemoryDbClient();

  const tablesToSync = [
    'data_scopes',
    'user_types',
    'permissions',
    'roles',
    'role_rights',
    'schools',
    'locations',
    'users',
    'user_roles',
    'user_location_access',
    'user_credentials',
    'academic_sessions',
    'classes',
    'sections',
    'academic_class_sections',
    'student_academic_enrollments',
    'subjects',
    'subject_groups',
    'subject_group_items',
    'academic_class_subjects',
    'teacher_subject_assignments',
    'student_profiles',
    'staff_profiles',
    'timetable_master',
    'timetable_details',
    'attendance_status_master',
    'user_attendance',
  ];

  for (const tableName of tablesToSync) {
    const records = mem.findAll(tableName);
    if (!records || records.length === 0) continue;

    console.log(`\x1b[33m[Supabase Sync]\x1b[0m Upserting ${records.length} records into ${tableName}...`);
    try {
      // Chunk into batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from(tableName).upsert(batch, { onConflict: 'id' });
        if (error) {
          console.warn(`  Warning on ${tableName}: ${error.message} (code: ${error.code})`);
        }
      }
      console.log(`\x1b[32m[Supabase Sync]\x1b[0m Done: ${tableName}`);
    } catch (err: any) {
      console.error(`  Error syncing ${tableName}:`, err.message);
    }
  }

  console.log('\x1b[32m[Supabase Sync]\x1b[0m Full database sync complete!');
}

syncToSupabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
