import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { calculateTotals, PAYMENT_TYPES, SOCKET_EVENTS } from "@lucky/shared";
import {
  clearAuthSession,
  collectEmptyBottles,
  collectOpeningEmptyBottles,
  confirmPreorder,
  createAuthUser,
  fetchAuthUsers,
  createCustomer,
  createProduct,
  createStaff,
  createAccount,
  createAccounting,
  deleteAuthUser,
  deleteCustomer,
  deleteSale,
  deleteStaff,
  deleteAccount,
  deleteAccounting,
  deleteProduct,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  createPurchase,
  updatePurchase,
  deletePurchase,
  fetchAppConfig,
  fetchDashboard,
  fetchMe,
  fetchState,
  getAccessToken,
  getApiBase,
  loginApi,
  logoutApi,
  patchSale,
  patchProduct,
  setAuthCallbacks,
  setAuthSession,
  submitDeliveryAdjustment,
  submitReturn,
  submitSale,
  payCustomerOutstanding,
  setManagerFullAccess,
  updateCustomer,
  updateAuthUser,
  updateStaff,
  updateAccount,
  updateAccounting,
  resetLorryCount,
  resetAllData,
  setLoadingRowMark
} from "./api.js";


export const PaginatedList = ({ items, renderItem, itemsPerPage = 50, emptyMessage = "No items found." }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil((items?.length || 0) / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [items?.length, totalPages]);

  if (!items || items.length === 0) {
    return (
      <tr>
        <td colSpan="100%" className="form-hint" style={{ textAlign: "center", padding: "20px" }}>
          {emptyMessage}
        </td>
      </tr>
    );
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleItems = items.slice(startIndex, startIndex + itemsPerPage);

  return (
    <>
      {visibleItems.map(renderItem)}
      {totalPages > 1 && (
        <tr>
          <td colSpan="100%">
            <div className="pagination-controls" style={{ display: 'flex', gap: '10px', marginTop: '15px', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
              <button type="button" className="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button type="button" className="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export const usePagination = (items, itemsPerPage = 50) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil((items?.length || 0) / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [items?.length, totalPages]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleItems = (items || []).slice(startIndex, startIndex + itemsPerPage);

  const controls = totalPages > 1 ? (
    <div className="pagination-controls" style={{ display: 'flex', gap: '10px', marginTop: '15px', alignItems: 'center', justifyContent: 'center', padding: '10px', gridColumn: '1 / -1', width: '100%' }}>
      <button type="button" className="ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
      <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>Page {currentPage} of {totalPages}</span>
      <button type="button" className="ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
    </div>
  ) : null;

  return { visibleItems, controls };
};

export const PaginatedGridList = ({ items, renderItem, itemsPerPage = 50, emptyMessage = "No items found." }) => {
  const { visibleItems, controls } = usePagination(items, itemsPerPage);
  
  if (!items || items.length === 0) {
    return <p className="form-hint table-empty" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px" }}>{emptyMessage}</p>;
  }

  return (
    <>
      {visibleItems.map(renderItem)}
      {controls}
    </>
  );
};

export const PaginatedTableBody = ({ items, renderItem, itemsPerPage = 50, emptyMessage = "No items found.", colSpan = 1 }) => {
  const { visibleItems, controls } = usePagination(items, itemsPerPage);
  
  if (!items || items.length === 0) {
    return <tr><td colSpan={colSpan} className="form-hint table-empty" style={{ textAlign: "center", padding: "20px" }}>{emptyMessage}</td></tr>;
  }

  return (
    <>
      {visibleItems.map(renderItem)}
      {controls && (
        <tr>
          <td colSpan={colSpan} style={{ padding: 0, border: "none" }}>
            {controls}
          </td>
        </tr>
      )}
    </>
  );
};

export const SaveButton = ({ onClick, children, className, style, disabled, ...props }) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleClick = async (e) => {
    if (isSaving || disabled) return;
    setIsSaving(true);
    try {
      const result = onClick(e);
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button type="button" className={className} style={style} onClick={handleClick} disabled={isSaving || disabled} {...props}>
      {isSaving ? "Wait..." : children}
    </button>
  );
};

export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(error);
    }
  };

  return [storedValue, setValue];
};

export const formatLkrValue = (value) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
export const currency = (value) => `LKR ${formatLkrValue(value)}`;
export const SESSION_KEY = "lucky_pos_session";

export const executeHtmlPrint = (htmlContent, existingPrintWindow = null) => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    if (existingPrintWindow && !existingPrintWindow.closed) existingPrintWindow.close();
    
    let style = document.getElementById('mobile-print-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'mobile-print-style';
      style.innerHTML = '@media print { #root { display: none !important; } #mobile-print-container { display: block !important; margin: 0; padding: 0; } @page { margin: 0; } } @media screen { #mobile-print-container { display: none !important; } }';
      document.head.appendChild(style);
    }
    
    let container = document.getElementById('mobile-print-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'mobile-print-container';
      document.body.appendChild(container);
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    container.innerHTML = '';
    doc.querySelectorAll('style').forEach(s => container.appendChild(s.cloneNode(true)));
    Array.from(doc.body.childNodes).forEach(n => container.appendChild(n.cloneNode(true)));
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        container.innerHTML = '';
      }, 1000);
    }, 250);
    
    return null;
  }

  const printWindow = (existingPrintWindow && !existingPrintWindow.closed) 
    ? existingPrintWindow 
    : window.open("", "_blank", "width=400,height=640");
    
  if (!printWindow) {
    console.warn("Popup blocked");
    return null;
  }
  
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  const handlePrint = () => {
    printWindow.focus();
    printWindow.print();
    setTimeout(() => {
      printWindow.close();
    }, 1000);
  };
  
  printWindow.onafterprint = () => {
    printWindow.close();
  };
  
  printWindow.onload = handlePrint;
  setTimeout(handlePrint, 800);
  
  return printWindow;
};

