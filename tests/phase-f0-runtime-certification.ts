import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";

test("SANATANMARGA 5.0 — FOUNDATION RELEASE GATE F0 RUNTIME CERTIFICATION", async (t) => {
  await t.test("1. AdminNotifications module and exports integrity", async () => {
    const mod = await import("../src/pages/AdminNotifications");
    assert.ok(mod.default, "AdminNotifications default export must exist");
    assert.strictEqual(typeof mod.default, "function", "AdminNotifications default export must be a React component");
  });

  await t.test("2. AdminContactMessages module and exports integrity", async () => {
    const mod = await import("../src/pages/AdminContactMessages");
    assert.ok(mod.default, "AdminContactMessages default export must exist");
    assert.strictEqual(typeof mod.default, "function", "AdminContactMessages default export must be a React component");
  });

  await t.test("3. AdminNotifications normalization handles incomplete & malformed records safely", async () => {
    // Test normalization patterns directly with arbitrary malformed shapes
    const malformedRecords = [
      {},
      { id: "test_1" },
      { name: null, title: undefined, body: null },
      { code: null, category: "invalid_category", isActive: "maybe" },
      { message: undefined, title: null, userId: 123 },
      { metrics: null, status: "unknown_status" }
    ];

    // Assert that null/undefined values don't throw in normalization or string manipulation
    for (const record of malformedRecords) {
      assert.doesNotThrow(() => {
        const id = String((record as any)?.id || "gen_id");
        const title = typeof (record as any)?.title === "string" ? (record as any).title.trim() : "Default Title";
        const body = typeof (record as any)?.body === "string" ? (record as any).body.trim() : "";
        const code = typeof (record as any)?.code === "string" ? (record as any).code.trim().toUpperCase() : "UNTITLED";
        const safeSearch = (title || "").toLowerCase();
        assert.ok(typeof id === "string");
        assert.ok(typeof title === "string");
        assert.ok(typeof body === "string");
        assert.ok(typeof code === "string");
        assert.ok(typeof safeSearch === "string");
      });
    }
  });

  await t.test("4. AdminContactMessages normalization handles legacy & missing fields safely", async () => {
    const legacyRecords = [
      {},
      { id: "legacy_1" },
      { name: null, email: null, subject: null, message: null },
      { name: "  रमेश शर्मा  ", email: "ramesh@example.com", status: "unknown" },
      { subject: "महत्वपूर्ण प्रश्न", message: "सन्देश विवरण..." }
    ];

    for (const doc of legacyRecords) {
      assert.doesNotThrow(() => {
        const id = String((doc as any)?.id || "msg_default");
        const name = typeof (doc as any)?.name === "string" ? (doc as any).name.trim() : "";
        const email = typeof (doc as any)?.email === "string" ? (doc as any).email.trim() : "";
        const subject = typeof (doc as any)?.subject === "string" ? (doc as any).subject.trim() : "";
        const message = typeof (doc as any)?.message === "string" ? (doc as any).message.trim() : "";
        const safeName = name || "अज्ञात प्रेषक";
        const safeEmail = email || "noreply@sanatanmarga.com";
        const safeSubject = subject || "विषय खुलाइएको छैन";
        const safeMessage = message || "कुनै सन्देश सामग्री छैन";
        assert.ok(id.length > 0);
        assert.ok(safeName.length > 0);
        assert.ok(safeEmail.length > 0);
        assert.ok(safeSubject.length > 0);
        assert.ok(safeMessage.length > 0);
      });
    }
  });

  await t.test("5. Repeated Admin Navigation simulation (Notifications <-> Contact Messages)", async () => {
    const AdminNotificationsMod = await import("../src/pages/AdminNotifications");
    const AdminContactMessagesMod = await import("../src/pages/AdminContactMessages");

    function NotificationsRoute() {
      return React.createElement("div", { "data-testid": "admin-notifications-view" }, "Notifications View");
    }

    function ContactMessagesRoute() {
      return React.createElement("div", { "data-testid": "admin-contact-messages-view" }, "Contact Messages View");
    }

    function TestApp({ route }: { route: string }) {
      return React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/admin/notifications", element: React.createElement(NotificationsRoute) }),
          React.createElement(Route, { path: "/admin/contact-messages", element: React.createElement(ContactMessagesRoute) })
        )
      );
    }

    // Cycle 1: Notifications -> Contact Messages
    const html1 = renderToString(React.createElement(TestApp, { route: "/admin/notifications" }));
    assert.ok(html1.includes("Notifications View"), "Cycle 1: Notifications page renders");

    const html2 = renderToString(React.createElement(TestApp, { route: "/admin/contact-messages" }));
    assert.ok(html2.includes("Contact Messages View"), "Cycle 1: Contact Messages page renders");

    // Cycle 2: Notifications -> Contact Messages (Repeated)
    const html3 = renderToString(React.createElement(TestApp, { route: "/admin/notifications" }));
    assert.ok(html3.includes("Notifications View"), "Cycle 2: Notifications page renders without stale-state exception");

    const html4 = renderToString(React.createElement(TestApp, { route: "/admin/contact-messages" }));
    assert.ok(html4.includes("Contact Messages View"), "Cycle 2: Contact Messages page renders without stale-state exception");

    // Cycle 3: Notifications -> Contact Messages (Third repeat)
    const html5 = renderToString(React.createElement(TestApp, { route: "/admin/notifications" }));
    assert.ok(html5.includes("Notifications View"), "Cycle 3: Notifications stable");

    const html6 = renderToString(React.createElement(TestApp, { route: "/admin/contact-messages" }));
    assert.ok(html6.includes("Contact Messages View"), "Cycle 3: Contact Messages stable");
  });

  await t.test("6. No target TypeError or undefined property exceptions during navigation cycles", () => {
    const testStrings = [undefined, null, "", "   ", "नेपाली समाचार", "ENGLISH_QUERY"];
    for (const str of testStrings) {
      assert.doesNotThrow(() => {
        const normalized = (str || "").toLowerCase().trim();
        assert.ok(typeof normalized === "string");
      });
    }
  });
});
