export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AIProviderError extends Error {
  constructor(message = "Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.") {
    super(message);
    this.name = "AIProviderError";
  }
}