export const getDefaultLorryForUsername = (username = "") => {
  const clean = String(username || "").trim().toLowerCase();
  if (!clean) return "";
  if (clean.includes("rep1") || clean.includes("rep-1") || clean.includes("rep 1")) return "Lorry A";
  if (clean.includes("rep2") || clean.includes("rep-2") || clean.includes("rep 2")) return "Lorry B";
  const match = clean.match(/rep\D*(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return num % 2 !== 0 ? "Lorry A" : "Lorry B";
  }
  return "";
};

export const getAllowedLorriesForUser = (cashier = "", user = null) => {
  const activeUser = String(user?.username || user?.name || user?.id || cashier || "").trim().toLowerCase();
  if (activeUser.includes("rep1") || activeUser.includes("rep-1") || activeUser.includes("rep 1") || activeUser === "user-rep-1") {
    return ["Lorry A"];
  }
  if (activeUser.includes("rep2") || activeUser.includes("rep-2") || activeUser.includes("rep 2") || activeUser === "user-rep-2") {
    return ["Lorry B"];
  }
  return ORDER_LORRIES;
};

export const CHART_OF_ACCOUNTS = {
  "Operating Expenses": {
    "Vehicle Expenses": ["Lorry Fuel", "Maintenance & Repairs", "Insurance", "Licensing", "Tolls/Parking"],
    "Office Expenses": ["Rent", "Electricity", "Water", "Internet & Phone", "Office Supplies"],
    "Meals & Entertainment": ["Staff Meals", "Client Meetings"]
  },
  "Marketing & Promotions": {
    "Advertising": ["Print Media", "Digital Ads"],
    "Promotions": ["Event Sponsorship", "Customer Gifts"]
  },
  "Financial & Professional": {
    "Fees": ["Bank Charges", "Accounting/Audit Fees", "Legal Fees"],
    "Taxes": ["Local Taxes", "Income Tax"]
  },
  "Payroll & Staff": {
    "Salaries": ["Staff Salary"],
    "Advances": ["Staff Advance"]
  },
  "Miscellaneous": {
    "Other": ["General Expense"]
  }
};
export const BUSINESS_TIME_ZONE = "Asia/Colombo";
export const colomboDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
export const colomboTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});
export const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export const BUNDLE_BY_SIZE_ML = {
  180: 24,
  200: 24,
  250: 30,
  300: 24,
  400: 24,
  1000: 12,
  1500: 12,
  1800: 6,
  2000: 9
};
export const BASE_LORRIES = ["Lorry A", "Lorry B"];
export const ORDER_LORRIES = ["Lorry A", "Lorry A Overflow", "Lorry B", "Lorry B Overflow"];
export const LOADING_PANEL_CONFIG = [
  { name: "Lorry A", sortKey: "loadingA", className: "loading-lorry-a" },
  { name: "Lorry A Overflow", sortKey: "loadingAOverflow", className: "loading-lorry-a loading-lorry-overflow" },
  { name: "Lorry B", sortKey: "loadingB", className: "loading-lorry-b" },
  { name: "Lorry B Overflow", sortKey: "loadingBOverflow", className: "loading-lorry-b loading-lorry-overflow" }
];
export const buildLoadingMarkKey = ({ lorry, rowKey, dateFrom, timeFrom, dateTo, timeTo }) => [
  String(lorry || "").trim(),
  String(rowKey || "").trim(),
  String(dateFrom || "").trim(),
  String(timeFrom || "").trim(),
  String(dateTo || "").trim(),
  String(timeTo || "").trim()
].join("|");

export const extractSizeMl = (value = "") => {
  const raw = String(value || "").toLowerCase().replace(/\s+/g, "");
  const match = raw.match(/(\d{3,4})ml/);
  return match ? Number(match[1]) : 0;
};

export const getBundleSize = () => 0;
export const getBundleBreakdown = (row) => ({ bundles: 0, singles: Number(row?.qty || 0) });
export const bundleRuleLabel = () => "";
export const findBundleDiscountViolation = () => null;

