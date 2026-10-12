// Run with: node scripts/test-wallet-topup-handoff.cjs
// Executes the actual TypeScript handlers with payment/network/storage mocks.
// No live payments, authentication requests, or database writes are performed.
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone Node regression harness is intentionally CommonJS. */
const realAssert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const { webcrypto } = require("node:crypto")
const ts = require("typescript")
const { NextRequest, NextResponse } = require("next/server")

const root = path.resolve(__dirname, "..")
let assertions = 0
const assert = new Proxy(realAssert, {
    get(target, key) {
        const value = target[key]
        return typeof value === "function" ? (...args) => { assertions++; return value(...args) } : value
    },
})
const tests = []
const test = (suite, name, run) => tests.push({ suite, name, run })
const attemptId = "6bf52eaa-cdf8-47e9-abec-b0942157184d"
const reference = `WAL-${attemptId}`
const checkoutUrl = "https://sdk.monnify.com/checkout/test-reference"
const ready = () => ({ attemptId, startedAt: Date.now(), reference, checkoutUrl, amount: 1000 })
const quietConsole = { info() {}, error() {}, warn() {} }
const tick = () => new Promise(setImmediate)
function deferred() {
    let resolve
    const promise = new Promise((done) => { resolve = done })
    return { promise, resolve }
}
function compile(source) {
    const result = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
        reportDiagnostics: true,
    })
    const errors = result.diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error)
    if (errors.length) throw new Error(ts.flattenDiagnosticMessageText(errors[0].messageText, "\n"))
    return result.outputText
}
function runSource(file, context) {
    vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), "utf8")), context, { filename: file })
}

function routeFixture() {
    const state = { provider: { success: true, checkoutUrl, reference }, calls: [], logs: [] }
    const context = { exports: {}, crypto: webcrypto, URL, console: quietConsole, require(name) {
        if (name === "next/server") return { NextRequest, NextResponse }
        if (name.endsWith("/actions")) return { async initializeTopUp(...args) {
            state.calls.push(args)
            if (state.provider instanceof Error) throw state.provider
            return state.provider
        } }
        if (name.endsWith("/walletTopupDiagnostics")) return { async recordWalletTopupDiagnostic(value) {
            state.logs.push(value)
            return { success: true }
        } }
        throw new Error(`Unexpected route import: ${name}`)
    } }
    runSource("src/app/api/wallet/topup/route.ts", context)
    state.request = (options = {}) => {
        const { json = true, amount = "1000", bodyId = attemptId, queryId = attemptId, origin = "https://www.myrss.com.ng" } = options
        const form = new FormData()
        if (bodyId !== null) form.set("attemptId", bodyId)
        form.set("amount", amount)
        const url = `https://www.myrss.com.ng/api/wallet/topup${queryId === null ? "" : `?attemptId=${queryId}`}`
        return context.exports.POST(new NextRequest(url, { method: "POST", headers: {
            Accept: json ? "application/json" : "text/html", Origin: origin,
            "User-Agent": "iPhone OS 16_7_12", "Sec-Fetch-Site": "same-origin",
        }, body: form }))
    }
    return state
}

const pageText = fs.readFileSync(path.join(root, "src/app/account/wallet/page.tsx"), "utf8")
const pageAst = ts.createSourceFile("page.tsx", pageText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const pageFunctions = new Map()
let returnHandler
function findPageFunctions(node) {
    if (ts.isFunctionDeclaration(node) && node.name) pageFunctions.set(node.name.text, node.getText(pageAst))
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "reportUnexpectedReturn") {
        returnHandler = `const ${node.getText(pageAst)};`
    }
    ts.forEachChild(node, findPageFunctions)
}
findPageFunctions(pageAst)
const helperNames = ["isTrustedCheckoutUrl", "isReadyWalletTopup", "createTopupAttemptId", "readPendingWalletTopup",
    "clearPendingWalletTopup", "isMonnifyReferrer", "checkPreparedTopup", "handleTopupSubmit"]
