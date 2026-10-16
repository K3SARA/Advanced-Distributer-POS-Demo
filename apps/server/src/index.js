import "dotenv/config";
import express from "express";
import http from "node:http";
import fs from "node:fs";
import cors from "cors";
import { Server } from "socket.io";
import { nanoid } from "nanoid";
import { SOCKET_EVENTS } from "@lucky/shared";
import { enrichSale, seedState } from "./seed.js";
import { getState, getStoreMeta, replaceState, updateState } from "./store.js";
import {
  createAuthUser,
  deleteAuthUser,
  extractSocketToken,
  getAuthStoreMeta,
  listUsers,
  loginUser,
  requireAuth,
  requireRole,
  revokeRefreshToken,
  rotateRefreshToken,
  updateAuthUser,
  verifyAccessToken
} from "./auth.js";

const BASE_LORRIES = ["Lorry A", "Lorry B"];
const ORDER_LORRIES = ["Lorry A", "Lorry A Overflow", "Lorry B", "Lorry B Overflow"];
const LORRY_CAPACITY = 2880;
const BUSINESS_TIME_ZONE = "Asia/Colombo";
const APP_MODE = String(process.env.APP_MODE || "live").trim().toLowerCase();
const IS_DEMO_MODE = APP_MODE === "demo";
const DEMO_READ_ONLY = String(process.env.DEMO_READ_ONLY || "false").trim().toLowerCase() === "true";
const DEMO_SNAPSHOT_FILE = String(process.env.DEMO_SNAPSHOT_FILE || "").trim();
const colomboDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const normalizeRepKey = (val = "") => String(val || "").trim().toLowerCase().replace(/[\s\-_]+/g, "");
const isSameRep = (saleCashier, currentCashier, userObj) => {
  const normSale = normalizeRepKey(saleCashier);
  if (!normSale) return false;
  const normCurrent = normalizeRepKey(currentCashier);
  if (normCurrent && normSale === normCurrent) return true;
  const normUsername = normalizeRepKey(userObj?.username);
  if (normUsername && normSale === normUsername) return true;
  const normName = normalizeRepKey(userObj?.name);
  if (normName && normSale === normName) return true;
  const normId = normalizeRepKey(userObj?.id);
  if (normId && normSale === normId) return true;
  return false;
};

const toColomboDateKey = (value = new Date()) => {
  try {
    return colomboDateFormatter.format(new Date(value));
  } catch {
    return "";
  }
};

const buildLorryLoadMap = (state) => {
  const next = ORDER_LORRIES.reduce((acc, name) => {
    acc[name] = 0;
    return acc;
  }, {});
  const resetAtMap = state?.settings?.lorryCountResetAt || {};
  
  const now = new Date();
  const startOfTodayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  for (const sale of (state.sales || [])) {
    const lorryName = String(sale.lorry || "").trim();
    if (!(lorryName in next)) continue;
    if (!BASE_LORRIES.includes(lorryName) && sale.deliveryConfirmedAt) continue;
    
    const resetAt = String(resetAtMap[lorryName] || "").trim();
    const resetAtTs = resetAt ? new Date(resetAt).getTime() : 0;
    
    const effectiveResetTs = Math.max(
      Number.isFinite(resetAtTs) ? resetAtTs : 0,
      startOfTodayTs
    );
    
    const saleCreatedAtTs = new Date(sale.createdAt || 0).getTime();
    if (Number.isFinite(saleCreatedAtTs) && saleCreatedAtTs <= effectiveResetTs) {
      continue;
    }
    
    const saleQty = (sale.lines || []).reduce((acc, line) => acc + Number(line.quantity || 0), 0);
    next[lorryName] += saleQty;
  }
  return next;
};

const buildPreOrderReservedMap = (state, excludeSaleId = "") => {
  const map = new Map();
  for (const sale of (state.sales || [])) {
    if (String(sale.id || "") === String(excludeSaleId || "")) continue;
    if (sale.orderType !== "preorder" || sale.preOrderStatus !== "pending" || sale.stockDecremented !== false) continue;
    for (const line of (sale.lines || [])) {
      const key = String(line.productId || "").trim();
      if (!key) continue;
      map.set(key, Number(map.get(key) || 0) + Number(line.quantity || 0));
    }
  }
  return map;
};

const managerHasFullAccess = (state = null) => Boolean((state || getState())?.settings?.managerFullAccess);

const requireAdminOrManagerFullAccess = async (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin") {
    next();
    return;
  }
  if (role === "manager" && managerHasFullAccess()) {
    next();
    return;
  }
  res.status(403).json({ message: "Manager full access is required" });
};

const normalizeSalePayments = (sale) => {
  const explicit = Array.isArray(sale?.payments) ? sale.payments : [];
  if (explicit.length) return explicit;
  const migrated = [];
  if (Number(sale?.cashReceived || 0) > 0) {
    migrated.push({
      id: `legacy-cash-${sale.id || "sale"}`,
      method: "cash",
      amount: Number(Number(sale.cashReceived || 0).toFixed(2)),
      createdAt: sale.deliveryConfirmedAt || sale.createdAt || new Date().toISOString(),
      receivedBy: sale.deliveryConfirmedBy || sale.cashier || "system"
    });
  }
  if (Number(sale?.chequeAmount || 0) > 0) {
    migrated.push({
      id: `legacy-cheque-${sale.id || "sale"}`,
      method: "cheque",
      amount: Number(Number(sale.chequeAmount || 0).toFixed(2)),
      chequeNo: sale.chequeNo || "",
      chequeDate: sale.chequeDate || "",
      chequeBank: sale.chequeBank || "",
      createdAt: sale.deliveryConfirmedAt || sale.createdAt || new Date().toISOString(),
      receivedBy: sale.deliveryConfirmedBy || sale.cashier || "system"
    });
  }
  return migrated;
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const totalPaymentsAmount = (payments = []) => roundMoney(
  payments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0)
);

const buildCustomerCreditUsagePlan = ({ credits = [], customerName = "", amount = 0 }) => {
  const normalizedName = String(customerName || "").trim().toLowerCase();
  let remaining = roundMoney(amount);
  const usagePlan = [];
  if (!normalizedName || remaining <= 0) {
    return { usagePlan, remaining };
  }

  const eligibleCredits = [...credits]
    .filter((entry) => String(entry.customerName || "").trim().toLowerCase() === normalizedName)
    .filter((entry) => Number(entry.remainingAmount ?? entry.amount ?? 0) > 0)
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  for (const entry of eligibleCredits) {
    if (remaining <= 0) break;
    const available = roundMoney(entry.remainingAmount ?? entry.amount ?? 0);
    if (available <= 0) continue;
    const used = roundMoney(Math.min(available, remaining));
    if (used <= 0) continue;
    usagePlan.push({
      creditId: entry.id,
      amount: used
    });
    remaining = roundMoney(remaining - used);
  }

  return { usagePlan, remaining };
};

const restoreCustomerCreditUsage = ({ credits = [], creditPayment = null, saleId = "" }) => {
  if (!creditPayment?.usagePlan?.length) return;
  for (const usage of creditPayment.usagePlan) {
    const creditEntry = credits.find((entry) => String(entry.id) === String(usage.creditId));
    if (!creditEntry) continue;
    const currentRemaining = roundMoney(creditEntry.remainingAmount ?? creditEntry.amount ?? 0);
    creditEntry.remainingAmount = roundMoney(currentRemaining + Number(usage.amount || 0));
    creditEntry.status = "open";
    creditEntry.usageHistory = (creditEntry.usageHistory || []).filter((entry) => !(String(entry.saleId || "") === String(saleId) && Number(entry.amount || 0) === roundMoney(usage.amount || 0)));
  }
};

const applyCustomerCreditUsage = ({ credits = [], creditPayment = null, customerName = "", amount = 0, saleId = "", username = "system" }) => {
  const desiredAmount = roundMoney(amount);
  if (!creditPayment || desiredAmount <= 0) return null;
  const { usagePlan, remaining } = buildCustomerCreditUsagePlan({ credits, customerName, amount: desiredAmount });
  if (remaining > 0) {
    throw new Error("Customer credit exceeds available balance");
  }
  for (const usage of usagePlan) {
    const creditEntry = credits.find((entry) => String(entry.id) === String(usage.creditId));
    if (!creditEntry) continue;
    const currentRemaining = roundMoney(creditEntry.remainingAmount ?? creditEntry.amount ?? 0);
    creditEntry.remainingAmount = roundMoney(Math.max(0, currentRemaining - Number(usage.amount || 0)));
    creditEntry.status = creditEntry.remainingAmount > 0 ? "partial" : "used";
    creditEntry.usedAt = new Date().toISOString();
    creditEntry.usageHistory = creditEntry.usageHistory || [];
    creditEntry.usageHistory.push({
      saleId,
      amount: roundMoney(usage.amount || 0),
      createdAt: new Date().toISOString(),
      by: username
    });
  }
  return {
    ...creditPayment,
    amount: desiredAmount,
    usagePlan
  };
};

const resolveCustomerDiscountLimit = ({ customers = [], customerName = "" }) => {
  const key = String(customerName || "").trim().toLowerCase();
  if (!key || key === "walk-in") return 0;
  return roundMoney(
    (customers || [])
      .filter((customer) => String(customer?.name || "").trim().toLowerCase() === key)
      .reduce((max, customer) => Math.max(max, Number(customer?.discountLimit || 0)), 0)
  );
};

const resolveCustomerCreditProfile = ({ customers = [], customerName = "", customerId = "" }) => {
  if (customerId) {
    const customer = (customers || []).find((c) => String(c.id) === String(customerId));
    if (customer) {
      return {
        creditLimit: Number(customer.creditLimit || 0),
        openingOutstanding: Number(customer.openingOutstanding || 0),
        outstandingAdjustment: Number(customer.outstandingAdjustment || 0)
      };
    }
  }
  
  const key = String(customerName || "").trim().toLowerCase();
  if (!key || key === "walk-in") {
    return { creditLimit: 0, openingOutstanding: 0, outstandingAdjustment: 0 };
  }

  return (customers || [])
    .filter((customer) => String(customer?.name || "").trim().toLowerCase() === key)
    .reduce((profile, customer) => ({
      creditLimit: Math.max(Number(profile.creditLimit || 0), Number(customer?.creditLimit || 0)),
      openingOutstanding: Math.max(Number(profile.openingOutstanding || 0), Number(customer?.openingOutstanding || 0)),
      outstandingAdjustment: Math.max(Number(profile.outstandingAdjustment || 0), Number(customer?.outstandingAdjustment || 0))
    }), { creditLimit: 0, openingOutstanding: 0, outstandingAdjustment: 0 });
};

const extractSizeMl = (value = "") => {
  const raw = String(value || "").toLowerCase().replace(/\s+/g, "");
  const match = raw.match(/(\d{3,4})ml/);
  return match ? Number(match[1]) : 0;
};


const calculateSaleDiscountTotal = ({ lines = [], billDiscount = 0 }) => {
  const lineDiscountTotal = roundMoney((lines || []).reduce((acc, line) => {
    const base = Number(line?.basePrice || 0);
    const price = Number(line?.price || 0);
    const qty = Number(line?.quantity || 0);
    return acc + (Math.max(0, base - price) * Math.max(0, qty));
  }, 0));
  return roundMoney(lineDiscountTotal + Math.max(0, Number(billDiscount || 0)));
};

const recalculateSaleFinancials = (sale) => {
  // A pending pre-order hasn't been delivered or billed yet — it's a reservation of
  // stock/intent, not a debt. Don't count it as outstanding (or against credit limits)
  // until it's actually confirmed at delivery via /sales/:id/confirm-preorder.
  const isPendingPreOrder = sale.orderType === "preorder" && sale.preOrderStatus === "pending";
  const payments = normalizeSalePayments(sale);
  const cashPayments = payments.filter((payment) => String(payment.method || "").toLowerCase() === "cash");
  const chequePayments = payments.filter((payment) => String(payment.method || "").toLowerCase() === "cheque");
  const allPaidPayments = payments.filter((payment) => Number(payment.amount || 0) > 0);
  const totalCash = totalPaymentsAmount(cashPayments);
  const totalCheque = totalPaymentsAmount(chequePayments);
  const latestCheque = chequePayments.length ? chequePayments[chequePayments.length - 1] : null;
  const returnedAmount = roundMoney(sale.returnedAmount || 0);
  const undeliveredAmount = computeDeliveryAdjustmentsAmount(sale);
  const netTotalAfterReturns = roundMoney(Math.max(0, Number(sale.total || 0) - returnedAmount - undeliveredAmount));
  const rawPaid = totalPaymentsAmount(allPaidPayments);
  const paidAmount = roundMoney(Math.min(netTotalAfterReturns, rawPaid));
  const outstandingAmount = isPendingPreOrder ? 0 : roundMoney(Math.max(0, netTotalAfterReturns - paidAmount));
  const refundDueAmount = roundMoney(Math.max(0, rawPaid - netTotalAfterReturns));

  return {
    ...sale,
    payments,
    cashReceived: totalCash > 0 ? totalCash : null,
    chequeAmount: totalCheque > 0 ? totalCheque : null,
    chequeNo: latestCheque?.chequeNo || "",
    chequeDate: latestCheque?.chequeDate || "",
    chequeBank: latestCheque?.chequeBank || "",
    returnedAmount,
    undeliveredAmount,
    netTotalAfterReturns,
    paidAmount,
    totalPaymentReceived: paidAmount,
    outstandingAmount,
    dueAmount: outstandingAmount,
    refundDueAmount
  };
};

const calculateCustomerOutstanding = ({ sales = [], customers = [], customerName = "", customerId = "" }) => {
  const profile = resolveCustomerCreditProfile({ customers, customerName, customerId });
  
  const liveOutstanding = (sales || []).reduce((total, sale) => {
    let match = false;
    if (customerId && sale.customerId) {
      match = String(sale.customerId) === String(customerId);
    } else {
      const key = String(customerName || "").trim().toLowerCase();
      if (!key || key === "walk-in") return total;
      const saleCustomer = String(sale?.customerName || "").trim().toLowerCase();
      match = saleCustomer === key;
    }
    if (!match) return total;
    return total + Number(recalculateSaleFinancials(sale).outstandingAmount || 0);
  }, 0);

  return roundMoney(Math.max(
    0,
    Number(liveOutstanding || 0)
      + Number(profile.openingOutstanding || 0)
      - Number(profile.outstandingAdjustment || 0)
  ));
};

