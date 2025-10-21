export interface IPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ISuccessResponse<T = any> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface IPaginatedResponse<T = any> {
  success: true;
  message: string;
  data: T;
  pagination: IPagination;
  timestamp: string;
}

export interface IErrorResponse {
  success: false;
  message: string;
  timestamp: string;
  errors?: any;
}

class ResponseHelper {
  static success<T>(data: T, message = 'Success', statusCode = 200): ISuccessResponse<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message = 'An error occurred', statusCode = 500, errors: any = null): IErrorResponse {
    const response: IErrorResponse = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.errors = errors;
    }

    return response;
  }

  static paginated<T>(
    data: T, 
    pagination: IPagination, 
    message = 'Success'
  ): IPaginatedResponse<T> {
    return {
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    };
  }
}

export default ResponseHelper;