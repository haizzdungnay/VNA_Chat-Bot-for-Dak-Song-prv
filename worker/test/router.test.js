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
