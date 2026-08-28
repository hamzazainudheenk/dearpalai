import crypto from 'crypto';
import { supabaseAdmin } from '@config/supabase';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export interface BackendTodoItem {
  id: string;
  title: string;
  completed: boolean;
  timeCategory?: string;
  createdAt?: string;
}

const DEFAULT_SEED_TASKS: Omit<BackendTodoItem, 'id' | 'createdAt'>[] = [
  { title: 'Take morning medicines', completed: false, timeCategory: 'Morning' },
  { title: '15 min gentle walk or morning sunlight', completed: false, timeCategory: 'Morning' },
  { title: 'Drink water (stay hydrated)', completed: false, timeCategory: 'Afternoon' },
  { title: 'Evening breathing or quiet rest', completed: false, timeCategory: 'Evening' },
];

export class TodoService {
  // In-memory fallback per dearPalId if database table is not yet migrated
  private fallbackStore = new Map<string, BackendTodoItem[]>();

  private async getPatientIdByDearPalId(dearPalId: string): Promise<string | null> {
    try {
      const { data } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('public_dearpal_id', dearPalId)
        .maybeSingle();
      return data?.id ?? null;
    } catch {
      return null;
    }
  }

  private getFallback(dearPalId: string): BackendTodoItem[] {
    if (!this.fallbackStore.has(dearPalId)) {
      const initial: BackendTodoItem[] = DEFAULT_SEED_TASKS.map((t) => ({
        id: crypto.randomUUID(),
        ...t,
        createdAt: new Date().toISOString(),
      }));
      this.fallbackStore.set(dearPalId, initial);
    }
    return this.fallbackStore.get(dearPalId)!;
  }