export const productDisplayName = (product) => {
  const name = String(product?.name || "").trim();
  const size = String(product?.size || "").trim();
  return size ? `${name} ${size}` : name;
};
export const toColomboDateKey = (value = new Date()) => {
  try {
    return colomboDateFormatter.format(new Date(value));
  } catch {
    return "";
  }
};
export const toColomboTimeKey = (value = new Date()) => {
  try {
    return colomboTimeFormatter.format(new Date(value));
  } catch {
    return "";
  }
};
export const isChequePaymentPending = (payment, referenceDate = new Date()) => {
  if (String(payment?.method || "").toLowerCase() !== "cheque") return false;
  const chequeDateKey = toColomboDateKey(payment?.chequeDate);
  if (!chequeDateKey) return false;
  const todayKey = toColomboDateKey(referenceDate);
  if (!todayKey) return false;
  return chequeDateKey > todayKey;
};
export const scrollViewportToTop = () => {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};
export const startOfLocalDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
export const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};
export const customerOutstandingAging = (sale) => {
  if (!sale) return { daysLeft: null, label: "-" };
  const rawDue = String(sale.creditDueDate || "").trim();
  const dueDate = rawDue ? startOfLocalDay(rawDue) : startOfLocalDay(addDays(sale.createdAt || new Date().toISOString(), 15));
  const today = startOfLocalDay();
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  if (diffDays >= 0) {
    return { daysLeft: diffDays, label: `${diffDays} days left` };
  }
  return { daysLeft: diffDays, label: `Overdue by ${Math.abs(diffDays)} days` };
};
export const productSalePrice = (product) => Number(product?.billingPrice ?? product?.price ?? product?.mrp ?? 0);
export const lineBasePrice = (line) => Number(line?.basePrice ?? line?.price ?? 0);
export const lineStoredDiscountAmount = (line) => {
  const base = lineBasePrice(line);
  const explicitAmount = Number(line?.itemDiscountAmount || 0);
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) return Math.min(base, explicitAmount);
  const storedPrice = Number(line?.price);
  if (Number.isFinite(storedPrice) && base > 0 && storedPrice >= 0 && storedPrice < base) {
    return Number((base - storedPrice).toFixed(2));
  }
  return 0;
};
export const lineItemDiscount = (line) => {
  const raw = Number(line?.itemDiscount || 0);
  const base = lineBasePrice(line);
  const storedAmount = lineStoredDiscountAmount(line);
  if (storedAmount > 0) return storedAmount;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (String(line?.itemDiscountMode || "amount") === "percent") {
    const percent = Math.min(raw, 100);
    return Number(((base * percent) / 100).toFixed(2));
  }
  return Math.min(raw, base);
};
export const lineFinalPrice = (line) => Math.max(0, lineBasePrice(line) - Math.max(0, lineItemDiscount(line)));
export const editableLineDiscountValue = (line) => {
  const base = lineBasePrice(line);
  const mode = String(line?.itemDiscountMode || "amount");
  const raw = Number(line?.itemDiscount || 0);
  const applied = lineStoredDiscountAmount(line);
  if (mode === "percent") {
    if (applied > 0 && base > 0) return Number(((applied / base) * 100).toFixed(2));
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(raw, 100);
  }
  if (applied > 0) return applied;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, base);
};
export const billDiscountValue = (discountMode, discountValue, lines) => {
  const raw = Number(discountValue || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const subTotal = Number((lines || []).reduce((acc, line) => acc + (Number(line.price || 0) * Number(line.quantity || 0)), 0).toFixed(2));
  if (String(discountMode || "amount") === "percent") {
    const clamped = Math.min(raw, 100);
    return Number(((subTotal * clamped) / 100).toFixed(2));
  }
  return Number(raw.toFixed(2));
};
export const totalDiscountApplied = ({ lines = [], billDiscount = 0 }) => {
  const lineDiscountTotal = Number((lines || []).reduce((acc, line) => {
    const qty = Number(line?.quantity || 0);
    return acc + (lineItemDiscount(line) * Math.max(0, qty));
  }, 0).toFixed(2));
  return Number((lineDiscountTotal + Math.max(0, Number(billDiscount || 0))).toFixed(2));
};
export const salePayments = (sale) => {
  const explicit = Array.isArray(sale?.payments) ? sale.payments : [];
  if (explicit.length) return explicit;
  const migrated = [];
  if (Number(sale?.cashReceived || 0) > 0) {
    migrated.push({
      id: `legacy-cash-${sale?.id || "sale"}`,
      method: "cash",
      amount: Number(sale.cashReceived || 0),
      createdAt: sale?.deliveryConfirmedAt || sale?.createdAt || new Date().toISOString(),
      receivedBy: sale?.deliveryConfirmedBy || sale?.cashier || "-"
    });
  }
  if (Number(sale?.chequeAmount || 0) > 0) {
    migrated.push({
      id: `legacy-cheque-${sale?.id || "sale"}`,
      method: "cheque",
      amount: Number(sale.chequeAmount || 0),
      chequeNo: sale?.chequeNo || "",
      chequeDate: sale?.chequeDate || "",
      chequeBank: sale?.chequeBank || "",
      createdAt: sale?.deliveryConfirmedAt || sale?.createdAt || new Date().toISOString(),
      receivedBy: sale?.deliveryConfirmedBy || sale?.cashier || "-"
    });
  }
  return migrated;
};
export const getSalePaymentBreakdown = (sale) => {
  const net = saleNetTotal(sale);
  const payments = salePayments(sale);
  let cash = 0;
  let cheque = 0;

  for (const p of payments) {
    const m = String(p.method || "").toLowerCase();
    const amt = Number(p.amount || 0);
    if (m === "cash") cash += amt;
    else if (m === "cheque") cheque += amt;
  }

  const pType = String(sale?.paymentType || "").toLowerCase();
  if (cash === 0 && cheque === 0) {
    if (pType === "cash") {
      cash = net;
    } else if (pType === "cheque") {
      cheque = net;
    }
  }

  const paid = Number((cash + cheque).toFixed(2));
  const credit = Math.max(0, Number((net - paid).toFixed(2)));

  return {
    net: Number(net.toFixed(2)),
    cash: Number(Math.min(net, cash).toFixed(2)),
    cheque: Number(Math.min(net, cheque).toFixed(2)),
    credit: Number(credit.toFixed(2))
  };
};
export const saleDisplayPaymentInfo = (sale) => {
  const payments = salePayments(sale).filter((payment) => Number(payment.amount || 0) > 0);
  const methods = [...new Set(payments.map((payment) => String(payment.method || "").toLowerCase()).filter(Boolean))];
  if (!methods.length) {
    const fallbackType = String(sale?.paymentType || "").trim().toLowerCase();
    return {
      label: String(sale?.paymentType || "").toUpperCase() || "-",
      detail: fallbackType === "credit" && sale?.creditDueDate ? `DUE ${sale.creditDueDate}` : ""
    };
  }
  if (methods.length === 1) {
    const method = methods[0];
    if (method === "cheque") {
      const latestCheque = [...payments].reverse().find((payment) => String(payment.method || "").toLowerCase() === "cheque");
      const detailParts = [];
      if (latestCheque?.chequeDate) detailParts.push(`DATE ${latestCheque.chequeDate}`);
      if (latestCheque?.chequeNo) detailParts.push(`NO ${latestCheque.chequeNo}`);
      return {
        label: "CHEQUE",
        detail: detailParts.join(" • ")
      };
    }
    if (method === "customer_credit") {
      return {
        label: "CUSTOMER CREDIT",
        detail: ""
      };
    }
    return {
      label: method.toUpperCase(),
      detail: ""
    };
  }
  return {
    label: "MIXED",
    detail: methods.map((method) => method === "customer_credit" ? "CUSTOMER CREDIT" : method.toUpperCase()).join(" + ")
  };
};
export const returnLinePreview = (sale, line, quantity = 0) => {
  const qty = Number(quantity || 0);
  const soldQty = Number(line?.quantity || 0);
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(soldQty) || soldQty <= 0) {
    return { grossAmount: 0, billDiscountShare: 0, returnAmount: 0, unitAmount: 0 };
  }
  const soldUnitPrice = Number(line?.price || 0);
  const grossAmount = Number((soldUnitPrice * qty).toFixed(2));
  const saleSubTotal = Number(sale?.subTotal || 0);
  const billDiscountShare = saleSubTotal > 0
    ? Number((Number(sale?.discountAmount || sale?.discount || 0) * (grossAmount / saleSubTotal)).toFixed(2))
    : 0;
  const returnAmount = Number(Math.max(0, grossAmount - billDiscountShare).toFixed(2));
  return {
    grossAmount,
    billDiscountShare,
    returnAmount,
    unitAmount: qty > 0 ? Number((returnAmount / qty).toFixed(2)) : 0
  };
};
export const deliveryAdjustmentAmount = (sale, draft = {}) => {
  if (!sale) return 0;
  const qtyByProduct = new Map();
  for (const adj of (sale.deliveryAdjustments || [])) {
    for (const line of (adj.lines || [])) {
      const key = String(line.productId || "").trim();
      if (!key) continue;
      qtyByProduct.set(key, Number(qtyByProduct.get(key) || 0) + Number(line.quantity || 0));
    }
  }
  Object.entries(draft || {}).forEach(([productId, quantity]) => {
    const key = String(productId || "").trim();
    if (!key) return;
    const qty = Number(quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) return;
    qtyByProduct.set(key, Number(qtyByProduct.get(key) || 0) + qty);
  });

  let total = 0;
  for (const line of (sale.lines || [])) {
    const key = String(line.productId || "").trim();
    if (!key) continue;
    const soldQty = Number(line.quantity || 0);
    const undeliveredQty = Math.min(soldQty, Number(qtyByProduct.get(key) || 0));
    if (undeliveredQty <= 0) continue;
    total += Number(returnLinePreview(sale, line, undeliveredQty).returnAmount || 0);
  }
  return Number(total.toFixed(2));
};
export const saleUndeliveredQtyByProduct = (sale) => {
  const map = new Map();
  for (const adjustment of (sale?.deliveryAdjustments || [])) {
    for (const line of (adjustment.lines || [])) {
      const key = String(line.productId || "").trim();
      if (!key) continue;
      map.set(key, Number(map.get(key) || 0) + Number(line.quantity || 0));
    }
  }
  return map;
};
export const saleReturnedQtyByProduct = (sale, returns = []) => {
  const map = new Map();
  for (const entry of (returns || [])) {
    if (String(entry.saleId || "") !== String(sale?.id || "")) continue;
    for (const line of (entry.lines || [])) {
      if (line.condition !== "good") continue;
      const key = String(line.productId || "").trim();
      if (!key) continue;
      map.set(key, Number(map.get(key) || 0) + Number(line.quantity || 0));
    }
  }
  return map;
};
export const saleLineRevenueForQty = (sale, line, quantity = 0) => {
  const qty = Math.max(0, Number(quantity || 0));
  const unitPrice = Number(line?.price || 0);
  const grossAmount = Number((unitPrice * qty).toFixed(2));
  const saleSubTotal = Number(sale?.subTotal || 0);
  const billDiscountShare = saleSubTotal > 0
    ? Number((Number(sale?.discountAmount || sale?.discount || 0) * (grossAmount / saleSubTotal)).toFixed(2))
    : 0;
  return Math.max(0, Number((grossAmount - billDiscountShare).toFixed(2)));
};
export const effectiveSaleLineState = (sale, line, { returnedByProduct = new Map(), undeliveredByProduct = new Map() } = {}) => {
  const orderedQty = Number(line?.quantity || 0);
  const undeliveredQty = Math.min(orderedQty, Number(undeliveredByProduct.get(String(line?.productId || "")) || 0));
  const soldQty = Math.max(0, orderedQty - undeliveredQty);
  const returnedQty = Math.min(soldQty, Number(returnedByProduct.get(String(line?.productId || "")) || 0));
  const effectiveQty = Math.max(0, soldQty - returnedQty);
  const unitPrice = Number(line?.price || 0);
  const grossEffective = Number((unitPrice * effectiveQty).toFixed(2));
  const billDiscountShare = Number((grossEffective - saleLineRevenueForQty(sale, line, effectiveQty)).toFixed(2));
  const effectiveRevenue = saleLineRevenueForQty(sale, line, effectiveQty);
  return {
    orderedQty,
    undeliveredQty,
    soldQty,
    returnedQty,
    effectiveQty,
    unitPrice,
    billDiscountShare,
    effectiveRevenue
  };
};
export const saleNetTotal = (sale) => Number(
  Math.max(
    0,
    Number(
      sale?.netTotalAfterReturns
      ?? (Number(sale?.total || 0) - Number(sale?.returnedAmount || 0) - Number(sale?.undeliveredAmount || 0))
    )
  )
    .toFixed(2)
);
export const saleCustomerCreditApplied = (sale) => Number(
  salePayments(sale)
    .filter((payment) => String(payment.method || "").toLowerCase() === "customer_credit")
    .reduce((acc, payment) => acc + Number(payment.amount || 0), 0)
    .toFixed(2)
);
// Buckets a whole bill into cash / cheque / credit for the bottle-payment report.
// A bill sold on credit that's still outstanding stays "credit". Once it's fully
// settled, it moves to whichever method (cash or cheque) paid the larger share -
// mixed cash+cheque settlements aren't split per-bill, the dominant method wins.
export const saleBottlePaymentBucket = (sale) => {
  const paymentType = String(sale?.paymentType || "").trim().toLowerCase();
  if (paymentType === "cash") return "cash";
  if (paymentType === "cheque") return "cheque";
  const outstanding = Number(sale?.outstandingAmount || 0);
  if (outstanding > 0.009) return "credit";
  const payments = salePayments(sale).filter((payment) => Number(payment.amount || 0) > 0);
  const cashTotal = payments
    .filter((payment) => String(payment.method || "").toLowerCase() === "cash")
    .reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
  const chequeTotal = payments
    .filter((payment) => String(payment.method || "").toLowerCase() === "cheque")
    .reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
  if (cashTotal === 0 && chequeTotal === 0) return "credit";
  return chequeTotal > cashTotal ? "cheque" : "cash";
};
export const localDateKey = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
export const inDateRange = (iso, from, to) => {
  const day = toColomboDateKey(iso);
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
};
export const matchesSearch = (term, ...values) => {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
};