const pushStockMovement = (draft, entry) => {
  draft.stockMovements = draft.stockMovements || [];
  draft.stockMovements.unshift({
    id: nanoid(12),
    at: new Date().toISOString(),
    ...entry
  });
  if (draft.stockMovements.length > 5000) {
    draft.stockMovements = draft.stockMovements.slice(0, 5000);
  }
};

const buildReturnLineFinancials = ({ sale, soldLine, quantity }) => {
  const qty = Number(quantity || 0);
  const soldQty = Number(soldLine?.quantity || 0);
  const soldUnitPrice = roundMoney(soldLine?.price || 0);
  const baseUnitPrice = roundMoney(soldLine?.basePrice ?? soldUnitPrice);
  const grossAmount = roundMoney(soldUnitPrice * qty);
  const saleSubTotal = Number(sale?.subTotal || 0);
  const proportionalBillDiscount = saleSubTotal > 0
    ? roundMoney(Number(sale?.discountAmount || sale?.discount || 0) * (grossAmount / saleSubTotal))
    : 0;
  const returnAmount = roundMoney(Math.max(0, grossAmount - proportionalBillDiscount));
  const unitItemDiscount = roundMoney(Math.max(0, baseUnitPrice - soldUnitPrice));

  return {
    quantity: qty,
    baseUnitPrice,
    soldUnitPrice,
    unitItemDiscount,
    itemDiscountMode: soldLine?.itemDiscountMode || "amount",
    itemDiscountValue: roundMoney(soldLine?.itemDiscount || 0),
    grossAmount,
    billDiscountShare: proportionalBillDiscount,
    returnAmount,
    returnUnitPrice: qty > 0 ? roundMoney(returnAmount / qty) : 0,
    returnRatio: soldQty > 0 ? roundMoney(qty / soldQty) : 0
  };
};

const computeDeliveryAdjustmentsAmount = (sale, extraAdjustments = []) => {
  const saleLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const qtyByProduct = new Map();
  const allAdjustments = [...(Array.isArray(sale?.deliveryAdjustments) ? sale.deliveryAdjustments : []), ...extraAdjustments];

  for (const adj of allAdjustments) {
    for (const line of (adj?.lines || [])) {
      const key = String(line.productId || "").trim();
      if (!key) continue;
      qtyByProduct.set(key, Number(qtyByProduct.get(key) || 0) + Number(line.quantity || 0));
    }
  }

  let total = 0;
  for (const soldLine of saleLines) {
    const key = String(soldLine.productId || "").trim();
    if (!key) continue;
    const soldQty = Number(soldLine.quantity || 0);
    const undeliveredQty = Math.min(soldQty, Number(qtyByProduct.get(key) || 0));
    if (undeliveredQty <= 0) continue;
    total += Number(buildReturnLineFinancials({ sale, soldLine, quantity: undeliveredQty }).returnAmount || 0);
  }

  return roundMoney(total);
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || "*"
  }
});

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json());

app.use(async (req, res, next) => {
  if (!IS_DEMO_MODE || !DEMO_READ_ONLY) {
    next();
    return;
  }
  const method = String(req.method || "").toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    next();
    return;
  }
  const routePath = String(req.path || "");
  const isAuthRoute = routePath === "/auth/login" || routePath === "/auth/refresh" || routePath === "/auth/logout";
  const isDemoResetRoute = routePath === "/demo/reset";
  if (isAuthRoute || isDemoResetRoute) {
    next();
    return;
  }
  res.status(403).json({ message: "Demo mode is read-only" });
});

const sendFullSync = () => {
  const state = getState();
  io.emit(SOCKET_EVENTS.STATE_SYNC, {
    ...state,
    sales: (state.sales || []).map((sale) => recalculateSaleFinancials(sale))
  });
};

app.get("/health", async (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/app/config", requireAuth, async (_req, res) => {
  res.json({
    appMode: APP_MODE,
    businessTimeZone: BUSINESS_TIME_ZONE,
    demo: {
      enabled: IS_DEMO_MODE,
      readOnly: DEMO_READ_ONLY,
      hasSnapshot: Boolean(DEMO_SNAPSHOT_FILE)
    }
  });
});

app.get("/db/readonly", async (req, res) => {
  const token = String(req.query.token || req.headers["x-readonly-token"] || "").trim();
  const expected = String(process.env.READONLY_DASHBOARD_TOKEN || "").trim();
  if (!expected) {
    res.status(503).json({ message: "READONLY_DASHBOARD_TOKEN is not configured" });
    return;
  }
  if (!token || token !== expected) {
    res.status(401).json({ message: "Invalid readonly token" });
    return;
  }

  const state = getState();
  const normalizedSales = (state.sales || []).map((sale) => recalculateSaleFinancials(sale));
  const today = toColomboDateKey();
  const todaySales = normalizedSales.filter((sale) => toColomboDateKey(sale.createdAt) === today);
  const todayRevenue = todaySales.reduce((acc, sale) => acc + Number(sale.netTotalAfterReturns || 0), 0);

  res.json({
    now: new Date().toISOString(),
    storage: {
      state: getStoreMeta(),
      auth: getAuthStoreMeta()
    },
    counts: {
      products: (state.products || []).length,
      customers: (state.customers || []).length,
      staff: (state.staff || []).length,
      sales: normalizedSales.length,
      returns: (state.returns || []).length,
      todaySales: todaySales.length,
      todayRevenue: Number(todayRevenue.toFixed(2))
    },
    latestSales: normalizedSales.slice(0, 20).map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt,
      rep: sale.cashier || "-",
      customer: sale.customerName || "-",
      lorry: sale.lorry || "-",
      total: Number(sale.netTotalAfterReturns || 0)
    }))
  });
});

app.post("/auth/login", async (req, res) => {
  const { role, username, password } = req.body || {};
  loginUser({ role, username, password })
    .then((session) => {
      if (!session) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
      res.json(session);
    })
    .catch(() => {
      res.status(500).json({ message: "Unable to login" });
    });
});

app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    res.status(400).json({ message: "refreshToken is required" });
    return;
  }

  const nextSession = await rotateRefreshToken(refreshToken);
  if (!nextSession) {
    res.status(401).json({ message: "Invalid or expired refresh token" });
    return;
  }

  res.json(nextSession);
});

app.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  await revokeRefreshToken(refreshToken);
  res.json({ ok: true });
});

app.get("/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.get("/auth/users", requireAuth, requireAdminOrManagerFullAccess, async (_req, res) => {
  res.json(listUsers());
});

app.post("/auth/users", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  try {
    const user = await createAuthUser(req.body || {});
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to create user" });
  }
});

app.patch("/auth/users/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  try {
    const user = await updateAuthUser(req.params.id, req.body || {});
    res.json(user);
  } catch (error) {
    const message = error.message || "Unable to update user";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ message });
  }
});

app.delete("/auth/users/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  try {
    const user = await deleteAuthUser(req.params.id, req.user?.id || "");
    res.json(user);
  } catch (error) {
    const message = error.message || "Unable to delete user";
    const status = /not found/i.test(message) ? 404 : 400;
    res.status(status).json({ message });
  }
});

app.get("/state", requireAuth, async (_req, res) => {
  const state = getState();
  res.json({
    ...state,
    sales: (state.sales || []).map((sale) => recalculateSaleFinancials(sale))
  });
});

app.get("/products", requireAuth, async (_req, res) => {
  res.json(getState().products);
});

app.post("/products", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  const size = String(body.size || "").trim();
  const sku = String(body.sku || "").trim();
  const category = String(body.category || "General").trim();
  const billingPrice = Number(body.billingPrice);
  const invoicePrice = body.invoicePrice !== undefined ? Number(body.invoicePrice) : 0;
  const mrp = Number(body.mrp);
  const stock = Number(body.stock);

  if (!name || !sku || Number.isNaN(billingPrice) || Number.isNaN(mrp) || Number.isNaN(stock) || Number.isNaN(invoicePrice)) {
    res.status(400).json({ message: "name, sku, invoicePrice, billingPrice, mrp, stock are required" });
    return;
  }

  const state = getState();
  const exists = state.products.find((item) => item.sku.toLowerCase() === sku.toLowerCase());
  if (exists) {
    res.status(409).json({ message: `Product SKU already exists: ${sku}` });
    return;
  }

  const created = {
    id: `p-${nanoid(8)}`,
    name,
    size,
    sku,
    category: category || "General",
      price: mrp,
      invoicePrice,
      billingPrice,
      mrp,
      stock
  };

  await updateState((draft) => {
    draft.products.unshift(created);
    pushStockMovement(draft, {
      action: "create_product",
      by: req.user?.username || "system",
      productId: created.id,
      sku: created.sku || "",
      name: created.name || "",
      beforeStock: 0,
      changeQty: Number(created.stock || 0),
      afterStock: Number(created.stock || 0)
    });
    return draft;
  });

  io.emit(SOCKET_EVENTS.PRODUCT_UPDATED, created);
  sendFullSync();
  res.status(201).json(created);
});

app.patch("/products/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  const incomingSku = patch.sku ? String(patch.sku).trim() : null;

  if (incomingSku) {
    const state = getState();
    const conflict = state.products.find((item) => item.id !== id && item.sku.toLowerCase() === incomingSku.toLowerCase());
    if (conflict) {
      res.status(409).json({ message: `SKU already exists: ${incomingSku}` });
      return;
    }
  }

  const next = await updateState((state) => {
    const index = state.products.findIndex((item) => item.id === id);
    if (index === -1) {
      return state;
    }
    const previous = state.products[index];
    const previousStock = Number(previous.stock || 0);

    const updated = {
      ...previous,
      ...patch,
      size: patch.size !== undefined ? String(patch.size || "").trim() : previous.size,
      sku: incomingSku ?? previous.sku,
      invoicePrice: patch.invoicePrice !== undefined ? Number(patch.invoicePrice) : (previous.invoicePrice ?? 0),
      billingPrice: patch.billingPrice !== undefined ? Number(patch.billingPrice) : previous.billingPrice,
      mrp: patch.mrp !== undefined ? Number(patch.mrp) : previous.mrp,
      price: patch.price !== undefined ? Number(patch.price) : previous.price,
      stock: patch.stock !== undefined ? Number(patch.stock) : previous.stock
    };
    state.products[index] = updated;
    const nextStock = Number(updated.stock || 0);
    if (Number.isFinite(previousStock) && Number.isFinite(nextStock) && previousStock !== nextStock) {
      pushStockMovement(state, {
        action: "update_stock",
        by: req.user?.username || "system",
        productId: updated.id,
        sku: updated.sku || "",
        name: updated.name || "",
        beforeStock: previousStock,
        changeQty: Number((nextStock - previousStock).toFixed(2)),
        afterStock: nextStock
      });
    }

    return state;
  });

  const updated = next.products.find((item) => item.id === id);
  if (!updated) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  io.emit(SOCKET_EVENTS.PRODUCT_UPDATED, updated);
  sendFullSync();
  res.json(updated);
});

app.delete("/products/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  let removed = null;

  const next = await updateState((state) => {
    const index = state.products.findIndex((item) => item.id === id);
    if (index === -1) return state;
    removed = state.products[index];
    pushStockMovement(state, {
      action: "delete_product",
      by: req.user?.username || "system",
      productId: removed.id,
      sku: removed.sku || "",
      name: removed.name || "",
      beforeStock: Number(removed.stock || 0),
      changeQty: Number((0 - Number(removed.stock || 0)).toFixed(2)),
      afterStock: 0
    });
    state.products.splice(index, 1);
    return state;
  });

  if (!removed) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  io.emit(SOCKET_EVENTS.PRODUCT_UPDATED, { id, deleted: true });
  io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
  sendFullSync();
  res.json({ ok: true, deleted: removed });
});

app.get("/sales", requireAuth, async (_req, res) => {
  res.json(getState().sales);
});

app.get("/customers", requireAuth, requireRole("admin"), async (_req, res) => {
  res.json(getState().customers || []);
});

app.post("/customers", requireAuth, requireRole("admin", "manager", "cashier"), async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim();
  const rawOpeningOutstanding = Number(body.openingOutstanding || 0);
  const rawCreditLimit = Number(body.creditLimit || 0);
  const rawDiscountLimit = Number(body.discountLimit || 0);
  const rawOutstandingAdjustment = Number(body.outstandingAdjustment || 0);
  const outstandingAdjustmentReason = String(body.outstandingAdjustmentReason || "").trim().slice(0, 240);
  const openingOutstanding = Number.isFinite(rawOpeningOutstanding) && rawOpeningOutstanding > 0
    ? roundMoney(rawOpeningOutstanding)
    : 0;
  const creditLimit = Number.isFinite(rawCreditLimit) && rawCreditLimit > 0
    ? roundMoney(rawCreditLimit)
    : 0;
  const discountLimit = Number.isFinite(rawDiscountLimit) && rawDiscountLimit > 0
    ? roundMoney(rawDiscountLimit)
    : 0;
  const outstandingAdjustment = Number.isFinite(rawOutstandingAdjustment) && rawOutstandingAdjustment > 0
    ? roundMoney(rawOutstandingAdjustment)
    : 0;
  const rawOpeningEmptyBottles = Number(body.openingEmptyBottles || 0);
  const openingEmptyBottles = Number.isFinite(rawOpeningEmptyBottles) && rawOpeningEmptyBottles > 0
    ? Math.floor(rawOpeningEmptyBottles)
    : 0;
  const itemPrices = body.itemPrices && typeof body.itemPrices === "object" ? body.itemPrices : {};

  if (!name) {
    res.status(400).json({ message: "Customer name is required" });
    return;
  }
  const role = String(req.user?.role || "").toLowerCase();
  const canManageOpeningOutstanding = role === "admin" || (role === "manager" && managerHasFullAccess());
  const canManageCustomerLimits = role === "admin" || (role === "manager" && managerHasFullAccess());
  const canManageOutstandingAdjustment = role === "admin";
  const record = {
    id: nanoid(12),
    name,
    phone,
    address,
    openingOutstanding: canManageOpeningOutstanding ? openingOutstanding : 0,
    creditLimit: canManageCustomerLimits ? creditLimit : 0,
    discountLimit: canManageCustomerLimits ? discountLimit : 0,
    outstandingAdjustment: canManageOutstandingAdjustment ? outstandingAdjustment : 0,
    outstandingAdjustmentReason: canManageOutstandingAdjustment ? outstandingAdjustmentReason : "",
    openingEmptyBottles,
    collectedOpeningEmptyBottles: 0,
    itemPrices: canManageCustomerLimits ? itemPrices : {},
    createdAt: new Date().toISOString()
  };

  await updateState((state) => {
    state.customers = state.customers || [];
    state.customers.push(record);
    return state;
  });

  sendFullSync();
  res.status(201).json(record);
});

