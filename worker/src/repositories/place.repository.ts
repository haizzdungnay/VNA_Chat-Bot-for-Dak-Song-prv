import type { Place } from "../types";

interface PlaceRow {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  mapUrl: string | null;
  isFeatured: number;
  c_id: string | null;
  c_slug: string | null;
  c_name: string | null;
  c_icon: string | null;
}

export class PlaceRepository {
  constructor(private db: D1Database) {}

  async findAll(options?: {
    categoryId?: string;
    search?: string;
    featured?: boolean;
    limit?: number;
  }): Promise<Place[]> {
    let query = `
      SELECT p.id, p.slug, p.name, p.category_id as categoryId,
             p.short_description as shortDescription, p.description,
             p.address, p.latitude, p.longitude, p.image_url as imageUrl,
             p.map_url as mapUrl, p.is_featured as isFeatured,
             c.id as c_id, c.slug as c_slug, c.name as c_name, c.icon as c_icon
      FROM places p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (options?.categoryId) {
      query += " AND p.category_id = ?";
      params.push(options.categoryId);
    }

    if (options?.featured !== undefined) {
      query += " AND p.is_featured = ?";
      params.push(options.featured ? 1 : 0);
    }

    if (options?.search) {
      query += " AND (p.name LIKE ? OR p.short_description LIKE ? OR p.description LIKE ?)";
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += " ORDER BY p.is_featured DESC, p.created_at DESC";

    if (options?.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const { results } = await bound.all<PlaceRow>();

    return (results || []).map((r) => this.mapRowToPlace(r));
  }

  async findById(idOrSlug: string): Promise<Place | null> {
    const row = await this.db
      .prepare(`
        SELECT p.id, p.slug, p.name, p.category_id as categoryId,
               p.short_description as shortDescription, p.description,
               p.address, p.latitude, p.longitude, p.image_url as imageUrl,
               p.map_url as mapUrl, p.is_featured as isFeatured,
               c.id as c_id, c.slug as c_slug, c.name as c_name, c.icon as c_icon
        FROM places p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? OR p.slug = ?
        LIMIT 1
      `)
      .bind(idOrSlug, idOrSlug)
      .first<PlaceRow>();

    return row ? this.mapRowToPlace(row) : null;
  }

  private mapRowToPlace(r: PlaceRow): Place {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      categoryId: r.categoryId,
      category: r.c_id
        ? {
            id: r.c_id,
            slug: r.c_slug || "",
            name: r.c_name || "",
            icon: r.c_icon || undefined,
          }
        : undefined,
      shortDescription: r.shortDescription,
      description: r.description,
      address: r.address || undefined,
      latitude: r.latitude ?? undefined,
      longitude: r.longitude ?? undefined,
      imageUrl: r.imageUrl || undefined,
      mapUrl: r.mapUrl || undefined,
      isFeatured: Boolean(r.isFeatured),
    };
  }
}
