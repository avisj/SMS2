// ========================================================================
// Timetable Repository
// Data Access for Timetable Master & Versioned Timetable Details
// Authoritative Student Timetable Storage with In-Memory Support
// ========================================================================

import { getMemoryDbClient, getCloudDatabaseClient, ICloudDatabaseClient } from '../db/client.js';
import {
  TimetableMaster,
  TimetableDetail,
  AcademicSession,
  Location,
  ClassItem,
  SectionItem,
  SubjectItem,
  User,
} from '../types/index.js';

export class TimetableRepository {
  private mem = getMemoryDbClient();

  private get pg(): ICloudDatabaseClient | null {
    return getCloudDatabaseClient();
  }

  // ----------------------------------------------------------------------
  // 1. Timetable Master (Version Headers)
  // ----------------------------------------------------------------------

  async findMasterById(id: string, schoolId?: string): Promise<TimetableMaster | null> {
    if (this.pg) {
      let sql = 'SELECT * FROM timetable_master WHERE id = $1 AND deleted_at IS NULL';
      const params: any[] = [id];
      if (schoolId) {
        params.push(schoolId);
        sql += ' AND school_id = $2';
      }
      const item = await this.pg.queryOne<TimetableMaster>(sql, params);
      if (!item) return null;
      return this.enrichMaster(item);
    }
    const item = this.mem.findById('timetable_master', id) as TimetableMaster | null;
    if (!item || item.deleted_at) return null;
    if (schoolId && item.school_id !== schoolId) return null;
    return this.enrichMaster(item);
  }

  async findMasterByTimetableId(timetableId: string, schoolId?: string): Promise<TimetableMaster | null> {
    if (this.pg) {
      let sql = 'SELECT * FROM timetable_master WHERE timetable_id = $1 AND deleted_at IS NULL';
      const params: any[] = [timetableId];
      if (schoolId) {
        params.push(schoolId);
        sql += ' AND school_id = $2';
      }
      const item = await this.pg.queryOne<TimetableMaster>(sql, params);
      if (!item) return null;
      return this.enrichMaster(item);
    }
    const list = this.mem.findAll('timetable_master', (row: TimetableMaster) => {
      if (row.deleted_at) return false;
      if (schoolId && row.school_id !== schoolId) return false;
      return row.timetable_id === timetableId;
    }) as TimetableMaster[];

    if (!list.length) return null;
    return this.enrichMaster(list[0]);
  }

  async findActiveMaster(schoolId: string, sessionId: string, locationId: string): Promise<TimetableMaster | null> {
    if (this.pg) {
      const sql = `
        SELECT * FROM timetable_master 
        WHERE school_id = $1 AND academic_session_id = $2 AND location_id = $3 AND status = 'ACTIVE' AND deleted_at IS NULL 
        ORDER BY version_no DESC LIMIT 1
      `;
      const item = await this.pg.queryOne<TimetableMaster>(sql, [schoolId, sessionId, locationId]);
      if (!item) return null;
      return this.enrichMaster(item);
    }
    const list = this.mem.findAll('timetable_master', (row: TimetableMaster) => {
      if (row.deleted_at) return false;
      return (
        row.school_id === schoolId &&
        row.academic_session_id === sessionId &&
        row.location_id === locationId &&
        row.status === 'ACTIVE'
      );
    }) as TimetableMaster[];

    if (!list.length) return null;
    // Return latest active if multiple
    list.sort((a, b) => b.version_no - a.version_no);
    return this.enrichMaster(list[0]);
  }

  async findLatestMaster(schoolId: string, sessionId: string, locationId: string): Promise<TimetableMaster | null> {
    if (this.pg) {
      const sql = `
        SELECT * FROM timetable_master 
        WHERE school_id = $1 AND academic_session_id = $2 AND location_id = $3 AND deleted_at IS NULL 
        ORDER BY version_no DESC LIMIT 1
      `;
      const item = await this.pg.queryOne<TimetableMaster>(sql, [schoolId, sessionId, locationId]);
      if (!item) return null;
      return this.enrichMaster(item);
    }
    const list = this.mem.findAll('timetable_master', (row: TimetableMaster) => {
      if (row.deleted_at) return false;
      return (
        row.school_id === schoolId &&
        row.academic_session_id === sessionId &&
        row.location_id === locationId
      );
    }) as TimetableMaster[];

    if (!list.length) return null;
    list.sort((a, b) => b.version_no - a.version_no);
    return this.enrichMaster(list[0]);
  }