app.patch("/customers/:id", requireAuth, requireRole("admin", "cashier", "manager"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  if (req.user?.role === "manager" && !managerHasFullAccess()) {
    res.status(403).json({ message: "Manager full access is required to edit customers" });
    return;
  }
  const hasOpeningOutstanding = Object.prototype.hasOwnProperty.call(body, "openingOutstanding");
  const hasCreditLimit = Object.prototype.hasOwnProperty.call(body, "creditLimit");
  const hasDiscountLimit = Object.prototype.hasOwnProperty.call(body, "discountLimit");
  const hasOutstandingAdjustment = Object.prototype.hasOwnProperty.call(body, "outstandingAdjustment");
  const hasOutstandingAdjustmentReason = Object.prototype.hasOwnProperty.call(body, "outstandingAdjustmentReason");
  const rawOpeningOutstanding = Number(body.openingOutstanding || 0);
  const rawCreditLimit = Number(body.creditLimit || 0);
  const rawDiscountLimit = Number(body.discountLimit || 0);
  const rawOutstandingAdjustment = Number(body.outstandingAdjustment || 0);
  const outstandingAdjustmentReason = String(body.outstandingAdjustmentReason || "").trim().slice(0, 240);
  
  const hasOpeningEmptyBottles = Object.prototype.hasOwnProperty.call(body, "openingEmptyBottles");
  const rawOpeningEmptyBottles = Number(body.openingEmptyBottles || 0);
  const openingEmptyBottles = Number.isFinite(rawOpeningEmptyBottles) && rawOpeningEmptyBottles > 0
    ? Math.floor(rawOpeningEmptyBottles)
    : 0;

  const hasItemPrices = Object.prototype.hasOwnProperty.call(body, "itemPrices");
  const itemPrices = body.itemPrices && typeof body.itemPrices === "object" ? body.itemPrices : {};

  const openingOutstanding = Number.isFinite(rawOpeningOutstanding) && rawOpeningOutstanding > 0
    ? roundMoney(rawOpeningOutstanding)
    : 0;
  const creditLimit = Number.isFinite(rawCreditLimit) && rawCreditLimit > 0
    ? roundMoney(rawCreditLimit)
    : 0;
  const discountLimit = Number.isFinite(rawDiscountLimit) && rawDiscountLimit > 0
    ? roundMoney(rawDiscountLimit)
    : 0;
  const outstandingAdjustment = Number.isFinite(rawOutstandingAdjustment) && rawOutstandingAdjustment > 0
    ? roundMoney(rawOutstandingAdjustment)
    : 0;
  if ((hasOutstandingAdjustment || hasOutstandingAdjustmentReason) && String(req.user?.role || "").toLowerCase() !== "admin") {
    res.status(403).json({ message: "Only admin can adjust total outstanding" });
    return;
  }

  const next = await updateState((state) => {
    state.customers = state.customers || [];
    const idx = state.customers.findIndex((item) => item.id === id);
    if (idx === -1) return state;
    if (req.user?.role === "cashier") {
      state.customers[idx] = {
        ...state.customers[idx],
        phone: body.phone !== undefined ? String(body.phone || "").trim() : state.customers[idx].phone,
        ...(hasOpeningEmptyBottles ? { openingEmptyBottles } : {})
      };
    } else if (req.user?.role === "manager") {
      state.customers[idx] = {
        ...state.customers[idx],
        name: body.name !== undefined ? String(body.name || "").trim() : state.customers[idx].name,
        phone: body.phone !== undefined ? String(body.phone || "").trim() : state.customers[idx].phone,
        address: body.address !== undefined ? String(body.address || "").trim() : state.customers[idx].address,
        ...(hasOpeningOutstanding ? { openingOutstanding } : {}),
        ...(hasCreditLimit ? { creditLimit } : {}),
        ...(hasDiscountLimit ? { discountLimit } : {}),
        ...(hasItemPrices ? { itemPrices } : {})
      };
    } else {
      state.customers[idx] = {
        ...state.customers[idx],
        ...body,
        ...(hasOpeningOutstanding ? { openingOutstanding } : {}),
        ...(hasCreditLimit ? { creditLimit } : {}),
        ...(hasDiscountLimit ? { discountLimit } : {}),
        ...(hasItemPrices ? { itemPrices } : {}),
        ...(hasOutstandingAdjustment ? { outstandingAdjustment } : {}),
        ...(hasOutstandingAdjustmentReason ? { outstandingAdjustmentReason } : {}),
        ...(hasOpeningEmptyBottles ? { openingEmptyBottles } : {})
      };
    }
    return state;
  });

  const updated = (next.customers || []).find((item) => item.id === id);
  if (!updated) {
    res.status(404).json({ message: "Customer not found" });
    return;
  }

  sendFullSync();
  res.json(updated);
});


app.post("/customers/pay-outstanding", requireAuth, requireRole("cashier", "admin", "manager"), async (req, res) => {
  const body = req.body || {};
  const customerId = String(body.customerId || "").trim();
  const customerName = String(body.customerName || "").trim();
  const paymentAmount = roundMoney(Number(body.amount || 0));

  if (!customerId && (!customerName || customerName.toLowerCase() === "walk-in")) {
    res.status(400).json({ message: "Valid customer required" });
    return;
  }
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    res.status(400).json({ message: "Valid payment amount required" });
    return;
  }

  const next = await updateState((state) => {
    // 1. Fetch unpaid bills
    const key = customerName.toLowerCase();
    const unpaidSales = (state.sales || [])
      .filter((sale) => {
        if (customerId) return sale.customerId === customerId;
        return String(sale.customerName || "").trim().toLowerCase() === key;
      })
      .map((sale) => ({ sale, fin: recalculateSaleFinancials(sale) }))
      .filter(({ fin }) => fin.outstandingAmount > 0)
      .sort((a, b) => new Date(a.sale.createdAt).getTime() - new Date(b.sale.createdAt).getTime());

    let remainingPayment = paymentAmount;

    // 2. Distribute payment across unpaid sales
    for (const { sale, fin } of unpaidSales) {
      if (remainingPayment <= 0) break;
      const saleOutstanding = fin.outstandingAmount;
      const applyAmount = Math.min(remainingPayment, saleOutstanding);
      sale.cashReceived = roundMoney(Number(sale.cashReceived || 0) + applyAmount);
      remainingPayment = roundMoney(remainingPayment - applyAmount);
    }

    // 3. If there is remaining payment (e.g. paying openingOutstanding),
    // add it to customer's outstandingAdjustment
    if (remainingPayment > 0) {
      const customers = state.customers || [];
      const customer = customers.find((c) => {
        if (customerId) return c.id === customerId;
        return String(c.name || "").trim().toLowerCase() === key;
      });
      if (customer) {
        customer.outstandingAdjustment = roundMoney(Number(customer.outstandingAdjustment || 0) + remainingPayment);
      }
    }
    
    return state;
  });

  sendFullSync();
  res.json({ ok: true });
});

app.post("/customers/:id/collect-opening-empty-bottles", requireAuth, requireRole("cashier", "admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const quantity = Number(body.quantity);
  
  if (!Number.isFinite(quantity) || quantity <= 0) {
    res.status(400).json({ message: "quantity must be greater than 0" });
    return;
  }

  const state = getState();
  const customer = (state.customers || []).find((item) => item.id === id);
  if (!customer) {
    res.status(404).json({ message: "Customer not found" });
    return;
  }

  const openingEmptyBottles = Number(customer.openingEmptyBottles || 0);
  const alreadyCollected = Number(customer.collectedOpeningEmptyBottles || 0);
  
  if (quantity > (openingEmptyBottles - alreadyCollected)) {
    res.status(400).json({ message: "Cannot collect more than the remaining opening empty bottles" });
    return;
  }

  const next = await updateState((draft) => {
    draft.customers = draft.customers || [];
    const idx = draft.customers.findIndex((item) => item.id === id);
    if (idx !== -1) {
      draft.customers[idx].collectedOpeningEmptyBottles = Math.floor(alreadyCollected + quantity);
    }
    
    // Log the collection event
    draft.emptyBottleCollections = draft.emptyBottleCollections || [];
    draft.emptyBottleCollections.unshift({
      id: nanoid(12),
      customerId: id,
      quantity,
      cashier: req.user?.username || "",
      isOpeningEmptyBottles: true,
      createdAt: new Date().toISOString()
    });
    return draft;
  });

  sendFullSync();
  const updated = (next.customers || []).find((item) => item.id === id);
  res.json(updated);
});

app.delete("/customers/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const state = getState();
  const target = (state.customers || []).find((item) => item.id === id);
  if (!target) {
    res.status(404).json({ message: "Customer not found" });
    return;
  }

  const outstanding = calculateCustomerOutstanding({
    sales: state.sales || [],
    customers: state.customers || [],
    customerName: target.name,
    customerId: target.id
  });
  if (outstanding > 0) {
    res.status(409).json({ message: "Cannot delete a customer with an outstanding balance" });
    return;
  }

  let removed = null;
  await updateState((draft) => {
    draft.customers = draft.customers || [];
    const idx = draft.customers.findIndex((item) => item.id === id);
    if (idx === -1) return draft;
    removed = draft.customers[idx];
    draft.customers.splice(idx, 1);
    return draft;
  });

  if (!removed) {
    res.status(404).json({ message: "Customer not found" });
    return;
  }

  sendFullSync();
  res.json({ ok: true, deleted: removed });
});

app.post("/admin/reset-data", requireAuth, requireRole("admin"), async (req, res) => {
  const mode = String(req.body?.mode || "").trim();
  const validModes = ["keep-products", "keep-customers", "keep-customers-and-products", "full"];
  if (!validModes.includes(mode)) {
    res.status(400).json({ message: "Invalid reset mode specified" });
    return;
  }

  await updateState((draft) => {
    draft.sales = [];
    draft.returns = [];
    draft.stockMovements = [];
    draft.customerCredits = [];
    draft.emptyBottleCollections = [];
    draft.staff = [];
    draft.purchases = [];
    draft.suppliers = [];

    if (mode !== "keep-customers" && mode !== "keep-customers-and-products") {
      draft.customers = [];
    }

    if (mode !== "keep-products" && mode !== "keep-customers-and-products") {
      draft.products = [];
    }

    return draft;
  });

  sendFullSync();
  res.json({ ok: true, mode });
});

app.post("/settings/lorry-count-reset", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const now = new Date().toISOString();
  const next = await updateState((state) => {
    state.settings = state.settings || {};
    state.settings.lorryCountResetAt = {
      "Lorry A": now,
      "Lorry B": now
    };
    return state;
  });

  sendFullSync();
  res.json(next.settings?.lorryCountResetAt || {});
});

app.post("/settings/loading-row-mark", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const markKey = String(req.body?.markKey || "").trim();
  const loaded = Boolean(req.body?.loaded);
  if (!markKey) {
    res.status(400).json({ message: "Loading mark key is required" });
    return;
  }
  const next = await updateState((state) => {
    state.settings = state.settings || {};
    state.settings.loadingRowMarks = state.settings.loadingRowMarks || {};
    if (loaded) {
      state.settings.loadingRowMarks[markKey] = {
        loaded: true,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.username || "admin"
      };
    } else {
      delete state.settings.loadingRowMarks[markKey];
    }
    return state;
  });

  sendFullSync();
  res.json(next.settings?.loadingRowMarks || {});
});

app.post("/settings/manager-full-access", requireAuth, requireRole("admin"), async (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  const next = await updateState((state) => {
    state.settings = state.settings || {};
    state.settings.managerFullAccess = enabled;
    return state;
  });
  sendFullSync();
  res.json({ enabled: Boolean(next.settings?.managerFullAccess) });
});

app.get("/staff", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  res.json(getState().staff || []);
});

app.post("/staff", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim()) {
    res.status(400).json({ message: "Staff name is required" });
    return;
  }

  const record = {
    id: nanoid(12),
    name: body.name.trim(),
    role: body.role || "",
    phone: body.phone || "",
    monthlySalary: Number(body.monthlySalary || 0),
    createdAt: new Date().toISOString()
  };

  await updateState((state) => {
    state.staff = state.staff || [];
    state.staff.push(record);
    return state;
  });

  sendFullSync();
  res.status(201).json(record);
});

app.patch("/staff/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  const next = await updateState((state) => {
    state.staff = state.staff || [];
    const idx = state.staff.findIndex((item) => item.id === id);
    if (idx === -1) return state;
    state.staff[idx] = { ...state.staff[idx], ...body };
    return state;
  });

  const updated = (next.staff || []).find((item) => item.id === id);
  if (!updated) {
    res.status(404).json({ message: "Staff not found" });
    return;
  }

  sendFullSync();
  res.json(updated);
});

app.delete("/staff/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const next = await updateState((state) => {
    state.staff = state.staff || [];
    state.staff = state.staff.filter((item) => String(item.id || "") !== String(id || ""));
    return state;
  });

  const exists = (next.staff || []).some((item) => String(item.id || "") === String(id || ""));
  if (exists) {
    res.status(400).json({ message: "Unable to delete staff" });
    return;
  }

  sendFullSync();
  res.json({ ok: true });
});

app.get("/accounts", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  res.json(getState().accounts || []);
});

app.post("/accounts", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim()) {
    res.status(400).json({ message: "Account name is required" });
    return;
  }

  const record = {
    id: nanoid(12),
    name: body.name.trim(),
    type: body.type || "bank",
    initialBalance: Number(body.initialBalance || 0),
    createdAt: new Date().toISOString()
  };

  await updateState((state) => {
    state.accounts = state.accounts || [];
    state.accounts.push(record);
    return state;
  });

  sendFullSync();
  res.status(201).json(record);
});

app.patch("/accounts/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  const next = await updateState((state) => {
    state.accounts = state.accounts || [];
    const idx = state.accounts.findIndex((item) => item.id === id);
    if (idx === -1) return state;
    state.accounts[idx] = { ...state.accounts[idx], ...body };
    return state;
  });

  const updated = (next.accounts || []).find((item) => item.id === id);
  if (!updated) {
    res.status(404).json({ message: "Account not found" });
    return;
  }

  sendFullSync();
  res.json(updated);
});

