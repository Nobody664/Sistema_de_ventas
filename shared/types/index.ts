export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ApiError = {
  statusCode: number;
  message: string;
  error?: string;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
};

export type SortDirection = 'asc' | 'desc';

export type PaginationParams = {
  page?: number;
  limit?: number;
  sort?: string;
  order?: SortDirection;
};
