import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import { isUniqueViolation } from "../kernel/pg.js";
import { AppError } from "../shared/errors/index.js";
import type { CategoryRecord } from "./auction-item.types.js";
import type { CreateCategoryRequest } from "@auction/shared";

// Raw shape returned by the database driver — all keys are snake_case.
interface DbCategory {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: DbCategory): CategoryRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Categories have no RLS — they are the shared public taxonomy used by the
// AI categorization service, so no user-scoped session context is needed.

export async function createCategory(data: CreateCategoryRequest): Promise<CategoryRecord> {
  const duplicate = await queryOne<{ id: string }>(
    `SELECT id FROM categories WHERE is_active = TRUE AND LOWER(name) = LOWER($1)`,
    [data.name],
  );
  if (duplicate) throw AppError.conflict("An active category with this name already exists");

  const duplicateSlug = await queryOne<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1`,
    [data.slug],
  );
  if (duplicateSlug) throw AppError.conflict("A category with this slug already exists");

  let row: DbCategory | null;
  try {
    row = await queryOne<DbCategory>(
      `INSERT INTO categories (name, slug, description, parent_id, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.slug, data.description ?? null, data.parentId ?? null, data.isActive ?? true],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.conflict("A category with this name or slug already exists");
    throw error;
  }
  if (!row) throw new Error('Failed to create category');
  return mapRow(row);
}

export async function getCategories(): Promise<CategoryRecord[]> {
  const rows = await queryAll<DbCategory>(
    `SELECT * FROM categories WHERE is_active = TRUE ORDER BY name ASC`,
  );
  return rows.map(mapRow);
}

export async function getCategoryById(id: string): Promise<CategoryRecord | null> {
  const row = await queryOne<DbCategory>(
    `SELECT * FROM categories WHERE id = $1`,
    [id],
  );
  return row ? mapRow(row) : null;
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
  const row = await queryOne<DbCategory>(
    `SELECT * FROM categories WHERE slug = $1`,
    [slug],
  );
  return row ? mapRow(row) : null;
}

export async function updateCategory(
  id: string,
  data: Partial<CreateCategoryRequest>,
): Promise<CategoryRecord> {
  if (data.name !== undefined || data.isActive === true) {
    const targetName = data.name ?? (await getCategoryById(id))?.name;
    if (targetName) {
      const duplicate = await queryOne<{ id: string }>(
        `SELECT id FROM categories
         WHERE is_active = TRUE AND LOWER(name) = LOWER($1) AND id <> $2`,
        [targetName, id],
      );
      if (duplicate) throw AppError.conflict("An active category with this name already exists");
    }
  }

  if (data.slug !== undefined) {
    const duplicateSlug = await queryOne<{ id: string }>(
      `SELECT id FROM categories WHERE slug = $1 AND id <> $2`,
      [data.slug, id],
    );
    if (duplicateSlug) throw AppError.conflict("A category with this slug already exists");
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const addField = (column: string, value: unknown) => {
    if (value !== undefined) {
      updates.push(`${column} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  };

  addField('name', data.name);
  addField('slug', data.slug);
  addField('description', data.description);
  addField('parent_id', data.parentId);
  addField('is_active', data.isActive);

  if (updates.length === 0) {
    const existing = await getCategoryById(id);
    if (!existing) throw AppError.notFound("Category not found");
    return existing;
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  let row: DbCategory | null;
  try {
    row = await queryOne<DbCategory>(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw AppError.conflict("A category with this name or slug already exists");
    throw error;
  }
  if (!row) throw AppError.notFound("Category not found");
  return mapRow(row);
}