app.delete("/accounts/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const next = await updateState((state) => {
    state.accounts = state.accounts || [];
    state.accounts = state.accounts.filter((item) => String(item.id || "") !== String(id || ""));
    return state;
  });

  sendFullSync();
  res.json({ ok: true });
});
// --- SUPPLIERS API ---
app.post("/suppliers", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const body = req.body || {};
  if (!body.name?.trim()) {
    res.status(400).json({ message: "Supplier name is required" });
    return;
  }
  const record = {
    id: nanoid(12),
    name: body.name.trim(),
    company: (body.company || "").trim(),
    phone: (body.phone || "").trim(),
    address: (body.address || "").trim(),
    createdAt: new Date().toISOString()
  };
  await updateState((state) => {
    state.suppliers = state.suppliers || [];
    state.suppliers.push(record);
    return state;
  });
  sendFullSync();
  res.status(201).json(record);
});

app.patch("/suppliers/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const next = await updateState((state) => {
    state.suppliers = state.suppliers || [];
    const idx = state.suppliers.findIndex((item) => item.id === id);
    if (idx === -1) return state;
    state.suppliers[idx] = { ...state.suppliers[idx], ...body };
    return state;
  });
  const updated = (next.suppliers || []).find((item) => item.id === id);
  if (!updated) return res.status(404).json({ message: "Supplier not found" });
  sendFullSync();
  res.json(updated);
});

app.delete("/suppliers/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  await updateState((state) => {
    state.suppliers = (state.suppliers || []).filter((item) => String(item.id || "") !== String(id || ""));
    return state;
  });
  sendFullSync();
  res.json({ ok: true });
});

// --- PURCHASES / SUPPLIER INVOICES API ---
app.post("/purchases", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const body = req.body || {};
  if (!body.supplierId?.trim() || !Number(body.totalAmount)) {
    res.status(400).json({ message: "Supplier and Total Amount are required" });
    return;
  }
  const record = {
    id: nanoid(12),
    supplierId: body.supplierId.trim(),
    invoiceNo: (body.invoiceNo || "").trim(),
    date: (body.date || new Date().toISOString().split("T")[0]).trim(),
    dueDate: (body.dueDate || "").trim(),
    totalAmount: Number(body.totalAmount || 0),
    paidAmount: Number(body.paidAmount || 0),
    status: body.status || "unpaid",
    createdAt: new Date().toISOString()
  };
  await updateState((state) => {
    state.purchases = state.purchases || [];
    state.purchases.push(record);
    return state;
  });
  sendFullSync();
  res.status(201).json(record);
});

app.patch("/purchases/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const next = await updateState((state) => {
    state.purchases = state.purchases || [];
    const idx = state.purchases.findIndex((item) => item.id === id);
    if (idx === -1) return state;
    state.purchases[idx] = { ...state.purchases[idx], ...body };
    return state;
  });
  const updated = (next.purchases || []).find((item) => item.id === id);
  if (!updated) return res.status(404).json({ message: "Purchase invoice not found" });
  sendFullSync();
  res.json(updated);
});

app.delete("/purchases/:id", requireAuth, requireAdminOrManagerFullAccess, async (req, res) => {
  const { id } = req.params;
  await updateState((state) => {
    state.purchases = (state.purchases || []).filter((item) => String(item.id || "") !== String(id || ""));
    return state;
  });
  sendFullSync();
  res.json({ ok: true });
});

app.post("/accounting", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const body = req.body || {};
  const type = String(body.type || "expense").trim().toLowerCase();
  const category = String(body.category || "General").trim();
  const description = String(body.description || "").trim();
  const date = String(body.date || new Date().toISOString().split("T")[0]).trim();
  const amount = Number(body.amount);
  const staffId = body.staffId ? String(body.staffId).trim() : null;
  const sourceAccountId = body.sourceAccountId ? String(body.sourceAccountId).trim() : null;
  const destinationAccountId = body.destinationAccountId ? String(body.destinationAccountId).trim() : null;
  const supplierInvoiceId = body.supplierInvoiceId ? String(body.supplierInvoiceId).trim() : null;

  if (!category || Number.isNaN(amount) || amount < 0) {
    res.status(400).json({ message: "Category and a valid positive amount are required" });
    return;
  }

  const newEntry = {
    id: nanoid(12),
    type,
    category,
    description,
    date,
    amount: roundMoney(amount),
    staffId,
    sourceAccountId,
    destinationAccountId,
    supplierInvoiceId,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.username || "admin"
  };

  const next = await updateState((state) => {
    state.accounting = state.accounting || [];
    state.accounting.unshift(newEntry);
    if (type === "supplier_payment" && supplierInvoiceId) {
      state.purchases = state.purchases || [];
      const invoice = state.purchases.find(p => p.id === supplierInvoiceId);
      if (invoice) {
        invoice.paidAmount = roundMoney((invoice.paidAmount || 0) + amount);
        if (invoice.paidAmount >= invoice.totalAmount) {
          invoice.status = "paid";
        } else if (invoice.paidAmount > 0) {
          invoice.status = "partial";
        } else {
          invoice.status = "unpaid";
        }
      }
    }
    return state;
  });

  sendFullSync();
  res.status(201).json(newEntry);
});

app.patch("/accounting/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  const next = await updateState((state) => {
    state.accounting = state.accounting || [];
    const idx = state.accounting.findIndex((item) => item.id === id);
    if (idx === -1) return state;
    
    const amount = body.amount !== undefined ? Number(body.amount) : state.accounting[idx].amount;
    
    state.accounting[idx] = {
      ...state.accounting[idx],
      ...body,
      amount: Number.isFinite(amount) ? roundMoney(amount) : state.accounting[idx].amount
    };
    return state;
  });

  const updated = (next.accounting || []).find((item) => item.id === id);
  if (!updated) {
    res.status(404).json({ message: "Accounting entry not found" });
    return;
  }

  sendFullSync();
  res.json(updated);
});

app.delete("/accounting/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const next = await updateState((state) => {
    state.accounting = state.accounting || [];
    const entry = state.accounting.find((item) => String(item.id || "") === String(id || ""));
    if (entry && entry.type === "supplier_payment" && entry.supplierInvoiceId) {
      state.purchases = state.purchases || [];
      const invoice = state.purchases.find(p => p.id === entry.supplierInvoiceId);
      if (invoice) {
        invoice.paidAmount = roundMoney((invoice.paidAmount || 0) - entry.amount);
        if (invoice.paidAmount >= invoice.totalAmount) {
          invoice.status = "paid";
        } else if (invoice.paidAmount > 0) {
          invoice.status = "partial";
        } else {
          invoice.status = "unpaid";
        }
      }
    }
    state.accounting = state.accounting.filter((item) => String(item.id || "") !== String(id || ""));
    return state;
  });

  const exists = (next.accounting || []).some((item) => String(item.id || "") === String(id || ""));
  if (exists) {
    res.status(400).json({ message: "Unable to delete accounting entry" });
    return;
  }

  sendFullSync();
  res.json({ ok: true });
});

