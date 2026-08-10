export type PaginationQuery = {
  limit?: string;
  page?: string;
  paginated?: string;
  search?: string;
  sort?: string;
};

export type PaginationOptions = {
  limit: number;
  page: number;
  search?: string;
  skip: number;
  sort?: string;
};

export type PaginatedResponse<TItem> = {
  items: TItem[];
  meta: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
};

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function shouldPaginate(query: PaginationQuery = {}) {
  return (
    query.paginated === 'true' ||
    query.page !== undefined ||
    query.limit !== undefined
  );
}

export function getPaginationOptions(
  query: PaginationQuery = {},
): PaginationOptions {
  const page = parsePositiveInteger(query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(query.limit, DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  return {
    limit,
    page,
    search: query.search?.trim() || undefined,
    skip: (page - 1) * limit,
    sort: query.sort?.trim() || undefined,
  };
}

export function paginatedResponse<TItem>(
  items: TItem[],
  total: number,
  pagination: PaginationOptions,
): PaginatedResponse<TItem> {
  const totalPages = Math.max(1, Math.ceil(total / pagination.limit));

  return {
    items,
    meta: {
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
      limit: pagination.limit,
      page: pagination.page,
      total,
      totalPages,
    },
  };
}
