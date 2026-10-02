import { query, queryOne, queryAll } from "../infrastructure/database/query.js";
import { withTransaction } from "../infrastructure/database/tx.js";
import type { AuctionItemRecord } from "./auction-item.types.js";
import type { CreateAuctionItemRequest, UpdateAuctionItemRequest } from "@auction/shared";

// Raw shape returned by the database driver — all keys are snake_case.
// pg returns NUMERIC columns as strings, so estimated_value is string | null.
interface DbAuctionItem {
  id: string;
  auction_id: string;
  title: string;
  description: string | null;
  quantity: string;           // NUMERIC comes back as string from pg
  unit: string | null;
  estimated_value: string | null; // NUMERIC(14,2) — added by migration 004
  category_id: string | null;
  ai_category_suggestion: string | null;
  ai_sub_category: string | null;
  ai_confidence: string | null;  // NUMERIC(5,4) — string from pg
  ai_rationale: string | null;
  condition: string | null;
  ai_model: string | null;
  category_source: string;
  region: string | null;
  city: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: DbAuctionItem): AuctionItemRecord {
  return {
    id: row.id,
    auctionId: row.auction_id,
    title: row.title,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    estimatedValue: row.estimated_value !== null ? Number(row.estimated_value) : null,
    categoryId: row.category_id,
    aiCategorySuggestion: row.ai_category_suggestion,
    aiSubCategory: row.ai_sub_category,
    aiConfidence: row.ai_confidence !== null ? Number(row.ai_confidence) : null,
    aiRationale: row.ai_rationale,
    condition: row.condition,
    aiModel: row.ai_model,
    categorySource: row.category_source,
    region: row.region,
    city: row.city,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createAuctionItem(
  userId: string,
  auctionId: string,
  data: CreateAuctionItemRequest,
): Promise<AuctionItemRecord> {
  return withTransaction(async (tx) => {
    const row = await queryOne<DbAuctionItem>(
      `INSERT INTO auction_items (
        auction_id, title, description, quantity, unit, estimated_value,
        category_id, condition, category_source, region, city
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *`,
      [
        auctionId,
        data.title,
        data.description ?? null,
        data.quantity ?? 1,
        data.unit ?? null,
        data.estimatedValue ?? null,
        data.categoryId ?? null,
        data.condition ?? null,
        data.categorySource ?? 'manual',
        data.region ?? null,
        data.city ?? null,
      ],
      tx,
    );
    if (!row) throw new Error('Failed to create auction item');
    return mapRow(row);
  }, { userId });
}

export async function getAuctionItems(auctionId: string, limit?: number): Promise<AuctionItemRecord[]> {
  const limitClause = limit ? " LIMIT $2" : "";
  const rows = await queryAll<DbAuctionItem>(
    `SELECT * FROM auction_items WHERE auction_id = $1 ORDER BY created_at ASC${limitClause}`,
    limit ? [auctionId, limit] : [auctionId],
  );
  return rows.map(mapRow);
}

export async function getAuctionItemById(id: string): Promise<AuctionItemRecord | null> {
  const row = await queryOne<DbAuctionItem>(
    `SELECT * FROM auction_items WHERE id = $1`,
    [id],
  );
  return row ? mapRow(row) : null;
}

export async function updateAuctionItem(
  userId: string,
  id: string,
  data: UpdateAuctionItemRequest,
): Promise<AuctionItemRecord> {
  return withTransaction(async (tx) => {
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

    addField('title', data.title);
    addField('description', data.description);
    addField('quantity', data.quantity);
    addField('unit', data.unit);
    addField('estimated_value', data.estimatedValue);
    addField('category_id', data.categoryId);
    addField('condition', data.condition);
    addField('category_source', data.categorySource);
    addField('region', data.region);
    addField('city', data.city);

    if (updates.length === 0) {
      const existing = await queryOne<DbAuctionItem>(
        `SELECT * FROM auction_items WHERE id = $1`,
        [id],
        tx,
      );
      if (!existing) throw new Error('Item not found');
      return mapRow(existing);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const row = await queryOne<DbAuctionItem>(
      `UPDATE auction_items SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
      tx,
    );
    if (!row) throw new Error('Failed to update auction item');
    return mapRow(row);
  }, { userId });
}

export async function deleteAuctionItem(userId: string, id: string): Promise<void> {
  await withTransaction(async (tx) => {
    await query(
      `DELETE FROM auction_items WHERE id = $1`,
      [id],
      tx,
    );
  }, { userId });
}