app.post("/sales", requireAuth, requireRole("cashier", "admin"), async (req, res) => {
  const body = req.body || {};
  const requestId = String(body.requestId || "").trim();
  const orderType = String(body.orderType || "direct").trim().toLowerCase() === "preorder" ? "preorder" : "direct";
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const lorry = String(body.lorry || "").trim();
  const customerId = String(body.customerId || "").trim();
  const customerPhone = String(body.customerPhone || "").trim();
  const paymentType = String(body.paymentType || "cash");
  const customerCreditAmount = roundMoney(Number(body.customerCreditAmount || 0));
  const cashReceived = Number(body.cashReceived || 0);
  const creditDueDate = String(body.creditDueDate || "").trim();
  const chequeAmount = Number(body.chequeAmount || 0);
  const chequeNo = String(body.chequeNo || "").trim();
  const chequeDate = String(body.chequeDate || "").trim();
  const chequeBank = String(body.chequeBank || "").trim();

  if (!lines.length) {
    res.status(400).json({ message: "Cart is empty" });
    return;
  }
  if (!Number.isFinite(customerCreditAmount) || customerCreditAmount < 0) {
    res.status(400).json({ message: "customerCreditAmount must be 0 or more" });
    return;
  }
  if (!ORDER_LORRIES.includes(lorry)) {
    res.status(400).json({ message: "Lorry selection is required" });
    return;
  }

  const state = getState();
  const productMap = new Map(state.products.map((p) => [p.id, p]));
  const preparedLines = [];
  const preOrderReservedMap = orderType === "preorder" ? buildPreOrderReservedMap(state) : null;

  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) {
      res.status(404).json({ message: `Unknown product ${line.productId}` });
      return;
    }
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ message: `Invalid quantity for ${product.name}` });
      return;
    }
    if (orderType === "preorder") {
      const alreadyReserved = Number(preOrderReservedMap?.get(product.id) || 0);
      const availableForPreOrder = Math.max(0, Number(product.stock || 0) - alreadyReserved);
      if (availableForPreOrder < quantity) {
        res.status(409).json({ message: `Insufficient stock available for pre-order: ${product.name}. Available: ${availableForPreOrder}` });
        return;
      }
    } else if (product.stock < quantity) {
      res.status(409).json({ message: `Insufficient stock for ${product.name}` });
      return;
    }
    const basePrice = Number(
      line.basePrice ?? product.billingPrice ?? product.price ?? product.mrp ?? 0
    );
    const incomingMode = String(line.itemDiscountMode || "amount").trim().toLowerCase();
    const itemDiscountMode = incomingMode === "percent" ? "percent" : "amount";
    const rawDiscount = Number(line.itemDiscount || 0);
    const safeDiscount = Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : 0;
    const discountAmount = itemDiscountMode === "percent"
      ? Math.min(100, safeDiscount)
      : Math.min(basePrice, safeDiscount);
    const netUnitPrice = Number(line.price);
    const resolvedUnitPrice = Number.isFinite(netUnitPrice)
      ? Math.max(0, netUnitPrice)
      : Math.max(0, itemDiscountMode === "percent"
        ? Number((basePrice - ((basePrice * discountAmount) / 100)).toFixed(2))
        : Number((basePrice - discountAmount).toFixed(2)));
    preparedLines.push({
      productId: product.id,
      name: line.name || `${product.name}${product.size ? ` ${product.size}` : ""}`,
      size: product.size || "",
      category: product.category || "",
      quantity,
      basePrice: Number(basePrice.toFixed(2)),
      itemDiscount: Number(discountAmount.toFixed(2)),
      itemDiscountMode,
      price: Number(resolvedUnitPrice.toFixed(2)),
      invoicePrice: product.invoicePrice !== undefined ? Number(product.invoicePrice) : 0
    });
  }

  const currentOrderQty = preparedLines.reduce((acc, line) => acc + Number(line.quantity || 0), 0);
  const lorryLoadMap = buildLorryLoadMap(state);
  const pendingLoad = Number(lorryLoadMap[lorry] || 0);
  if (BASE_LORRIES.includes(lorry)) {
    if (pendingLoad >= LORRY_CAPACITY) {
      res.status(409).json({ message: "Selected lorry is full." });
      return;
    }
    if ((pendingLoad + currentOrderQty) > LORRY_CAPACITY) {
      res.status(409).json({
        message: `Selected lorry exceeds capacity. Only ${Math.max(0, LORRY_CAPACITY - pendingLoad)} items left.`
      });
      return;
    }
  }

  // Direct sales are delivered immediately (stock decrements at creation), so empty
  // bottles are owed from the moment of sale. Pre-orders aren't actually delivered
  // yet, so their emptyBottlesOwed is computed later, at pre-order confirmation.
  const emptyBottlesOwed = orderType === "preorder" ? 0 : preparedLines.reduce((acc, line) => {
    const product = productMap.get(line.productId);
    const is250ml = String(product?.size || "").includes("250");
    if (!product || product.returnableBottle === false || !is250ml) return acc;
    return acc + Number(line.quantity || 0);
  }, 0);

  const emptyBottlesCollected = roundMoney(Number(body.emptyBottlesCollected || 0));
  if (!Number.isFinite(emptyBottlesCollected) || emptyBottlesCollected < 0) {
    res.status(400).json({ message: "emptyBottlesCollected must be 0 or more" });
    return;
  }
  
  const customerNameKey = String(body.customerName || "Walk-in").trim().toLowerCase();
  let maxAllowedCollection = emptyBottlesOwed;
  if (customerNameKey !== "walk-in") {
    const otherSalesOutstanding = (state.sales || [])
      .filter((s) => String(s.customerName || "").trim().toLowerCase() === customerNameKey)
      .reduce((acc, s) => acc + Math.max(0, roundMoney(Number(s.emptyBottlesOwed || 0) - Number(s.emptyBottlesCollected || 0))), 0);
      
    let openingOutstanding = 0;
    const targetCustomer = (state.customers || []).find((c) => String(c.name || "").trim().toLowerCase() === customerNameKey);
    if (targetCustomer) {
      openingOutstanding = Math.max(0, roundMoney(Number(targetCustomer.openingEmptyBottles || 0) - Number(targetCustomer.collectedOpeningEmptyBottles || 0)));
    }
    maxAllowedCollection = roundMoney(emptyBottlesOwed + otherSalesOutstanding + openingOutstanding);
  }
  
  if (emptyBottlesCollected > maxAllowedCollection) {
    res.status(409).json({ message: `Cannot collect more than the total owed empty bottles (${maxAllowedCollection} available)` });
    return;
  }

  const prepared = enrichSale({
    id: "TEMP_ID",
    requestId,
    createdAt: new Date().toISOString(),
    cashier: body.cashier || req.user.username,
    customerId,
    customerName: body.customerName || "Walk-in",
    customerPhone,
    lorry,
    paymentType,
    notes: body.notes || "",
    discount: Number(body.discount || 0),
    taxRate: 0,
    payments: [],
    lines: preparedLines,
    orderType,
    preOrderStatus: orderType === "preorder" ? "pending" : null,
    stockDecremented: orderType !== "preorder",
    emptyBottlesOwed,
    emptyBottlesCollected: 0
  });

  const preparedCustomerName = String(prepared.customerName || "").trim();
  const existingPreparedCustomer = (state.customers || []).find(
    (item) => String(item.name || "").trim().toLowerCase() === preparedCustomerName.toLowerCase()
  );
  if (String(req.user?.role || "").toLowerCase() === "cashier" && (!preparedCustomerName || preparedCustomerName.toLowerCase() === "walk-in" || !existingPreparedCustomer)) {
    res.status(409).json({ message: "Select a saved customer before checkout" });
    return;
  }
  const customerDiscountLimit = resolveCustomerDiscountLimit({ customers: state.customers || [], customerName: preparedCustomerName });
  const totalDiscountApplied = calculateSaleDiscountTotal({ lines: prepared.lines, billDiscount: prepared.discountAmount ?? prepared.discount ?? 0 });
  if (String(req.user?.role || "").toLowerCase() === "cashier" && customerDiscountLimit > 0 && totalDiscountApplied > customerDiscountLimit) {
    res.status(409).json({ message: `Discount limit exceeded for ${preparedCustomerName}. Allowed: ${customerDiscountLimit.toFixed(2)}` });
    return;
  }
  if (customerCreditAmount > 0) {
    if (!preparedCustomerName || preparedCustomerName.toLowerCase() === "walk-in") {
      res.status(409).json({ message: "Customer credit can be used only for saved customers" });
      return;
    }
    if (customerCreditAmount > roundMoney(Number(prepared.total || 0))) {
      res.status(409).json({ message: "Customer credit cannot exceed bill total" });
      return;
    }
    const { usagePlan, remaining } = buildCustomerCreditUsagePlan({
      credits: state.customerCredits || [],
      customerName: preparedCustomerName,
      amount: customerCreditAmount
    });
    if (remaining > 0) {
      res.status(409).json({ message: "Customer credit exceeds available balance" });
      return;
    }
    prepared.payments = [{
      id: nanoid(12),
      method: "customer_credit",
      amount: customerCreditAmount,
      createdAt: new Date().toISOString(),
      receivedBy: req.user?.username || "system",
      usagePlan
    }];
    prepared.customerCreditApplied = customerCreditAmount;
  }

  const creditProfile = resolveCustomerCreditProfile({ customers: state.customers || [], customerName: preparedCustomerName, customerId });
  if (Number(creditProfile.creditLimit || 0) > 0) {
    const currentOutstanding = calculateCustomerOutstanding({
      sales: state.sales || [],
      customers: state.customers || [],
      customerName: preparedCustomerName,
      customerId
    });
    const projectedSaleOutstanding = Number(recalculateSaleFinancials(prepared).outstandingAmount || 0);
    const projectedOutstanding = roundMoney(currentOutstanding + projectedSaleOutstanding);
    if (projectedOutstanding > roundMoney(creditProfile.creditLimit)) {
      const availableCreditLimit = roundMoney(Math.max(0, Number(creditProfile.creditLimit || 0) - currentOutstanding));
      res.status(409).json({
        message: `Credit limit exceeded for ${preparedCustomerName}. Limit: ${roundMoney(creditProfile.creditLimit).toFixed(2)}, outstanding: ${currentOutstanding.toFixed(2)}, available: ${availableCreditLimit.toFixed(2)}`
      });
      return;
    }
  }

  const remainingTotal = roundMoney(Math.max(0, Number(prepared.total || 0) - customerCreditAmount));
  if (paymentType === "cash" && remainingTotal > 0 && orderType !== "preorder") {
    prepared.payments = prepared.payments || [];
    prepared.payments.push({
      id: nanoid(12),
      method: "cash",
      amount: remainingTotal,
      createdAt: new Date().toISOString(),
      receivedBy: req.user?.username || "system"
    });
  }

  prepared.cashReceived = null;
  prepared.creditDueDate = creditDueDate || "";
  prepared.chequeAmount = null;
  prepared.chequeNo = "";
  prepared.chequeDate = "";
  prepared.chequeBank = "";
  prepared.returnedAmount = 0;
  prepared.refundDueAmount = 0;
  Object.assign(prepared, recalculateSaleFinancials(prepared));

  try {
    const next = await updateState((draft) => {
      if (requestId) {
        const existingSale = (draft.sales || []).find((item) => String(item.requestId || "") === requestId);
        if (existingSale) {
          throw new Error(`DuplicateSale:${JSON.stringify(existingSale)}`);
        }
      }

      const allSales = [...(draft.sales || []), ...(draft.voidedSales || [])];
      const maxSaleNo = allSales.reduce((max, sale) => {
        const raw = String(sale.id || "").trim();
        const asNumber = /^\d+$/.test(raw) ? Number(raw) : 0;
        return Math.max(max, asNumber);
      }, 0);
      prepared.id = String(maxSaleNo + 1).padStart(5, "0");

      for (const line of prepared.lines) {
        const product = draft.products.find((item) => item.id === line.productId);
        if (product && orderType !== "preorder") {
          if (product.stock < line.quantity) {
             throw new Error(`Concurrency Error: Insufficient stock for ${product.name} (Available: ${product.stock})`);
          }
          product.stock = Number((product.stock - line.quantity).toFixed(2));
        }
      }

      draft.sales.unshift(prepared);
      draft.customers = draft.customers || [];
      draft.staff = draft.staff || [];

    const existingCustomer = draft.customers.find((item) => item.name.toLowerCase() === prepared.customerName.toLowerCase());
    if (!existingCustomer && prepared.customerName && prepared.customerName !== "Walk-in") {
      draft.customers.push({
        id: nanoid(12),
        name: prepared.customerName,
        phone: prepared.customerPhone || "",
        address: "",
        createdAt: new Date().toISOString()
      });
    } else if (existingCustomer && prepared.customerPhone) {
      existingCustomer.phone = prepared.customerPhone;
    }

    const existingStaff = draft.staff.find((item) => item.name.toLowerCase() === prepared.cashier.toLowerCase());
    if (!existingStaff && prepared.cashier) {
      draft.staff.push({
        id: nanoid(12),
        name: prepared.cashier,
        role: "Cashier",
        phone: "",
        createdAt: new Date().toISOString()
      });
    }

    if (Number(prepared.customerCreditApplied || 0) > 0) {
      draft.customerCredits = draft.customerCredits || [];
      const creditPayment = (prepared.payments || []).find((payment) => String(payment.method || "").toLowerCase() === "customer_credit");
      for (const usage of (creditPayment?.usagePlan || [])) {
        const creditEntry = draft.customerCredits.find((entry) => String(entry.id) === String(usage.creditId));
        if (!creditEntry) continue;
        const currentRemaining = roundMoney(creditEntry.remainingAmount ?? creditEntry.amount ?? 0);
        creditEntry.remainingAmount = roundMoney(Math.max(0, currentRemaining - Number(usage.amount || 0)));
        creditEntry.status = creditEntry.remainingAmount > 0 ? "partial" : "used";
        creditEntry.usedAt = new Date().toISOString();
        creditEntry.usageHistory = creditEntry.usageHistory || [];
        creditEntry.usageHistory.push({
          saleId: prepared.id,
          amount: roundMoney(usage.amount || 0),
          createdAt: new Date().toISOString(),
          by: req.user?.username || "system"
        });
      }
    }

    if (emptyBottlesCollected > 0) {
      let remainingToAllocate = emptyBottlesCollected;
      
      const applyToTarget = Math.min(remainingToAllocate, emptyBottlesOwed);
      
      if (applyToTarget > 0) {
        prepared.emptyBottlesCollected = applyToTarget;
        remainingToAllocate = roundMoney(remainingToAllocate - applyToTarget);
      }
      
      if (remainingToAllocate > 0 && customerNameKey !== "walk-in") {
        const otherSales = draft.sales
          .filter((s) => String(s.id) !== String(prepared.id) && String(s.customerName || "").trim().toLowerCase() === customerNameKey)
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

        for (const otherSale of otherSales) {
          if (remainingToAllocate <= 0) break;
          const oOwed = Number(otherSale.emptyBottlesOwed || 0);
          const oCollected = Number(otherSale.emptyBottlesCollected || 0);
          const oOutstanding = Math.max(0, roundMoney(oOwed - oCollected));
          if (oOutstanding <= 0) continue;

          const applyToOther = Math.min(remainingToAllocate, oOutstanding);
          otherSale.emptyBottlesCollected = roundMoney(oCollected + applyToOther);
          remainingToAllocate = roundMoney(remainingToAllocate - applyToOther);
        }
      }
      
      if (remainingToAllocate > 0 && customerNameKey !== "walk-in") {
        draft.customers = draft.customers || [];
        const cIdx = draft.customers.findIndex((c) => String(c.name || "").trim().toLowerCase() === customerNameKey);
        if (cIdx !== -1) {
          const c = draft.customers[cIdx];
          c.collectedOpeningEmptyBottles = roundMoney(Number(c.collectedOpeningEmptyBottles || 0) + remainingToAllocate);
        }
      }

      draft.emptyBottleCollections = draft.emptyBottleCollections || [];
      draft.emptyBottleCollections.unshift({
        id: nanoid(12),
        saleId: prepared.id,
        customerName: prepared.customerName || "Walk-in",
        quantity: emptyBottlesCollected,
        collectedBy: req.user?.username || "system",
        createdAt: new Date().toISOString()
      });
    }

    return draft;
  });

    io.emit(SOCKET_EVENTS.SALE_CREATED, prepared);
    io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
    sendFullSync();
    res.status(201).json(prepared);
  } catch (err) {
    if (err.message && err.message.startsWith("DuplicateSale:")) {
      try {
        const existingSale = JSON.parse(err.message.replace("DuplicateSale:", ""));
        res.status(200).json(existingSale);
        return;
      } catch (e) {
        // Fallback
      }
    }
    res.status(409).json({ message: err.message || "Transaction failed due to concurrent modification. Please try again." });
  }
});

