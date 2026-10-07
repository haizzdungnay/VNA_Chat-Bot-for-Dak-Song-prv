import type { Category } from "../types";

export class CategoryRepository {
  constructor(private db: D1Database) {}

  async findAll(): Promise<Category[]> {
    const { results } = await this.db
      .prepare("SELECT id, slug, name, icon FROM categories ORDER BY name ASC")
      .all<Category>();
    return results || [];
  }

  async findById(id: string): Promise<Category | null> {
    return await this.db
      .prepare("SELECT id, slug, name, icon FROM categories WHERE id = ?")
      .bind(id)
      .first<Category>();
  }
}