  async listMasterVersions(schoolId: string, sessionId: string, locationId: string): Promise<TimetableMaster[]> {
    if (this.pg) {
      const sql = `
        SELECT * FROM timetable_master 
        WHERE school_id = $1 AND academic_session_id = $2 AND location_id = $3 AND deleted_at IS NULL 
        ORDER BY version_no DESC
      `;
      const res = await this.pg.query<TimetableMaster>(sql, [schoolId, sessionId, locationId]);
      return res.rows.map((m) => this.enrichMaster(m));
    }
    const list = this.mem.findAll('timetable_master', (row: TimetableMaster) => {
      if (row.deleted_at) return false;
      return (
        row.school_id === schoolId &&
        row.academic_session_id === sessionId &&
        row.location_id === locationId
      );
    }) as TimetableMaster[];

    list.sort((a, b) => b.version_no - a.version_no);
    return list.map((m) => this.enrichMaster(m));
  }

  async getNextVersionNo(schoolId: string, sessionId: string, locationId: string): Promise<number> {
    if (this.pg) {
      const sql = `
        SELECT COALESCE(MAX(version_no), 0) + 1 AS next_ver 
        FROM timetable_master 
        WHERE school_id = $1 AND academic_session_id = $2 AND location_id = $3
      `;
      const res = await this.pg.queryOne<{ next_ver: number }>(sql, [schoolId, sessionId, locationId]);
      return Number(res?.next_ver || 1);
    }
    const list = this.mem.findAll('timetable_master', (row: TimetableMaster) => {
      return (
        row.school_id === schoolId &&
        row.academic_session_id === sessionId &&
        row.location_id === locationId
      );
    }) as TimetableMaster[];

    if (!list.length) return 1;
    const maxVersion = Math.max(...list.map((m) => m.version_no || 0));
    return maxVersion + 1;
  }

  async createMaster(master: TimetableMaster): Promise<TimetableMaster> {
    if (master.status === 'ACTIVE') {
      await this.archiveAllActiveVersions(
        master.school_id,
        master.academic_session_id,
        master.location_id,
        master.id
      );
    }
    if (this.pg) {
      const created = await this.pg.insert<TimetableMaster>('timetable_master', master);
      return this.enrichMaster(created);
    }
    const table = this.mem.getTable('timetable_master');
    table.set(master.id, master);
    return this.enrichMaster(master);
  }