export const normalizeRepKey = (val) => String(val || "").trim().toLowerCase().replace(/[\s\-_]+/g, "");

export const isSameRep = (saleCashier, currentCashier, userObj) => {
  if (!saleCashier) return false;
  const sNorm = normalizeRepKey(saleCashier);
  if (!sNorm) return false;
  
  if (currentCashier) {
    const cNorm = normalizeRepKey(currentCashier);
    if (cNorm && sNorm === cNorm) return true;
  }
  
  if (userObj) {
    if (userObj.username && sNorm === normalizeRepKey(userObj.username)) return true;
    if (userObj.name && sNorm === normalizeRepKey(userObj.name)) return true;
    if (userObj.id) {
      const idNorm = normalizeRepKey(userObj.id);
      if (sNorm === idNorm || sNorm === idNorm.replace(/^user/, "")) return true;
    }
  }

  return false;
};

export const openPayslipPrint = ({ entry, staff }) => {
  if (typeof window === "undefined" || !entry || !staff) return;
  const toMoney = (value) => formatLkrValue(value);
  
  const entryDate = new Date(entry.date);
  const monthName = entryDate.toLocaleString('default', { month: 'long', year: 'numeric' });


  const escapeHtml = (unsafe) => {
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const receiptHtml = `<!DOCTYPE html><html><head><title>Payslip</title>
<style>
@media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 0; } }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #111; line-height: 1.4; max-width: 80mm; margin: 0 auto; padding: 12px; }
.center { text-align: center; }
.title { font-weight: 900; font-size: 18px; text-transform: uppercase; line-height: 1.15; }
.tag { display: inline-block; margin-top: 4px; padding: 2px 10px; border: 1px solid #111; border-radius: 999px; font-weight: 800; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
.meta { margin-top: 10px; font-size: 14px; line-height: 1.5; border-top: 1px dashed #111; border-bottom: 1px dashed #111; padding: 6px 0; }
.totals-grid { margin-top: 12px; }
.summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
.summary-row.is-deduction { color: #d32f2f; }
.summary-total { margin-top: 8px; display: flex; justify-content: space-between; font-weight: 900; font-size: 17px; border-top: 1px solid #111; padding-top: 6px; }
.sign-box { margin-top: 36px; display: flex; justify-content: space-between; }
.sign-col { width: 45%; text-align: center; }
.sign-line { border-bottom: 1px dotted #111; height: 20px; margin-bottom: 4px; }
.sign-label { font-size: 12px; font-weight: 600; }
.powered { text-align: center; font-size: 11px; margin-top: 24px; color: #444; }
</style></head><body><div class="sheet">
<div class="center"><div class="title">Lucky Distributor</div><div class="tag">Payslip</div></div>
<div class="meta">
Staff Name: ${escapeHtml(staff.name)}<br/>
Role: ${escapeHtml(staff.role || "Staff")}<br/>
Date: ${escapeHtml(entry.date)}<br/>
Period: ${escapeHtml(monthName)}
</div>
<div class="totals-grid">
<div class="summary-row"><span>Base Salary</span><strong>LKR ${toMoney(staff.monthlySalary || 0)}</strong></div>
<div class="summary-row is-deduction"><span>Advances</span><strong>- LKR ${toMoney((staff.monthlySalary || 0) - entry.amount)}</strong></div>
<div class="summary-total"><span>Net Pay</span><span>LKR ${toMoney(entry.amount)}</span></div>
</div>
<div class="sign-box"><div class="sign-col"><div class="sign-line"></div><div class="sign-label">Employer Sign</div></div><div class="sign-col"><div class="sign-line"></div><div class="sign-label">Staff Sign</div></div></div>
<div class="powered">Powered By J&amp;Co.</div>
</div></body></html>`;

  executeHtmlPrint(receiptHtml);
};

export const openSaleReceiptPrint = ({
  sale,
  customers = [],
  products = [],
  allSales = [],
  fallbackCustomerName = "",
  onPopupBlocked = () => { },
  returnByProduct = new Map(),
  undeliveredByProduct = new Map(),
  returnedAmountOverride = null,
  totalOverride = null,
  existingPrintWindow = null
}) => {
  if (typeof window === "undefined" || !sale) return;
  const toMoney = (value) => formatLkrValue(value);
  const saleDate = new Date(sale?.createdAt || Date.now());
  const dateLabel = Number.isNaN(saleDate.getTime())
    ? ""
    : `${String(saleDate.getDate()).padStart(2, "0")}/${String(saleDate.getMonth() + 1).padStart(2, "0")}/${saleDate.getFullYear()}`;

  const pickedCustomer = String(sale?.customerName || fallbackCustomerName || "Walk-in").trim() || "Walk-in";
  const customer = (customers || []).find(
    (row) => String(row?.name || "").trim().toLowerCase() === pickedCustomer.toLowerCase()
  );
  const printedCustomerPhone = String(sale?.customerPhone || customer?.phone || "-").trim() || "-";

  const baseLines = Array.isArray(sale?.lines) ? sale.lines : [];
  const rawBillDiscount = Number(sale?.discountAmount || sale?.discount || 0);
  const returnedAmount = Number(
    returnedAmountOverride !== null && returnedAmountOverride !== undefined
      ? returnedAmountOverride
      : sale?.returnedAmount || 0
  );
  const undeliveredAmount = Number(sale?.undeliveredAmount || 0);
  const hasAdjustedLines = returnedAmount > 0 || undeliveredAmount > 0;
  const lines = baseLines.map((line) => {
    const returned = returnByProduct?.get?.(String(line?.productId || "")) || { qty: 0, amount: 0 };
    const originalQty = Number(line?.quantity || 0);
    const undeliveredQty = Number(undeliveredByProduct?.get?.(String(line?.productId || "")) || 0);
    const soldAfterDelivery = Math.max(0, originalQty - undeliveredQty);
    const qty = Math.max(0, soldAfterDelivery - Number(returned.qty || 0));
    const product = (products || []).find((p) => p.id === line?.productId);
    const billingPrice = Number(line?.basePrice ?? line?.price ?? product?.billingPrice ?? product?.price ?? 0);
    const mrp = Number(product?.mrp ?? product?.price ?? line?.price ?? 0);
    const itemDiscount = lineItemDiscount(line);
    const netUnit = Math.max(0, Number(line?.price ?? (billingPrice - itemDiscount)));
    const sku = line?.sku || product?.sku || "";
    const saleSubTotal = Number(sale?.subTotal || 0);
    const grossRemaining = Number((netUnit * qty).toFixed(2));
    const remainingBillDiscountShare = saleSubTotal > 0
      ? Number((rawBillDiscount * (grossRemaining / saleSubTotal)).toFixed(2))
      : 0;
    const adjustedTotal = Math.max(0, Number((grossRemaining - remainingBillDiscountShare).toFixed(2)));
    const rowTotal = hasAdjustedLines ? adjustedTotal : grossRemaining;
    const bundleSource = product || line;
    const bundleSize = getBundleSize(bundleSource);
    const bundles = bundleSize ? Math.floor(qty / bundleSize) : 0;
    const singles = bundleSize ? qty % bundleSize : qty;
    return {
      name: line?.name || product?.name || "",
      sku,
      qty,
      billingPrice,
      mrp,
      itemDiscount,
      billDiscountShare: remainingBillDiscountShare,
      total: rowTotal,
      adjustedTotal,
      grossRemaining,
      undeliveredQty,
      returnedQty: Number(returned.qty || 0),
      returnedAmount: Number(returned.amount || 0),
      originalQty,
      bundles,
      singles,
      bundleSize,
      bundleRule: bundleRuleLabel(bundleSource)
    };
  }).filter((line) => line.qty > 0 || line.total > 0);

  const printedTotal = Number(
    totalOverride !== null && totalOverride !== undefined
      ? totalOverride
      : saleNetTotal(sale)
  );
  const customerCreditApplied = saleCustomerCreditApplied(sale);
  const paymentDisplay = saleDisplayPaymentInfo(sale);
  const lineSubtotal = Number(lines.reduce((acc, line) => acc + Number(line.grossRemaining || 0), 0).toFixed(2));
  const effectiveBillDiscount = hasAdjustedLines
    ? Number(lines.reduce((acc, line) => acc + Number(line.billDiscountShare || 0), 0).toFixed(2))
    : rawBillDiscount;
  const summaryRows = [
    { label: "Line Subtotal", value: lineSubtotal },
    ...(effectiveBillDiscount > 0 ? [{ label: "Bill Discount", value: -effectiveBillDiscount, tone: "deduction" }] : []),
    ...(undeliveredAmount > 0 ? [{ label: "Not Delivered", value: -undeliveredAmount, tone: "deduction" }] : []),
    ...(returnedAmount > 0 ? [{ label: "Returns", value: -returnedAmount, tone: "deduction" }] : []),
    ...(customerCreditApplied > 0 ? [{ label: "Customer Credit", value: -customerCreditApplied, tone: "deduction" }] : [])
  ];

  const rowsHtml = lines
    .map((line) => {
      const extraNotes = [];
      if (line.undeliveredQty > 0) extraNotes.push(`Not Delivered ${line.undeliveredQty}`);
      if (line.returnedQty > 0) extraNotes.push(`Returned ${line.returnedQty}`);
      if (hasAdjustedLines && line.billDiscountShare > 0) extraNotes.push(`Bill disc. ${toMoney(line.billDiscountShare)}`);
      if (hasAdjustedLines && line.returnedAmount > 0) extraNotes.push(`- ${toMoney(line.returnedAmount)}`);

      const notesHtml = extraNotes.length > 0 ? `<div class="return-print-note">${extraNotes.join(' | ')}</div>` : "";
      const qtyStr = line.bundleSize > 0 ? `${line.bundles}B ${line.singles}S` : `${line.singles}`;

      return `<tr><td colspan="4" class="item-name">${escapeHtml(line.name || line.sku)} ${notesHtml}</td></tr>
<tr><td class="c">${qtyStr}</td><td class="r">${toMoney(line.billingPrice)}</td><td class="r">${toMoney(line.mrp)}</td><td class="r">${toMoney(line.total)}</td></tr>`;
    })
    .join("");
  const summaryRowsHtml = summaryRows
    .map((row) => `<div class="summary-row ${row.tone === "deduction" ? "is-deduction" : ""}"><span>${escapeHtml(row.label)}</span><strong>${row.value < 0 ? "- " : ""}LKR ${toMoney(Math.abs(row.value))}</strong></div>`)
    .join("");
  const bundleGuideText = [...new Set(lines.map((line) => String(line.bundleRule || "").trim()).filter(Boolean))].join(" | ");

  const billEmptyOwed = Number(sale?.emptyBottlesOwed || 0);
  const billEmptyCollected = Number(sale?.emptyBottlesCollected || 0);
  let remainingCollection = billEmptyCollected;

  const thisBillCleared = Math.min(billEmptyOwed, remainingCollection);
  const billEmptyOutstanding = billEmptyOwed - thisBillCleared;
  remainingCollection -= thisBillCleared;

  let customerEmptyOwed = 0;
  let customerEmptyCollected = 0;
  if (Array.isArray(allSales) && allSales.length > 0 && pickedCustomer && pickedCustomer !== "Walk-in") {
    for (const s of allSales) {
      if (String(s?.customerName || "").trim().toLowerCase() === pickedCustomer.toLowerCase()) {
        if (String(s.id) !== String(sale.id)) {
          customerEmptyOwed += Number(s.emptyBottlesOwed || 0);
          customerEmptyCollected += Number(s.emptyBottlesCollected || 0);
        }
      }
    }
  }

  let openingOwed = 0;
  let openingCollected = 0;
  if (customer) {
    openingOwed = Number(customer?.openingEmptyBottles || 0);
    openingCollected = Number(customer?.collectedOpeningEmptyBottles || 0);
  }

  const prevCustomerOutstanding = Math.max(0, customerEmptyOwed - customerEmptyCollected) + Math.max(0, openingOwed - openingCollected);
  const customerCleared = Math.min(prevCustomerOutstanding, remainingCollection);
  const customerEmptyOutstanding = prevCustomerOutstanding - customerCleared;

  const totalEmptiesToCollect = billEmptyOutstanding + customerEmptyOutstanding;

  const paymentsList = salePayments(sale);
  const totalPaid = Number(paymentsList.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2));
  const remainingBalance = Math.max(0, Number((printedTotal - totalPaid).toFixed(2)));

  const paymentsBreakdownHtml = paymentsList.length > 0 ? `
<div class="payments-history-block" style="margin-top: 8px; border-top: 1.5px solid #000; padding-top: 5px;">
  <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.04em; color: #000;">PAYMENT SETTLEMENT HISTORY</div>
  ${paymentsList.map((p, index) => {
    const termLabel = paymentsList.length > 1
      ? `${index + 1}${index === 0 ? "st" : (index === 1 ? "nd" : (index === 2 ? "rd" : "th"))} Payment`
      : "Payment";
    const methodStr = String(p.method || "").toUpperCase();
    const dateObj = p.createdAt ? new Date(p.createdAt) : null;
    const dateStr = dateObj && !isNaN(dateObj.getTime())
      ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`
      : "";
    const detailStr = p.chequeNo ? ` [Chq #${escapeHtml(p.chequeNo)}${p.chequeBank ? " " + escapeHtml(p.chequeBank) : ""}]` : "";
    return `
      <div class="summary-row" style="font-size: 10.5px; padding: 2px 0;">
        <span><b>${termLabel}:</b> ${escapeHtml(methodStr)}${detailStr}${dateStr ? " (" + dateStr + ")" : ""}</span>
        <span class="mono" style="font-weight: 700;">LKR ${toMoney(p.amount)}</span>
      </div>
    `;
  }).join("")}
  <div class="summary-row" style="font-size: 11px; font-weight: 800; border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
    <span>TOTAL PAID SO FAR</span>
    <span class="mono" style="font-weight: 800;">LKR ${toMoney(totalPaid)}</span>
  </div>
  <div class="summary-row" style="font-size: 11.5px; font-weight: 900; color: #000; border: 2px solid #000; padding: 3px 6px; border-radius: 3px; margin-top: 4px;">
    <span>${remainingBalance <= 0 ? "STATUS: FULLY SETTLED" : "REMAINING BALANCE DUE"}</span>
    <span class="mono" style="font-weight: 900; font-size: 13px;">LKR ${toMoney(remainingBalance)}</span>
  </div>
