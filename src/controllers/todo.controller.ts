import { Response } from 'express';
import { AuthenticatedPatientRequest } from '@middleware/auth.middleware';
import { TodoService } from '@services/todo/todo.service';
import { AppError } from '@middleware/error.middleware';
import { logger } from '@utils/logger';

export class TodoController {
  constructor(private readonly todoService: TodoService = new TodoService()) {}

  private handleError(err: unknown, res: Response, action: string): void {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        status: 'error',
        code: err.code || 'ERROR',
        message: err.message,
      });
      return;
    }
    logger.error(`TodoController.${action} unexpected error`, {
      error: (err as Error).message,
    });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }

  getTodos = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      const dearPalId = req.patient?.dearPalId;
      if (!dearPalId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const todos = await this.todoService.getTodos(dearPalId);
      res.status(200).json({
        status: 'success',
        data: { todos },
      });
    } catch (err) {
      this.handleError(err, res, 'getTodos');
    }
  };

  createTodo = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      const dearPalId = req.patient?.dearPalId;
      if (!dearPalId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const { title, timeCategory } = req.body || {};
      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ status: 'error', message: 'Task title is required.' });
        return;
      }

      const todo = await this.todoService.addTodo(dearPalId, title, timeCategory);
      res.status(201).json({
        status: 'success',
        data: { todo },
      });
    } catch (err) {
      this.handleError(err, res, 'createTodo');
    }
  };

  updateTodo = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      const dearPalId = req.patient?.dearPalId;
      if (!dearPalId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ status: 'error', message: 'Todo id is required.' });
        return;
      }

      const { completed, title, timeCategory } = req.body || {};
      const updated = await this.todoService.updateTodo(dearPalId, id, {
        completed,
        title,
        timeCategory,
      });

      res.status(200).json({
        status: 'success',
        data: { todo: updated },
      });
    } catch (err) {
      this.handleError(err, res, 'updateTodo');
    }
  };

  deleteTodo = async (req: AuthenticatedPatientRequest, res: Response): Promise<void> => {
    try {
      const dearPalId = req.patient?.dearPalId;
      if (!dearPalId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id || typeof id !== 'string') {
        res.status(400).json({ status: 'error', message: 'Todo id is required.' });
        return;
      }

      await this.todoService.deleteTodo(dearPalId, id);
      res.status(200).json({
        status: 'success',
        message: 'Todo deleted successfully',
      });
    } catch (err) {
      this.handleError(err, res, 'deleteTodo');
    }
  };
}
