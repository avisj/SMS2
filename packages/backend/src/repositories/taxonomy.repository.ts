// ========================================================================
// Taxonomy Repository
// Designations, Categories, Subcategories, Tags, and Labels Data Access
// All entities are strictly tenant-scoped (school_id)
// ========================================================================

import { getMemoryDbClient } from '../db/client.js';
import {
  Designation,
  UserCategory,
  UserSubcategory,
  UserTag,
  UserLabel,
} from '../types/index.js';

export class TaxonomyRepository {
  private mem = getMemoryDbClient();

  // ----------------------------------------------------------------------
  // Designations Master
  // ----------------------------------------------------------------------
  async findDesignations(schoolId: string, options?: { includeInactive?: boolean }): Promise<Designation[]> {
    return (this.mem.findAll('designations', (row: Designation) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (!options?.includeInactive && row.status !== 'ACTIVE') return false;
      return true;
    }) as Designation[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findDesignationById(id: string, schoolId?: string): Promise<Designation | null> {
    const item = this.mem.findById('designations', id) as Designation | null;
    if (!item || item.deleted_at) return null;
    if (schoolId && item.school_id !== schoolId) return null;
    return item;
  }

  async findDesignationByCode(schoolId: string, code: string): Promise<Designation | null> {
    const list = this.mem.findAll('designations', (row: Designation) => 
      row.school_id === schoolId &&
      row.code.toUpperCase() === code.toUpperCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createDesignation(data: Omit<Designation, 'id' | 'created_at' | 'updated_at'>): Promise<Designation> {
    return this.mem.insert('designations', {
      ...data,
      code: data.code.toUpperCase(),
    }) as Designation;
  }

  async updateDesignation(id: string, updates: Partial<Designation>): Promise<Designation | null> {
    return this.mem.update('designations', id, updates) as Designation | null;
  }

  async deleteDesignation(id: string): Promise<boolean> {
    return this.mem.softDelete('designations', id);
  }

  // ----------------------------------------------------------------------
  // User Categories Master
  // ----------------------------------------------------------------------
  async findCategories(schoolId: string, userType?: string): Promise<UserCategory[]> {
    const categories = this.mem.findAll('user_categories', (row: UserCategory) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (userType && row.applicable_user_type && row.applicable_user_type !== userType) return false;
      return true;
    }) as UserCategory[];

    // Hydrate subcategories
    for (const cat of categories) {
      cat.subcategories = await this.findSubcategoriesByCategory(cat.id);
    }
    return categories.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findCategoryById(id: string, schoolId?: string): Promise<UserCategory | null> {
    const cat = this.mem.findById('user_categories', id) as UserCategory | null;
    if (!cat || cat.deleted_at) return null;
    if (schoolId && cat.school_id !== schoolId) return null;
    cat.subcategories = await this.findSubcategoriesByCategory(cat.id);
    return cat;
  }

  async findCategoryByCode(schoolId: string, code: string): Promise<UserCategory | null> {
    const list = this.mem.findAll('user_categories', (row: UserCategory) => 
      row.school_id === schoolId &&
      row.code.toUpperCase() === code.toUpperCase() &&
      !row.deleted_at
    );
    return list[0] || null;
  }

  async createCategory(data: Omit<UserCategory, 'id' | 'created_at' | 'updated_at'>): Promise<UserCategory> {
    return this.mem.insert('user_categories', {
      ...data,
      code: data.code.toUpperCase(),
    }) as UserCategory;
  }

  async updateCategory(id: string, updates: Partial<UserCategory>): Promise<UserCategory | null> {
    return this.mem.update('user_categories', id, updates) as UserCategory | null;
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.mem.softDelete('user_categories', id);
  }

  // ----------------------------------------------------------------------
  // User Subcategories Master
  // ----------------------------------------------------------------------
  async findSubcategories(schoolId: string, categoryId?: string): Promise<UserSubcategory[]> {
    return (this.mem.findAll('user_subcategories', (row: UserSubcategory) => {
      if (row.school_id !== schoolId) return false;
      if (row.deleted_at) return false;
      if (categoryId && row.category_id !== categoryId) return false;
      return true;
    }) as UserSubcategory[]).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async findSubcategoriesByCategory(categoryId: string): Promise<UserSubcategory[]> {
    return this.mem.findAll('user_subcategories', (row: UserSubcategory) => {
      if (row.category_id !== categoryId) return false;
      if (row.deleted_at) return false;
      return true;
    }) as UserSubcategory[];
  }

  async findSubcategoryById(id: string, schoolId?: string): Promise<UserSubcategory | null> {
    const sub = this.mem.findById('user_subcategories', id) as UserSubcategory | null;
    if (!sub || sub.deleted_at) return null;
    if (schoolId && sub.school_id !== schoolId) return null;
    return sub;
  }

  async createSubcategory(data: Omit<UserSubcategory, 'id' | 'created_at' | 'updated_at'>): Promise<UserSubcategory> {
    return this.mem.insert('user_subcategories', {
      ...data,
      code: data.code.toUpperCase(),
    }) as UserSubcategory;
  }

  async updateSubcategory(id: string, updates: Partial<UserSubcategory>): Promise<UserSubcategory | null> {
    return this.mem.update('user_subcategories', id, updates) as UserSubcategory | null;
  }

  async deleteSubcategory(id: string): Promise<boolean> {
    return this.mem.softDelete('user_subcategories', id);
  }

  // ----------------------------------------------------------------------
  // User Tags Master
  // ----------------------------------------------------------------------
  async findTags(schoolId: string): Promise<UserTag[]> {
    return this.mem.findAll('user_tags', (row: UserTag) => row.school_id === schoolId);
  }

  async findTagById(id: string, schoolId?: string): Promise<UserTag | null> {
    const tag = this.mem.findById('user_tags', id) as UserTag | null;
    if (!tag) return null;
    if (schoolId && tag.school_id !== schoolId) return null;
    return tag;
  }

  async createTag(data: Omit<UserTag, 'id' | 'created_at' | 'updated_at'>): Promise<UserTag> {
    return this.mem.insert('user_tags', {
      ...data,
      code: data.code.toUpperCase(),
    }) as UserTag;
  }

  async updateTag(id: string, updates: Partial<UserTag>): Promise<UserTag | null> {
    return this.mem.update('user_tags', id, updates) as UserTag | null;
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.mem.delete('user_tags', id);
  }

  // ----------------------------------------------------------------------
  // User Labels Master
  // ----------------------------------------------------------------------
  async findLabels(schoolId: string): Promise<UserLabel[]> {
    return this.mem.findAll('user_labels', (row: UserLabel) => row.school_id === schoolId);
  }

  async findLabelById(id: string, schoolId?: string): Promise<UserLabel | null> {
    const label = this.mem.findById('user_labels', id) as UserLabel | null;
    if (!label) return null;
    if (schoolId && label.school_id !== schoolId) return null;
    return label;
  }

  async createLabel(data: Omit<UserLabel, 'id' | 'created_at' | 'updated_at'>): Promise<UserLabel> {
    return this.mem.insert('user_labels', {
      ...data,
      code: data.code.toUpperCase(),
    }) as UserLabel;
  }

  async updateLabel(id: string, updates: Partial<UserLabel>): Promise<UserLabel | null> {
    return this.mem.update('user_labels', id, updates) as UserLabel | null;
  }

  async deleteLabel(id: string): Promise<boolean> {
    return this.mem.delete('user_labels', id);
  }

  // ----------------------------------------------------------------------
  // User Taxonomy Mappings (Many-to-Many)
  // ----------------------------------------------------------------------
  async getUserCategories(userId: string): Promise<UserCategory[]> {
    const mappings = this.mem.findAll('user_category_assignments', (row: any) => row.user_id === userId);
    const result: UserCategory[] = [];
    for (const m of mappings) {
      const cat = await this.findCategoryById(m.category_id);
      if (cat) result.push(cat);
    }
    return result;
  }

  async getUserSubcategories(userId: string): Promise<UserSubcategory[]> {
    const mappings = this.mem.findAll('user_subcategory_assignments', (row: any) => row.user_id === userId);
    const result: UserSubcategory[] = [];
    for (const m of mappings) {
      const sub = await this.findSubcategoryById(m.subcategory_id);
      if (sub) result.push(sub);
    }
    return result;
  }

  async getUserTags(userId: string): Promise<UserTag[]> {
    const mappings = this.mem.findAll('user_tag_assignments', (row: any) => row.user_id === userId);
    const result: UserTag[] = [];
    for (const m of mappings) {
      const tag = await this.findTagById(m.tag_id);
      if (tag) result.push(tag);
    }
    return result;
  }

  async getUserLabels(userId: string): Promise<UserLabel[]> {
    const mappings = this.mem.findAll('user_label_assignments', (row: any) => row.user_id === userId);
    const result: UserLabel[] = [];
    for (const m of mappings) {
      const label = await this.findLabelById(m.label_id);
      if (label) result.push(label);
    }
    return result;
  }

  async syncUserTaxonomy(
    userId: string,
    taxonomy: {
      categoryIds?: string[];
      subcategoryIds?: string[];
      tagIds?: string[];
      labelIds?: string[];
    }
  ) {
    // Categories
    if (taxonomy.categoryIds !== undefined) {
      const existing = this.mem.findAll('user_category_assignments', (r: any) => r.user_id === userId);
      for (const e of existing) this.mem.delete('user_category_assignments', e.id);
      for (const catId of taxonomy.categoryIds) {
        this.mem.insert('user_category_assignments', { user_id: userId, category_id: catId });
      }
    }

    // Subcategories
    if (taxonomy.subcategoryIds !== undefined) {
      const existing = this.mem.findAll('user_subcategory_assignments', (r: any) => r.user_id === userId);
      for (const e of existing) this.mem.delete('user_subcategory_assignments', e.id);
      for (const subId of taxonomy.subcategoryIds) {
        this.mem.insert('user_subcategory_assignments', { user_id: userId, subcategory_id: subId });
      }
    }

    // Tags
    if (taxonomy.tagIds !== undefined) {
      const existing = this.mem.findAll('user_tag_assignments', (r: any) => r.user_id === userId);
      for (const e of existing) this.mem.delete('user_tag_assignments', e.id);
      for (const tagId of taxonomy.tagIds) {
        this.mem.insert('user_tag_assignments', { user_id: userId, tag_id: tagId });
      }
    }

    // Labels
    if (taxonomy.labelIds !== undefined) {
      const existing = this.mem.findAll('user_label_assignments', (r: any) => r.user_id === userId);
      for (const e of existing) this.mem.delete('user_label_assignments', e.id);
      for (const labelId of taxonomy.labelIds) {
        this.mem.insert('user_label_assignments', { user_id: userId, label_id: labelId });
      }
    }
  }
}

export const taxonomyRepository = new TaxonomyRepository();