</div>
` : `
<div class="payments-history-block" style="margin-top: 8px; border-top: 1.5px solid #000; padding-top: 5px;">
  <div class="summary-row" style="font-size: 11.5px; font-weight: 900; color: #000; border: 2px solid #000; padding: 3px 6px; border-radius: 3px; margin-top: 4px;">
    <span>REMAINING BALANCE DUE</span>
    <span class="mono" style="font-weight: 900; font-size: 13px;">LKR ${toMoney(printedTotal)}</span>
  </div>
</div>
`;

  const emptySummaryHtml = `
<div class="empty-summary"><div class="empty-title">Empty Bottles Summary</div>
<div class="summary-row"><span>Collected</span><span>${billEmptyCollected}</span></div>
<div class="summary-row"><span>This Bill Pending</span><span>${billEmptyOutstanding}</span></div>
<div class="summary-row"><span>Customer Outstanding</span><span>${customerEmptyOutstanding}</span></div>
<div class="summary-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dotted #111; font-weight: 800;"><span>Total to Collect</span><span>${totalEmptiesToCollect}</span></div></div>
`;

  const receiptHtml = `<!doctype html><html><head><meta charset="utf-8" /><title>Receipt #${escapeHtml(sale.id)}</title><style>
@media print {
  .no-print { display: none !important; }
  @page { size: 80mm auto; margin: 2mm 3mm; }
  body { width: 100%; -webkit-print-color-adjust: exact; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #000; font-size: 11px; line-height: 1.35; background: #fff; }
.sheet { width: 100%; max-width: 76mm; margin: 0 auto; padding: 2px; }
.header-block { text-align: center; margin-bottom: 6px; }
.logo { max-width: 75px; height: auto; margin: 0 auto 3px auto; display: block; }
.brand-title { font-weight: 900; font-size: 13.5px; text-transform: uppercase; line-height: 1.15; letter-spacing: -0.01em; color: #000; }
.brand-sub { font-size: 9.5px; font-weight: 500; color: #222; margin-top: 2px; line-height: 1.25; }
.badge { display: inline-block; margin-top: 5px; padding: 2px 10px; border: 1.5px solid #000; border-radius: 4px; font-weight: 800; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; background: #fff; color: #000; }
.meta-box { margin-top: 8px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { padding: 1.5px 0; vertical-align: top; font-size: 11px; }
.meta-label { font-size: 10px; font-weight: 600; color: #333; text-transform: uppercase; white-space: nowrap; padding-right: 6px; }
.meta-val { font-size: 11px; font-weight: 700; color: #000; padding-right: 12px; word-break: break-word; }
table.items-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
table.items-table th { font-size: 9.5px; font-weight: 800; text-transform: uppercase; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 2px; letter-spacing: 0.04em; color: #000; }
table.items-table td { padding: 2.5px 2px; font-size: 11px; font-weight: 500; vertical-align: top; }
.item-row-name { font-size: 11.5px; font-weight: 700; color: #000; padding-top: 4px; }
.item-note { font-size: 9.5px; color: #444; font-weight: 600; margin-top: 1px; }
.c { text-align: center; } .r { text-align: right; }
.mono { font-family: "Courier New", Courier, monospace; font-size: 11px; font-weight: 600; }
.empty-summary { border: 1px dashed #000; border-radius: 4px; padding: 5px 8px; margin-top: 8px; }
.empty-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 3px; }
.summary-row { display: flex; justify-content: space-between; font-size: 10.5px; padding: 1.5px 0; font-weight: 500; }
.bundle-guide-line { margin-top: 8px; font-size: 10.5px; text-align: center; border: 1px solid #000; border-radius: 4px; padding: 4px; font-weight: 700; }
.totals-grid { border-top: 1.5px solid #000; margin-top: 8px; padding-top: 4px; }
.summary-total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 1.5px solid #000; border-bottom: 3px double #000; padding: 5px 0; margin-top: 4px; margin-bottom: 4px; }
.payment-highlight-badge { display: inline-block; padding: 2px 7px; border: 1.5px solid #000; border-radius: 4px; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; background: #000; color: #fff; }
.payment-banner-box { margin-top: 6px; padding: 5px 8px; border: 1.5px solid #000; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; background: #fff; }
.notes { margin-top: 10px; font-size: 9.5px; line-height: 1.35; font-weight: 500; text-align: center; color: #222; }
.footer-block { margin-top: 18px; page-break-inside: avoid !important; break-inside: avoid !important; }
.sign-box { display: flex; justify-content: space-between; }
.sign-col { width: 45%; text-align: center; }
.sign-line { border-bottom: 1.5px dashed #000; height: 18px; margin-bottom: 3px; }
.sign-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #000; }
.powered { text-align: center; font-size: 11px; margin-top: 10px; color: #000 !important; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; display: block; }
.feed-space { height: 25mm; display: block; clear: both; }
</style></head><body>
<div class="no-print" style="margin-bottom: 12px; display: flex; gap: 8px; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1;">
  <button onclick="window.close()" style="padding: 8px 16px; cursor: pointer; font-size: 13px; font-weight: bold; background: #f1f5f9; color: #334155; border: 1px solid #94a3b8; border-radius: 6px;">← Back / Close</button>
  <button onclick="window.print()" style="padding: 8px 16px; cursor: pointer; font-size: 13px; font-weight: bold; background: #2563eb; color: #fff; border: none; border-radius: 6px;">Print Receipt</button>
</div>
<div class="sheet">
<div class="header-block">
  <img src="/lucky-logo.png" class="logo" alt="Logo" />
  <div class="brand-title">LUCKY LANKA DISTRIBUTOR</div>
  <div class="brand-sub">Polonnaruwa • Tel: +94 74 014 2898, +94 27 205 4887</div>
  <div class="badge">ORIGINAL BILL</div>
</div>
<div class="meta-box">
  <table class="meta-table">
    <tr>
      <td class="meta-label">Customer</td><td class="meta-val">${escapeHtml(pickedCustomer)}</td>
      <td class="meta-label"></td><td class="meta-val">${escapeHtml(sale?.cashier || "-")}</td>
    </tr>
    <tr>
      <td class="meta-label">Date</td><td class="meta-val">${escapeHtml(dateLabel)}</td>
      <td class="meta-label"></td><td class="meta-val">${escapeHtml(sale?.lorry || "-")}</td>
    </tr>
    <tr>
      <td class="meta-label">Address</td><td class="meta-val">${escapeHtml(customer?.address || "-")}</td>
      <td class="meta-label"></td><td class="meta-val">#${escapeHtml(sale?.id || "-")}</td>
    </tr>
    <tr>
      <td class="meta-label">Tel</td><td class="meta-val">${escapeHtml(printedCustomerPhone)}</td>
      <td class="meta-label"></td><td class="meta-val"><span class="payment-highlight-badge" style="padding: 1px 4px; font-size: 9px; line-height: 1.1;">${escapeHtml(paymentDisplay.label)}${paymentDisplay.detail ? " (" + escapeHtml(paymentDisplay.detail) + ")" : ""}</span></td>
    </tr>
  </table>
</div>
<table class="items-table">
  <thead>
    <tr><th colspan="4" style="text-align: left;">Item Name</th></tr>
    <tr><th class="c">Qty</th><th class="r">Price</th><th class="r">MRP</th><th class="r">Total</th></tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>
${bundleGuideText ? '<div class="bundle-guide-line"><b>Bundle Count:</b> ' + escapeHtml(bundleGuideText) + '</div>' : ""}
${emptySummaryHtml}
<div class="totals-grid">
  ${summaryRowsHtml}
  <div class="summary-total"><span>TOTAL VALUE</span><span>LKR ${toMoney(printedTotal)}</span></div>

  ${paymentsBreakdownHtml}
</div>
<div class="footer-block">
  <div class="sign-box">
    <div class="sign-col"><div class="sign-line"></div><div class="sign-label">Customer Sign</div></div>
    <div class="sign-col"><div class="sign-line"></div><div class="sign-label">D.S.R Sign</div></div>
  </div>
  <div class="powered">POWERED BY J&amp;CO.</div>
  <div class="feed-space"></div>
</div>
</div></body></html>`;

  const launched = executeHtmlPrint(receiptHtml, existingPrintWindow);
  if (launched === null && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    onPopupBlocked();
  }
};

export const openPreOrderReceiptPrint = ({
  sale,
  customers = [],
  allSales = [],
  fallbackCustomerName = "",
  onPopupBlocked = () => { },
  existingPrintWindow = null
}) => {
  if (typeof window === "undefined" || !sale) return;
  const toMoney = (value) => formatLkrValue(value);
  const saleDate = new Date(sale?.createdAt || Date.now());
  const dateLabel = Number.isNaN(saleDate.getTime())
    ? ""
    : `${String(saleDate.getDate()).padStart(2, "0")}/${String(saleDate.getMonth() + 1).padStart(2, "0")}/${saleDate.getFullYear()}`;

  const pickedCustomer = String(sale?.customerName || fallbackCustomerName || "Walk-in").trim() || "Walk-in";
  const customer = (customers || []).find(
    (row) => String(row?.name || "").trim().toLowerCase() === pickedCustomer.toLowerCase()
  );
  const printedCustomerPhone = String(sale?.customerPhone || customer?.phone || "-").trim() || "-";

  const lines = Array.isArray(sale?.lines) ? sale.lines : [];
  const rowsHtml = lines.map((line) => {
    const qty = Number(line?.quantity || 0);
    const price = Number(line?.price ?? line?.basePrice ?? 0);
    const total = Number((price * qty).toFixed(2));
    return `<tr><td style="font-weight: 700;">${escapeHtml(line?.name || "")}</td><td class="c mono" style="font-weight: 700;">${qty}</td><td class="r mono">${toMoney(price)}</td><td class="r mono" style="font-weight: 700;">${toMoney(total)}</td></tr>`;
  }).join("");

  const printedTotal = Number(sale?.total || 0);
  let paymentDisplay = saleDisplayPaymentInfo(sale);

  const paymentsList = salePayments(sale);
  let totalPaid = Number(paymentsList.reduce((acc, p) => acc + Number(p.amount || 0), 0).toFixed(2));
  const remainingBalance = Math.max(0, Number((printedTotal - totalPaid).toFixed(2)));

  let paymentsBreakdownHtml = paymentsList.length > 0 ? `
<div class="payments-history-block" style="margin-top: 8px; border-top: 1.5px solid #000; padding-top: 5px;">
  <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.04em; color: #000;">PAYMENT SETTLEMENT HISTORY</div>
  ${paymentsList.map((p, index) => {
    const termLabel = paymentsList.length > 1
      ? `${index + 1}${index === 0 ? "st" : (index === 1 ? "nd" : (index === 2 ? "rd" : "th"))} Payment`
      : "Payment";
    const methodStr = String(p.method || "").toUpperCase();
    const dateObj = p.createdAt ? new Date(p.createdAt) : null;
    const dateStr = dateObj && !isNaN(dateObj.getTime())
      ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()}`
      : "";
    const detailStr = p.chequeNo ? ` [Chq #${escapeHtml(p.chequeNo)}${p.chequeBank ? " " + escapeHtml(p.chequeBank) : ""}]` : "";
    return `
      <div class="summary-row" style="font-size: 10.5px; padding: 2px 0;">
        <span><b>${termLabel}:</b> ${escapeHtml(methodStr)}${detailStr}${dateStr ? " (" + dateStr + ")" : ""}</span>
        <span class="mono" style="font-weight: 700;">LKR ${toMoney(p.amount)}</span>
      </div>
    `;
  }).join("")}
  <div class="summary-row" style="font-size: 11px; font-weight: 800; border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px;">
    <span>TOTAL PAID SO FAR</span>
    <span class="mono" style="font-weight: 800;">LKR ${toMoney(totalPaid)}</span>
  </div>
  <div class="summary-row" style="font-size: 11.5px; font-weight: 900; color: #000; border: 2px solid #000; padding: 3px 6px; border-radius: 3px; margin-top: 4px;">
    <span>${remainingBalance <= 0 ? "STATUS: FULLY SETTLED" : "REMAINING BALANCE DUE"}</span>
    <span class="mono" style="font-weight: 900; font-size: 13px;">LKR ${toMoney(remainingBalance)}</span>
  </div>
</div>
` : `
<div class="payments-history-block" style="margin-top: 8px; border-top: 1.5px solid #000; padding-top: 5px;">
  <div class="summary-row" style="font-size: 11.5px; font-weight: 900; color: #000; border: 2px solid #000; padding: 3px 6px; border-radius: 3px; margin-top: 4px;">
    <span>REMAINING BALANCE DUE</span>
    <span class="mono" style="font-weight: 900; font-size: 13px;">LKR ${toMoney(printedTotal)}</span>
  </div>
</div>
`;
  const billEmptyOwed = Number(sale?.emptyBottlesOwed || 0);
  const billEmptyCollected = Number(sale?.emptyBottlesCollected || 0);
  let remainingCollection = billEmptyCollected;
  const thisBillCleared = Math.min(billEmptyOwed, remainingCollection);
  const billEmptyOutstanding = billEmptyOwed - thisBillCleared;
  remainingCollection -= thisBillCleared;
  let customerEmptyOwed = 0;
  let customerEmptyCollected = 0;
  if (Array.isArray(allSales) && allSales.length > 0 && pickedCustomer && pickedCustomer !== "Walk-in") {
    for (const s of allSales) {
      if (String(s?.customerName || "").trim().toLowerCase() === pickedCustomer.toLowerCase()) {
        if (String(s.id) !== String(sale.id)) {
          customerEmptyOwed += Number(s.emptyBottlesOwed || 0);
          customerEmptyCollected += Number(s.emptyBottlesCollected || 0);
        }
      }
    }
  }
  let openingOwed = 0;
  let openingCollected = 0;
  if (customer) {
    openingOwed = Number(customer?.openingEmptyBottles || 0);
    openingCollected = Number(customer?.openingEmptyBottlesCollected || 0);
  }
  const pendingOpening = Math.max(0, openingOwed - openingCollected);
  const customerEmptyOutstanding = pendingOpening + (customerEmptyOwed - customerEmptyCollected) - remainingCollection;
  const totalEmptiesToCollect = billEmptyOutstanding + customerEmptyOutstanding;



  const emptySummaryHtml = (billEmptyOwed > 0 || billEmptyCollected > 0 || totalEmptiesToCollect > 0) ? `
<div class="empty-summary"><div class="empty-title">Empty Bottles Summary</div>
<div class="summary-row"><span>Collected</span><span>${billEmptyCollected}</span></div>
<div class="summary-row"><span>This Pre-Order Pending</span><span>${billEmptyOutstanding}</span></div>
<div class="summary-row"><span>Customer Outstanding</span><span>${customerEmptyOutstanding}</span></div>
<div class="summary-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px dotted #111; font-weight: 800;"><span>Total to Collect</span><span>${totalEmptiesToCollect}</span></div></div>
` : "";

  const receiptHtml = `<!doctype html><html><head><meta charset="utf-8" /><title>Pre-Order #${escapeHtml(sale.id)}</title><style>
@media print {
  .no-print { display: none !important; }
  @page { size: 80mm auto; margin: 2mm 3mm; }
  body { width: 100%; -webkit-print-color-adjust: exact; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #000; font-size: 11px; line-height: 1.35; background: #fff; }
.sheet { width: 100%; max-width: 76mm; margin: 0 auto; padding: 2px; }
.header-block { text-align: center; margin-bottom: 6px; }
.brand-title { font-weight: 900; font-size: 13.5px; text-transform: uppercase; line-height: 1.15; letter-spacing: -0.01em; color: #000; }
.brand-sub { font-size: 9.5px; font-weight: 500; color: #222; margin-top: 2px; line-height: 1.25; }
.badge { display: inline-block; margin-top: 5px; padding: 2px 10px; border: 1.5px solid #000; border-radius: 4px; font-weight: 800; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; background: #000; color: #fff; }
.meta-box { margin-top: 8px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { padding: 1.5px 0; vertical-align: top; font-size: 11px; }
.meta-label { font-size: 10px; font-weight: 600; color: #333; text-transform: uppercase; white-space: nowrap; padding-right: 6px; }
.meta-val { font-size: 11px; font-weight: 700; color: #000; padding-right: 12px; word-break: break-word; }
table.items-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
table.items-table th { font-size: 9.5px; font-weight: 800; text-transform: uppercase; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 2px; letter-spacing: 0.04em; color: #000; }
table.items-table td { padding: 2.5px 2px; font-size: 11px; font-weight: 500; vertical-align: top; }
.item-row-name { font-size: 11.5px; font-weight: 700; color: #000; padding-top: 4px; }
.c { text-align: center; } .r { text-align: right; }
.mono { font-family: "Courier New", Courier, monospace; font-size: 11px; font-weight: 600; }
.totals-grid { border-top: 1.5px solid #000; margin-top: 8px; padding-top: 4px; }
.summary-total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; border-top: 1.5px solid #000; border-bottom: 3px double #000; padding: 5px 0; margin-top: 4px; margin-bottom: 4px; }
.notes { font-size: 9px; text-align: center; margin-top: 8px; padding: 4px; background: #eee; border-radius: 4px; }
.footer-block { margin-top: 12px; }
.sign-box { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 15px; }
.sign-col { width: 45%; text-align: center; }
.sign-line { border-top: 1px dashed #000; height: 1px; width: 100%; margin-bottom: 3px; }
.sign-label { font-size: 9.5px; font-weight: 600; }
.powered { text-align: center; font-size: 8px; color: #555; margin-top: 15px; letter-spacing: 0.5px; border-top: 1px dotted #ccc; padding-top: 5px; }
.feed-space { height: 15px; }
</style></head><body><div class="sheet">
<div class="header-block">
  <div class="brand-title">LUCKY LANKA DISTRIBUTOR</div>
  <div class="brand-sub">Polonnaruwa • Tel: +94 74 014 2898, +94 27 205 4887</div>
  <div class="badge">PRE-ORDER CONFIRMATION</div>
</div>
<div class="meta-box">
  <table class="meta-table">
    <tr>
      <td class="meta-label">Customer</td><td class="meta-val">${escapeHtml(pickedCustomer)}</td>
      <td class="meta-label"></td><td class="meta-val">${escapeHtml(sale?.cashier || "-")}</td>
    </tr>
    <tr>
      <td class="meta-label">Date</td><td class="meta-val">${escapeHtml(dateLabel)}</td>
      <td class="meta-label"></td><td class="meta-val">${escapeHtml(sale?.lorry || "-")}</td>
    </tr>
    <tr>
      <td class="meta-label">Address</td><td class="meta-val">${escapeHtml(customer?.address || "-")}</td>
      <td class="meta-label"></td><td class="meta-val">#${escapeHtml(sale?.id || "-")}</td>
    </tr>
  </table>
</div>
<table class="items-table">
  <thead>
    <tr><th style="text-align: left; width: 45%;">Item Name</th><th class="c" style="width: 15%;">Qty</th><th class="r" style="width: 20%;">Price</th><th class="r" style="width: 20%;">Total</th></tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>
${emptySummaryHtml}
<div class="totals-grid">
  <div class="summary-total"><span>TOTAL PRE-ORDER</span><span>LKR ${toMoney(printedTotal)}</span></div>
  ${paymentsBreakdownHtml}
</div>
<div class="notes">This is a pre-order confirmation. Stock is reserved but not yet billed.<br/>Payment will be collected on delivery.</div>
<div class="footer-block">
  <div class="sign-box">
    <div class="sign-col"><div class="sign-line"></div><div class="sign-label">Customer Sign</div></div>
    <div class="sign-col"><div class="sign-line"></div><div class="sign-label">D.S.R Sign</div></div>
  </div>
  <div class="powered">POWERED BY J&amp;CO.</div>
  <div class="feed-space"></div>
</div>
</div></body></html>`;

  const launched = executeHtmlPrint(receiptHtml, existingPrintWindow);
  if (launched === null && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    onPopupBlocked();
  }
};










