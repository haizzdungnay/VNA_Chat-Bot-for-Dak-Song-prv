export class ValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = statusCode;
  }
}

export class AIProviderError extends Error {
  constructor(message = "Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.") {
    super(message);
    this.name = "AIProviderError";
  }
}