for (const name of helperNames) if (!pageFunctions.has(name)) throw new Error(`Missing actual page function: ${name}`)
if (!returnHandler) throw new Error("Missing actual page return handler")
const pageHandlers = compile(`${helperNames.map((name) => pageFunctions.get(name)).join("\n")}\n${returnHandler}
globalThis.handlers = { ${helperNames.join(",")}, reportUnexpectedReturn };`)
function uiFixture() {
    const state = { pending: null, statuses: [], diagnostics: [], verifies: [], fetches: [], order: [] }
    const context = {
        URL, URLSearchParams, Date, JSON, Number, crypto: webcrypto, BroadcastChannel: function () {},
        navigator: { userAgent: "iPhone OS 16_7_12", onLine: true },
        document: { visibilityState: "visible", referrer: "https://www.myrss.com.ng/account/wallet" },
        window: { location: { search: "", href: "https://www.myrss.com.ng/account/wallet" }, sessionStorage: {
            getItem() { return state.pending }, setItem(key, value) { state.pending = value }, removeItem() { state.pending = null },
        } },
        PENDING_WALLET_TOPUP_KEY: "rss-wallet-topup-pending",
        UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        topupInFlight: { current: false }, walletMounted: { current: true }, activeTopupAttempt: { current: null },
        paymentCheck: { current: null }, readyTopup: null,
        setTopupLoading(value) { state.order.push(`loading:${value}`) },
        setReadyTopup(value) { context.readyTopup = value }, setAmount(value) { state.amount = value },
        showStatus(...args) { state.statuses.push(args) }, reportWalletTopupDiagnostic(...args) { state.diagnostics.push(args) },
        async loadData() {}, async verifyWalletTopUp(ref) { state.verifies.push(ref); return { success: true, status: "PENDING" } },
        FormData: class {
            constructor(form) { state.order.push("form-snapshot"); this.values = new Map([["amount", form.amount]]) }
            set(key, value) { this.values.set(key, value) }
            get(key) { return this.values.get(key) }
        },
        async fetch(url, options) {
            state.fetches.push({ url, options })
            return { ok: true, async json() { return { attemptId: options.body.get("attemptId"), reference, checkoutUrl } } }
        },
    }
    vm.runInNewContext(pageHandlers, context, { filename: "actual-wallet-handlers.ts" })
    state.context = context
    state.handlers = context.handlers
    state.event = { preventDefault() {}, currentTarget: { action: "/api/wallet/topup", amount: "1000" } }
    state.restore = (value = ready()) => {
        context.activeTopupAttempt.current = value.attemptId
        context.readyTopup = value
        state.pending = JSON.stringify(value)
        context.walletMounted.current = true
        context.paymentCheck.current = null
        return value
    }
    return state
}

