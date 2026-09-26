// ========================================================================
// Academic Repository
// Data Access for Academic Sessions, Classes, Sections, Subjects, Groups,
// Class-Section Offerings, Class-Subject Offerings, Student Enrollments,
// and Teacher Subject Assignments. All entities strictly tenant-scoped.
// ========================================================================

import { getMemoryDbClient, getCloudDatabaseClient, ICloudDatabaseClient, getSupabaseClient, isSupabaseDatabaseActive } from '../db/client.js';
import {
  AcademicSession,
  ClassItem,
  SectionItem,
  AcademicClassSection,
  SubjectItem,
  SubjectGroup,
  SubjectGroupItem,
  AcademicClassSubject,
  StudentAcademicEnrollment,
  TeacherSubjectAssignment,
  TeacherResponsibility,
  User,
  Location,
} from '../types/index.js';

export class AcademicRepository {
  private mem = getMemoryDbClient();

  private get pg(): ICloudDatabaseClient | null {
    return getCloudDatabaseClient();
  }

  // ----------------------------------------------------------------------
  // 1. Academic Sessions Master
  // ----------------------------------------------------------------------
  async findSessions(schoolId: string, options?: { includeInactive?: boolean }): Promise<AcademicSession[]> {
    if (this.pg) {
      let sql = 'SELECT * FROM academic_sessions WHERE school_id = $1 AND deleted_at IS NULL';
      if (!options?.includeInactive) {
        sql += " AND status = 'ACTIVE'";
      }
      sql += ' ORDER BY created_at DESC';
      const res = await this.pg.query<AcademicSession>(sql, [schoolId]);
      return res.rows;
    }
    return (this.mem.findAll('academic_sessions', (row: AcademicSession) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (!options?.includeInactive && row.status !== 'ACTIVE') return false;
      return true;
    }) as AcademicSession[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findSessionById(id: string, schoolId?: string): Promise<AcademicSession | null> {
    if (this.pg) {
      let sql = 'SELECT * FROM academic_sessions WHERE id = $1 AND deleted_at IS NULL';
      const params: any[] = [id];
      if (schoolId) {
        params.push(schoolId);
        sql += ' AND school_id = $2';
      }
      return this.pg.queryOne<AcademicSession>(sql, params);
    }
    const item = this.mem.findById('academic_sessions', id) as AcademicSession | null;
    if (!item || item.deleted_at) return null;
    if (schoolId && item.school_id !== schoolId) return null;
    return item;
  }

  async findCurrentSession(schoolId: string): Promise<AcademicSession | null> {
    if (this.pg) {
      return this.pg.queryOne<AcademicSession>(
        'SELECT * FROM academic_sessions WHERE school_id = $1 AND is_current = TRUE AND deleted_at IS NULL LIMIT 1',
        [schoolId]
      );
    }
    const list = this.mem.findAll('academic_sessions', (row: AcademicSession) =>
      row.school_id === schoolId && row.is_current === true && !row.deleted_at
    );
    return list[0] || null;
  }

  async findSessionByCode(schoolId: string, code: string): Promise<AcademicSession | null> {
    if (this.pg) {
      return this.pg.queryOne<AcademicSession>(
        'SELECT * FROM academic_sessions WHERE school_id = $1 AND UPPER(code) = UPPER($2) AND deleted_at IS NULL',
        [schoolId, code]
      );
    }
    const list = this.mem.findAll('academic_sessions', (row: AcademicSession) =>
      row.school_id === schoolId &&
      row.code.toUpperCase() === code.toUpperCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createSession(data: Omit<AcademicSession, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicSession> {
    const cleanData = { ...data, code: data.code.toUpperCase() };
    if (this.pg) {
      return this.pg.insert<AcademicSession>('academic_sessions', cleanData);
    }
    return this.mem.insert('academic_sessions', cleanData) as AcademicSession;
  }

  async updateSession(id: string, updates: Partial<AcademicSession>): Promise<AcademicSession | null> {
    if (this.pg) {
      return this.pg.update<AcademicSession>('academic_sessions', id, updates);
    }
    return this.mem.update('academic_sessions', id, updates) as AcademicSession | null;
  }

  async setCurrentSession(schoolId: string, sessionId: string): Promise<AcademicSession | null> {
    if (this.pg) {
      await this.pg.execute(
        'UPDATE academic_sessions SET is_current = FALSE, updated_at = NOW() WHERE school_id = $1',
        [schoolId]
      );
      await this.pg.execute(
        'UPDATE academic_sessions SET is_current = TRUE, updated_at = NOW() WHERE school_id = $1 AND id = $2',
        [schoolId, sessionId]
      );
      return this.findSessionById(sessionId, schoolId);
    }
    // Set all other sessions for this school to false
    const all = this.mem.findAll('academic_sessions', (row: AcademicSession) => row.school_id === schoolId);
    for (const s of all) {
      this.mem.update('academic_sessions', s.id, { is_current: s.id === sessionId });
    }
    return this.findSessionById(sessionId);
  }

  async deleteSession(id: string): Promise<boolean> {
    if (this.pg) {
      return this.pg.softDelete('academic_sessions', id);
    }
    return this.mem.softDelete('academic_sessions', id);
  }

  // ----------------------------------------------------------------------
  // 2. Class Master
  // ----------------------------------------------------------------------
  async findClasses(schoolId: string, options?: { includeInactive?: boolean }): Promise<ClassItem[]> {
    if (this.pg) {
      let sql = 'SELECT * FROM classes WHERE school_id = $1 AND deleted_at IS NULL';
      if (!options?.includeInactive) {
        sql += " AND status = 'ACTIVE'";
      }
      sql += ' ORDER BY created_at DESC';
      const res = await this.pg.query<ClassItem>(sql, [schoolId]);
      return res.rows;
    }
    return (this.mem.findAll('classes', (row: ClassItem) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (!options?.includeInactive && row.status !== 'ACTIVE') return false;
      return true;
    }) as ClassItem[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findClassById(id: string, schoolId?: string): Promise<ClassItem | null> {
    if (this.pg) {
      let sql = 'SELECT * FROM classes WHERE id = $1 AND deleted_at IS NULL';
      const params: any[] = [id];
      if (schoolId) {
        params.push(schoolId);
        sql += ' AND school_id = $2';
      }
      return this.pg.queryOne<ClassItem>(sql, params);
    }
    const item = this.mem.findById('classes', id) as ClassItem | null;
    if (!item || item.deleted_at) return null;
    if (schoolId && item.school_id !== schoolId) return null;
    return item;
  }

  async findClassByCode(schoolId: string, code: string): Promise<ClassItem | null> {
    if (this.pg) {
      return this.pg.queryOne<ClassItem>(
        'SELECT * FROM classes WHERE school_id = $1 AND UPPER(code) = UPPER($2) AND deleted_at IS NULL',
        [schoolId, code]
      );
    }
    const list = this.mem.findAll('classes', (row: ClassItem) =>
      row.school_id === schoolId &&
      row.code.toUpperCase() === code.toUpperCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createClass(data: Omit<ClassItem, 'id' | 'created_at' | 'updated_at'>): Promise<ClassItem> {
    const cleanData = { ...data, code: data.code.toUpperCase() };
    if (this.pg) {
      return this.pg.insert<ClassItem>('classes', cleanData);
    }
    return this.mem.insert('classes', cleanData) as ClassItem;
  }

  async updateClass(id: string, updates: Partial<ClassItem>): Promise<ClassItem | null> {
    if (this.pg) {
      return this.pg.update<ClassItem>('classes', id, updates);
    }
    return this.mem.update('classes', id, updates) as ClassItem | null;
  }

  async deleteClass(id: string): Promise<boolean> {
    if (this.pg) {
      return this.pg.softDelete('classes', id);
    }
    return this.mem.softDelete('classes', id);
  }

  async reorderClasses(schoolId: string, orderedIds: string[]): Promise<void> {
    if (this.pg) {
      for (let i = 0; i < orderedIds.length; i++) {
        await this.pg.execute(
          'UPDATE classes SET numeric_order = $1, updated_at = NOW() WHERE school_id = $2 AND id = $3',
          [i + 1, schoolId, orderedIds[i]]
        );
      }
      return;
    }
    orderedIds.forEach((id, index) => {
      this.mem.update('classes', id, { numeric_order: index + 1 });
    });
  }

  // ----------------------------------------------------------------------
  // 3. Section Master
  // ----------------------------------------------------------------------
  async findSections(schoolId: string, options?: { includeInactive?: boolean }): Promise<SectionItem[]> {
    if (this.pg) {
      let sql = 'SELECT * FROM sections WHERE school_id = $1 AND deleted_at IS NULL';
      if (!options?.includeInactive) {
        sql += " AND status = 'ACTIVE'";
      }
      sql += ' ORDER BY created_at DESC';
      const res = await this.pg.query<SectionItem>(sql, [schoolId]);
      return res.rows;
    }
    return (this.mem.findAll('sections', (row: SectionItem) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (!options?.includeInactive && row.status !== 'ACTIVE') return false;
      return true;
    }) as SectionItem[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findSectionById(id: string, schoolId?: string): Promise<SectionItem | null> {
    if (this.pg) {
      let sql = 'SELECT * FROM sections WHERE id = $1 AND deleted_at IS NULL';
      const params: any[] = [id];
      if (schoolId) {
        params.push(schoolId);
        sql += ' AND school_id = $2';
      }
      return this.pg.queryOne<SectionItem>(sql, params);
    }
    const item = this.mem.findById('sections', id) as SectionItem | null;
    if (!item || item.deleted_at) return null;
    if (schoolId && item.school_id !== schoolId) return null;
    return item;
  }

  async findSectionByCode(schoolId: string, code: string): Promise<SectionItem | null> {
    if (this.pg) {
      return this.pg.queryOne<SectionItem>(
        'SELECT * FROM sections WHERE school_id = $1 AND UPPER(code) = UPPER($2) AND deleted_at IS NULL',
        [schoolId, code]
      );
    }
    const list = this.mem.findAll('sections', (row: SectionItem) =>
      row.school_id === schoolId &&
      row.code.toUpperCase() === code.toUpperCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createSection(data: Omit<SectionItem, 'id' | 'created_at' | 'updated_at'>): Promise<SectionItem> {
    const cleanData = { ...data, code: data.code.toUpperCase() };
    if (this.pg) {
      return this.pg.insert<SectionItem>('sections', cleanData);
    }
    return this.mem.insert('sections', cleanData) as SectionItem;
  }

  async updateSection(id: string, updates: Partial<SectionItem>): Promise<SectionItem | null> {
    if (this.pg) {
      return this.pg.update<SectionItem>('sections', id, updates);
    }
    return this.mem.update('sections', id, updates) as SectionItem | null;
  }

  async deleteSection(id: string): Promise<boolean> {
    if (this.pg) {
      return this.pg.softDelete('sections', id);
    }
    return this.mem.softDelete('sections', id);
  }

  // ----------------------------------------------------------------------
  // 4. Academic Class + Section Offerings
  // ----------------------------------------------------------------------
  async findClassSections(
    schoolId: string,
    sessionId: string,
    classId?: string
  ): Promise<AcademicClassSection[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('academic_class_sections')
          .select('*')
          .eq('school_id', schoolId)
          .eq('academic_session_id', sessionId)
          .is('deleted_at', null);

        if (classId) {
          q = q.eq('class_id', classId);
        }

        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          // Sync to memory cache for fast secondary lookups
          for (const row of data) {
            const existing = this.mem.findById('academic_class_sections', row.id);
            if (!existing) {
              this.mem.insert('academic_class_sections', row);
            } else {
              this.mem.update('academic_class_sections', row.id, row);
            }
          }

          const [allClasses, allSections, allSessions] = await Promise.all([
            this.findClasses(schoolId, { includeInactive: true }),
            this.findSections(schoolId, { includeInactive: true }),
            this.findSessions(schoolId, { includeInactive: true }),
          ]);
          const classMap = new Map(allClasses.map(c => [c.id, c]));
          const sectionMap = new Map(allSections.map(s => [s.id, s]));
          const sessionMap = new Map(allSessions.map(s => [s.id, s]));

          return (data as AcademicClassSection[]).map(item => {
            const cls = classMap.get(item.class_id);
            const sec = sectionMap.get(item.section_id);
            const sess = sessionMap.get(item.academic_session_id);
            return {
              ...item,
              class: cls,
              section: sec,
              session: sess,
              section_name: sec?.name || '',
            };
          }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }
      } catch (err) {
        console.warn('[AcademicRepository.findClassSections] Supabase query failed, falling back to memory:', err);
      }
    }

    // Memory query
    const rawList = this.mem.findAll('academic_class_sections', (row: AcademicClassSection) => {
      if (row.school_id !== schoolId) return false;
      if (row.academic_session_id !== sessionId) return false;
      if (classId && row.class_id !== classId) return false;
      if (row.deleted_at) return false;
      return true;
    }) as AcademicClassSection[];

    // Hydrate class, section, session from both memory and DB lookups
    const [allClasses, allSections, allSessions] = await Promise.all([
      this.findClasses(schoolId, { includeInactive: true }),
      this.findSections(schoolId, { includeInactive: true }),
      this.findSessions(schoolId, { includeInactive: true }),
    ]);
    const classMap = new Map(allClasses.map(c => [c.id, c]));
    const sectionMap = new Map(allSections.map(s => [s.id, s]));
    const sessionMap = new Map(allSessions.map(s => [s.id, s]));

    return rawList.map(item => {
      const cls = this.mem.findById('classes', item.class_id) || classMap.get(item.class_id) || undefined;
      const sec = this.mem.findById('sections', item.section_id) || sectionMap.get(item.section_id) || undefined;
      const sess = this.mem.findById('academic_sessions', item.academic_session_id) || sessionMap.get(item.academic_session_id) || undefined;
      return {
        ...item,
        class: cls,
        section: sec,
        session: sess,
        section_name: sec?.name || '',
      };
    }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findClassSectionById(id: string): Promise<AcademicClassSection | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('academic_class_sections')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) {
          const [cls, sec, sess] = await Promise.all([
            this.findClassById(data.class_id),
            this.findSectionById(data.section_id),
            this.findSessionById(data.academic_session_id),
          ]);
          return {
            ...data,
            class: cls || undefined,
            section: sec || undefined,
            session: sess || undefined,
            section_name: sec?.name || '',
          };
        }
      } catch (err) {
        console.warn('[AcademicRepository.findClassSectionById] Supabase error:', err);
      }
    }

    const item = this.mem.findById('academic_class_sections', id) as AcademicClassSection | null;
    if (!item || item.deleted_at) return null;
    const [cls, sec, sess] = await Promise.all([
      this.findClassById(item.class_id),
      this.findSectionById(item.section_id),
      this.findSessionById(item.academic_session_id),
    ]);
    return {
      ...item,
      class: this.mem.findById('classes', item.class_id) || cls || undefined,
      section: this.mem.findById('sections', item.section_id) || sec || undefined,
      session: this.mem.findById('academic_sessions', item.academic_session_id) || sess || undefined,
      section_name: sec?.name || '',
    };
  }

  async findClassSectionExact(
    schoolId: string,
    sessionId: string,
    classId: string,
    sectionId: string
  ): Promise<AcademicClassSection | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('academic_class_sections')
          .select('*')
          .eq('school_id', schoolId)
          .eq('academic_session_id', sessionId)
          .eq('class_id', classId)
          .eq('section_id', sectionId)
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) {
          return data as AcademicClassSection;
        }
      } catch (err) {
        console.warn('[AcademicRepository.findClassSectionExact] Supabase error:', err);
      }
    }

    const list = this.mem.findAll('academic_class_sections', (row: AcademicClassSection) =>
      row.school_id === schoolId &&
      row.academic_session_id === sessionId &&
      row.class_id === classId &&
      row.section_id === sectionId &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createClassSection(data: Omit<AcademicClassSection, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicClassSection> {
    const memRecord = this.mem.insert('academic_class_sections', data) as AcademicClassSection;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: inserted, error } = await getSupabaseClient()!
          .from('academic_class_sections')
          .insert(memRecord)
          .select('*')
          .single();
        if (!error && inserted) {
          return inserted as AcademicClassSection;
        }
      } catch (err) {
        console.warn('[AcademicRepository.createClassSection] Supabase error:', err);
      }
    }
    return memRecord;
  }

  async deleteClassSection(id: string): Promise<boolean> {
    const memDeleted = this.mem.softDelete('academic_class_sections', id);
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('academic_class_sections')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err) {
        console.warn('[AcademicRepository.deleteClassSection] Supabase error:', err);
      }
    }
    return memDeleted;
  }

  // ----------------------------------------------------------------------
  // 5. Subject Master
  // ----------------------------------------------------------------------
  async findSubjects(schoolId: string, options?: { includeInactive?: boolean }): Promise<SubjectItem[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('subjects')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);
        if (!options?.includeInactive) {
          q = q.eq('status', 'ACTIVE');
        }
        const { data, error } = await q.order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          return data as SubjectItem[];
        }
      } catch (err) {
        console.warn('[AcademicRepository.findSubjects] Supabase error:', err);
      }
    }