  async getTodos(dearPalId: string): Promise<BackendTodoItem[]> {
    const patientId = await this.getPatientIdByDearPalId(dearPalId);
    if (!patientId) {
      return this.getFallback(dearPalId);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('patient_todos')
        .select('id, title, completed, time_category, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true });

      if (error) {
        // Table not migrated yet, use in-memory fallback
        return this.getFallback(dearPalId);
      }

      if (!data || data.length === 0) {
        // Seed default tasks for new patient
        const toInsert = DEFAULT_SEED_TASKS.map((t, idx) => ({
          patient_id: patientId,
          title: t.title,
          completed: t.completed,
          time_category: t.timeCategory,
          position: idx,
        }));

        const { data: seeded, error: seedError } = await supabaseAdmin
          .from('patient_todos')
          .insert(toInsert)
          .select('id, title, completed, time_category, created_at');

        if (seedError || !seeded) {
          return this.getFallback(dearPalId);
        }

        return seeded.map((row: any) => ({
          id: row.id,
          title: row.title,
          completed: !!row.completed,
          timeCategory: row.time_category || undefined,
          createdAt: row.created_at,
        }));
      }

      return data.map((row: any) => ({
        id: row.id,
        title: row.title,
        completed: !!row.completed,
        timeCategory: row.time_category || undefined,
        createdAt: row.created_at,
      }));
    } catch {
      return this.getFallback(dearPalId);
    }
  }

  async addTodo(dearPalId: string, title: string, timeCategory?: string): Promise<BackendTodoItem> {
    const trimmed = (title || '').trim();
    if (!trimmed) {
      throw new AppError('Task title is required.', 400, true, 'VALIDATION_ERROR');
    }

    const patientId = await this.getPatientIdByDearPalId(dearPalId);
    if (!patientId) {
      const fallbackList = this.getFallback(dearPalId);
      const newItem: BackendTodoItem = {
        id: crypto.randomUUID(),
        title: trimmed,
        completed: false,
        timeCategory,
        createdAt: new Date().toISOString(),
      };
      fallbackList.push(newItem);
      return newItem;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('patient_todos')
        .insert({
          patient_id: patientId,
          title: trimmed,
          completed: false,
          time_category: timeCategory || null,
        })
        .select('id, title, completed, time_category, created_at')
        .single();

      if (error || !data) {
        const fallbackList = this.getFallback(dearPalId);
        const newItem: BackendTodoItem = {
          id: crypto.randomUUID(),
          title: trimmed,
          completed: false,
          timeCategory,
          createdAt: new Date().toISOString(),
        };
        fallbackList.push(newItem);
        return newItem;
      }

      return {
        id: data.id,
        title: data.title,
        completed: !!data.completed,
        timeCategory: data.time_category || undefined,
        createdAt: data.created_at,
      };
    } catch {
      const fallbackList = this.getFallback(dearPalId);
      const newItem: BackendTodoItem = {
        id: crypto.randomUUID(),
        title: trimmed,
        completed: false,
        timeCategory,
        createdAt: new Date().toISOString(),
      };
      fallbackList.push(newItem);
      return newItem;
    }
  }

  async updateTodo(
    dearPalId: string,
    todoId: string,
    updates: { completed?: boolean; title?: string; timeCategory?: string },
  ): Promise<BackendTodoItem> {
    const patientId = await this.getPatientIdByDearPalId(dearPalId);
    if (!patientId) {
      const fallbackList = this.getFallback(dearPalId);
      const item = fallbackList.find((i) => i.id === todoId);
      if (!item) throw new AppError('Todo item not found.', 404, true, 'NOT_FOUND');
      if (typeof updates.completed === 'boolean') item.completed = updates.completed;
      if (updates.title !== undefined) item.title = updates.title.trim();
      if (updates.timeCategory !== undefined) item.timeCategory = updates.timeCategory;
      return item;
    }

    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof updates.completed === 'boolean') updatePayload.completed = updates.completed;
      if (updates.title !== undefined) updatePayload.title = updates.title.trim();
      if (updates.timeCategory !== undefined) updatePayload.time_category = updates.timeCategory;

      const { data, error } = await supabaseAdmin
        .from('patient_todos')
        .update(updatePayload)
        .eq('id', todoId)
        .eq('patient_id', patientId)
        .select('id, title, completed, time_category, created_at')
        .maybeSingle();

      if (error || !data) {
        const fallbackList = this.getFallback(dearPalId);
        const item = fallbackList.find((i) => i.id === todoId);
        if (!item) throw new AppError('Todo item not found.', 404, true, 'NOT_FOUND');
        if (typeof updates.completed === 'boolean') item.completed = updates.completed;
        if (updates.title !== undefined) item.title = updates.title.trim();
        if (updates.timeCategory !== undefined) item.timeCategory = updates.timeCategory;
        return item;
      }

      return {
        id: data.id,
        title: data.title,
        completed: !!data.completed,
        timeCategory: data.time_category || undefined,
        createdAt: data.created_at,
      };
    } catch {
      const fallbackList = this.getFallback(dearPalId);
      const item = fallbackList.find((i) => i.id === todoId);
      if (!item) throw new AppError('Todo item not found.', 404, true, 'NOT_FOUND');
      if (typeof updates.completed === 'boolean') item.completed = updates.completed;
      if (updates.title !== undefined) item.title = updates.title.trim();
      if (updates.timeCategory !== undefined) item.timeCategory = updates.timeCategory;
      return item;
    }
  }

  async deleteTodo(dearPalId: string, todoId: string): Promise<void> {
    const patientId = await this.getPatientIdByDearPalId(dearPalId);
    if (!patientId) {
      const fallbackList = this.getFallback(dearPalId);
      this.fallbackStore.set(
        dearPalId,
        fallbackList.filter((i) => i.id !== todoId),
      );
      return;
    }

    try {
      const { error } = await supabaseAdmin
        .from('patient_todos')
        .delete()
        .eq('id', todoId)
        .eq('patient_id', patientId);

      if (error) {
        const fallbackList = this.getFallback(dearPalId);
        this.fallbackStore.set(
          dearPalId,
          fallbackList.filter((i) => i.id !== todoId),
        );
      }
    } catch {
      const fallbackList = this.getFallback(dearPalId);
      this.fallbackStore.set(
        dearPalId,
        fallbackList.filter((i) => i.id !== todoId),
      );
    }
  }
}