app.patch("/sales/:id", requireAuth, requireRole("cashier", "admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) {
    res.status(400).json({ message: "At least one line is required" });
    return;
  }

  const state = getState();
  const sale = (state.sales || []).find((item) => String(item.id) === String(id));
  if (!sale) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }
  const nextPaymentType = String(body.paymentType || sale?.paymentType || "").trim();
  const nextBillDiscount = Math.max(0, Number(body.discount || 0) || 0);

  const isAdmin = ["admin", "manager"].includes(String(req.user?.role || "").toLowerCase());
  if (!isAdmin && !isSameRep(sale.cashier, req.user?.username, req.user)) {
    res.status(403).json({ message: "Only the rep who created this sale can edit it" });
    return;
  }

  const hasReturns = (state.returns || []).some((ret) => String(ret.saleId) === String(sale.id));
  if (hasReturns) {
    res.status(409).json({ message: "Cannot edit sale after returns have been submitted" });
    return;
  }
  const isPendingPreOrder = sale.orderType === "preorder" && sale.stockDecremented === false;

  const productMap = new Map((state.products || []).map((p) => [p.id, p]));
  const oldQtyByProduct = new Map();
  for (const line of (sale.lines || [])) {
    oldQtyByProduct.set(line.productId, (oldQtyByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
  }

  const preparedLines = [];
  const newQtyByProduct = new Map();
  for (const line of lines) {
    const productId = String(line.productId || "").trim();
    const quantity = Number(line.quantity || 0);
    const product = productMap.get(productId);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ message: "Invalid sale edit line" });
      return;
    }
    newQtyByProduct.set(productId, (newQtyByProduct.get(productId) || 0) + quantity);
    const basePrice = Number(
      line.basePrice ?? product.billingPrice ?? product.price ?? product.mrp ?? 0
    );
    const incomingMode = String(line.itemDiscountMode || "amount").trim().toLowerCase();
    const itemDiscountMode = incomingMode === "percent" ? "percent" : "amount";
    const rawDiscount = Number(line.itemDiscount || 0);
    const safeDiscount = Number.isFinite(rawDiscount) && rawDiscount > 0 ? rawDiscount : 0;
    const discountAmount = itemDiscountMode === "percent"
      ? Math.min(100, safeDiscount)
      : Math.min(basePrice, safeDiscount);
    const netUnitPrice = Number(line.price);
    const resolvedUnitPrice = Number.isFinite(netUnitPrice)
      ? Math.max(0, netUnitPrice)
      : Math.max(0, itemDiscountMode === "percent"
        ? Number((basePrice - ((basePrice * discountAmount) / 100)).toFixed(2))
        : Number((basePrice - discountAmount).toFixed(2)));
    preparedLines.push({
      productId,
      name: line.name || `${product.name}${product.size ? ` ${product.size}` : ""}`,
      size: product.size || "",
      category: product.category || "",
      quantity,
      basePrice: Number(basePrice.toFixed(2)),
      itemDiscount: Number(discountAmount.toFixed(2)),
      itemDiscountMode,
      price: Number(resolvedUnitPrice.toFixed(2)),
      invoicePrice: product.invoicePrice !== undefined ? Number(product.invoicePrice) : 0
    });
  }

  const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);
  if (isPendingPreOrder) {
    // Nothing was decremented from stock yet, so re-validate against the
    // pre-order reservation pool (excluding this sale's own prior reservation)
    // instead of diffing against product.stock.
    const preOrderReservedMap = buildPreOrderReservedMap(state, sale.id);
    for (const productId of allProductIds) {
      const product = productMap.get(productId);
      if (!product) continue;
      const nextQty = Number(newQtyByProduct.get(productId) || 0);
      const alreadyReserved = Number(preOrderReservedMap.get(productId) || 0);
      const availableForPreOrder = Math.max(0, Number(product.stock || 0) - alreadyReserved);
      if (nextQty > availableForPreOrder) {
        res.status(409).json({ message: `Insufficient stock available for pre-order: ${product.name}. Available: ${availableForPreOrder}` });
        return;
      }
    }
  } else {
    for (const productId of allProductIds) {
      const product = productMap.get(productId);
      if (!product) continue;
      const oldQty = Number(oldQtyByProduct.get(productId) || 0);
      const nextQty = Number(newQtyByProduct.get(productId) || 0);
      const projectedStock = Number(product.stock || 0) + oldQty - nextQty;
      if (projectedStock < 0) {
        res.status(409).json({ message: `Insufficient stock for ${product.name}` });
        return;
      }
    }
  }

  const existingPayments = normalizeSalePayments(sale);
  const existingCreditPayment = existingPayments.find((payment) => String(payment.method || "").toLowerCase() === "customer_credit") || null;
  const editSubTotal = roundMoney(preparedLines.reduce((acc, line) => acc + (Number(line.price || 0) * Number(line.quantity || 0)), 0));
  if (nextBillDiscount > editSubTotal) {
    res.status(409).json({ message: `Total bill discount cannot exceed subtotal (${editSubTotal.toFixed(2)})` });
    return;
  }
  const customerDiscountLimit = resolveCustomerDiscountLimit({ customers: state.customers || [], customerName: sale.customerName });
  const totalDiscountApplied = calculateSaleDiscountTotal({ lines: preparedLines, billDiscount: nextBillDiscount });
  if (!isAdmin && customerDiscountLimit > 0 && totalDiscountApplied > customerDiscountLimit) {
    res.status(409).json({ message: `Discount limit exceeded for ${sale.customerName}. Allowed: ${customerDiscountLimit.toFixed(2)}` });
    return;
  }

  const hasExplicitPayments = body.payments !== undefined ||
    body.cashReceived !== undefined ||
    body.chequeAmount !== undefined ||
    body.customerCreditAmount !== undefined ||
    body.creditDueDate !== undefined;

  let nextPayments = [];
  let nextCreditDueDate = body.creditDueDate !== undefined ? String(body.creditDueDate || "").trim() : (sale.creditDueDate || "");

  const simulatedCredits = JSON.parse(JSON.stringify(state.customerCredits || []));

  if (hasExplicitPayments) {
    restoreCustomerCreditUsage({ credits: simulatedCredits, creditPayment: existingCreditPayment, saleId: sale.id });

    if (Array.isArray(body.payments)) {
      nextPayments = body.payments.map((p) => ({
        ...p,
        id: p.id || nanoid(12),
        amount: roundMoney(Number(p.amount || 0)),
        createdAt: p.createdAt || new Date().toISOString(),
        receivedBy: p.receivedBy || req.user?.username || "system"
      }));
    } else {
      const cashVal = Math.max(0, roundMoney(Number(body.cashReceived || 0)));
      const chequeVal = Math.max(0, roundMoney(Number(body.chequeAmount || 0)));
      const chequeNo = String(body.chequeNo || "").trim();
      const chequeDate = String(body.chequeDate || "").trim();
      const chequeBank = String(body.chequeBank || "").trim();
      const customerCreditVal = Math.max(0, roundMoney(Number(body.customerCreditAmount || 0)));

      if (chequeVal > 0) {
        if (!chequeNo) {
          res.status(400).json({ message: "Cheque number is required" });
          return;
        }
        if (!chequeDate) {
          res.status(400).json({ message: "Cheque date is required" });
          return;
        }
        if (!chequeBank) {
          res.status(400).json({ message: "Cheque bank is required" });
          return;
        }
      }

      if (cashVal > 0) {
        nextPayments.push({
          id: nanoid(12),
          method: "cash",
          amount: cashVal,
          createdAt: new Date().toISOString(),
          receivedBy: req.user?.username || "system"
        });
      }
      if (chequeVal > 0) {
        nextPayments.push({
          id: nanoid(12),
          method: "cheque",
          amount: chequeVal,
          chequeNo,
          chequeDate,
          chequeBank,
          createdAt: new Date().toISOString(),
          receivedBy: req.user?.username || "system"
        });
      }
      if (customerCreditVal > 0) {
        const { usagePlan, remaining } = buildCustomerCreditUsagePlan({
          credits: simulatedCredits,
          customerName: sale.customerName,
          amount: customerCreditVal
        });
        if (remaining > 0) {
          res.status(409).json({ message: "Customer credit exceeds available balance" });
          return;
        }
        const creditPaymentObj = applyCustomerCreditUsage({
          credits: simulatedCredits,
          creditPayment: { id: nanoid(12), method: "customer_credit", amount: customerCreditVal },
          customerName: sale.customerName,
          amount: customerCreditVal,
          saleId: sale.id,
          username: req.user?.username || "system"
        });
        if (creditPaymentObj) {
          nextPayments.push(creditPaymentObj);
        }
      }
    }
  } else {
    restoreCustomerCreditUsage({ credits: simulatedCredits, creditPayment: existingCreditPayment, saleId: sale.id });
    nextPayments = existingPayments.filter((payment) => String(payment.method || "").toLowerCase() !== "customer_credit");
    if (existingCreditPayment) {
      const desiredCreditAmount = roundMoney(Math.min(Number(existingCreditPayment.amount || 0), Number(enrichSale({
        ...sale,
        paymentType: nextPaymentType || sale.paymentType,
        discount: nextBillDiscount,
        discountAmount: nextBillDiscount,
        payments: nextPayments,
        lines: preparedLines,
        taxRate: 0
      }).total || 0)));
      if (desiredCreditAmount > 0) {
        try {
          const rebalancedCreditPayment = applyCustomerCreditUsage({
            credits: simulatedCredits,
            creditPayment: existingCreditPayment,
            customerName: sale.customerName,
            amount: desiredCreditAmount,
            saleId: sale.id,
            username: req.user?.username || "system"
          });
          if (rebalancedCreditPayment) {
            nextPayments.push(rebalancedCreditPayment);
          }
        } catch (error) {
          res.status(409).json({ message: error.message || "Unable to rebalance customer credit for edited bill" });
          return;
        }
      }
    }
  }

  // Keep emptyBottlesOwed in sync with the edited line quantities. Pending
  // pre-orders stay at 0 (nothing delivered yet); emptyBottlesCollected is left
  // untouched since it reflects bottles physically already collected.
  const editedEmptyBottlesOwed = isPendingPreOrder ? 0 : preparedLines.reduce((acc, line) => {
    const product = productMap.get(line.productId);
    const is250ml = String(product?.size || "").includes("250");
    if (!product || product.returnableBottle === false || !is250ml) return acc;
    return acc + Number(line.quantity || 0);
  }, 0);

  const collectEmptyBottlesQty = Math.max(0, roundMoney(Number(body.collectEmptyBottlesQty || 0) || 0));
  const customerNameKey = String(sale.customerName || "").trim().toLowerCase();

  if (collectEmptyBottlesQty > 0) {
    const customerSales = (state.sales || []).filter((s) => String(s.customerName || "").trim().toLowerCase() === customerNameKey);
    let totalSalesEmptiesOutstanding = 0;
    for (const s of customerSales) {
      const owed = String(s.id) === String(sale.id) ? editedEmptyBottlesOwed : Number(s.emptyBottlesOwed || 0);
      const collected = Number(s.emptyBottlesCollected || 0);
      totalSalesEmptiesOutstanding += Math.max(0, roundMoney(owed - collected));
    }
    if (collectEmptyBottlesQty > totalSalesEmptiesOutstanding) {
      res.status(409).json({ message: `Cannot collect more empty bottles than total customer sales outstanding (${totalSalesEmptiesOutstanding} available)` });
      return;
    }
  }

  const recalculated = recalculateSaleFinancials(enrichSale({
    ...sale,
    paymentType: nextPaymentType || sale.paymentType,
    discount: nextBillDiscount,
    discountAmount: nextBillDiscount,
    payments: nextPayments,
    creditDueDate: nextCreditDueDate,
    lines: preparedLines,
    taxRate: 0,
    emptyBottlesOwed: editedEmptyBottlesOwed
  }));

  try {
    const next = await updateState((draft) => {
      const idx = draft.sales.findIndex((item) => String(item.id) === String(id));
    if (idx === -1) return draft;

    if (!isPendingPreOrder) {
      for (const productId of allProductIds) {
        const product = draft.products.find((p) => p.id === productId);
        if (!product) continue;
        const oldQty = Number(oldQtyByProduct.get(productId) || 0);
        const nextQty = Number(newQtyByProduct.get(productId) || 0);
        const projectedStock = Number((Number(product.stock || 0) + oldQty - nextQty).toFixed(2));
        if (projectedStock < 0) {
           throw new Error(`Concurrency Error: Insufficient stock for ${product.name}`);
        }
        product.stock = projectedStock;
      }
    }

    if (existingCreditPayment) {
      draft.customerCredits = draft.customerCredits || [];
      restoreCustomerCreditUsage({ credits: draft.customerCredits, creditPayment: existingCreditPayment, saleId: sale.id });
      const nextCreditPayment = nextPayments.find((payment) => String(payment.method || "").toLowerCase() === "customer_credit");
      if (nextCreditPayment) {
        applyCustomerCreditUsage({
          credits: draft.customerCredits,
          creditPayment: nextCreditPayment,
          customerName: sale.customerName,
          amount: Number(nextCreditPayment.amount || 0),
          saleId: sale.id,
          username: req.user?.username || "system"
        });
      }
    }

    if (collectEmptyBottlesQty > 0) {
      let remainingToAllocate = collectEmptyBottlesQty;

      const targetSale = draft.sales[idx];
      const targetOwed = editedEmptyBottlesOwed;
      const targetCollected = Number(targetSale.emptyBottlesCollected || 0);
      const targetOutstanding = Math.max(0, roundMoney(targetOwed - targetCollected));
      const applyToTarget = Math.min(remainingToAllocate, targetOutstanding);

      if (applyToTarget > 0) {
        targetSale.emptyBottlesCollected = roundMoney(targetCollected + applyToTarget);
        recalculated.emptyBottlesCollected = targetSale.emptyBottlesCollected;
        remainingToAllocate = roundMoney(remainingToAllocate - applyToTarget);
      }

      if (remainingToAllocate > 0) {
        const otherSales = (draft.sales || [])
          .filter((s) => String(s.id) !== String(id) && String(s.customerName || "").trim().toLowerCase() === customerNameKey)
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

        for (const otherSale of otherSales) {
          if (remainingToAllocate <= 0) break;
          const oOwed = Number(otherSale.emptyBottlesOwed || 0);
          const oCollected = Number(otherSale.emptyBottlesCollected || 0);
          const oOutstanding = Math.max(0, roundMoney(oOwed - oCollected));
          if (oOutstanding <= 0) continue;

          const applyToOther = Math.min(remainingToAllocate, oOutstanding);
          otherSale.emptyBottlesCollected = roundMoney(oCollected + applyToOther);
          remainingToAllocate = roundMoney(remainingToAllocate - applyToOther);
        }
      }

      draft.emptyBottleCollections = draft.emptyBottleCollections || [];
      draft.emptyBottleCollections.unshift({
        id: nanoid(12),
        saleId: sale.id,
        customerName: sale.customerName,
        quantity: collectEmptyBottlesQty,
        createdAt: new Date().toISOString(),
        collectedBy: req.user?.username || "system"
      });
    }

    draft.sales[idx] = recalculated;
    return draft;
  });

    io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
    sendFullSync();
    res.json(recalculated);
  } catch (err) {
    res.status(409).json({ message: err.message || "Transaction failed due to concurrent modification. Please try again." });
  }
});

