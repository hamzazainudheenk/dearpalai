import { TodoService } from '@services/todo/todo.service';

describe('TodoService', () => {
  let service: TodoService;
  const testDearPalId = 'DP-TEST-1234';

  beforeEach(() => {
    service = new TodoService();
  });

  it('returns default seeded todos for a patient with no previous items', async () => {
    const todos = await service.getTodos(testDearPalId);
    expect(todos.length).toBe(4);
    expect(todos[0].title).toBe('Take morning medicines');
    expect(todos[0].completed).toBe(false);
  });

  it('adds a new todo item and returns it', async () => {
    const newItem = await service.addTodo(testDearPalId, 'Drink green tea', 'Evening');
    expect(newItem.id).toBeDefined();
    expect(newItem.title).toBe('Drink green tea');
    expect(newItem.timeCategory).toBe('Evening');
    expect(newItem.completed).toBe(false);

    const list = await service.getTodos(testDearPalId);
    expect(list.length).toBe(5);
  });

  it('updates an existing todo item completion and title', async () => {
    const todos = await service.getTodos(testDearPalId);
    const firstId = todos[0].id;

    const updated = await service.updateTodo(testDearPalId, firstId, { completed: true });
    expect(updated.completed).toBe(true);

    const list = await service.getTodos(testDearPalId);
    const found = list.find((i) => i.id === firstId);
    expect(found?.completed).toBe(true);
  });

  it('deletes a todo item', async () => {
    const todos = await service.getTodos(testDearPalId);
    const firstId = todos[0].id;

    await service.deleteTodo(testDearPalId, firstId);
    const list = await service.getTodos(testDearPalId);
    expect(list.find((i) => i.id === firstId)).toBeUndefined();
  });
});
