export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(Math.max(1, params.pageSize || 20), 100);
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export function getPrismaPaginationArgs(params: PaginationParams): {
  skip: number;
  take: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
} {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(Math.max(1, params.pageSize || 20), 100);
  const skip = (page - 1) * pageSize;

  const args: { skip: number; take: number; orderBy?: Record<string, 'asc' | 'desc'> } = {
    skip,
    take: pageSize,
  };

  if (params.sortBy) {
    args.orderBy = {
      [params.sortBy]: params.sortOrder || 'asc',
    };
  }

  return args;
}

export function getPaginationParams(query: Record<string, unknown>): PaginationParams {
  return {
    page: query.page ? parseInt(query.page as string, 10) : undefined,
    pageSize: query.pageSize ? parseInt(query.pageSize as string, 10) : undefined,
    sortBy: query.sortBy as string | undefined,
    sortOrder: (query.sortOrder as 'asc' | 'desc') || undefined,
  };
}
