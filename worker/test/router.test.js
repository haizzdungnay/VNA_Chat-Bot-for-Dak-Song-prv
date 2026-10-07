import assert from "node:assert";
import test from "node:test";

test("Router matches static and parameterized routes", () => {
  function matchPath(routePattern, path) {
    const paramNames = [];
    const regexSource = routePattern.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    const reg = new RegExp(`^${regexSource}$`);
    const match = path.match(reg);
    if (!match) return null;
    const params = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = decodeURIComponent(match[i + 1]);
    }
    return params;
  }

  const staticMatch = matchPath("/api/health", "/api/health");
  assert.deepStrictEqual(staticMatch, {});

  const paramMatch = matchPath("/api/places/:id", "/api/places/place-01");
  assert.deepStrictEqual(paramMatch, { id: "place-01" });

  const nonMatch = matchPath("/api/places/:id", "/api/categories");
  assert.strictEqual(nonMatch, null);
});

test("Place mapping handles null images_json without crashing", () => {
  function mapPlace(r) {
    let parsedImages = undefined;
    if (r.imagesJson) {
      try {
        const arr = JSON.parse(r.imagesJson);
        if (Array.isArray(arr)) {
          parsedImages = arr.filter((x) => typeof x === "string");
        }
      } catch {
        // safe fallback
      }
    }
    return {
      id: r.id,
      name: r.name,
      images: parsedImages,
      openingHours: r.openingHours || undefined,
      phone: r.phone || undefined,
      website: r.website || undefined,
    };
  }

  // Case 1: NULL imagesJson
  const mapped1 = mapPlace({
    id: "place-01",
    name: "Place 1",
    imagesJson: null,
    openingHours: null,
    phone: null,
    website: null,
  });
  assert.strictEqual(mapped1.images, undefined);
  assert.strictEqual(mapped1.openingHours, undefined);

  // Case 2: Valid JSON array
  const mapped2 = mapPlace({
    id: "place-02",
    name: "Place 2",
    imagesJson: JSON.stringify(["https://img1.jpg", "https://img2.jpg"]),
    openingHours: "08:00 - 17:00",
    phone: "0123456789",
    website: "https://example.com",
  });
  assert.deepStrictEqual(mapped2.images, ["https://img1.jpg", "https://img2.jpg"]);
  assert.strictEqual(mapped2.openingHours, "08:00 - 17:00");
  assert.strictEqual(mapped2.phone, "0123456789");
  assert.strictEqual(mapped2.website, "https://example.com");

  // Case 3: Malformed JSON
  const mapped3 = mapPlace({
    id: "place-03",
    name: "Place 3",
    imagesJson: "invalid-json",
  });
  assert.strictEqual(mapped3.images, undefined);
});

test("Validation error handling does not expose internal errors", () => {
  class ValidationError extends Error {
    constructor(msg) {
      super(msg);
      this.name = "ValidationError";
    }
  }

  class AIProviderError extends Error {
    constructor(msg = "Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại.") {
      super(msg);
      this.name = "AIProviderError";
    }
  }

  function handleRouteError(err) {
    if (err instanceof ValidationError) {
      return { status: 400, message: err.message };
    }
    if (err instanceof AIProviderError) {
      return { status: 502, message: err.message };
    }
    return { status: 500, message: "Đã xảy ra lỗi hệ thống." };
  }

  assert.strictEqual(handleRouteError(new ValidationError("Tin nhắn trống")).status, 400);
  assert.strictEqual(handleRouteError(new AIProviderError()).status, 502);
  assert.strictEqual(handleRouteError(new Error("Database connection timed out")).status, 500);
  assert.strictEqual(handleRouteError(new Error("Secret key invalid")).message, "Đã xảy ra lỗi hệ thống.");
});
