/**
 * A minimal in-memory stand-in for the Supabase JS client, supporting only
 * the query shapes this codebase's Phase 1 services actually use
 * (`.select().eq().is().order().limit().maybeSingle()/.single()`,
 * `.insert()`, `.update()`, and the specific two-column `.or()` shape
 * `PatientAuthService.signup` uses). Not a general Supabase mock — it
 * exists purely so the DB-dependent business logic in
 * `OtpService`/`CaretakerAuthService`/`PatientAuthService` can be tested
 * without a live Supabase project.
 */

type Row = Record<string, any>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private orderCol?: string;
  private orderAscending = true;
  private limitCount?: number;

  constructor(
    private readonly table: FakeTable,
    private op: 'select' | 'insert' | 'update' = 'select',
    private payload?: Row,
  ) {}

  select(_cols?: string) {
    return this;
  }

  eq(col: string, value: any) {
    this.filters.push((row) => row[col] === value);
    return this;
  }

  is(col: string, value: null) {
    this.filters.push((row) => row[col] === value || row[col] === undefined);
    return this;
  }

  /** Only supports the exact shape used in this codebase:
   *  `col1.eq.val1,col2.eq.val2`. */
  or(expr: string) {
    const clauses = expr.split(',').map((c) => {
      const [col, , ...rest] = c.split('.');
      return { col, value: rest.join('.') };
    });
    this.filters.push((row) => clauses.some((c) => String(row[c.col]) === c.value));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  private matched(): Row[] {
    let rows = this.table.rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const cmp = String(a[col]).localeCompare(String(b[col]));
        return this.orderAscending ? cmp : -cmp;
      });
    }
    if (this.limitCount !== undefined) rows = rows.slice(0, this.limitCount);
    return rows;
  }

  async maybeSingle() {
    if (this.op === 'insert') return this.doInsert(true);
    const rows = this.matched();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    if (this.op === 'insert') return this.doInsert(false);
    const rows = this.matched();
    if (rows.length === 0) return { data: null, error: { message: 'Not found' } };
    return { data: rows[0], error: null };
  }

  private doInsert(nullable: boolean) {
    // Mirrors the real schema's column defaults (`attempt_count integer
    // default 0`, `created_at timestamptz default now()`) — the fake has
    // no DDL to read these from, so they're hardcoded here for the columns
    // Phase 1's services actually rely on defaulting.
    const defaults = { attempt_count: 0, created_at: new Date().toISOString() };
    const row = { id: this.table.nextId(), ...defaults, ...this.payload };
    if (this.table.uniqueConstraintViolated(row)) {
      return Promise.resolve({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });
    }
    this.table.rows.push(row);
    return Promise.resolve({ data: row, error: null });
  }

  // Makes a bare `await builder` (no terminal .single()/.maybeSingle())
  // work for plain insert/update calls, matching how the services await
  // `.insert({...})` / `.update({...}).eq(...)` directly.
  then(resolve: (v: { data: any; error: any }) => void, reject?: (e: any) => void) {
    (async () => {
      try {
        if (this.op === 'insert') {
          resolve(await this.doInsert(true));
        } else if (this.op === 'update') {
          const rows = this.matched();
          rows.forEach((row) => Object.assign(row, this.payload));
          resolve({ data: rows, error: null });
        } else {
          resolve({ data: this.matched(), error: null });
        }
      } catch (err) {
        if (reject) reject(err);
      }
    })();
  }
}

class FakeTable {
  rows: Row[] = [];
  private idCounter = 1;
  /** Column names that should behave as unique, for insert-collision tests
   *  (e.g. `code_hash` on `caretaker_codes`). */
  uniqueColumns: string[] = [];

  nextId() {
    return `fake-id-${this.idCounter++}`;
  }

  uniqueConstraintViolated(row: Row): boolean {
    return this.uniqueColumns.some((col) =>
      this.rows.some((existing) => existing[col] !== undefined && existing[col] === row[col]),
    );
  }
}

export class FakeSupabaseClient {
  private tables = new Map<string, FakeTable>();

  table(name: string, uniqueColumns: string[] = []): FakeTable {
    if (!this.tables.has(name)) {
      const t = new FakeTable();
      t.uniqueColumns = uniqueColumns;
      this.tables.set(name, t);
    }
    return this.tables.get(name)!;
  }

  /** Clears every table's rows — call between tests that share one
   *  module-scoped fake client instance. */
  reset(): void {
    this.tables.clear();
  }

  from(name: string) {
    const table = this.table(name);
    return {
      select: (cols?: string) => new FakeQuery(table, 'select').select(cols),
      insert: (payload: Row) => new FakeQuery(table, 'insert', payload),
      update: (payload: Row) => new FakeQuery(table, 'update', payload),
    };
  }

  auth = {
    admin: {
      createUser: jest.fn(async (input: any) => ({
        data: { user: { id: `auth-${Math.random().toString(36).slice(2)}`, email: input.email } },
        error: null,
      })),
      deleteUser: jest.fn(async () => ({ error: null })),
      updateUserById: jest.fn(async () => ({ error: null })),
      generateLink: jest.fn(async () => ({
        data: { properties: { email_otp: '123456', hashed_token: 'fake-hashed-token' } },
        error: null,
      })),
    },
    getUser: jest.fn(async () => ({ data: { user: null }, error: { message: 'not implemented' } })),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({
      data: { session: null, user: null },
      error: { message: 'not implemented' },
    })),
  };
}