app.delete("/sales/:id", requireAuth, requireRole("admin", "cashier", "manager"), async (req, res) => {
  const { id } = req.params;
  const state = getState();
  const sale = (state.sales || []).find((item) => String(item.id) === String(id));
  if (!sale) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }
  if (req.user?.role === "cashier") {
    const saleCashier = String(sale.cashier || "").trim().toLowerCase();
    const actingUser = String(req.user?.username || "").trim().toLowerCase();
    if (!saleCashier || saleCashier !== actingUser) {
      res.status(403).json({ message: "You can delete only your own bills" });
      return;
    }
  }
  const hasDeliveryProcessing = Boolean(sale.deliveryConfirmedAt) || (Array.isArray(sale.deliveryAdjustments) && sale.deliveryAdjustments.length > 0) || Boolean(sale.preOrderConfirmedAt);
  if (hasDeliveryProcessing) {
    res.status(409).json({ message: "Cannot delete sale after delivery processing has started" });
    return;
  }
  if (Number(sale.emptyBottlesCollected || 0) > 0) {
    res.status(409).json({ message: "Cannot delete sale after empty bottles have been collected against it" });
    return;
  }
  const hasReturns = (state.returns || []).some((r) => String(r.saleId) === String(id));
  if (hasReturns) {
    res.status(409).json({ message: "Cannot delete a sale that has returns processed against it" });
    return;
  }

  const returnedByProduct = new Map();
  for (const ret of (state.returns || [])) {
    if (String(ret.saleId) !== String(id)) continue;
    for (const line of (ret.lines || [])) {
      returnedByProduct.set(line.productId, (returnedByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
    }
  }
  const creditPayment = normalizeSalePayments(sale).find((payment) => String(payment.method || "").toLowerCase() === "customer_credit");

  try {
    const next = await updateState((draft) => {
      // Restore only net sold qty not already returned. Pending pre-orders never
      // decremented stock at creation (stockDecremented === false), so deleting
      // one must not add stock back — there is nothing to restore.
      if (sale.stockDecremented !== false) {
        for (const line of (sale.lines || [])) {
          const product = draft.products.find((item) => item.id === line.productId);
          if (!product) continue;
          const sold = Number(line.quantity || 0);
          const alreadyReturned = Number(returnedByProduct.get(line.productId) || 0);
          const netSold = Math.max(0, sold - alreadyReturned);
          product.stock = Number((Number(product.stock || 0) + netSold).toFixed(2));
        }
      }
    if (creditPayment?.usagePlan?.length) {
      draft.customerCredits = draft.customerCredits || [];
      restoreCustomerCreditUsage({ credits: draft.customerCredits, creditPayment, saleId: sale.id });
    }
    draft.voidedSales = draft.voidedSales || [];
    draft.voidedSales.push({
      ...sale,
      voidedAt: new Date().toISOString(),
      voidedBy: req.user?.username || "system"
    });
    draft.sales = (draft.sales || []).filter((item) => String(item.id) !== String(id));
    draft.returns = (draft.returns || []).filter((ret) => String(ret.saleId) !== String(id));
      return draft;
    });

    io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
    sendFullSync();
    res.json({ ok: true, id: String(id) });
  } catch (err) {
    res.status(409).json({ message: err.message || "Transaction failed due to concurrent modification. Please try again." });
  }
});

app.post("/sales/:id/confirm-preorder", requireAuth, requireRole("cashier", "admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const state = getState();
  const sale = (state.sales || []).find((item) => String(item.id) === String(id));
  if (!sale) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }
  if (req.user?.role === "cashier") {
    const saleCashier = String(sale.cashier || "").trim().toLowerCase();
    const actingUser = String(req.user?.username || "").trim().toLowerCase();
    if (!saleCashier || saleCashier !== actingUser) {
      res.status(403).json({ message: "You can confirm only your own pre-orders" });
      return;
    }
  }
  if (sale.orderType !== "preorder" || sale.preOrderStatus !== "pending") {
    res.status(409).json({ message: "This sale is not a pending pre-order" });
    return;
  }

  const requestedLines = Array.isArray(body.lines) ? body.lines : [];
  const deliveredQtyOverrides = new Map();
  for (const line of requestedLines) {
    const productId = String(line.productId || "").trim();
    if (!productId) continue;
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      res.status(400).json({ message: `Invalid delivered quantity for ${productId}` });
      return;
    }
    deliveredQtyOverrides.set(productId, quantity);
  }

  const deliveredLines = [];
  const shortLines = [];
  for (const line of (sale.lines || [])) {
    const orderedQty = Number(line.quantity || 0);
    const deliveredQty = deliveredQtyOverrides.has(line.productId)
      ? deliveredQtyOverrides.get(line.productId)
      : orderedQty;
    if (deliveredQty > orderedQty) {
      res.status(400).json({ message: `Delivered quantity for ${line.name || line.productId} cannot exceed ordered quantity (${orderedQty})` });
      return;
    }
    if (deliveredQty > 0) {
      deliveredLines.push({ ...line, quantity: deliveredQty });
    }
    const shortQty = Number((orderedQty - deliveredQty).toFixed(2));
    if (shortQty > 0) {
      shortLines.push({ productId: line.productId, name: line.name, quantity: shortQty });
    }
  }

  if (!deliveredLines.length) {
    res.status(400).json({ message: "Nothing was delivered. Delete the pre-order instead of confirming an empty delivery." });
    return;
  }

  const paymentMethod = String(body.paymentMethod || "").trim().toLowerCase();
  if (!["cash", "cheque", "credit"].includes(paymentMethod)) {
    res.status(400).json({ message: "paymentMethod must be cash, cheque, or credit" });
    return;
  }

  const recalculatedSale = enrichSale({
    ...sale,
    lines: deliveredLines,
    discount: sale.discountAmount ?? sale.discount ?? 0,
    taxRate: sale.taxRate ?? 0
  });
  const deliveredTotal = roundMoney(recalculatedSale.total || 0);

  const payments = [];
  let chequeNo = "";
  let chequeDate = "";
  let chequeBank = "";

  if (paymentMethod === "cash") {
    const cashReceived = roundMoney(Number(body.cashReceived || 0));
    if (!Number.isFinite(cashReceived) || cashReceived < 0) {
      res.status(400).json({ message: "cashReceived must be 0 or more" });
      return;
    }
    if (cashReceived > deliveredTotal + 0.01) {
      res.status(400).json({ message: `Cash received cannot exceed the delivered bill total (${deliveredTotal.toFixed(2)})` });
      return;
    }
    if (cashReceived > 0) {
      payments.push({
        id: nanoid(12),
        method: "cash",
        amount: cashReceived,
        createdAt: new Date().toISOString(),
        receivedBy: req.user?.username || "system"
      });
    }
  } else if (paymentMethod === "cheque") {
    // No payment recorded now; manager will enter cheque details later during delivery confirmation.
  }
  // paymentMethod === "credit": no payment recorded now; full amount sits as outstanding.

  const paidNow = paymentMethod === "cash" ? Number(payments[0]?.amount || 0) : 0;
  const remainingAfterPayment = roundMoney(Math.max(0, deliveredTotal - paidNow));
  const preparedCustomerName = String(sale.customerName || "").trim();
  if (remainingAfterPayment > 0 && (!preparedCustomerName || preparedCustomerName.toLowerCase() === "walk-in")) {
    res.status(409).json({ message: "Outstanding balance can only be tracked for saved customers. Select a saved customer or collect full payment." });
    return;
  }

  // Credit limit is only meaningful once real debt is created, i.e. at confirmation
  // (pending pre-orders carry 0 outstanding) — enforce it here using the same rule
  // POST /sales applies to direct sales.
  if (remainingAfterPayment > 0) {
    const creditProfile = resolveCustomerCreditProfile({ customers: state.customers || [], customerName: preparedCustomerName, customerId: sale.customerId });
    if (Number(creditProfile.creditLimit || 0) > 0) {
      const currentOutstanding = calculateCustomerOutstanding({
        sales: state.sales || [],
        customers: state.customers || [],
        customerName: preparedCustomerName,
        customerId: sale.customerId
      });
      const projectedOutstanding = roundMoney(currentOutstanding + remainingAfterPayment);
      if (projectedOutstanding > roundMoney(creditProfile.creditLimit)) {
        const availableCreditLimit = roundMoney(Math.max(0, Number(creditProfile.creditLimit || 0) - currentOutstanding));
        res.status(409).json({
          message: `Credit limit exceeded for ${preparedCustomerName}. Limit: ${roundMoney(creditProfile.creditLimit).toFixed(2)}, outstanding: ${currentOutstanding.toFixed(2)}, available: ${availableCreditLimit.toFixed(2)}`
        });
        return;
      }
    }
  }

  const productMap = new Map((state.products || []).map((p) => [p.id, p]));
  const emptyBottlesOwed = deliveredLines.reduce((acc, line) => {
    const product = productMap.get(line.productId);
    const is250ml = String(product?.size || "").includes("250");
    if (!product || product.returnableBottle === false || !is250ml) return acc;
    return acc + Number(line.quantity || 0);
  }, 0);

  const emptyBottlesCollected = roundMoney(Number(body.emptyBottlesCollected || 0));
  if (!Number.isFinite(emptyBottlesCollected) || emptyBottlesCollected < 0) {
    res.status(400).json({ message: "emptyBottlesCollected must be 0 or more" });
    return;
  }
  
  const customerNameKey = String(sale.customerName || "").trim().toLowerCase();
  const otherSalesOutstanding = (state.sales || [])
    .filter((s) => String(s.id) !== String(id) && String(s.customerName || "").trim().toLowerCase() === customerNameKey)
    .reduce((acc, s) => acc + Math.max(0, roundMoney(Number(s.emptyBottlesOwed || 0) - Number(s.emptyBottlesCollected || 0))), 0);
    
  let openingOutstanding = 0;
  const targetCustomer = (state.customers || []).find((c) => String(c.name || "").trim().toLowerCase() === customerNameKey);
  if (targetCustomer) {
    openingOutstanding = Math.max(0, roundMoney(Number(targetCustomer.openingEmptyBottles || 0) - Number(targetCustomer.collectedOpeningEmptyBottles || 0)));
  }
  
  const maxAllowedCollection = roundMoney(emptyBottlesOwed + otherSalesOutstanding + openingOutstanding);
  if (emptyBottlesCollected > maxAllowedCollection) {
    res.status(409).json({ message: `Cannot collect more than the total owed empty bottles (${maxAllowedCollection} available)` });
    return;
  }

  try {
    let updatedSale = null;
    const next = await updateState((draft) => {
      const idx = (draft.sales || []).findIndex((item) => String(item.id) === String(id));
      if (idx === -1) return draft;
      const target = draft.sales[idx];

      if (target.stockDecremented === false) {
        for (const line of deliveredLines) {
          const product = draft.products.find((item) => item.id === line.productId);
          if (product) {
            const projectedStock = Number((Number(product.stock || 0) - Number(line.quantity || 0)).toFixed(2));
            if (projectedStock < 0) {
               throw new Error(`Concurrency Error: Insufficient stock for ${product.name}`);
            }
            product.stock = projectedStock;
          }
        }
    } else if (shortLines.length > 0) {
      for (const shortLine of shortLines) {
        const product = draft.products.find((item) => item.id === shortLine.productId);
        if (product) {
          product.stock = Number((Number(product.stock || 0) + Number(shortLine.quantity || 0)).toFixed(2));
        }
      }
    }

    const merged = {
      ...target,
      ...recalculatedSale,
      id: target.id,
      orderType: "preorder",
      preOrderStatus: "confirmed",
      preOrderConfirmedAt: new Date().toISOString(),
      preOrderConfirmedBy: req.user?.username || "system",
      preOrderShortLines: shortLines,
      paymentType: paymentMethod,
      payments,
      chequeNo,
      chequeDate,
      chequeBank,
      stockDecremented: true,
      emptyBottlesOwed,
      emptyBottlesCollected: 0
    };

    if (emptyBottlesCollected > 0) {
      let remainingToAllocate = emptyBottlesCollected;
      
      const targetOutstanding = emptyBottlesOwed;
      const applyToTarget = Math.min(remainingToAllocate, targetOutstanding);
      
      if (applyToTarget > 0) {
        merged.emptyBottlesCollected = applyToTarget;
        remainingToAllocate = roundMoney(remainingToAllocate - applyToTarget);
      }
      
      if (remainingToAllocate > 0) {
        const otherSales = (draft.sales || [])
          .filter((s) => String(s.id) !== String(id) && String(s.customerName || "").trim().toLowerCase() === customerNameKey)
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

        for (const otherSale of otherSales) {
          if (remainingToAllocate <= 0) break;
          const oOwed = Number(otherSale.emptyBottlesOwed || 0);
          const oCollected = Number(otherSale.emptyBottlesCollected || 0);
          const oOutstanding = Math.max(0, roundMoney(oOwed - oCollected));
          if (oOutstanding <= 0) continue;

          const applyToOther = Math.min(remainingToAllocate, oOutstanding);
          otherSale.emptyBottlesCollected = roundMoney(oCollected + applyToOther);
          remainingToAllocate = roundMoney(remainingToAllocate - applyToOther);
        }
      }
      
      if (remainingToAllocate > 0) {
        draft.customers = draft.customers || [];
        const cIdx = draft.customers.findIndex((c) => String(c.name || "").trim().toLowerCase() === customerNameKey);
        if (cIdx !== -1) {
          const c = draft.customers[cIdx];
          c.collectedOpeningEmptyBottles = roundMoney(Number(c.collectedOpeningEmptyBottles || 0) + remainingToAllocate);
        }
      }

      draft.emptyBottleCollections = draft.emptyBottleCollections || [];
      draft.emptyBottleCollections.unshift({
        id: nanoid(12),
        saleId: target.id,
        customerName: target.customerName || "",
        quantity: emptyBottlesCollected,
        collectedBy: req.user?.username || "system",
        createdAt: new Date().toISOString()
      });
    }

    const finalSale = { ...merged, ...recalculateSaleFinancials(merged) };
    draft.sales[idx] = finalSale;
    updatedSale = finalSale;
    return draft;
  });

    io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
    sendFullSync();
    res.json(updatedSale);
  } catch (err) {
    res.status(409).json({ message: err.message || "Transaction failed due to concurrent modification. Please try again." });
  }
});

app.post("/sales/:id/collect-empty-bottles", requireAuth, requireRole("cashier", "admin", "manager"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const state = getState();
  const sale = (state.sales || []).find((item) => String(item.id) === String(id));
  if (!sale) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }
  if (req.user?.role === "cashier") {
    const saleCashier = String(sale.cashier || "").trim().toLowerCase();
    const actingUser = String(req.user?.username || "").trim().toLowerCase();
    if (!saleCashier || saleCashier !== actingUser) {
      res.status(403).json({ message: "You can collect empty bottles only for your own bills" });
      return;
    }
  }

  const quantity = Number(body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    res.status(400).json({ message: "quantity must be greater than 0" });
    return;
  }

  const owed = Number(sale.emptyBottlesOwed || 0);
  const alreadyCollected = Number(sale.emptyBottlesCollected || 0);
  const outstanding = Math.max(0, roundMoney(owed - alreadyCollected));
  if (quantity > outstanding) {
    res.status(409).json({ message: `Cannot collect more than the outstanding empty bottles (${outstanding} available)` });
    return;
  }

  let updatedSale = null;
  const next = await updateState((draft) => {
    const idx = (draft.sales || []).findIndex((item) => String(item.id) === String(id));
    if (idx === -1) return draft;
    const target = draft.sales[idx];
    target.emptyBottlesCollected = roundMoney(Number(target.emptyBottlesCollected || 0) + quantity);
    updatedSale = target;

    draft.emptyBottleCollections = draft.emptyBottleCollections || [];
    draft.emptyBottleCollections.unshift({
      id: nanoid(12),
      saleId: target.id,
      customerName: target.customerName || "",
      quantity,
      collectedBy: req.user?.username || "system",
      createdAt: new Date().toISOString()
    });

    return draft;
  });

  sendFullSync();
  res.json(updatedSale || (next.sales || []).find((item) => String(item.id) === String(id)));
});