  async updateMaster(id: string, updates: Partial<TimetableMaster>): Promise<TimetableMaster> {
    const item = await this.findMasterById(id);
    if (!item) throw new Error(`Timetable master ${id} not found`);

    if (updates.status === 'ACTIVE') {
      await this.archiveAllActiveVersions(
        item.school_id,
        item.academic_session_id,
        item.location_id,
        id
      );
    }

    if (this.pg) {
      const updated = await this.pg.update<TimetableMaster>('timetable_master', id, updates);
      return this.enrichMaster(updated!);
    }

    const updated = {
      ...item,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const table = this.mem.getTable('timetable_master');
    table.set(id, updated);
    return this.enrichMaster(updated);
  }

  async archiveAllActiveVersions(schoolId: string, sessionId: string, locationId: string, exceptId?: string): Promise<void> {
    if (this.pg) {
      let sql = `
        UPDATE timetable_master 
        SET status = 'ARCHIVED', updated_at = NOW() 
        WHERE school_id = $1 AND academic_session_id = $2 AND location_id = $3 AND status = 'ACTIVE'
      `;
      const params: any[] = [schoolId, sessionId, locationId];
      if (exceptId) {
        params.push(exceptId);
        sql += ' AND id <> $4';
      }
      await this.pg.execute(sql, params);
      return;
    }
    const activeList = this.mem.findAll('timetable_master', (row: TimetableMaster) => {
      if (row.deleted_at) return false;
      if (exceptId && row.id === exceptId) return false;
      return (
        row.school_id === schoolId &&
        row.academic_session_id === sessionId &&
        row.location_id === locationId &&
        row.status === 'ACTIVE'
      );
    }) as TimetableMaster[];

    const table = this.mem.getTable('timetable_master');
    const now = new Date().toISOString();
    for (const item of activeList) {
      table.set(item.id, {
        ...item,
        status: 'ARCHIVED',
        updated_at: now,
      });
    }
  }

  // ----------------------------------------------------------------------
  // 2. Timetable Details (Cell Rows)
  // ----------------------------------------------------------------------

  async findDetails(
    masterId: string,
    schoolId: string,
    filters?: {
      classId?: string;
      sectionId?: string;
      teacherId?: string;
      dayOfWeek?: string;
    }
  ): Promise<TimetableDetail[]> {
    if (this.pg) {
      let sql = `
        SELECT 
          d.*,
          c.name AS class_name,
          s.name AS section_name,
          sub.name AS subject_name,
          sub.code AS subject_code,
          TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS teacher_name
        FROM timetable_details d
        LEFT JOIN classes c ON c.id = d.class_id
        LEFT JOIN sections s ON s.id = d.section_id
        LEFT JOIN subjects sub ON sub.id = d.subject_id
        LEFT JOIN users u ON u.id = d.teacher_id
        WHERE d.timetable_master_id = $1 AND d.school_id = $2 AND d.deleted_at IS NULL
      `;
      const params: any[] = [masterId, schoolId];
      if (filters?.classId) {
        params.push(filters.classId);
        sql += ` AND d.class_id = $${params.length}`;
      }
      if (filters?.sectionId) {
        params.push(filters.sectionId);
        sql += ` AND d.section_id = $${params.length}`;
      }
      if (filters?.teacherId) {
        params.push(filters.teacherId);
        sql += ` AND d.teacher_id = $${params.length}`;
      }
      if (filters?.dayOfWeek) {
        params.push(filters.dayOfWeek.toLowerCase());
        sql += ` AND LOWER(d.day_of_week) = $${params.length}`;
      }
      sql += ' ORDER BY period_no ASC';
      const res = await this.pg.query<TimetableDetail>(sql, params);
      return res.rows.map((d) => this.enrichDetail(d));
    }
    const list = this.mem.findAll('timetable_details', (row: TimetableDetail) => {
      if (row.deleted_at) return false;
      if (row.timetable_master_id !== masterId) return false;
      if (row.school_id !== schoolId) return false;

      if (filters?.classId && row.class_id !== filters.classId) return false;
      if (filters?.sectionId && row.section_id !== filters.sectionId) return false;
      if (filters?.teacherId && row.teacher_id !== filters.teacherId) return false;
      if (filters?.dayOfWeek && row.day_of_week.toLowerCase() !== filters.dayOfWeek.toLowerCase()) return false;

      return true;
    }) as TimetableDetail[];

    list.sort((a, b) => a.period_no - b.period_no);
    return list.map((d) => this.enrichDetail(d));
  }

  async createDetails(details: TimetableDetail[]): Promise<TimetableDetail[]> {
    if (this.pg) {
      for (const d of details) {
        await this.pg.insert<TimetableDetail>('timetable_details', d);
      }
      return details.map((d) => this.enrichDetail(d));
    }
    const table = this.mem.getTable('timetable_details');
    for (const d of details) {
      const master = this.mem.findById('timetable_master', d.timetable_master_id) as TimetableMaster | null;
      if (master) {
        if (master.timetable_id !== d.timetable_id) {
          throw new Error(
            `Data Integrity Error: Detail timetable_id (${d.timetable_id}) does not match master timetable_id (${master.timetable_id}).`
          );
        }
        if (master.school_id !== d.school_id) {
          throw new Error(`Data Integrity Error: Detail school_id does not match master school_id.`);
        }
      }
      table.set(d.id, d);
    }
    return details.map((d) => this.enrichDetail(d));
  }

  async deleteDetailsByMaster(masterId: string): Promise<void> {
    if (this.pg) {
      await this.pg.execute('DELETE FROM timetable_details WHERE timetable_master_id = $1', [masterId]);
      return;
    }
    const table = this.mem.getTable('timetable_details');
    for (const [id, row] of table.entries()) {
      if (row.timetable_master_id === masterId) {
        table.delete(id);
      }
    }
  }

  async findClassConflict(
    masterId: string,
    dayOfWeek: string,
    periodNo: number,
    classId: string,
    sectionId: string,
    excludeDetailId?: string
  ): Promise<TimetableDetail | null> {
    if (this.pg) {
      let sql = `
        SELECT * FROM timetable_details 
        WHERE timetable_master_id = $1 AND LOWER(day_of_week) = LOWER($2) AND period_no = $3 AND class_id = $4 AND section_id = $5 AND deleted_at IS NULL
      `;
      const params: any[] = [masterId, dayOfWeek, periodNo, classId, sectionId];
      if (excludeDetailId) {
        params.push(excludeDetailId);
        sql += ' AND id <> $6';
      }
      sql += ' LIMIT 1';
      const row = await this.pg.queryOne<TimetableDetail>(sql, params);
      return row ? this.enrichDetail(row) : null;
    }
    const matches = this.mem.findAll('timetable_details', (row: TimetableDetail) => {
      if (row.deleted_at) return false;
      if (row.timetable_master_id !== masterId) return false;
      if (excludeDetailId && row.id === excludeDetailId) return false;
      return (
        row.day_of_week.toLowerCase() === dayOfWeek.toLowerCase() &&
        row.period_no === periodNo &&
        row.class_id === classId &&
        row.section_id === sectionId
      );
    }) as TimetableDetail[];

    if (!matches.length) return null;
    return this.enrichDetail(matches[0]);
  }

  async findTeacherConflict(
    masterId: string,
    dayOfWeek: string,
    periodNo: number,
    teacherId: string,
    excludeDetailId?: string
  ): Promise<TimetableDetail | null> {
    if (this.pg) {
      let sql = `
        SELECT * FROM timetable_details 
        WHERE timetable_master_id = $1 AND LOWER(day_of_week) = LOWER($2) AND period_no = $3 AND teacher_id = $4 AND deleted_at IS NULL
      `;
      const params: any[] = [masterId, dayOfWeek, periodNo, teacherId];
      if (excludeDetailId) {
        params.push(excludeDetailId);
        sql += ' AND id <> $5';
      }
      sql += ' LIMIT 1';
      const row = await this.pg.queryOne<TimetableDetail>(sql, params);
      return row ? this.enrichDetail(row) : null;
    }
    const matches = this.mem.findAll('timetable_details', (row: TimetableDetail) => {
      if (row.deleted_at) return false;
      if (row.timetable_master_id !== masterId) return false;
      if (excludeDetailId && row.id === excludeDetailId) return false;
      return (
        row.day_of_week.toLowerCase() === dayOfWeek.toLowerCase() &&
        row.period_no === periodNo &&
        row.teacher_id === teacherId
      );
    }) as TimetableDetail[];

    if (!matches.length) return null;
    return this.enrichDetail(matches[0]);
  }

  // ----------------------------------------------------------------------
  // Enrichment Helpers
  // ----------------------------------------------------------------------

  private enrichMaster(master: TimetableMaster): TimetableMaster {
    const session = this.mem.findById('academic_sessions', master.academic_session_id) as AcademicSession | null;
    const location = this.mem.findById('locations', master.location_id) as Location | null;
    const creator = master.created_by ? (this.mem.findById('users', master.created_by) as User | null) : null;

    return {
      ...master,
      session_name: session?.name || master.academic_session_id,
      location_name: location?.location_name || master.location_id,
      created_by_name: creator ? `${creator.first_name} ${creator.last_name || ''}`.trim() : undefined,
    };
  }

  private enrichDetail(detail: TimetableDetail): TimetableDetail {
    const classRow = this.mem.findById('classes', detail.class_id) as ClassItem | null;
    const secRow = this.mem.findById('sections', detail.section_id) as SectionItem | null;
    const subRow = this.mem.findById('subjects', detail.subject_id) as SubjectItem | null;
    const teacherRow = this.mem.findById('users', detail.teacher_id) as User | null;

    return {
      ...detail,
      class_name: detail.class_name || classRow?.name || detail.class_id,
      section_name: detail.section_name || secRow?.name || detail.section_id,
      subject_name: detail.subject_name || subRow?.name || detail.subject_id,
      subject_code: detail.subject_code || subRow?.code,
      teacher_name: detail.teacher_name || (teacherRow ? `${teacherRow.first_name} ${teacherRow.last_name || ''}`.trim() : detail.teacher_id),
    };
  }
}

export const timetableRepository = new TimetableRepository();
