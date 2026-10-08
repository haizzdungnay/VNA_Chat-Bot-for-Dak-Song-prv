import type { Article } from "../types";

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  category_name: string;
  quote: string | null;
  content: string | null;
  image_url: string | null;
  publish_date: string | null;
  view_count: number;
  created_at: string;
}

export class ArticleRepository {
  constructor(private db: D1Database) {}

  async findAll(options?: { category?: string; search?: string; limit?: number }): Promise<Article[]> {
    let query = `
      SELECT id, slug, title, category_name, quote, content, image_url, publish_date, view_count, created_at
      FROM articles
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (options?.category) {
      query += " AND category_name LIKE ?";
      params.push(`%${options.category}%`);
    }

    if (options?.search) {
      query += " AND (title LIKE ? OR quote LIKE ? OR content LIKE ?)";
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    query += " ORDER BY created_at DESC";

    if (options?.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const { results } = await bound.all<ArticleRow>();

    return (results || []).map(this.mapRowToArticle);
  }

  async findBySlugOrId(slugOrId: string): Promise<Article | null> {
    const row = await this.db
      .prepare(`
        SELECT id, slug, title, category_name, quote, content, image_url, publish_date, view_count, created_at
        FROM articles
        WHERE id = ? OR slug = ?
        LIMIT 1
      `)
      .bind(slugOrId, slugOrId)
      .first<ArticleRow>();

    return row ? this.mapRowToArticle(row) : null;
  }

  private mapRowToArticle(r: ArticleRow): Article {
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      categoryName: r.category_name,
      quote: r.quote || undefined,
      content: r.content || undefined,
      imageUrl: r.image_url || undefined,
      publishDate: r.publish_date || undefined,
      viewCount: r.view_count || 0,
      createdAt: r.created_at,
    };
  }
}