app.post("/returns", requireAuth, requireRole("cashier", "admin"), async (req, res) => {
  const body = req.body || {};
  const saleId = String(body.saleId || "").trim();
  const lines = Array.isArray(body.lines) ? body.lines : [];

  if (!saleId) {
    res.status(400).json({ message: "saleId is required" });
    return;
  }
  if (!lines.length) {
    res.status(400).json({ message: "Select at least one return item" });
    return;
  }

  const state = getState();
  const sale = (state.sales || []).find((item) => String(item.id) === saleId);
  if (!sale) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }
  const saleCashier = String(sale.cashier || "").trim().toLowerCase();
  const actingUser = String(req.user?.username || "").trim().toLowerCase();
  const isAdmin = ["admin", "manager"].includes(String(req.user?.role || "").toLowerCase());
  if (!isAdmin && (!saleCashier || saleCashier !== actingUser)) {
    res.status(403).json({ message: "Only the rep who created this sale can return its items" });
    return;
  }
  if (sale.orderType === "preorder" && sale.preOrderStatus === "pending") {
    res.status(409).json({ message: "Cannot return items from a pre-order that hasn't been delivered yet" });
    return;
  }

  const previousReturns = (state.returns || []).filter((item) => item.saleId === saleId);
  const returnedByProduct = new Map();
  for (const ret of previousReturns) {
    for (const line of (ret.lines || [])) {
      const key = line.productId;
      returnedByProduct.set(key, (returnedByProduct.get(key) || 0) + Number(line.quantity || 0));
    }
  }

  const undeliveredByProduct = new Map();
  for (const adjustment of (sale.deliveryAdjustments || [])) {
    for (const line of (adjustment.lines || [])) {
      const key = line.productId;
      undeliveredByProduct.set(key, (undeliveredByProduct.get(key) || 0) + Number(line.quantity || 0));
    }
  }

  const saleLineByProduct = new Map((sale.lines || []).map((line) => [line.productId, line]));
  const preparedLines = [];
  for (const incoming of lines) {
    const productId = String(incoming.productId || "").trim();
    const quantity = Number(incoming.quantity || 0);
    const condition = "damaged";
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      res.status(400).json({ message: "Invalid return line" });
      return;
    }
    const soldLine = saleLineByProduct.get(productId);
    if (!soldLine) {
      res.status(400).json({ message: "Return item not found in selected sale" });
      return;
    }
    const soldQty = Number(soldLine.quantity || 0);
    const alreadyReturned = Number(returnedByProduct.get(productId) || 0);
    const alreadyUndelivered = Number(undeliveredByProduct.get(productId) || 0);
    const remaining = soldQty - alreadyReturned - alreadyUndelivered;
    if (quantity > remaining) {
      res.status(409).json({ message: `Return exceeds remaining qty for ${soldLine.name}` });
      return;
    }
      const financials = buildReturnLineFinancials({ sale, soldLine, quantity });
      preparedLines.push({
        productId,
        name: soldLine.name,
        quantity,
        condition,
        baseUnitPrice: financials.baseUnitPrice,
        soldUnitPrice: financials.soldUnitPrice,
        unitItemDiscount: financials.unitItemDiscount,
        itemDiscountMode: financials.itemDiscountMode,
        itemDiscountValue: financials.itemDiscountValue,
        grossAmount: financials.grossAmount,
        billDiscountShare: financials.billDiscountShare,
        returnUnitPrice: financials.returnUnitPrice,
        returnAmount: condition === "good" ? financials.returnAmount : 0
      });
    }

    const returnTotalAmount = roundMoney(preparedLines.reduce((acc, line) => acc + Number(line.returnAmount || 0), 0));
    const record = {
      id: nanoid(12),
      saleId,
      rep: req.user.username,
      createdAt: new Date().toISOString(),
      totalAmount: returnTotalAmount,
      lines: preparedLines
    };

  try {
    const next = await updateState((draft) => {
      draft.returns = draft.returns || [];
      draft.returns.unshift(record);
      let returnedEmptyBottles = 0;
      for (const line of preparedLines) {
        const product = draft.products.find((item) => item.id === line.productId);
        if (product && product.returnableBottle !== false) {
          returnedEmptyBottles += Number(line.quantity || 0);
        }
        // Replacement: deduct fresh item from stock, add returned item to returned lot
        if (product) {
          const projectedStock = Number((Number(product.stock || 0) - Number(line.quantity || 0)).toFixed(2));
          if (projectedStock < 0) {
             throw new Error(`Concurrency Error: Insufficient stock for replacement of ${product.name}`);
          }
          product.stock = projectedStock;
          product.returnedStock = Number((Number(product.returnedStock || 0) + Number(line.quantity || 0)).toFixed(2));
        }
      }
      const saleIndex = (draft.sales || []).findIndex((item) => String(item.id) === saleId);
      if (saleIndex !== -1) {
        const targetSale = draft.sales[saleIndex];
        targetSale.emptyBottlesOwed = Math.max(0, Number(targetSale.emptyBottlesOwed || 0) - returnedEmptyBottles);
        const previousRefundDue = roundMoney(Number(targetSale.refundDueAmount || 0));
        targetSale.returnedAmount = roundMoney(Number(targetSale.returnedAmount || 0) + returnTotalAmount);
        const recalculatedSale = recalculateSaleFinancials(targetSale);
        draft.sales[saleIndex] = recalculatedSale;
        const nextRefundDue = roundMoney(Number(recalculatedSale.refundDueAmount || 0));
        const newCreditAmount = roundMoney(Math.max(0, nextRefundDue - previousRefundDue));
        const customerName = String(recalculatedSale.customerName || "").trim();
        if (newCreditAmount > 0 && customerName && customerName.toLowerCase() !== "walk-in") {
          draft.customerCredits = draft.customerCredits || [];
          draft.customerCredits.unshift({
            id: nanoid(12),
            customerName,
            saleId: String(saleId),
            returnId: record.id,
            amount: newCreditAmount,
            remainingAmount: newCreditAmount,
            status: "open",
            createdAt: new Date().toISOString(),
            createdBy: req.user?.username || "system"
          });
        }
      }
      return draft;
    });

    io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
    sendFullSync();
    res.status(201).json(record);
  } catch (err) {
    res.status(409).json({ message: err.message || "Transaction failed due to concurrent modification. Please try again." });
  }
});

app.post("/sales/:id/delivery-adjust", requireAuth, requireRole("admin", "manager", "cashier"), async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const incomingLines = Array.isArray(body.lines) ? body.lines : [];
  const markConfirmed = body.markConfirmed !== false;
  const cashReceived = Number(body.cashReceived || 0);
  const chequeAmount = Number(body.chequeAmount || 0);
  const chequeNo = String(body.chequeNo || "").trim();
  const chequeDate = String(body.chequeDate || "").trim();
  const chequeBank = String(body.chequeBank || "").trim();

  const state = getState();
  const sale = (state.sales || []).find((item) => String(item.id) === String(id));
  if (!sale) {
    res.status(404).json({ message: "Sale not found" });
    return;
  }
  if (req.user.role === "cashier" && !isSameRep(sale.cashier, req.user?.username, req.user)) {
    res.status(403).json({ message: "Insufficient permissions. You can only confirm your own deliveries." });
    return;
  }
  if (sale.orderType === "preorder" && sale.preOrderStatus === "pending") {
    res.status(409).json({ message: "Pending pre-orders must be confirmed via the pre-order confirmation flow, not delivery adjustment" });
    return;
  }

  const saleLines = Array.isArray(sale.lines) ? sale.lines : [];
  const soldByProduct = new Map();
  for (const line of saleLines) {
    soldByProduct.set(line.productId, (soldByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
  }

  const alreadyUndelivered = new Map();
  for (const adj of (sale.deliveryAdjustments || [])) {
    for (const line of (adj.lines || [])) {
      alreadyUndelivered.set(line.productId, (alreadyUndelivered.get(line.productId) || 0) + Number(line.quantity || 0));
    }
  }

  const alreadyReturnedGood = new Map();
  for (const ret of (state.returns || [])) {
    if (String(ret.saleId) !== String(sale.id)) continue;
    for (const line of (ret.lines || [])) {
      if (String(line.condition || "").toLowerCase() !== "good") continue;
      alreadyReturnedGood.set(line.productId, (alreadyReturnedGood.get(line.productId) || 0) + Number(line.quantity || 0));
    }
  }

  const preparedLines = [];
  for (const line of incomingLines) {
    const productId = String(line.productId || "").trim();
    const quantity = Number(line.quantity || 0);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    const sold = Number(soldByProduct.get(productId) || 0);
    if (sold <= 0) {
      res.status(400).json({ message: "Invalid delivery line product" });
      return;
    }
    const prevUndelivered = Number(alreadyUndelivered.get(productId) || 0);
    const prevReturnedGood = Number(alreadyReturnedGood.get(productId) || 0);
    const maxAllowed = Math.max(0, sold - prevUndelivered - prevReturnedGood);
    if (quantity > maxAllowed) {
      const saleLine = saleLines.find((item) => item.productId === productId);
      res.status(409).json({ message: `Undelivered qty exceeds remaining for ${saleLine?.name || productId}` });
      return;
    }
    const saleLine = saleLines.find((item) => item.productId === productId);
    preparedLines.push({
      productId,
      name: saleLine?.name || productId,
      quantity
    });
  }

  const adjustmentRecord = preparedLines.length ? {
    id: nanoid(12),
    createdAt: new Date().toISOString(),
    by: req.user?.username || "admin",
    lines: preparedLines
  } : null;

  const existingPayments = normalizeSalePayments(sale);
  if (markConfirmed) {
    if (!Number.isFinite(cashReceived) || cashReceived < 0) {
      res.status(400).json({ message: "Cash received must be 0 or more" });
      return;
    }
    if (!Number.isFinite(chequeAmount) || chequeAmount < 0) {
      res.status(400).json({ message: "Cheque amount must be 0 or more" });
      return;
    }
    if (chequeAmount > 0) {
      if (!chequeNo) {
        res.status(400).json({ message: "Cheque number is required" });
        return;
      }
      if (!chequeDate) {
        res.status(400).json({ message: "Cheque date is required" });
        return;
      }
      if (!chequeBank) {
        res.status(400).json({ message: "Cheque bank is required" });
        return;
      }
    }
    const existingPaid = totalPaymentsAmount(existingPayments);
    const incomingPaid = roundMoney(Number(cashReceived || 0) + Number(chequeAmount || 0));
    const projectedUndeliveredAmount = computeDeliveryAdjustmentsAmount(sale, adjustmentRecord ? [adjustmentRecord] : []);
    const maxCollectible = roundMoney(Math.max(0, Number(sale.total || 0) - Number(sale.returnedAmount || 0) - projectedUndeliveredAmount));
    if (incomingPaid > roundMoney(Math.max(0, maxCollectible - existingPaid))) {
        res.status(409).json({ message: "Cash and cheque total cannot exceed bill total" });
        return;
    }
  }

  const next = await updateState((draft) => {
    const idx = (draft.sales || []).findIndex((item) => String(item.id) === String(id));
    if (idx === -1) return draft;
    const target = draft.sales[idx];
    target.deliveryAdjustments = target.deliveryAdjustments || [];
    if (adjustmentRecord) {
      target.deliveryAdjustments.push(adjustmentRecord);
      for (const line of adjustmentRecord.lines) {
        const product = (draft.products || []).find((item) => item.id === line.productId);
        if (!product) continue;
        product.stock = Number((Number(product.stock || 0) + Number(line.quantity || 0)).toFixed(2));
      }
    }
      if (markConfirmed) {
        const previousRefundDue = roundMoney(Number(target.refundDueAmount || 0));
        target.payments = normalizeSalePayments(target);
        if (cashReceived > 0) {
          target.payments.push({
            id: nanoid(12),
          method: "cash",
          amount: Number(cashReceived.toFixed(2)),
          createdAt: new Date().toISOString(),
          receivedBy: req.user?.username || "admin"
        });
      }
      if (chequeAmount > 0) {
        target.payments.push({
          id: nanoid(12),
          method: "cheque",
          amount: Number(chequeAmount.toFixed(2)),
          chequeNo,
          chequeDate,
          chequeBank,
          createdAt: new Date().toISOString(),
            receivedBy: req.user?.username || "admin"
          });
        }
        if (!target.deliveryConfirmedAt) {
          target.deliveryConfirmedAt = new Date().toISOString();
        }
        if (!target.deliveryConfirmedBy) {
          target.deliveryConfirmedBy = req.user?.username || "admin";
        }
        draft.sales[idx] = recalculateSaleFinancials(target);
        const recalculatedSale = draft.sales[idx];
        const nextRefundDue = roundMoney(Number(recalculatedSale.refundDueAmount || 0));
        const newCreditAmount = roundMoney(Math.max(0, nextRefundDue - previousRefundDue));
        const customerName = String(recalculatedSale.customerName || "").trim();
        if (newCreditAmount > 0 && customerName && customerName.toLowerCase() !== "walk-in") {
          draft.customerCredits = draft.customerCredits || [];
          draft.customerCredits.unshift({
            id: nanoid(12),
            customerName,
            saleId: String(id),
            returnId: "",
            amount: newCreditAmount,
            remainingAmount: newCreditAmount,
            status: "open",
            createdAt: new Date().toISOString(),
            createdBy: req.user?.username || "system",
            source: "delivery_adjustment"
          });
        }
      }
      return draft;
    });

  io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, next.products);
  sendFullSync();
  const updatedSale = (next.sales || []).find((item) => String(item.id) === String(id));
  res.status(201).json(updatedSale);
});

app.get("/dashboard", requireAuth, async (_req, res) => {
  const state = getState();
  const sales = (state.sales || []).map((sale) => recalculateSaleFinancials(sale));

  const validSales = sales.filter(sale => !(sale.orderType === "preorder" && sale.preOrderStatus === "pending"));
  const today = toColomboDateKey();
  const todaySales = validSales.filter((sale) => toColomboDateKey(sale.createdAt) === today);
  // netTotalAfterReturns (not the raw total) so returns/undelivered adjustments
  // don't inflate revenue. Pending pre-orders are excluded entirely until confirmed.
  const todayRevenue = todaySales.reduce((acc, sale) => acc + Number(sale.netTotalAfterReturns || 0), 0);
  const todayOutstanding = todaySales.reduce((acc, sale) => acc + Number(sale.outstandingAmount || 0), 0);

  const lowStockItems = state.products.filter((item) => item.stock <= 25);

  res.json({
    salesCount: validSales.length,
    todaySalesCount: todaySales.length,
    todayRevenue: Number(todayRevenue.toFixed(2)),
    todayOutstanding: Number(todayOutstanding.toFixed(2)),
    lowStockItems
  });
});

app.post("/demo/reset", requireAuth, requireRole("admin"), async (_req, res) => {
  if (!IS_DEMO_MODE) {
    res.status(404).json({ message: "Demo reset is available only in demo mode" });
    return;
  }

  let nextState = structuredClone(seedState);
  if (DEMO_SNAPSHOT_FILE) {
    try {
      const raw = fs.readFileSync(DEMO_SNAPSHOT_FILE, "utf8");
      nextState = JSON.parse(raw);
    } catch (error) {
      res.status(500).json({ message: `Unable to load demo snapshot: ${error?.message || "invalid snapshot"}` });
      return;
    }
  }

  const replaced = replaceState(nextState);
  io.emit(SOCKET_EVENTS.INVENTORY_UPDATED, replaced.products || []);
  sendFullSync();
  res.json({
    ok: true,
    mode: APP_MODE,
    source: DEMO_SNAPSHOT_FILE ? "snapshot" : "seed",
    sales: (replaced.sales || []).length,
    products: (replaced.products || []).length
  });
});

io.use((socket, next) => {
  const token = extractSocketToken(socket);
  if (!token) {
    next(new Error("Missing token"));
    return;
  }

  try {
    socket.data.user = verifyAccessToken(token);
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  socket.emit(SOCKET_EVENTS.STATE_SYNC, getState());
});

const migrateCustomerIds = async () => {
  await updateState((draft) => {
    if (!draft.sales || !draft.customers) return draft;
    
    const customerMap = new Map();
    const nameCounts = new Map();
    for (const customer of draft.customers) {
      const key = String(customer.name || "").trim().toLowerCase();
      customerMap.set(key, customer);
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }
    
    let migratedCount = 0;
    for (const sale of draft.sales) {
      if (!sale.customerId && sale.customerName) {
        const key = String(sale.customerName).trim().toLowerCase();
        if (nameCounts.get(key) === 1) {
          const matched = customerMap.get(key);
          sale.customerId = matched.id;
          migratedCount++;
        }
      }
    }
    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} legacy sales to use customerId`);
    }
    return draft;
  });
};

migrateCustomerIds().then(() => {
  const port = Number(process.env.PORT || 4010);
  server.listen(port, () => {
    console.log(`POS API listening on http://localhost:${port}`);
  });
});