    return (this.mem.findAll('subjects', (row: SubjectItem) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (!options?.includeInactive && row.status !== 'ACTIVE') return false;
      return true;
    }) as SubjectItem[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findSubjectById(id: string, schoolId?: string): Promise<SubjectItem | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('subjects')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null);
        if (schoolId) q = q.eq('school_id', schoolId);
        const { data, error } = await q.maybeSingle();
        if (!error && data) return data as SubjectItem;
      } catch (err) {
        console.warn('[AcademicRepository.findSubjectById] Supabase error:', err);
      }
    }

    const item = this.mem.findById('subjects', id) as SubjectItem | null;
    if (!item || item.deleted_at) return null;
    if (schoolId && item.school_id !== schoolId) return null;
    return item;
  }

  async findSubjectByCode(schoolId: string, code: string): Promise<SubjectItem | null> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('subjects')
          .select('*')
          .eq('school_id', schoolId)
          .eq('code', code.toUpperCase())
          .is('deleted_at', null)
          .maybeSingle();
        if (!error && data) return data as SubjectItem;
      } catch (err) {
        console.warn('[AcademicRepository.findSubjectByCode] Supabase error:', err);
      }
    }

    const list = this.mem.findAll('subjects', (row: SubjectItem) =>
      row.school_id === schoolId &&
      row.code.toUpperCase() === code.toUpperCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createSubject(data: Omit<SubjectItem, 'id' | 'created_at' | 'updated_at'>): Promise<SubjectItem> {
    const id = (data as any).id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...data,
      id,
      code: data.code.toUpperCase(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { display_order, ...cleanPayload } = record as any;
        const { data: dbData, error } = await getSupabaseClient()!
          .from('subjects')
          .insert(cleanPayload)
          .select()
          .single();
        if (error) {
          console.error('[AcademicRepository.createSubject] Supabase error:', error);
          throw new Error(`Failed to create subject in Supabase: ${error.message}`);
        }
        if (dbData) {
          this.mem.insert('subjects', dbData);
          return dbData as SubjectItem;
        }
      } catch (err) {
        console.error('[AcademicRepository.createSubject] Supabase error:', err);
        throw err;
      }
    }

    return this.mem.insert('subjects', record) as SubjectItem;
  }

  async updateSubject(id: string, updates: Partial<SubjectItem>): Promise<SubjectItem | null> {
    return this.mem.update('subjects', id, updates) as SubjectItem | null;
  }

  async deleteSubject(id: string): Promise<boolean> {
    return this.mem.softDelete('subjects', id);
  }

  // ----------------------------------------------------------------------
  // 6. Subject Groups Master & Relational Items
  // ----------------------------------------------------------------------
  async findSubjectGroups(schoolId: string): Promise<SubjectGroup[]> {
    const groups = (this.mem.findAll('subject_groups', (row: SubjectGroup) =>
      row.school_id === schoolId && !row.deleted_at
    ) as SubjectGroup[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return groups.map(grp => {
      const items = this.mem.findAll('subject_group_items', (i: SubjectGroupItem) => i.subject_group_id === grp.id);
      const subjects = items
        .map(i => this.mem.findById('subjects', i.subject_id))
        .filter(Boolean) as SubjectItem[];
      return { ...grp, subjects };
    });
  }

  async findSubjectGroupById(id: string, schoolId?: string): Promise<SubjectGroup | null> {
    const grp = this.mem.findById('subject_groups', id) as SubjectGroup | null;
    if (!grp || grp.deleted_at) return null;
    if (schoolId && grp.school_id !== schoolId) return null;

    const items = this.mem.findAll('subject_group_items', (i: SubjectGroupItem) => i.subject_group_id === grp.id);
    const subjects = items
      .map(i => this.mem.findById('subjects', i.subject_id))
      .filter(Boolean) as SubjectItem[];
    return { ...grp, subjects };
  }

  async createSubjectGroup(
    data: Omit<SubjectGroup, 'id' | 'created_at' | 'updated_at'>,
    subjectIds: string[] = []
  ): Promise<SubjectGroup> {
    const grp = this.mem.insert('subject_groups', {
      ...data,
      code: data.code.toUpperCase(),
    }) as SubjectGroup;

    subjectIds.forEach((subjId) => {
      this.mem.insert('subject_group_items', {
        id: crypto.randomUUID(),
        school_id: data.school_id,
        subject_group_id: grp.id,
        subject_id: subjId,
        created_at: new Date().toISOString(),
      });
    });

    return this.findSubjectGroupById(grp.id) as Promise<SubjectGroup>;
  }

  async updateSubjectGroup(
    id: string,
    updates: Partial<SubjectGroup>,
    subjectIds?: string[]
  ): Promise<SubjectGroup | null> {
    const updated = this.mem.update('subject_groups', id, updates) as SubjectGroup | null;
    if (!updated) return null;

    if (subjectIds) {
      // Remove old relational links and insert updated links
      const oldItems = this.mem.findAll('subject_group_items', (i: SubjectGroupItem) => i.subject_group_id === id);
      for (const item of oldItems) {
        this.mem.delete('subject_group_items', item.id);
      }
      subjectIds.forEach((subjId) => {
        this.mem.insert('subject_group_items', {
          id: crypto.randomUUID(),
          school_id: updated.school_id,
          subject_group_id: id,
          subject_id: subjId,
          created_at: new Date().toISOString(),
        });
      });
    }

    return this.findSubjectGroupById(id);
  }

  async deleteSubjectGroup(id: string): Promise<boolean> {
    return this.mem.softDelete('subject_groups', id);
  }

  // ----------------------------------------------------------------------
  // 7. Academic Class Subjects (Offerings)
  // ----------------------------------------------------------------------
  async findClassSubjects(
    schoolId: string,
    sessionId: string,
    classId?: string
  ): Promise<AcademicClassSubject[]> {
    const rawList = this.mem.findAll('academic_class_subjects', (row: AcademicClassSubject) => {
      if (row.school_id !== schoolId) return false;
      if (row.academic_session_id !== sessionId) return false;
      if (classId && row.class_id !== classId) return false;
      if (row.deleted_at) return false;
      return true;
    }) as AcademicClassSubject[];

    return rawList.map(item => ({
      ...item,
      subject: this.mem.findById('subjects', item.subject_id) || undefined,
      subject_group: item.subject_group_id ? this.mem.findById('subject_groups', item.subject_group_id) || undefined : undefined,
      class: this.mem.findById('classes', item.class_id) || undefined,
      session: this.mem.findById('academic_sessions', item.academic_session_id) || undefined,
    })).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findClassSubjectById(id: string): Promise<AcademicClassSubject | null> {
    const item = this.mem.findById('academic_class_subjects', id) as AcademicClassSubject | null;
    if (!item || item.deleted_at) return null;
    return {
      ...item,
      subject: this.mem.findById('subjects', item.subject_id) || undefined,
      subject_group: item.subject_group_id ? this.mem.findById('subject_groups', item.subject_group_id) || undefined : undefined,
      class: this.mem.findById('classes', item.class_id) || undefined,
      session: this.mem.findById('academic_sessions', item.academic_session_id) || undefined,
    };
  }

  async findClassSubjectExact(
    schoolId: string,
    sessionId: string,
    classId: string,
    subjectId: string
  ): Promise<AcademicClassSubject | null> {
    const list = this.mem.findAll('academic_class_subjects', (row: AcademicClassSubject) =>
      row.school_id === schoolId &&
      row.academic_session_id === sessionId &&
      row.class_id === classId &&
      row.subject_id === subjectId &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createClassSubject(data: Omit<AcademicClassSubject, 'id' | 'created_at' | 'updated_at'>): Promise<AcademicClassSubject> {
    return this.mem.insert('academic_class_subjects', data) as AcademicClassSubject;
  }

  async updateClassSubject(id: string, updates: Partial<AcademicClassSubject>): Promise<AcademicClassSubject | null> {
    return this.mem.update('academic_class_subjects', id, updates) as AcademicClassSubject | null;
  }

  async deleteClassSubject(id: string): Promise<boolean> {
    return this.mem.softDelete('academic_class_subjects', id);
  }

  // ----------------------------------------------------------------------
  // 8. Student Academic Enrollments (Historical & Operational)
  // ----------------------------------------------------------------------
  async findEnrollments(
    schoolId: string,
    filters: {
      sessionId?: string;
      locationId?: string;
      classId?: string;
      sectionId?: string;
      studentId?: string;
      status?: string;
      search?: string;
    }
  ): Promise<StudentAcademicEnrollment[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let q = getSupabaseClient()!
          .from('student_academic_enrollments')
          .select('*')
          .eq('school_id', schoolId)
          .is('deleted_at', null);

        if (filters.sessionId) q = q.eq('academic_session_id', filters.sessionId);
        if (filters.locationId) q = q.eq('location_id', filters.locationId);
        if (filters.classId) q = q.eq('class_id', filters.classId);
        if (filters.sectionId) q = q.eq('section_id', filters.sectionId);
        if (filters.studentId) q = q.eq('student_user_id', filters.studentId);
        if (filters.status) {
          if (filters.status === 'ACTIVE') {
            q = q.in('enrollment_status', ['ENROLLED', 'ACTIVE']);
          } else {
            q = q.eq('enrollment_status', filters.status);
          }
        }

        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          for (const row of data) {
            const existing = this.mem.findById('student_academic_enrollments', row.id);
            if (!existing) {
              this.mem.insert('student_academic_enrollments', row);
            } else {
              this.mem.update('student_academic_enrollments', row.id, row);
            }
          }

          const userIds = data.map((e: any) => e.student_user_id);
          const userMap = new Map<string, any>();
          for (const uid of userIds) {
            const u = this.mem.findById('users', uid);
            if (u) userMap.set(uid, u);
          }
          const missing = userIds.filter((uid: string) => !userMap.has(uid));
          if (missing.length > 0) {
            const { data: dbUsers } = await getSupabaseClient()!
              .from('users')
              .select('*')
              .in('id', missing);
            if (dbUsers) {
              for (const u of dbUsers) {
                userMap.set(u.id, u);
                if (!this.mem.findById('users', u.id)) {
                  this.mem.insert('users', u);
                }
              }
            }
          }

          const [allClasses, allSections, allSessions] = await Promise.all([
            this.findClasses(schoolId, { includeInactive: true }),
            this.findSections(schoolId, { includeInactive: true }),
            this.findSessions(schoolId, { includeInactive: true }),
          ]);
          const classMap = new Map(allClasses.map(c => [c.id, c]));
          const sectionMap = new Map(allSections.map(s => [s.id, s]));
          const sessionMap = new Map(allSessions.map(s => [s.id, s]));

          const locationMap = new Map<string, any>();
          const locationIds = [...new Set(data.map((e: any) => e.location_id).filter(Boolean))];
          for (const lid of locationIds) {
            const loc = this.mem.findById('locations', lid);
            if (loc) locationMap.set(lid, loc);
          }
          const missingLocs = locationIds.filter(id => !locationMap.has(id));
          if (missingLocs.length > 0 && isSupabaseDatabaseActive() && getSupabaseClient()) {
            const { data: dbLocs } = await getSupabaseClient()!
              .from('locations')
              .select('*')
              .in('id', missingLocs);
            if (dbLocs) {
              for (const l of dbLocs) {
                locationMap.set(l.id, l);
                if (!this.mem.findById('locations', l.id)) {
                  this.mem.insert('locations', l);
                }
              }
            }
          }

          const hydrated = (data as StudentAcademicEnrollment[]).map(e => {
            const studentUser = userMap.get(e.student_user_id) as User | null;
            const cls = classMap.get(e.class_id) || (this.mem.findById('classes', e.class_id) as ClassItem) || undefined;
            const sec = sectionMap.get(e.section_id) || (this.mem.findById('sections', e.section_id) as SectionItem) || undefined;
            const sess = sessionMap.get(e.academic_session_id) || (this.mem.findById('academic_sessions', e.academic_session_id) as AcademicSession) || undefined;
            const loc = locationMap.get(e.location_id) || (this.mem.findById('locations', e.location_id) as Location) || undefined;
            return {
              ...e,
              student: studentUser ? {
                ...studentUser,
                password_hash: undefined,
              } : undefined,
              session: sess,
              location: loc,
              class: cls,
              section: sec,
            };
          });

          let filtered = hydrated;
          if (filters.search) {
            const s = filters.search.toLowerCase();
            filtered = filtered.filter(e =>
              e.admission_number?.toLowerCase().includes(s) ||
              e.roll_number?.toLowerCase().includes(s) ||
              e.student?.first_name?.toLowerCase().includes(s) ||
              e.student?.last_name?.toLowerCase().includes(s) ||
              e.student?.username?.toLowerCase().includes(s)
            );
          }

          return filtered.sort((a, b) => {
            const rollA = parseInt(a.roll_number || '0', 10);
            const rollB = parseInt(b.roll_number || '0', 10);
            return rollA - rollB;
          });
        }
      } catch (err: any) {
        console.warn('[AcademicRepository.findEnrollments] Supabase fallback:', err.message);
      }
    }

    const rawList = this.mem.findAll('student_academic_enrollments', (row: StudentAcademicEnrollment) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters.sessionId && row.academic_session_id !== filters.sessionId) return false;
      if (filters.locationId && row.location_id !== filters.locationId) return false;
      if (filters.classId && row.class_id !== filters.classId) return false;
      if (filters.sectionId && row.section_id !== filters.sectionId) return false;
      if (filters.studentId && row.student_user_id !== filters.studentId) return false;
      if (filters.status) {
        if (filters.status === 'ACTIVE') {
          if (row.enrollment_status !== 'ENROLLED' && (row.enrollment_status as string) !== 'ACTIVE') return false;
        } else if (row.enrollment_status !== filters.status) {
          return false;
        }
      }
      return true;
    }) as StudentAcademicEnrollment[];

    const [allClasses, allSections, allSessions] = await Promise.all([
      this.findClasses(schoolId, { includeInactive: true }),
      this.findSections(schoolId, { includeInactive: true }),
      this.findSessions(schoolId, { includeInactive: true }),
    ]);
    const classMap = new Map(allClasses.map(c => [c.id, c]));
    const sectionMap = new Map(allSections.map(s => [s.id, s]));
    const sessionMap = new Map(allSessions.map(s => [s.id, s]));

    // Hydrate student user, location, class, section, session
    const hydrated = rawList.map(e => {
      const studentUser = this.mem.findById('users', e.student_user_id) as User | null;
      const cls = classMap.get(e.class_id) || (this.mem.findById('classes', e.class_id) as ClassItem) || undefined;
      const sec = sectionMap.get(e.section_id) || (this.mem.findById('sections', e.section_id) as SectionItem) || undefined;
      const sess = sessionMap.get(e.academic_session_id) || (this.mem.findById('academic_sessions', e.academic_session_id) as AcademicSession) || undefined;
      const loc = (this.mem.findById('locations', e.location_id) as Location) || undefined;
      return {
        ...e,
        student: studentUser ? {
          ...studentUser,
          password_hash: undefined,
        } : undefined,
        session: sess,
        location: loc,
        class: cls,
        section: sec,
      };
    });

    if (filters.search) {
      const q = filters.search.toLowerCase();
      return hydrated.filter(e =>
        e.admission_number?.toLowerCase().includes(q) ||
        e.roll_number?.toLowerCase().includes(q) ||
        e.student?.first_name?.toLowerCase().includes(q) ||
        e.student?.last_name?.toLowerCase().includes(q) ||
        e.student?.username?.toLowerCase().includes(q)
      );
    }

    return hydrated.sort((a, b) => {
      const rollA = parseInt(a.roll_number || '0', 10);
      const rollB = parseInt(b.roll_number || '0', 10);
      return rollA - rollB;
    });
  }

  async findEnrollmentById(id: string): Promise<StudentAcademicEnrollment | null> {
    const e = this.mem.findById('student_academic_enrollments', id) as StudentAcademicEnrollment | null;
    if (!e || e.deleted_at) {
      if (isSupabaseDatabaseActive() && getSupabaseClient()) {
        const { data } = await getSupabaseClient()!
          .from('student_academic_enrollments')
          .select('*')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();
        if (data) {
          const list = await this.findEnrollments(data.school_id, { studentId: data.student_user_id });
          return list.find(x => x.id === id) || null;
        }
      }
      return null;
    }
    const [cls, sec, sess] = await Promise.all([
      this.findClassById(e.class_id, e.school_id),
      this.findSectionById(e.section_id, e.school_id),
      this.findSessionById(e.academic_session_id, e.school_id),
    ]);
    const studentUser = this.mem.findById('users', e.student_user_id) as User | null;
    return {
      ...e,
      student: studentUser ? { ...studentUser, password_hash: undefined } : undefined,
      session: sess || undefined,
      location: (this.mem.findById('locations', e.location_id) as Location) || undefined,
      class: cls || undefined,
      section: sec || undefined,
    };
  }

  async findActiveEnrollmentForStudent(
    schoolId: string,
    studentUserId: string,
    sessionId?: string
  ): Promise<StudentAcademicEnrollment | null> {
    const list = await this.findEnrollments(schoolId, {
      studentId: studentUserId,
      sessionId,
      status: 'ACTIVE',
    });
    return list[0] || null;
  }

  async findStudentAcademicHistory(
    schoolId: string,
    studentUserId: string
  ): Promise<StudentAcademicEnrollment[]> {
    const rawList = this.mem.findAll('student_academic_enrollments', (row: StudentAcademicEnrollment) =>
      row.school_id === schoolId &&
      row.student_user_id === studentUserId &&
      !row.deleted_at
    ) as StudentAcademicEnrollment[];

    return rawList.map(e => ({
      ...e,
      session: this.mem.findById('academic_sessions', e.academic_session_id) || undefined,
      location: this.mem.findById('locations', e.location_id) || undefined,
      class: this.mem.findById('classes', e.class_id) || undefined,
      section: this.mem.findById('sections', e.section_id) || undefined,
    })).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  }

  async createEnrollment(data: Omit<StudentAcademicEnrollment, 'id' | 'created_at' | 'updated_at'>): Promise<StudentAcademicEnrollment> {
    const memRecord = this.mem.insert('student_academic_enrollments', data) as StudentAcademicEnrollment;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: inserted, error } = await getSupabaseClient()!
          .from('student_academic_enrollments')
          .insert(memRecord)
          .select('*')
          .single();
        if (!error && inserted) {
          return inserted as StudentAcademicEnrollment;
        }
      } catch (err) {
        console.warn('[AcademicRepo] Error persisting enrollment to Supabase:', err);
      }
    }
    return memRecord;
  }

  async updateEnrollment(id: string, updates: Partial<StudentAcademicEnrollment>): Promise<StudentAcademicEnrollment | null> {
    const memUpdated = this.mem.update('student_academic_enrollments', id, updates) as StudentAcademicEnrollment | null;
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data: updated, error } = await getSupabaseClient()!
          .from('student_academic_enrollments')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();
        if (!error && updated) {
          return updated as StudentAcademicEnrollment;
        }
      } catch (err) {
        console.warn('[AcademicRepo] Error updating enrollment in Supabase:', err);
      }
    }
    return memUpdated;
  }

  // ----------------------------------------------------------------------
  // 9. Teacher Subject Assignments
  // ----------------------------------------------------------------------
  async findTeacherAssignments(
    schoolId: string,
    filters: {
      sessionId?: string;
      locationId?: string;
      classId?: string;
      sectionId?: string;
      subjectId?: string;
      teacherId?: string;
      status?: string;
    }
  ): Promise<TeacherSubjectAssignment[]> {
    const rawList = this.mem.findAll('teacher_subject_assignments', (row: TeacherSubjectAssignment) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (filters.sessionId && row.academic_session_id !== filters.sessionId) return false;
      if (filters.locationId && row.location_id !== filters.locationId) return false;
      if (filters.classId && row.class_id !== filters.classId) return false;
      if (filters.sectionId && row.section_id !== filters.sectionId) return false;
      if (filters.subjectId && row.subject_id !== filters.subjectId) return false;
      if (filters.teacherId && row.teacher_user_id !== filters.teacherId) return false;
      if (filters.status && row.status !== filters.status) return false;
      return true;
    }) as TeacherSubjectAssignment[];

    return rawList.map(a => {
      const teacherUser = this.mem.findById('users', a.teacher_user_id) as User | null;
      return {
        ...a,
        teacher: teacherUser ? { ...teacherUser, password_hash: undefined } : undefined,
        session: this.mem.findById('academic_sessions', a.academic_session_id) || undefined,
        location: this.mem.findById('locations', a.location_id) || undefined,
        class: this.mem.findById('classes', a.class_id) || undefined,
        section: this.mem.findById('sections', a.section_id) || undefined,
        subject: this.mem.findById('subjects', a.subject_id) || undefined,
      };
    });
  }

  async findTeacherAssignmentById(id: string): Promise<TeacherSubjectAssignment | null> {
    const a = this.mem.findById('teacher_subject_assignments', id) as TeacherSubjectAssignment | null;
    if (!a || a.deleted_at) return null;
    const teacherUser = this.mem.findById('users', a.teacher_user_id) as User | null;
    return {
      ...a,
      teacher: teacherUser ? { ...teacherUser, password_hash: undefined } : undefined,
      session: this.mem.findById('academic_sessions', a.academic_session_id) || undefined,
      location: this.mem.findById('locations', a.location_id) || undefined,
      class: this.mem.findById('classes', a.class_id) || undefined,
      section: this.mem.findById('sections', a.section_id) || undefined,
      subject: this.mem.findById('subjects', a.subject_id) || undefined,
    };
  }

  async findExactTeacherAssignment(
    schoolId: string,
    sessionId: string,
    locationId: string,
    classId: string,
    sectionId: string,
    subjectId: string,
    teacherUserId: string
  ): Promise<TeacherSubjectAssignment | null> {
    const list = this.mem.findAll('teacher_subject_assignments', (row: TeacherSubjectAssignment) =>
      row.school_id === schoolId &&
      row.academic_session_id === sessionId &&
      row.location_id === locationId &&
      row.class_id === classId &&
      row.section_id === sectionId &&
      row.subject_id === subjectId &&
      row.teacher_user_id === teacherUserId &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createTeacherAssignment(data: Omit<TeacherSubjectAssignment, 'id' | 'created_at' | 'updated_at'>): Promise<TeacherSubjectAssignment> {
    return this.mem.insert('teacher_subject_assignments', data) as TeacherSubjectAssignment;
  }

  async updateTeacherAssignment(id: string, updates: Partial<TeacherSubjectAssignment>): Promise<TeacherSubjectAssignment | null> {
    return this.mem.update('teacher_subject_assignments', id, updates) as TeacherSubjectAssignment | null;
  }

  async deleteTeacherAssignment(id: string): Promise<boolean> {
    return this.mem.softDelete('teacher_subject_assignments', id);
  }

  async findTeacherResponsibilities(
    teacherUserId: string,
    sessionId?: string
  ): Promise<TeacherResponsibility[]> {
    const rawList = this.mem.findAll('teacher_subject_assignments', (row: TeacherSubjectAssignment) => {
      if (row.teacher_user_id !== teacherUserId) return false;
      if (sessionId && row.academic_session_id !== sessionId) return false;
      if (row.deleted_at) return false;
      if (row.status !== 'ACTIVE') return false;
      return true;
    }) as TeacherSubjectAssignment[];

    return rawList.map(item => {
      const session = this.mem.findById('academic_sessions', item.academic_session_id) as AcademicSession | null;
      const location = this.mem.findById('locations', item.location_id) as Location | null;
      const cls = this.mem.findById('classes', item.class_id) as ClassItem | null;
      const sec = this.mem.findById('sections', item.section_id) as SectionItem | null;
      const subj = this.mem.findById('subjects', item.subject_id) as SubjectItem | null;

      return {
        assignment_id: item.id,
        session_id: item.academic_session_id,
        session_name: session?.name || 'Unknown Session',
        location_id: item.location_id,
        location_name: location?.location_name || 'Main Campus',
        class_id: item.class_id,
        class_name: cls?.display_name || cls?.name || 'Unknown Class',
        section_id: item.section_id,
        section_name: sec?.name || 'Unknown Section',
        subject_id: item.subject_id,
        subject_name: subj?.name || 'Unknown Subject',
        subject_code: subj?.code || '',
        is_primary_teacher: item.is_primary_teacher,
        effective_date: item.effective_date,
        status: item.status,
      };
    });
  }
}

export const academicRepository = new AcademicRepository();
