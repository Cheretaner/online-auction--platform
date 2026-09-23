/**
 * CSV Upload Adapter
 * Parses uploaded CSV files from officers
 * Maps CSV columns to internal AuctionItem model
 */

import { ISourceAdapter } from './adapter.interface.js';
import {
  SourceFetch,
  NormalizedItem,
  ConfidenceScore,
  SourceMetadata,
  FetchOptions,
  AdapterError,
  NormalizationError,
} from '../types/index.js';

interface CsvUploadConfig {
  headers: string[]; // Column names in order
  mappings?: Record<string, string>; // Column mappings to internal fields
  delimiter?: string; // Default: ','
}

export class CsvUploadAdapter implements ISourceAdapter {
  private config: CsvUploadConfig = { headers: [], delimiter: ',' };
  private rows: Record<string, unknown>[] = [];

  getMetadata(): SourceMetadata {
    return {
      name: 'csv-upload',
      version: '1.0.0',
      description: 'Parses uploaded CSV files for auction items',
      config: {
        enabled: true,
        timeout: 60000, // Higher timeout for large files
        retryCount: 1,
      },
    };
  }

  async validateConfig(config: Record<string, unknown>): Promise<void> {
    const csvConfig = config as unknown as CsvUploadConfig;

    if (!csvConfig.headers || !Array.isArray(csvConfig.headers)) {
      throw new Error('headers array is required for csv-upload adapter');
    }

    if (csvConfig.headers.length === 0) {
      throw new Error('headers array cannot be empty');
    }
  }

  /**
   * For CSV upload, the "query" parameter should contain the CSV content
   * In practice, this is called with the uploaded file content
   */
  async fetchItems(csvContent: string, _options: FetchOptions): Promise<SourceFetch[]> {
    try {
      if (!csvContent || csvContent.trim().length === 0) {
        throw new AdapterError(
          'CSV content is empty',
          'INVALID_FORMAT',
          { content: csvContent }
        );
      }

      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        throw new AdapterError(
          'CSV must contain header and at least one data row',
          'INVALID_FORMAT',
          { lineCount: lines.length }
        );
      }

      // Parse CSV rows
      this.rows = this.parseCsv(lines);

      return this.rows.map((row, index) => ({
        id: `csv-upload:${index}`,
        externalId: String(index),
        title: String(row.title || `Row ${index}`),
        description: typeof row.description === 'string' ? row.description : undefined,
        metadata: row,
        source: 'csv-upload',
        fetchedAt: new Date(),
      }));
    } catch (error) {
      if (error instanceof AdapterError) throw error;

      throw new AdapterError(
        `Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`,
        'PARSE_FAILED',
        { originalError: error }
      );
    }
  }

  async normalize(raw: unknown): Promise<NormalizedItem> {
    try {
      const row = raw as Record<string, unknown>;

      // Apply field mappings if configured
      const mapped = this.applyMappings(row);

      return {
        title: this.normalizeString(mapped.title || row.title, 'title'),
        description: this.normalizeOptionalString(
          mapped.description || row.description
        ),
        quantity: this.normalizeNumber(mapped.quantity || row.quantity || 1),
        unit: this.normalizeOptionalString(mapped.unit || row.unit),
        estimatedValue: this.normalizeOptionalNumber(
          mapped.estimatedValue || row.estimatedValue || row.value || row.estimate
        ),
        categoryId: undefined,
        categoryName: this.normalizeOptionalString(
          mapped.categoryName || row.category || row.categoryName
        ),
        condition: this.normalizeOptionalString(
          mapped.condition || row.condition
        ),
        region: this.normalizeOptionalString(
          mapped.region || row.region || row.location
        ),
        city: this.normalizeOptionalString(mapped.city || row.city),
        externalId: String(row._index || '0'),
        externalSource: 'csv-upload',
        rawMetadata: row,
      };
    } catch (error) {
      throw new NormalizationError(
        `Failed to normalize CSV row: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error }
      );
    }
  }

  scoreConfidence(item: NormalizedItem): ConfidenceScore {
    const rationale: string[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    // Title quality (mandatory)
    const titleQuality =
      item.title && item.title.length > 5 ? 100 : item.title ? 70 : 0;
    totalScore += titleQuality;
    fieldCount++;
    if (titleQuality < 100) rationale.push('Title is short or missing');

    // Description quality (optional but valuable)
    const descriptionQuality = item.description ? 80 : 15;
    totalScore += descriptionQuality;
    fieldCount++;
    if (!item.description) rationale.push('No description provided');

    // Value quality (important)
    const valueQuality =
      item.estimatedValue && item.estimatedValue > 0 ? 90 : 20;
    totalScore += valueQuality;
    fieldCount++;
    if (!item.estimatedValue) rationale.push('Estimated value missing');

    // Category quality
    const categoryQuality = item.categoryName ? 70 : 20;
    totalScore += categoryQuality;
    fieldCount++;
    if (!item.categoryName) rationale.push('No category provided');

    // Location quality
    const locationQuality =
      item.region && item.city ? 85 : item.region ? 55 : 25;
    totalScore += locationQuality;
    fieldCount++;
    if (!item.region) rationale.push('Region missing');

    const overall = Math.round(totalScore / fieldCount);

    return {
      overall,
      titleQuality,
      descriptionQuality,
      valueQuality,
      categoryQuality,
      locationQuality,
      rationale,
    };
  }

  isStale(item: NormalizedItem): boolean {
    // Mark as stale if critical fields missing
    if (!item.title || item.title.length < 3) return true;
    if (!item.estimatedValue || item.estimatedValue <= 0) return true;

    return false;
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private parseCsv(lines: string[]): Record<string, unknown>[] {
    const delimiter = this.config.delimiter || ',';

    // Parse header row
    const headerLine = lines[0];
    const headers = this.parseRow(headerLine, delimiter);

    // Parse data rows
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue; // Skip empty lines

      try {
        const values = this.parseRow(line, delimiter);

        // Map values to headers
        const row: Record<string, unknown> = { _index: i - 1 };

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = values[j] || '';

          // Convert empty strings to null
          row[header] = value.length > 0 ? value : null;
        }

        rows.push(row);
      } catch (error) {
        throw new AdapterError(`Error parsing row ${i}: ${error}`, 'PARSE_ERROR');
      }
    }

    return rows;
  }

  private parseRow(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    values.push(current.trim());

    return values;
  }

  private applyMappings(
    row: Record<string, unknown>
  ): Record<string, unknown> {
    if (!this.config.mappings) {
      return row;
    }

    const mapped: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.config.mappings)) {
      mapped[key] = row[value as keyof typeof row];
    }

    return { ...row, ...mapped };
  }

  private normalizeString(value: unknown, fieldName: string): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (value === null || value === undefined) {
      throw new NormalizationError(`${fieldName} is required but missing`);
    }

    return String(value).trim();
  }

  private normalizeOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    return String(value).trim();
  }

  private normalizeNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return 1;
  }

  private normalizeOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return value > 0 ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
    }

    return undefined;
  }
}
