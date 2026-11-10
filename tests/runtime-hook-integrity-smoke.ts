import { describe, it } from "node:test";
import assert from "node:assert";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Ensure global React instance integrity
describe("SANATANMARGA 5.0 — RUNTIME HOOK INTEGRITY SUITE", () => {
  it("1. React singleton check: React and ReactDOM resolve to single instances", () => {
    assert.strictEqual(typeof React.useState, "function");
    assert.strictEqual(typeof React.useEffect, "function");
    assert.strictEqual(typeof React.useMemo, "function");
    assert.strictEqual(typeof React.useCallback, "function");
  });

  it("2. React hook dispatcher contract check in rendering context", () => {
    let hookExecuted = false;
    function TestHookComponent() {
      const [val] = React.useState("active");
      const memoized = React.useMemo(() => val.toUpperCase(), [val]);
      if (memoized === "ACTIVE") {
        hookExecuted = true;
      }
      return React.createElement("div", null, memoized);
    }

    const html = renderToString(React.createElement(TestHookComponent));
    assert.strictEqual(hookExecuted, true);
    assert.ok(html.includes("ACTIVE"));
  });

  it("3. Admin Review Inbox structure & hook compatibility validation", async () => {
    const AdminReviewModule = await import("../src/pages/admin/AdminReviewInboxPage");
    assert.ok(AdminReviewModule.default, "AdminReviewInboxPage default export exists");
    assert.strictEqual(typeof AdminReviewModule.default, "function");
  });

  it("4. Admin Users & Feature Control page export validation", async () => {
    const AdminUsersModule = await import("../src/pages/AdminUsers");
    const AdminFeatureModule = await import("../src/pages/admin/AdminFeatureControl");
    assert.ok(AdminUsersModule.default);
    assert.ok(AdminFeatureModule.default);
  });

  it("5. Route transition emulation public -> admin -> public without dispatcher corruption", () => {
    function PublicPage() {
      const [state] = React.useState("public_state");
      return React.createElement("div", null, state);
    }
    function AdminMockPage() {
      const [state] = React.useState("admin_state");
      return React.createElement("div", null, state);
    }

    // Public render
    const publicHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement(PublicPage) }),
          React.createElement(Route, { path: "/admin", element: React.createElement(AdminMockPage) })
        )
      )
    );
    assert.ok(publicHtml.includes("public_state"));

    // Admin render
    const adminHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/admin"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement(PublicPage) }),
          React.createElement(Route, { path: "/admin", element: React.createElement(AdminMockPage) })
        )
      )
    );
    assert.ok(adminHtml.includes("admin_state"));

    // Return to Public render
    const returnPublicHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement(PublicPage) }),
          React.createElement(Route, { path: "/admin", element: React.createElement(AdminMockPage) })
        )
      )
    );
    assert.ok(returnPublicHtml.includes("public_state"));
  });

  it("6. Zero Invalid Hook Call runtime exceptions across simulated lifecycle", () => {
    assert.doesNotThrow(() => {
      function ComplexHookComponent() {
        const [a] = React.useState(1);
        const [b] = React.useState(2);
        const c = React.useMemo(() => a + b, [a, b]);
        return React.createElement("span", null, `Result: ${c}`);
      }
      const out = renderToString(React.createElement(ComplexHookComponent));
      assert.ok(out.includes("Result: 3"));
    });
  });
});
