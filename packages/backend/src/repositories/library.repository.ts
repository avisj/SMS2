// ========================================================================
// Library Repository
// Multi-Tenant PostgREST (Supabase) + In-Memory Fallback Data Access Layer
// Complete Persistence for Library Books, Copies, Members, Issues,
// Fines, Reservations, Lost/Damaged, Settings, and Dashboard Aggregations
// ========================================================================

import crypto from 'crypto';
import {
  LibrarySettings,
  LibraryCategory,
  LibraryAuthor,
  LibraryPublisher,
  LibraryBook,
  LibraryBookAuthor,
  LibraryBookCopy,
  LibraryMember,
  LibraryIssue,
  LibraryReservation,
  LibraryFine,
  LibraryLostDamaged,
  LibraryDashboardMetrics,
  BookCopyStatus,
  BookCopyCondition,
  Location,
  User,
  StudentAcademicEnrollment,
} from '../types/index.js';
import {
  getMemoryDbClient,
  getSupabaseClient,
  isSupabaseDatabaseActive,
} from '../db/client.js';

export class LibraryRepository {
  private mem = getMemoryDbClient();

  // ======================================================================
  // 1. Library Settings
  // ======================================================================

  async getSettings(schoolId: string): Promise<LibrarySettings> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_settings')
          .select('*')
          .eq('school_id', schoolId)
          .maybeSingle();
        if (!error && data) return data as LibrarySettings;
      } catch (err) {
        console.warn('[LibraryRepository.getSettings] Supabase fallback:', err);
      }
    }

    const settings = this.mem.find<LibrarySettings>('library_settings', (s) => s.school_id === schoolId);
    if (settings.length > 0) return settings[0];

    // Default settings fallback
    const defaultSettings: LibrarySettings = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      loan_period_days: 14,
      maximum_books_per_member: 3,
      student_issue_limit: 3,
      staff_issue_limit: 5,
      maximum_renewals: 2,
      fine_per_day: 5.00,
      grace_period_days: 1,
      reservation_enabled: true,
      reservation_expiry_days: 7,
      auto_fine_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.mem.insert('library_settings', defaultSettings);
    return defaultSettings;
  }

  async upsertSettings(schoolId: string, payload: Partial<LibrarySettings>): Promise<LibrarySettings> {
    const existing = await this.getSettings(schoolId);
    const updated: LibrarySettings = {
      ...existing,
      ...payload,
      school_id: schoolId,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_settings')
          .upsert(updated)
          .select()
          .single();
        if (!error && data) return data as LibrarySettings;
      } catch (err) {
        console.warn('[LibraryRepository.upsertSettings] Supabase fallback:', err);
      }
    }

    this.mem.update('library_settings', existing.id, updated);
    return updated;
  }

  // ======================================================================
  // 2. Categories
  // ======================================================================

  async findCategories(schoolId: string): Promise<LibraryCategory[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_categories')
          .select('*')
          .eq('school_id', schoolId)
          .order('name');
        if (!error && data && data.length > 0) return data as LibraryCategory[];
      } catch (err) {
        console.warn('[LibraryRepository.findCategories] Supabase fallback:', err);
      }
    }

    const categories = this.mem.find<LibraryCategory>('library_categories', (c) => c.school_id === schoolId);
    const books = this.mem.find<LibraryBook>('library_books', (b) => b.school_id === schoolId);
    return categories.map((c) => ({
      ...c,
      book_count: books.filter((b) => b.category_id === c.id).length,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(schoolId: string, payload: Partial<LibraryCategory>): Promise<LibraryCategory> {
    const category: LibraryCategory = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      name: payload.name!.trim(),
      code: payload.code?.trim().toUpperCase() || undefined,
      description: payload.description?.trim() || undefined,
      status: payload.status || 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_categories')
          .insert(category)
          .select()
          .single();
        if (!error && data) return data as LibraryCategory;
      } catch (err) {
        console.warn('[LibraryRepository.createCategory] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_categories', category);
    return category;
  }

  async updateCategory(schoolId: string, id: string, payload: Partial<LibraryCategory>): Promise<LibraryCategory> {
    const existing = this.mem.findById<LibraryCategory>('library_categories', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Category not found or unauthorized.');
    }
    const updated = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_categories')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryCategory;
      } catch (err) {
        console.warn('[LibraryRepository.updateCategory] Supabase fallback:', err);
      }
    }

    this.mem.update('library_categories', id, updated);
    return updated;
  }

  async deleteCategory(schoolId: string, id: string): Promise<void> {
    const books = this.mem.find<LibraryBook>('library_books', (b) => b.school_id === schoolId && b.category_id === id);
    if (books.length > 0) {
      throw new Error(`Cannot delete category referenced by ${books.length} book(s). Deactivate it instead.`);
    }

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('library_categories')
          .delete()
          .eq('id', id)
          .eq('school_id', schoolId);
      } catch (err) {
        console.warn('[LibraryRepository.deleteCategory] Supabase fallback:', err);
      }
    }

    this.mem.delete('library_categories', id);
  }

  // ======================================================================
  // 3. Authors
  // ======================================================================

  async findAuthors(schoolId: string): Promise<LibraryAuthor[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_authors')
          .select('*')
          .eq('school_id', schoolId)
          .order('name');
        if (!error && data && data.length > 0) return data as LibraryAuthor[];
      } catch (err) {
        console.warn('[LibraryRepository.findAuthors] Supabase fallback:', err);
      }
    }

    return this.mem.find<LibraryAuthor>('library_authors', (a) => a.school_id === schoolId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createAuthor(schoolId: string, payload: Partial<LibraryAuthor>): Promise<LibraryAuthor> {
    const author: LibraryAuthor = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      name: payload.name!.trim(),
      biography: payload.biography?.trim() || undefined,
      remarks: payload.remarks?.trim() || undefined,
      status: payload.status || 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_authors')
          .insert(author)
          .select()
          .single();
        if (!error && data) return data as LibraryAuthor;
      } catch (err) {
        console.warn('[LibraryRepository.createAuthor] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_authors', author);
    return author;
  }

  async updateAuthor(schoolId: string, id: string, payload: Partial<LibraryAuthor>): Promise<LibraryAuthor> {
    const existing = this.mem.findById<LibraryAuthor>('library_authors', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Author not found.');
    }
    const updated = { ...existing, ...payload, updated_at: new Date().toISOString() };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_authors')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryAuthor;
      } catch (err) {
        console.warn('[LibraryRepository.updateAuthor] Supabase fallback:', err);
      }
    }

    this.mem.update('library_authors', id, updated);
    return updated;
  }

  // ======================================================================
  // 4. Publishers
  // ======================================================================

  async findPublishers(schoolId: string): Promise<LibraryPublisher[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_publishers')
          .select('*')
          .eq('school_id', schoolId)
          .order('name');
        if (!error && data && data.length > 0) return data as LibraryPublisher[];
      } catch (err) {
        console.warn('[LibraryRepository.findPublishers] Supabase fallback:', err);
      }
    }

    return this.mem.find<LibraryPublisher>('library_publishers', (p) => p.school_id === schoolId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createPublisher(schoolId: string, payload: Partial<LibraryPublisher>): Promise<LibraryPublisher> {
    const publisher: LibraryPublisher = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      name: payload.name!.trim(),
      contact: payload.contact?.trim() || undefined,
      email: payload.email?.trim() || undefined,
      phone: payload.phone?.trim() || undefined,
      address: payload.address?.trim() || undefined,
      website: payload.website?.trim() || undefined,
      remarks: payload.remarks?.trim() || undefined,
      status: payload.status || 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_publishers')
          .insert(publisher)
          .select()
          .single();
        if (!error && data) return data as LibraryPublisher;
      } catch (err) {
        console.warn('[LibraryRepository.createPublisher] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_publishers', publisher);
    return publisher;
  }

  async updatePublisher(schoolId: string, id: string, payload: Partial<LibraryPublisher>): Promise<LibraryPublisher> {
    const existing = this.mem.findById<LibraryPublisher>('library_publishers', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Publisher not found.');
    }
    const updated = { ...existing, ...payload, updated_at: new Date().toISOString() };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_publishers')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryPublisher;
      } catch (err) {
        console.warn('[LibraryRepository.updatePublisher] Supabase fallback:', err);
      }
    }

    this.mem.update('library_publishers', id, updated);
    return updated;
  }

  // ======================================================================
  // 5. Books & Copies
  // ======================================================================

  private hydrateBook(book: LibraryBook, schoolId: string): LibraryBook {
    const category = this.mem.findById<LibraryCategory>('library_categories', book.category_id);
    const publisher = book.publisher_id ? this.mem.findById<LibraryPublisher>('library_publishers', book.publisher_id) : undefined;
    
    // Find book authors
    const bookAuthorLinks = this.mem.find<LibraryBookAuthor>('library_book_authors', (ba) => ba.book_id === book.id);
    const authors = bookAuthorLinks
      .map((ba) => this.mem.findById<LibraryAuthor>('library_authors', ba.author_id))
      .filter(Boolean) as LibraryAuthor[];

    // Find copies
    const copies = this.mem.find<LibraryBookCopy>('library_book_copies', (c) => c.book_id === book.id && c.school_id === schoolId);
    const availableCopies = copies.filter((c) => c.status === 'AVAILABLE');

    return {
      ...book,
      category: category || undefined,
      publisher: publisher || undefined,
      authors,
      copies,
      total_copies_count: copies.length,
      available_copies_count: availableCopies.length,
    };
  }

  async findBooks(
    schoolId: string,
    filters?: { search?: string; category_id?: string; author_id?: string; publisher_id?: string; status?: string }
  ): Promise<LibraryBook[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('library_books')
          .select(`
            *,
            category:library_categories(*),
            publisher:library_publishers(*),
            book_authors:library_book_authors(
              *,
              author:library_authors(*)
            ),
            copies:library_book_copies(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.category_id) query = query.eq('category_id', filters.category_id);
        if (filters?.publisher_id) query = query.eq('publisher_id', filters.publisher_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query.order('title');
        if (!error && data && data.length > 0) {
          return data.map((b: any) => ({
            ...b,
            authors: (b.book_authors || []).map((ba: any) => ba.author).filter(Boolean),
            total_copies_count: (b.copies || []).length,
            available_copies_count: (b.copies || []).filter((c: any) => c.status === 'AVAILABLE').length,
          })) as LibraryBook[];
        }
      } catch (err) {
        console.warn('[LibraryRepository.findBooks] Supabase fallback:', err);
      }
    }

    let books = this.mem.find<LibraryBook>('library_books', (b) => b.school_id === schoolId);

    if (filters?.category_id) books = books.filter((b) => b.category_id === filters.category_id);
    if (filters?.publisher_id) books = books.filter((b) => b.publisher_id === filters.publisher_id);
    if (filters?.status) books = books.filter((b) => b.status === filters.status);

    let hydrated = books.map((b) => this.hydrateBook(b, schoolId));

    if (filters?.author_id) {
      hydrated = hydrated.filter((b) => (b.authors || []).some((a) => a.id === filters.author_id));
    }

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      hydrated = hydrated.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          (b.isbn && b.isbn.toLowerCase().includes(term)) ||
          (b.accession_reference && b.accession_reference.toLowerCase().includes(term)) ||
          (b.subject && b.subject.toLowerCase().includes(term)) ||
          (b.authors && b.authors.some((a) => a.name.toLowerCase().includes(term)))
      );
    }

    return hydrated.sort((a, b) => a.title.localeCompare(b.title));
  }

  async findBookById(schoolId: string, id: string): Promise<LibraryBook | null> {
    const book = this.mem.findById<LibraryBook>('library_books', id);
    if (!book || book.school_id !== schoolId) return null;
    return this.hydrateBook(book, schoolId);
  }

  async createBook(schoolId: string, payload: Partial<LibraryBook>, authorIds: string[] = []): Promise<LibraryBook> {
    const book: LibraryBook = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      accession_reference: payload.accession_reference?.trim() || undefined,
      isbn: payload.isbn?.trim() || undefined,
      title: payload.title!.trim(),
      subtitle: payload.subtitle?.trim() || undefined,
      category_id: payload.category_id!,
      publisher_id: payload.publisher_id || undefined,
      publication_year: payload.publication_year || undefined,
      edition: payload.edition?.trim() || undefined,
      language: payload.language || 'English',
      pages: payload.pages || undefined,
      description: payload.description?.trim() || undefined,
      subject: payload.subject?.trim() || undefined,
      class_level: payload.class_level?.trim() || undefined,
      cover_image: payload.cover_image?.trim() || undefined,
      price: Number(payload.price || 0),
      status: payload.status || 'ACTIVE',
      created_by: payload.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_books')
          .insert(book)
          .select()
          .single();
        if (!error && data) {
          if (authorIds.length > 0) {
            const authorRows = authorIds.map((aId, idx) => ({
              school_id: schoolId,
              book_id: book.id,
              author_id: aId,
              is_primary: idx === 0,
            }));
            await getSupabaseClient()!.from('library_book_authors').insert(authorRows);
          }
        }
      } catch (err) {
        console.warn('[LibraryRepository.createBook] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_books', book);

    for (let i = 0; i < authorIds.length; i++) {
      this.mem.insert('library_book_authors', {
        id: crypto.randomUUID(),
        school_id: schoolId,
        book_id: book.id,
        author_id: authorIds[i],
        is_primary: i === 0,
        created_at: new Date().toISOString(),
      });
    }

    return this.hydrateBook(book, schoolId);
  }

  async updateBook(schoolId: string, id: string, payload: Partial<LibraryBook>, authorIds?: string[]): Promise<LibraryBook> {
    const existing = this.mem.findById<LibraryBook>('library_books', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Book not found.');
    }
    const updated = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        await getSupabaseClient()!
          .from('library_books')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId);

        if (authorIds !== undefined) {
          await getSupabaseClient()!.from('library_book_authors').delete().eq('book_id', id);
          if (authorIds.length > 0) {
            const authorRows = authorIds.map((aId, idx) => ({
              school_id: schoolId,
              book_id: id,
              author_id: aId,
              is_primary: idx === 0,
            }));
            await getSupabaseClient()!.from('library_book_authors').insert(authorRows);
          }
        }
      } catch (err) {
        console.warn('[LibraryRepository.updateBook] Supabase fallback:', err);
      }
    }

    this.mem.update('library_books', id, updated);

    if (authorIds !== undefined) {
      // Remove existing author links
      const currentLinks = this.mem.find<LibraryBookAuthor>('library_book_authors', (ba) => ba.book_id === id);
      for (const link of currentLinks) {
        this.mem.delete('library_book_authors', link.id);
      }
      // Insert new links
      for (let i = 0; i < authorIds.length; i++) {
        this.mem.insert('library_book_authors', {
          id: crypto.randomUUID(),
          school_id: schoolId,
          book_id: id,
          author_id: authorIds[i],
          is_primary: i === 0,
          created_at: new Date().toISOString(),
        });
      }
    }

    return this.hydrateBook(updated, schoolId);
  }

  // ======================================================================
  // 6. Book Copies
  // ======================================================================

  private hydrateCopy(copy: LibraryBookCopy, schoolId: string): LibraryBookCopy {
    const book = this.mem.findById<LibraryBook>('library_books', copy.book_id);
    const location = this.mem.findById<Location>('locations', copy.location_id);
    const activeIssue = this.mem.find<LibraryIssue>(
      'library_issues',
      (i) => i.book_copy_id === copy.id && i.status === 'ISSUED' && i.school_id === schoolId
    )[0];

    return {
      ...copy,
      book: book ? this.hydrateBook(book, schoolId) : undefined,
      location: location || undefined,
      current_issue: activeIssue || undefined,
    };
  }

  async findCopies(
    schoolId: string,
    filters?: { book_id?: string; location_id?: string; status?: string; search?: string }
  ): Promise<LibraryBookCopy[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('library_book_copies')
          .select(`
            *,
            book:library_books(*),
            location:locations(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.book_id) query = query.eq('book_id', filters.book_id);
        if (filters?.location_id) query = query.eq('location_id', filters.location_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query.order('copy_code');
        if (!error && data && data.length > 0) return data as LibraryBookCopy[];
      } catch (err) {
        console.warn('[LibraryRepository.findCopies] Supabase fallback:', err);
      }
    }

    let copies = this.mem.find<LibraryBookCopy>('library_book_copies', (c) => c.school_id === schoolId);

    if (filters?.book_id) copies = copies.filter((c) => c.book_id === filters.book_id);
    if (filters?.location_id) copies = copies.filter((c) => c.location_id === filters.location_id);
    if (filters?.status) copies = copies.filter((c) => c.status === filters.status);

    let hydrated = copies.map((c) => this.hydrateCopy(c, schoolId));

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      hydrated = hydrated.filter(
        (c) =>
          c.copy_code.toLowerCase().includes(term) ||
          (c.barcode && c.barcode.toLowerCase().includes(term)) ||
          (c.accession_number && c.accession_number.toLowerCase().includes(term)) ||
          (c.book && c.book.title.toLowerCase().includes(term))
      );
    }

    return hydrated.sort((a, b) => a.copy_code.localeCompare(b.copy_code));
  }

  async findCopyById(schoolId: string, id: string): Promise<LibraryBookCopy | null> {
    const copy = this.mem.findById<LibraryBookCopy>('library_book_copies', id);
    if (!copy || copy.school_id !== schoolId) return null;
    return this.hydrateCopy(copy, schoolId);
  }

  async findCopyByCodeOrBarcode(schoolId: string, queryTerm: string): Promise<LibraryBookCopy | null> {
    const term = queryTerm.trim();
    const copy = this.mem.find<LibraryBookCopy>(
      'library_book_copies',
      (c) =>
        c.school_id === schoolId &&
        (c.copy_code.toUpperCase() === term.toUpperCase() ||
          (c.barcode && c.barcode.toUpperCase() === term.toUpperCase()) ||
          (c.accession_number && c.accession_number.toUpperCase() === term.toUpperCase()))
    )[0];
    if (!copy) return null;
    return this.hydrateCopy(copy, schoolId);
  }

  async createCopy(schoolId: string, payload: Partial<LibraryBookCopy>): Promise<LibraryBookCopy> {
    const copyCode = payload.copy_code || (await this.getNextCopyCode(schoolId));
    const barcode = payload.barcode?.trim() || `BC-${copyCode}`;

    const copy: LibraryBookCopy = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      book_id: payload.book_id!,
      copy_code: copyCode,
      accession_number: payload.accession_number?.trim() || copyCode,
      barcode,
      purchase_date: payload.purchase_date || new Date().toISOString().split('T')[0],
      purchase_price: Number(payload.purchase_price || 0),
      vendor_id: payload.vendor_id || undefined,
      purchase_order_id: payload.purchase_order_id || undefined,
      location_id: payload.location_id!,
      room: payload.room?.trim() || undefined,
      shelf: payload.shelf?.trim() || undefined,
      rack: payload.rack?.trim() || undefined,
      condition: payload.condition || 'GOOD',
      status: payload.status || 'AVAILABLE',
      remarks: payload.remarks?.trim() || undefined,
      created_by: payload.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_book_copies')
          .insert(copy)
          .select()
          .single();
        if (!error && data) return data as LibraryBookCopy;
      } catch (err) {
        console.warn('[LibraryRepository.createCopy] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_book_copies', copy);
    return this.hydrateCopy(copy, schoolId);
  }

  async updateCopy(schoolId: string, id: string, payload: Partial<LibraryBookCopy>): Promise<LibraryBookCopy> {
    const existing = this.mem.findById<LibraryBookCopy>('library_book_copies', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Book copy not found.');
    }
    const updated = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_book_copies')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryBookCopy;
      } catch (err) {
        console.warn('[LibraryRepository.updateCopy] Supabase fallback:', err);
      }
    }

    this.mem.update('library_book_copies', id, updated);
    return this.hydrateCopy(updated, schoolId);
  }

  async getNextCopyCode(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LIB-${year}-`;
    const copies = this.mem.find<LibraryBookCopy>(
      'library_book_copies',
      (c) => c.school_id === schoolId && c.copy_code.startsWith(prefix)
    );
    let maxNum = 0;
    for (const c of copies) {
      const numPart = parseInt(c.copy_code.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    }
    return `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
  }

  // ======================================================================
  // 7. Library Members
  // ======================================================================

  private hydrateMember(member: LibraryMember, schoolId: string): LibraryMember {
    const user = this.mem.findById<User>('users', member.user_id);
    const activeIssues = this.mem.find<LibraryIssue>(
      'library_issues',
      (i) => i.member_user_id === member.user_id && i.status === 'ISSUED' && i.school_id === schoolId
    );
    const now = new Date().toISOString().split('T')[0];
    const overdueIssues = activeIssues.filter((i) => i.due_date < now);

    const unpaidFines = this.mem.find<LibraryFine>(
      'library_fines',
      (f) => f.member_user_id === member.user_id && f.school_id === schoolId && f.status !== 'PAID' && f.status !== 'WAIVED'
    );
    const totalFinesUnpaid = unpaidFines.reduce((sum, f) => sum + Number(f.balance_amount || 0), 0);

    // Hydrate student enrollment for student members
    const enrollment = this.mem.find<StudentAcademicEnrollment>(
      'student_academic_enrollments',
      (e) => e.student_user_id === member.user_id && e.school_id === schoolId
    )[0];

    return {
      ...member,
      user: user || undefined,
      active_issues_count: activeIssues.length,
      overdue_issues_count: overdueIssues.length,
      total_fines_unpaid: totalFinesUnpaid,
      student_enrollment: enrollment || undefined,
    };
  }

  async findMembers(
    schoolId: string,
    filters?: { search?: string; type?: string; status?: string }
  ): Promise<LibraryMember[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('library_members')
          .select(`
            *,
            user:users(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.type) query = query.eq('membership_type', filters.type);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query.order('membership_number');
        if (!error && data && data.length > 0) return data as LibraryMember[];
      } catch (err) {
        console.warn('[LibraryRepository.findMembers] Supabase fallback:', err);
      }
    }

    let members = this.mem.find<LibraryMember>('library_members', (m) => m.school_id === schoolId);

    if (filters?.type) members = members.filter((m) => m.membership_type === filters.type);
    if (filters?.status) members = members.filter((m) => m.status === filters.status);

    let hydrated = members.map((m) => this.hydrateMember(m, schoolId));

    if (filters?.search) {
      const term = filters.search.toLowerCase();
      hydrated = hydrated.filter((m) => {
        const u = m.user;
        const name = u ? `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase() : '';
        const email = u?.email?.toLowerCase() || '';
        const num = m.membership_number.toLowerCase();
        return name.includes(term) || email.includes(term) || num.includes(term);
      });
    }

    return hydrated.sort((a, b) => a.membership_number.localeCompare(b.membership_number));
  }

  async findMemberByUserId(schoolId: string, userId: string): Promise<LibraryMember | null> {
    const member = this.mem.find<LibraryMember>(
      'library_members',
      (m) => m.school_id === schoolId && m.user_id === userId
    )[0];
    if (!member) return null;
    return this.hydrateMember(member, schoolId);
  }

  async findMemberById(schoolId: string, id: string): Promise<LibraryMember | null> {
    const member = this.mem.findById<LibraryMember>('library_members', id);
    if (!member || member.school_id !== schoolId) return null;
    return this.hydrateMember(member, schoolId);
  }

  async createMember(schoolId: string, payload: Partial<LibraryMember>): Promise<LibraryMember> {
    const existing = await this.findMemberByUserId(schoolId, payload.user_id!);
    if (existing) {
      throw new Error('User is already registered as a library member.');
    }

    const membershipNumber = payload.membership_number || (await this.getNextMembershipNumber(schoolId));
    const member: LibraryMember = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      user_id: payload.user_id!,
      membership_number: membershipNumber,
      membership_type: payload.membership_type || 'STUDENT',
      status: payload.status || 'ACTIVE',
      max_books_allowed: payload.max_books_allowed || undefined,
      joined_date: payload.joined_date || new Date().toISOString().split('T')[0],
      expiry_date: payload.expiry_date || undefined,
      remarks: payload.remarks?.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_members')
          .insert(member)
          .select()
          .single();
        if (!error && data) return data as LibraryMember;
      } catch (err) {
        console.warn('[LibraryRepository.createMember] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_members', member);
    return this.hydrateMember(member, schoolId);
  }

  async updateMember(schoolId: string, id: string, payload: Partial<LibraryMember>): Promise<LibraryMember> {
    const existing = this.mem.findById<LibraryMember>('library_members', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Member record not found.');
    }
    const updated = { ...existing, ...payload, updated_at: new Date().toISOString() };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_members')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryMember;
      } catch (err) {
        console.warn('[LibraryRepository.updateMember] Supabase fallback:', err);
      }
    }

    this.mem.update('library_members', id, updated);
    return this.hydrateMember(updated, schoolId);
  }

  async getNextMembershipNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `MEM-${year}-`;
    const members = this.mem.find<LibraryMember>(
      'library_members',
      (m) => m.school_id === schoolId && m.membership_number.startsWith(prefix)
    );
    let maxNum = 0;
    for (const m of members) {
      const numPart = parseInt(m.membership_number.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    }
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
  }

  // ======================================================================
  // 8. Issues & Circulation
  // ======================================================================

  private hydrateIssue(issue: LibraryIssue, schoolId: string): LibraryIssue {
    const user = this.mem.findById<User>('users', issue.member_user_id);
    const book = this.mem.findById<LibraryBook>('library_books', issue.book_id);
    const copy = this.mem.findById<LibraryBookCopy>('library_book_copies', issue.book_copy_id);
    const issuedBy = issue.issued_by ? this.mem.findById<User>('users', issue.issued_by) : undefined;
    const returnedBy = issue.returned_by ? this.mem.findById<User>('users', issue.returned_by) : undefined;
    const fine = this.mem.find<LibraryFine>('library_fines', (f) => f.issue_id === issue.id && f.school_id === schoolId)[0];

    return {
      ...issue,
      member_user: user || undefined,
      book: book ? this.hydrateBook(book, schoolId) : undefined,
      book_copy: copy ? this.hydrateCopy(copy, schoolId) : undefined,
      issued_by_user: issuedBy || undefined,
      returned_by_user: returnedBy || undefined,
      fine: fine || undefined,
    };
  }

  async findIssues(
    schoolId: string,
    filters?: { member_user_id?: string; book_id?: string; book_copy_id?: string; status?: string }
  ): Promise<LibraryIssue[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('library_issues')
          .select(`
            *,
            member_user:users!member_user_id(*),
            book:library_books(*),
            book_copy:library_book_copies(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.member_user_id) query = query.eq('member_user_id', filters.member_user_id);
        if (filters?.book_id) query = query.eq('book_id', filters.book_id);
        if (filters?.book_copy_id) query = query.eq('book_copy_id', filters.book_copy_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as LibraryIssue[];
      } catch (err) {
        console.warn('[LibraryRepository.findIssues] Supabase fallback:', err);
      }
    }

    let issues = this.mem.find<LibraryIssue>('library_issues', (i) => i.school_id === schoolId);

    if (filters?.member_user_id) issues = issues.filter((i) => i.member_user_id === filters.member_user_id);
    if (filters?.book_id) issues = issues.filter((i) => i.book_id === filters.book_id);
    if (filters?.book_copy_id) issues = issues.filter((i) => i.book_copy_id === filters.book_copy_id);
    if (filters?.status) issues = issues.filter((i) => i.status === filters.status);

    return issues
      .map((i) => this.hydrateIssue(i, schoolId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async findIssueById(schoolId: string, id: string): Promise<LibraryIssue | null> {
    const issue = this.mem.findById<LibraryIssue>('library_issues', id);
    if (!issue || issue.school_id !== schoolId) return null;
    return this.hydrateIssue(issue, schoolId);
  }

  async findActiveIssueForCopy(schoolId: string, copyId: string): Promise<LibraryIssue | null> {
    const issue = this.mem.find<LibraryIssue>(
      'library_issues',
      (i) => i.school_id === schoolId && i.book_copy_id === copyId && i.status === 'ISSUED'
    )[0];
    if (!issue) return null;
    return this.hydrateIssue(issue, schoolId);
  }

  async countActiveIssuesForMember(schoolId: string, memberUserId: string): Promise<number> {
    const issues = this.mem.find<LibraryIssue>(
      'library_issues',
      (i) => i.school_id === schoolId && i.member_user_id === memberUserId && i.status === 'ISSUED'
    );
    return issues.length;
  }

  async createIssue(schoolId: string, payload: Partial<LibraryIssue>): Promise<LibraryIssue> {
    const issue: LibraryIssue = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      member_user_id: payload.member_user_id!,
      book_id: payload.book_id!,
      book_copy_id: payload.book_copy_id!,
      issue_date: payload.issue_date || new Date().toISOString().split('T')[0],
      due_date: payload.due_date!,
      return_date: null,
      renewal_count: 0,
      status: 'ISSUED',
      issued_by: payload.issued_by,
      remarks: payload.remarks?.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_issues')
          .insert(issue)
          .select()
          .single();
        if (!error && data) return data as LibraryIssue;
      } catch (err) {
        console.warn('[LibraryRepository.createIssue] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_issues', issue);
    return this.hydrateIssue(issue, schoolId);
  }

  async updateIssue(schoolId: string, id: string, payload: Partial<LibraryIssue>): Promise<LibraryIssue> {
    const existing = this.mem.findById<LibraryIssue>('library_issues', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Issue transaction not found.');
    }
    const updated = { ...existing, ...payload, updated_at: new Date().toISOString() };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_issues')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryIssue;
      } catch (err) {
        console.warn('[LibraryRepository.updateIssue] Supabase fallback:', err);
      }
    }

    this.mem.update('library_issues', id, updated);
    return this.hydrateIssue(updated, schoolId);
  }

  // ======================================================================
  // 9. Reservations
  // ======================================================================

  private hydrateReservation(reservation: LibraryReservation, schoolId: string): LibraryReservation {
    const book = this.mem.findById<LibraryBook>('library_books', reservation.book_id);
    const user = this.mem.findById<User>('users', reservation.member_user_id);
    const fulfilledCopy = reservation.fulfilled_copy_id
      ? this.mem.findById<LibraryBookCopy>('library_book_copies', reservation.fulfilled_copy_id)
      : undefined;

    return {
      ...reservation,
      book: book ? this.hydrateBook(book, schoolId) : undefined,
      member_user: user || undefined,
      fulfilled_copy: fulfilledCopy ? this.hydrateCopy(fulfilledCopy, schoolId) : undefined,
    };
  }

  async findReservations(
    schoolId: string,
    filters?: { book_id?: string; member_user_id?: string; status?: string }
  ): Promise<LibraryReservation[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('library_reservations')
          .select(`
            *,
            book:library_books(*),
            member_user:users(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.book_id) query = query.eq('book_id', filters.book_id);
        if (filters?.member_user_id) query = query.eq('member_user_id', filters.member_user_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query.order('queue_position');
        if (!error && data && data.length > 0) return data as LibraryReservation[];
      } catch (err) {
        console.warn('[LibraryRepository.findReservations] Supabase fallback:', err);
      }
    }

    let reservations = this.mem.find<LibraryReservation>('library_reservations', (r) => r.school_id === schoolId);

    if (filters?.book_id) reservations = reservations.filter((r) => r.book_id === filters.book_id);
    if (filters?.member_user_id) reservations = reservations.filter((r) => r.member_user_id === filters.member_user_id);
    if (filters?.status) reservations = reservations.filter((r) => r.status === filters.status);

    return reservations
      .map((r) => this.hydrateReservation(r, schoolId))
      .sort((a, b) => a.queue_position - b.queue_position);
  }

  async findReservationById(schoolId: string, id: string): Promise<LibraryReservation | null> {
    const res = this.mem.findById<LibraryReservation>('library_reservations', id);
    if (!res || res.school_id !== schoolId) return null;
    return this.hydrateReservation(res, schoolId);
  }

  async createReservation(schoolId: string, payload: Partial<LibraryReservation>): Promise<LibraryReservation> {
    const queuePosition = await this.getNextQueuePosition(schoolId, payload.book_id!);
    const reservation: LibraryReservation = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      book_id: payload.book_id!,
      member_user_id: payload.member_user_id!,
      reservation_date: payload.reservation_date || new Date().toISOString().split('T')[0],
      expiry_date: payload.expiry_date!,
      queue_position: queuePosition,
      status: 'ACTIVE',
      remarks: payload.remarks?.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_reservations')
          .insert(reservation)
          .select()
          .single();
        if (!error && data) return data as LibraryReservation;
      } catch (err) {
        console.warn('[LibraryRepository.createReservation] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_reservations', reservation);
    return this.hydrateReservation(reservation, schoolId);
  }

  async updateReservation(schoolId: string, id: string, payload: Partial<LibraryReservation>): Promise<LibraryReservation> {
    const existing = this.mem.findById<LibraryReservation>('library_reservations', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Reservation not found.');
    }
    const updated = { ...existing, ...payload, updated_at: new Date().toISOString() };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_reservations')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryReservation;
      } catch (err) {
        console.warn('[LibraryRepository.updateReservation] Supabase fallback:', err);
      }
    }

    this.mem.update('library_reservations', id, updated);
    return this.hydrateReservation(updated, schoolId);
  }

  async getNextQueuePosition(schoolId: string, bookId: string): Promise<number> {
    const active = this.mem.find<LibraryReservation>(
      'library_reservations',
      (r) => r.school_id === schoolId && r.book_id === bookId && r.status === 'ACTIVE'
    );
    let max = 0;
    for (const r of active) {
      if (r.queue_position > max) max = r.queue_position;
    }
    return max + 1;
  }

  // ======================================================================
  // 10. Fines & Payments
  // ======================================================================

  private hydrateFine(fine: LibraryFine, schoolId: string): LibraryFine {
    const user = this.mem.findById<User>('users', fine.member_user_id);
    const issue = fine.issue_id ? this.mem.findById<LibraryIssue>('library_issues', fine.issue_id) : undefined;
    const receivedBy = fine.received_by ? this.mem.findById<User>('users', fine.received_by) : undefined;
    const waivedBy = fine.waived_by ? this.mem.findById<User>('users', fine.waived_by) : undefined;

    return {
      ...fine,
      member_user: user || undefined,
      issue: issue ? this.hydrateIssue(issue, schoolId) : undefined,
      received_by_user: receivedBy || undefined,
      waived_by_user: waivedBy || undefined,
    };
  }

  async findFines(
    schoolId: string,
    filters?: { member_user_id?: string; status?: string }
  ): Promise<LibraryFine[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        let query = getSupabaseClient()!
          .from('library_fines')
          .select(`
            *,
            member_user:users!member_user_id(*),
            issue:library_issues(*)
          `)
          .eq('school_id', schoolId);

        if (filters?.member_user_id) query = query.eq('member_user_id', filters.member_user_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as LibraryFine[];
      } catch (err) {
        console.warn('[LibraryRepository.findFines] Supabase fallback:', err);
      }
    }

    let fines = this.mem.find<LibraryFine>('library_fines', (f) => f.school_id === schoolId);

    if (filters?.member_user_id) fines = fines.filter((f) => f.member_user_id === filters.member_user_id);
    if (filters?.status) fines = fines.filter((f) => f.status === filters.status);

    return fines
      .map((f) => this.hydrateFine(f, schoolId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async createFine(schoolId: string, payload: Partial<LibraryFine>): Promise<LibraryFine> {
    const amount = Number(payload.amount || 0);
    const paidAmount = Number(payload.paid_amount || 0);
    const balanceAmount = amount - paidAmount;
    let status: LibraryFine['status'] = 'UNPAID';
    if (paidAmount >= amount && amount > 0) status = 'PAID';
    else if (paidAmount > 0) status = 'PARTIALLY_PAID';

    const fine: LibraryFine = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      issue_id: payload.issue_id || undefined,
      member_user_id: payload.member_user_id!,
      fine_date: payload.fine_date || new Date().toISOString().split('T')[0],
      amount,
      reason: payload.reason || 'OVERDUE',
      status,
      paid_amount: paidAmount,
      balance_amount: balanceAmount,
      paid_date: payload.paid_date || undefined,
      payment_mode: payload.payment_mode || undefined,
      payment_reference: payload.payment_reference || undefined,
      received_by: payload.received_by || undefined,
      remarks: payload.remarks?.trim() || undefined,
      created_by: payload.created_by || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_fines')
          .insert(fine)
          .select()
          .single();
        if (!error && data) return data as LibraryFine;
      } catch (err) {
        console.warn('[LibraryRepository.createFine] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_fines', fine);
    return this.hydrateFine(fine, schoolId);
  }

  async updateFine(schoolId: string, id: string, payload: Partial<LibraryFine>): Promise<LibraryFine> {
    const existing = this.mem.findById<LibraryFine>('library_fines', id);
    if (!existing || existing.school_id !== schoolId) {
      throw new Error('Fine record not found.');
    }
    const updated = { ...existing, ...payload, updated_at: new Date().toISOString() };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_fines')
          .update(updated)
          .eq('id', id)
          .eq('school_id', schoolId)
          .select()
          .single();
        if (!error && data) return data as LibraryFine;
      } catch (err) {
        console.warn('[LibraryRepository.updateFine] Supabase fallback:', err);
      }
    }

    this.mem.update('library_fines', id, updated);
    return this.hydrateFine(updated, schoolId);
  }

  // ======================================================================
  // 11. Lost / Damaged / Disposed
  // ======================================================================

  private hydrateLostDamaged(record: LibraryLostDamaged, schoolId: string): LibraryLostDamaged {
    const copy = this.mem.findById<LibraryBookCopy>('library_book_copies', record.book_copy_id);
    const member = record.responsible_member_id ? this.mem.findById<User>('users', record.responsible_member_id) : undefined;
    const reportedBy = record.reported_by ? this.mem.findById<User>('users', record.reported_by) : undefined;
    const fine = record.fine_id ? this.mem.findById<LibraryFine>('library_fines', record.fine_id) : undefined;

    return {
      ...record,
      book_copy: copy ? this.hydrateCopy(copy, schoolId) : undefined,
      responsible_member: member || undefined,
      reported_by_user: reportedBy || undefined,
      fine: fine || undefined,
    };
  }

  async findLostDamaged(schoolId: string): Promise<LibraryLostDamaged[]> {
    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_lost_damaged')
          .select(`
            *,
            book_copy:library_book_copies(*),
            responsible_member:users!responsible_member_id(*),
            reported_by_user:users!reported_by(*)
          `)
          .eq('school_id', schoolId)
          .order('record_date', { ascending: false });
        if (!error && data && data.length > 0) return data as LibraryLostDamaged[];
      } catch (err) {
        console.warn('[LibraryRepository.findLostDamaged] Supabase fallback:', err);
      }
    }

    return this.mem.find<LibraryLostDamaged>('library_lost_damaged', (l) => l.school_id === schoolId)
      .map((l) => this.hydrateLostDamaged(l, schoolId))
      .sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime());
  }

  async createLostDamaged(schoolId: string, payload: Partial<LibraryLostDamaged>): Promise<LibraryLostDamaged> {
    const record: LibraryLostDamaged = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      book_copy_id: payload.book_copy_id!,
      issue_id: payload.issue_id || undefined,
      record_type: payload.record_type!,
      record_date: payload.record_date || new Date().toISOString().split('T')[0],
      reported_by: payload.reported_by || undefined,
      responsible_member_id: payload.responsible_member_id || undefined,
      description: payload.description!.trim(),
      cost_charged: Number(payload.cost_charged || 0),
      fine_id: payload.fine_id || undefined,
      remarks: payload.remarks?.trim() || undefined,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseDatabaseActive() && getSupabaseClient()) {
      try {
        const { data, error } = await getSupabaseClient()!
          .from('library_lost_damaged')
          .insert(record)
          .select()
          .single();
        if (!error && data) return data as LibraryLostDamaged;
      } catch (err) {
        console.warn('[LibraryRepository.createLostDamaged] Supabase fallback:', err);
      }
    }

    this.mem.insert('library_lost_damaged', record);
    return this.hydrateLostDamaged(record, schoolId);
  }

  // ======================================================================
  // 12. Dashboard Metrics
  // ======================================================================

  async getDashboardMetrics(schoolId: string): Promise<LibraryDashboardMetrics> {
    const books = await this.findBooks(schoolId);
    const copies = await this.findCopies(schoolId);
    const issues = await this.findIssues(schoolId);
    const members = await this.findMembers(schoolId);
    const fines = await this.findFines(schoolId);
    const reservations = await this.findReservations(schoolId);
    const categories = await this.findCategories(schoolId);

    const now = new Date().toISOString().split('T')[0];

    const activeIssues = issues.filter((i) => i.status === 'ISSUED');
    const overdueIssues = activeIssues.filter((i) => i.due_date < now);
    const availableCopies = copies.filter((c) => c.status === 'AVAILABLE').length;
    const issuedCopies = copies.filter((c) => c.status === 'ISSUED').length;
    const reservedBooks = reservations.filter((r) => r.status === 'ACTIVE').length;
    const lostBooks = copies.filter((c) => c.status === 'LOST').length;
    const damagedBooks = copies.filter((c) => c.status === 'DAMAGED').length;
    const activeMembers = members.filter((m) => m.status === 'ACTIVE').length;

    let outstandingFines = 0;
    let totalFineCollected = 0;
    for (const f of fines) {
      if (f.status !== 'WAIVED') {
        outstandingFines += Number(f.balance_amount || 0);
        totalFineCollected += Number(f.paid_amount || 0);
      }
    }

    // Books by category
    const byCategory = categories.map((cat) => ({
      category_id: cat.id,
      category_name: cat.name,
      count: books.filter((b) => b.category_id === cat.id).length,
    }));

    // Copies by status
    const statusCounts: Record<BookCopyStatus, number> = {
      AVAILABLE: 0,
      ISSUED: 0,
      RESERVED: 0,
      LOST: 0,
      DAMAGED: 0,
      UNDER_REPAIR: 0,
      DISPOSED: 0,
    };
    for (const c of copies) {
      if (statusCounts[c.status] !== undefined) statusCounts[c.status]++;
    }
    const byStatus = (Object.keys(statusCounts) as BookCopyStatus[]).map((status) => ({
      status,
      count: statusCounts[status],
    }));

    // Most issued books
    const issueCountByBook: Record<string, { title: string; count: number }> = {};
    for (const b of books) {
      issueCountByBook[b.id] = { title: b.title, count: 0 };
    }
    for (const i of issues) {
      if (issueCountByBook[i.book_id]) {
        issueCountByBook[i.book_id].count++;
      }
    }
    const mostIssuedBooks = Object.keys(issueCountByBook)
      .map((bookId) => ({
        book_id: bookId,
        title: issueCountByBook[bookId].title,
        issue_count: issueCountByBook[bookId].count,
      }))
      .sort((a, b) => b.issue_count - a.issue_count)
      .slice(0, 5);

    const recentIssues = issues.slice(0, 5);
    const recentReturns = issues.filter((i) => i.status === 'RETURNED').slice(0, 5);
    const pendingReservations = reservations.filter((r) => r.status === 'ACTIVE').slice(0, 5);

    return {
      total_books: books.length,
      total_copies: copies.length,
      available_copies: availableCopies,
      issued_copies: issuedCopies,
      overdue_books: overdueIssues.length,
      reserved_books: reservedBooks,
      lost_books: lostBooks,
      damaged_books: damagedBooks,
      active_members: activeMembers,
      outstanding_fines: outstandingFines,
      total_fine_collected: totalFineCollected,
      by_category: byCategory,
      by_status: byStatus,
      most_issued_books: mostIssuedBooks,
      recent_issues: recentIssues,
      recent_returns: recentReturns,
      overdue_issues: overdueIssues.slice(0, 5),
      pending_reservations: pendingReservations,
    };
  }
}

export const libraryRepository = new LibraryRepository();
