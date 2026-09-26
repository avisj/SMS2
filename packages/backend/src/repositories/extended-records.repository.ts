// ========================================================================
// Extended Records Repository
// Specialized child entities for student history, staff qualifications,
// experience, certifications, and generic user documents.
// ========================================================================

import { getMemoryDbClient } from '../db/client.js';
import {
  StudentPreviousAcademicRecord,
  StudentAchievement,
  StaffQualification,
  StaffProfessionalExperience,
  StaffCertification,
  UserDocument,
} from '../types/index.js';

export class ExtendedRecordsRepository {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // Student Previous Academic Records
  // ----------------------------------------------------------------------
  async getPreviousRecordsForStudent(studentUserId: string): Promise<StudentPreviousAcademicRecord[]> {
    return this.mem.findAll(
      'student_previous_academic_records',
      (r: StudentPreviousAcademicRecord) => r.student_user_id === studentUserId
    );
  }

  async insertPreviousRecord(
    data: Omit<StudentPreviousAcademicRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StudentPreviousAcademicRecord> {
    return this.mem.insert('student_previous_academic_records', data) as StudentPreviousAcademicRecord;
  }

  async insertPreviousRecords(
    records: Array<Omit<StudentPreviousAcademicRecord, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<StudentPreviousAcademicRecord[]> {
    const results: StudentPreviousAcademicRecord[] = [];
    for (const rec of records) {
      results.push(await this.insertPreviousRecord(rec));
    }
    return results;
  }

  // ----------------------------------------------------------------------
  // Student Achievements
  // ----------------------------------------------------------------------
  async getAchievementsForStudent(studentUserId: string): Promise<StudentAchievement[]> {
    return this.mem.findAll(
      'student_achievements',
      (r: StudentAchievement) => r.student_user_id === studentUserId
    );
  }

  async insertAchievement(
    data: Omit<StudentAchievement, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StudentAchievement> {
    return this.mem.insert('student_achievements', data) as StudentAchievement;
  }

  async insertAchievements(
    records: Array<Omit<StudentAchievement, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<StudentAchievement[]> {
    const results: StudentAchievement[] = [];
    for (const rec of records) {
      results.push(await this.insertAchievement(rec));
    }
    return results;
  }

  // ----------------------------------------------------------------------
  // Staff Qualifications
  // ----------------------------------------------------------------------
  async getQualificationsForStaff(staffUserId: string): Promise<StaffQualification[]> {
    return this.mem.findAll(
      'staff_qualifications',
      (r: StaffQualification) => r.staff_user_id === staffUserId
    );
  }

  async insertQualification(
    data: Omit<StaffQualification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StaffQualification> {
    return this.mem.insert('staff_qualifications', data) as StaffQualification;
  }

  async insertQualifications(
    records: Array<Omit<StaffQualification, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<StaffQualification[]> {
    const results: StaffQualification[] = [];
    for (const rec of records) {
      results.push(await this.insertQualification(rec));
    }
    return results;
  }

  // ----------------------------------------------------------------------
  // Staff Professional Experience
  // ----------------------------------------------------------------------
  async getExperiencesForStaff(staffUserId: string): Promise<StaffProfessionalExperience[]> {
    return this.mem.findAll(
      'staff_professional_experience',
      (r: StaffProfessionalExperience) => r.staff_user_id === staffUserId
    );
  }

  async insertExperience(
    data: Omit<StaffProfessionalExperience, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StaffProfessionalExperience> {
    return this.mem.insert('staff_professional_experience', data) as StaffProfessionalExperience;
  }

  async insertExperiences(
    records: Array<Omit<StaffProfessionalExperience, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<StaffProfessionalExperience[]> {
    const results: StaffProfessionalExperience[] = [];
    for (const rec of records) {
      results.push(await this.insertExperience(rec));
    }
    return results;
  }

  // ----------------------------------------------------------------------
  // Staff Certifications
  // ----------------------------------------------------------------------
  async getCertificationsForStaff(staffUserId: string): Promise<StaffCertification[]> {
    return this.mem.findAll(
      'staff_certifications',
      (r: StaffCertification) => r.staff_user_id === staffUserId
    );
  }

  async insertCertification(
    data: Omit<StaffCertification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<StaffCertification> {
    return this.mem.insert('staff_certifications', data) as StaffCertification;
  }

  async insertCertifications(
    records: Array<Omit<StaffCertification, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<StaffCertification[]> {
    const results: StaffCertification[] = [];
    for (const rec of records) {
      results.push(await this.insertCertification(rec));
    }
    return results;
  }

  // ----------------------------------------------------------------------
  // Generic User Documents
  // ----------------------------------------------------------------------
  async getDocumentsForUser(userId: string): Promise<UserDocument[]> {
    return this.mem.findAll(
      'user_documents',
      (r: UserDocument) => r.user_id === userId
    );
  }

  async insertDocument(
    data: Omit<UserDocument, 'id' | 'created_at' | 'updated_at'>
  ): Promise<UserDocument> {
    return this.mem.insert('user_documents', data) as UserDocument;
  }

  async insertDocuments(
    records: Array<Omit<UserDocument, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<UserDocument[]> {
    const results: UserDocument[] = [];
    for (const rec of records) {
      results.push(await this.insertDocument(rec));
    }
    return results;
  }
}

export const extendedRecordsRepository = new ExtendedRecordsRepository();