function edgeFixture() {
    const state = { inserted: [], authCalls: 0, user: { id: "test-user", is_anonymous: false }, authError: null, insertError: null,
        env: { SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test-public", SUPABASE_SERVICE_ROLE_KEY: "test-server" } }
    const context = { exports: {}, Request, Response, console: quietConsole,
        Deno: { env: { get: (key) => state.env[key] }, serve(handler) { state.handler = handler } },
        require(name) {
            if (name !== "https://esm.sh/@supabase/supabase-js@2.90.1") throw new Error(`Unexpected Edge import: ${name}`)
            return { createClient(url, key) {
                if (key === "test-server") return { from(table) {
                    assert.equal(table, "wallet_topup_diagnostics")
                    return { async insert(row) { state.inserted.push(row); return { error: state.insertError } } }
                } }
                return { auth: { async getUser(token) {
                    state.authCalls++
                    assert.equal(token, "test-token")
                    return { data: { user: state.user }, error: state.authError }
                } } }
            } }
        },
    }
    runSource("supabase/functions/wallet-topup-diagnostics/index.ts", context)
    state.payload = { attemptId, source: "client", event: "client_submit", platform: "ios_webkit", details: {} }
    state.request = async (payload = state.payload, headers = { authorization: "Bearer test-token" }, method = "POST") => {
        const response = await state.handler(new Request("https://test.example", { method, headers,
            body: method === "POST" ? typeof payload === "string" ? payload : JSON.stringify(payload) : undefined }))
        return { status: response.status, body: await response.json() }
    }
    return state
}

function persistenceFixture() {
    const state = { env: {}, adminCalls: 0, adminError: null, session: { access_token: "test-token" }, invokes: [],
        invokeResult: { data: { success: true }, error: null } }
    const context = { exports: {}, process: { env: state.env }, console: quietConsole, require(name) {
        if (name === "server-only") return {}
        if (name.endsWith("/admin")) return { createAdminClient() {
            state.adminCalls++
            return { from() { return { async insert() { return { error: state.adminError } } } } }
        } }
        if (name.endsWith("/server")) return { async createClient() { return {
            auth: { async getSession() { return { data: { session: state.session }, error: null } } },
            functions: { async invoke(name, options) { state.invokes.push({ name, options }); return state.invokeResult } },
        } } }
        throw new Error(`Unexpected persistence import: ${name}`)
    } }
    runSource("src/lib/walletTopupDiagnostics.ts", context)
    state.record = context.exports.recordWalletTopupDiagnostic
    state.payload = { attemptId, source: "client", event: "client_submit", platform: "ios_webkit", details: {} }
    return state
}

test("route", "JSON preparation returns the original payment and support ID", async () => {
    const f = routeFixture(), response = await f.request(), data = await response.json()
    assert.equal(response.status, 200); assert.equal(data.checkoutUrl, checkoutUrl); assert.equal(data.reference, reference)
    assert.equal(data.attemptId, attemptId); assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("x-topup-diagnostic-id"), attemptId)
    assert.equal(f.logs.at(-1).event, "checkout_created"); assert.equal(f.calls[0][2], "ios_webkit")
})
test("route", "native form retains a GET-producing 303 redirect", async () => {
    const f = routeFixture(), response = await f.request({ json: false })
    assert.equal(response.status, 303); assert.equal(response.headers.get("location"), checkoutUrl)
    assert.equal(f.logs.at(-1).event, "redirect_issued")
})
test("route", "invalid amount produces JSON error or native wallet return", async () => {
    const f = routeFixture(), json = await f.request({ amount: "99" }), native = await f.request({ amount: "99", json: false })
    assert.equal(json.status, 400); assert.equal((await json.json()).code, "invalid_request")
    assert.equal(native.status, 303); assert.ok(new URL(native.headers.get("location")).searchParams.get("topup_error"))
    assert.equal(f.calls.length, 0)
})
test("route", "missing/conflicting support ID and foreign origin never initialize", async () => {
    const f = routeFixture()
    assert.equal((await f.request({ bodyId: null, queryId: null })).status, 400)
    assert.equal((await f.request({ bodyId: "cbf52eaa-cdf8-47e9-abec-b0942157184d" })).status, 400)
    assert.equal((await f.request({ origin: "https://evil.example" })).status, 403); assert.equal(f.calls.length, 0)
})
test("route", "unsafe checkout hosts/protocols/credentials are rejected", async () => {
    const f = routeFixture()
    for (const url of ["https://monnify.com.evil.example/pay", "http://sdk.monnify.com/pay", "https://user:pass@sdk.monnify.com/pay"]) {
        f.provider = { success: true, checkoutUrl: url, reference }
        const response = await f.request()
        assert.equal(response.status, 400); assert.equal((await response.json()).code, "invalid_checkout_url")
    }
})
test("route", "provider rejection and exception never expose a checkout", async () => {
    const f = routeFixture()
    for (const value of [{ success: false, error: "test-provider" }, new Error("test-provider")]) {
        f.provider = value
        const response = await f.request()
        assert.equal(response.status, 400); assert.equal((await response.json()).code, "topup_initialization_failed")
    }
})
test("UI", "initial pageshow after submit does not claim a checkout return", async () => {
    const f = uiFixture(); f.restore(); f.handlers.reportUnexpectedReturn({ persisted: false })
    assert.equal(f.statuses.length, 0); assert.equal(f.verifies.length, 0); assert.ok(f.pending)
})
test("UI", "BFCache return checks the existing reference and keeps its checkout", async () => {
    const f = uiFixture(), value = f.restore(); f.handlers.reportUnexpectedReturn({ persisted: true }); await tick()
    assert.equal(f.verifies[0], reference); assert.equal(f.context.readyTopup.reference, value.reference)
    assert.equal(f.statuses.at(-1)[0], "info"); assert.ok(f.pending); assert.equal(f.amount, "1000")
})
test("UI", "preparing snapshots amount before rendering loading and reuses the payment", async () => {
    const f = uiFixture(); await f.handlers.handleTopupSubmit(f.event)
    assert.equal(f.fetches.length, 1); assert.equal(f.fetches[0].options.body.get("amount"), "1000")
    assert.ok(f.order.indexOf("form-snapshot") < f.order.indexOf("loading:true"))
    assert.equal(f.context.readyTopup.checkoutUrl, checkoutUrl); assert.equal(JSON.parse(f.pending).reference, reference)
    assert.equal(JSON.parse(f.pending).amount, 1000)
    await f.handlers.handleTopupSubmit(f.event); assert.equal(f.fetches.length, 1)
})
test("UI", "PAID and expired results clear the checkout; status failure preserves it", async () => {
    for (const [result, cleared] of [[{ success: true, status: "PAID" }, true], [{ success: true, status: "EXPIRED" }, true], [{ success: false }, false]]) {
        const f = uiFixture(), value = f.restore(); f.context.verifyWalletTopUp = async () => result
        await f.handlers.checkPreparedTopup(value)
        assert.equal(f.pending === null, cleared); assert.equal(f.context.readyTopup === null, cleared)
    }
})
test("UI", "callback and stale checkout storage do not trigger duplicate verification", async () => {
    const f = uiFixture(); f.restore(); f.context.window.location.search = `?payment=return&ref=${reference}`
    f.handlers.reportUnexpectedReturn(); assert.equal(f.pending, null); assert.equal(f.verifies.length, 0)
    f.context.window.location.search = ""; f.restore({ ...ready(), startedAt: Date.now() - 41 * 60 * 1000 })
    f.handlers.reportUnexpectedReturn(); assert.equal(f.pending, null); assert.equal(f.context.readyTopup, null)
})
test("UI", "UUID fallback and checkout URL validation work without randomUUID", async () => {
    const f = uiFixture(); f.context.crypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }
    assert.match(f.handlers.createTopupAttemptId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    assert.equal(f.handlers.isTrustedCheckoutUrl("https://user:pass@sdk.monnify.com/pay"), false)
    assert.equal(f.handlers.isTrustedCheckoutUrl("https://evil.example/pay"), false)
})
test("UI", "an older status response cannot erase a newer payment", async () => {
    const f = uiFixture(), value = f.restore(), wait = deferred(); f.context.verifyWalletTopUp = () => wait.promise
    const oldCheck = f.handlers.checkPreparedTopup(value)
    const newer = f.restore({ ...ready(), attemptId: "cbf52eaa-cdf8-47e9-abec-b0942157184d" })
    const count = f.statuses.length; wait.resolve({ success: true, status: "PAID" }); await oldCheck
    assert.equal(JSON.parse(f.pending).attemptId, newer.attemptId); assert.equal(f.context.readyTopup, newer)
    assert.equal(f.statuses.length, count)
})
test("UI", "verification and preparation stop updating a page after unmount", async () => {
    const f = uiFixture(), value = f.restore(), wait = deferred(); f.context.verifyWalletTopUp = () => wait.promise
    const check = f.handlers.checkPreparedTopup(value); f.context.walletMounted.current = false
    const count = f.statuses.length; wait.resolve({ success: true, status: "PAID" }); await check
    assert.ok(f.pending); assert.equal(f.context.readyTopup, value); assert.equal(f.statuses.length, count)
    const g = uiFixture(), preparedWait = deferred(); g.context.fetch = () => preparedWait.promise
    const preparation = g.handlers.handleTopupSubmit(g.event); g.context.walletMounted.current = false
    preparedWait.resolve({ ok: true, async json() { return { attemptId: g.context.activeTopupAttempt.current, reference, checkoutUrl } } })
    await preparation; assert.equal(g.context.readyTopup, null)
})
test("UI", "double submit makes one preparation request", async () => {
    const f = uiFixture(), wait = deferred(); f.context.fetch = (url, options) => { f.fetches.push({ url, options }); return wait.promise }
    const first = f.handlers.handleTopupSubmit(f.event); await f.handlers.handleTopupSubmit(f.event)
    assert.equal(f.fetches.length, 1)
    wait.resolve({ ok: true, async json() { return { attemptId: f.fetches[0].options.body.get("attemptId"), reference, checkoutUrl } } })
    await first; assert.ok(f.context.readyTopup); assert.equal(f.context.topupInFlight.current, false)
})
test("UI", "unavailable session storage leaves the prepared link usable", async () => {
    const f = uiFixture(); f.context.window.sessionStorage = { getItem() { throw new Error("blocked") }, setItem() { throw new Error("blocked") }, removeItem() { throw new Error("blocked") } }
    await f.handlers.handleTopupSubmit(f.event)
    assert.equal(f.context.readyTopup.checkoutUrl, checkoutUrl); assert.equal(f.handlers.readPendingWalletTopup(), null)
})
test("UI", "legacy interrupted attempts show neutral status without creating another payment", async () => {
    const f = uiFixture(); f.pending = JSON.stringify({ attemptId, startedAt: Date.now() })
    f.handlers.reportUnexpectedReturn()
    assert.equal(f.pending, null); assert.equal(f.context.readyTopup, null)
    assert.equal(f.statuses.at(-1)[0], "info"); assert.equal(f.fetches.length, 0)
})
test("UI", "a mismatched preparation response cannot attach a different checkout", async () => {
    const f = uiFixture(); f.context.fetch = async () => ({ ok: true, async json() {
        return { attemptId: "cbf52eaa-cdf8-47e9-abec-b0942157184d", reference, checkoutUrl }
    } })
    await f.handlers.handleTopupSubmit(f.event)
    assert.equal(f.context.readyTopup, null); assert.equal(f.pending, null)
    assert.equal(f.statuses.at(-1)[0], "error"); assert.equal(f.context.topupInFlight.current, false)
})
test("Edge", "missing credentials, invalid user, and anonymous users cannot insert", async () => {
    const f = edgeFixture(); assert.equal((await f.request(f.payload, {})).status, 401); assert.equal(f.authCalls, 0)
    f.user = null; f.authError = { code: "invalid-token" }; assert.equal((await f.request()).status, 401)
    f.user = { id: "anonymous", is_anonymous: true }; f.authError = null; assert.equal((await f.request()).status, 401)
    assert.equal(f.inserted.length, 0)
})
test("Edge", "source/event/platform/ID whitelist rejects malformed records", async () => {
    const f = edgeFixture()
    for (const patch of [{ attemptId: "invalid" }, { source: "monnify_edge" }, { event: "redirect_issued" }, { platform: "unknown" }]) {
        assert.equal((await f.request({ ...f.payload, ...patch })).status, 400)
    }
    assert.equal(f.inserted.length, 0)
})
test("Edge", "method, JSON, and payload limits reject bad input", async () => {
    const f = edgeFixture(); assert.equal((await f.request(f.payload, {}, "GET")).status, 405)
    assert.equal((await f.request("invalid-json")).status, 400); assert.equal((await f.request(" ".repeat(8193))).status, 413)
})
test("Edge", "safe diagnostics persist while PII, full URLs, and nested data are stripped", async () => {
    const f = edgeFixture(), result = await f.request({ ...f.payload, details: {
        persisted: false, online: true, browserIOSVersion: "16.7.12", broadcastChannelAvailable: false, cryptoUUIDAvailable: true,
        checkoutPrepared: true, browserReturned: false, pendingAgeMs: 35 * 60 * 1000, durationMs: -1,
        checkoutHost: "SDK.Monnify.com", checkoutUrl: "https://sdk.monnify.com/?token=SECRET", email: "private@example.com",
        reason: "private@example.com", nested: { password: "SECRET" }, responseStatus: 200, errorType: "Error: PRIVATE",
    } })
    assert.equal(result.status, 200); assert.equal(result.body.success, true)
    assert.deepEqual(Object.keys(f.inserted[0].details).sort(), ["persisted", "online", "browserIOSVersion", "broadcastChannelAvailable", "cryptoUUIDAvailable", "checkoutPrepared", "browserReturned", "pendingAgeMs", "checkoutHost", "responseStatus"].sort())
    assert.equal(f.inserted[0].details.checkoutHost, "sdk.monnify.com"); assert.equal(f.inserted[0].details.pendingAgeMs, 35 * 60 * 1000)
})
test("Edge", "app checkout_created is accepted and database/configuration failures return false", async () => {
    const f = edgeFixture(); assert.equal((await f.request({ ...f.payload, source: "app_server", event: "checkout_created" })).status, 200)
    f.insertError = { code: "insert-failed" }; assert.equal((await f.request()).status, 500)
    delete f.env.SUPABASE_SERVICE_ROLE_KEY; assert.equal((await f.request()).body.success, false)
})
test("persistence", "authenticated fallback carries only the fixed payload and caller token", async () => {
    const f = persistenceFixture(); assert.equal((await f.record(f.payload)).success, true); assert.equal(f.adminCalls, 0)
    assert.equal(f.invokes[0].name, "wallet-topup-diagnostics"); assert.equal(f.invokes[0].options.headers.Authorization, "Bearer test-token")
    assert.deepEqual(Object.keys(f.invokes[0].options.body).sort(), ["attemptId", "source", "event", "platform", "details"].sort())
})
test("persistence", "missing session and rejected Edge persistence return false", async () => {
    const f = persistenceFixture(); f.session = null; assert.equal((await f.record(f.payload)).success, false); assert.equal(f.invokes.length, 0)
    f.session = { access_token: "test-token" }; f.invokeResult = { data: { success: false }, error: null }
    assert.equal((await f.record(f.payload)).success, false)
    assert.equal((await f.record({ ...f.payload, source: "monnify_edge" })).success, false)
})
test("persistence", "admin client remains preferred and its failure permits authenticated fallback", async () => {
    const f = persistenceFixture(); f.env.SUPABASE_SERVICE_ROLE_KEY = "test-server"
    assert.equal((await f.record(f.payload)).success, true); assert.equal(f.adminCalls, 1); assert.equal(f.invokes.length, 0)
    f.adminError = { code: "admin-failed" }; assert.equal((await f.record(f.payload)).success, true); assert.equal(f.invokes.length, 1)
})

async function main() {
    const counts = {}
    for (const item of tests) {
        try { await item.run() } catch (error) { throw new Error(`${item.suite}: ${item.name}`, { cause: error }) }
        counts[item.suite] = (counts[item.suite] ?? 0) + 1
    }
    console.log(`Passed ${tests.length} regression cases and ${assertions} assertions: ${Object.entries(counts).map(([suite, count]) => `${suite} ${count}`).join(", ")}.`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
