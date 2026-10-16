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
import {
  usePagination,
  PaginatedList,
  PaginatedGridList,
  PaginatedTableBody,
  SaveButton,
  formatLkrValue,
  currency,
  SESSION_KEY,
  executeHtmlPrint,
  getDefaultLorryForUsername,
  getAllowedLorriesForUser,
  CHART_OF_ACCOUNTS,
  BUSINESS_TIME_ZONE,
  colomboDateFormatter,
  colomboTimeFormatter,
  escapeHtml,
  BUNDLE_BY_SIZE_ML,
  BASE_LORRIES,
  ORDER_LORRIES,
  LOADING_PANEL_CONFIG,
  buildLoadingMarkKey,
  extractSizeMl,
  getBundleSize,
  getBundleBreakdown,
  bundleRuleLabel,
  findBundleDiscountViolation,
  productDisplayName,
  toColomboDateKey,
  toColomboTimeKey,
  isChequePaymentPending,
  scrollViewportToTop,
  startOfLocalDay,
  addDays,
  customerOutstandingAging,
  productSalePrice,
  lineBasePrice,
  lineStoredDiscountAmount,
  lineItemDiscount,
  lineFinalPrice,
  editableLineDiscountValue,
  billDiscountValue,
  totalDiscountApplied,
  salePayments,
  getSalePaymentBreakdown,
  saleDisplayPaymentInfo,
  returnLinePreview,
  deliveryAdjustmentAmount,
  saleUndeliveredQtyByProduct,
  saleReturnedQtyByProduct,
  saleLineRevenueForQty,
  effectiveSaleLineState,
  saleNetTotal,
  saleCustomerCreditApplied,
  saleBottlePaymentBucket,
  localDateKey,
  inDateRange,
  matchesSearch,
  normalizeRepKey,
  isSameRep,
  openPayslipPrint,
  openSaleReceiptPrint,
  openPreOrderReceiptPrint
} from './utils.jsx';
export const REPORT_SUBPAGES = [
  { id: "item-wise", label: "Item Wise Report" },
  { id: "bottle-payment", label: "Bottle Payment Report" },
  { id: "sales-wise", label: "Sales Wise Report" },
  { id: "cheque-summary", label: "Cheque Summary" },
  { id: "customer-wise", label: "Customer Wise Report" },
  { id: "rep-outstanding", label: "Rep Wise Customer Outstanding" },
  { id: "delivery-report", label: "Delivery Report" },
  { id: "empty-bottle-log", label: "Empty Bottle Log" },
  { id: "collected-cash", label: "Collected Cash Report" },
  { id: "voided-bills", label: "Voided Bills" }
];

export const AdminView = ({ state: rawState, dashboard, message, onError, requestConfirm, onSaleDeleted, user }) => {
  const state = useMemo(() => {
    return {
      ...rawState,
      sales: (rawState.sales || []).filter(s => !(s.orderType === "preorder" && s.preOrderStatus === "pending"))
    };
  }, [rawState]);
  const allSalesIncludingPreorders = rawState.sales || [];
  const [showLowStock, setShowLowStock] = useState(false);
  const [showChequeAlertDetails, setShowChequeAlertDetails] = useState(false);
  const [showChequeSummaryDetails, setShowChequeSummaryDetails] = useState(false);
  const [showCreditLimitAlertDetails, setShowCreditLimitAlertDetails] = useState(false);
  const [selectedRep, setSelectedRep] = useState("");
  const [chartDateFrom, setChartDateFrom] = useState("");
  const [chartDateTo, setChartDateTo] = useState("");
  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [itemReportLorry, setItemReportLorry] = useState("all");
  const [itemDateFrom, setItemDateFrom] = useState("");
  const [itemDateTo, setItemDateTo] = useState("");
  const [bottleReportDateFrom, setBottleReportDateFrom] = useState("");
  const [bottleReportDateTo, setBottleReportDateTo] = useState("");
  const [bottleReportSearch, setBottleReportSearch] = useState("");
  const [salesDateFrom, setSalesDateFrom] = useState("");
  const [salesDateTo, setSalesDateTo] = useState("");
  const [salesTimeFrom, setSalesTimeFrom] = useState("");
  const [salesTimeTo, setSalesTimeTo] = useState("");
  const [loadingDateFrom, setLoadingDateFrom] = useState("");
  const [loadingDateTo, setLoadingDateTo] = useState("");
  const [loadingTimeFrom, setLoadingTimeFrom] = useState("");
  const [loadingTimeTo, setLoadingTimeTo] = useState("");
  const [customerReportSearch, setCustomerReportSearch] = useState("");
  const [customerPanelSearch, setCustomerPanelSearch] = useState("");
  const [customerRouteFilter, setCustomerRouteFilter] = useState("All");
  const [stockPanelSearch, setStockPanelSearch] = useState("");
  const [stockLogSearch, setStockLogSearch] = useState("");
  const [stockLogDateFrom, setStockLogDateFrom] = useState("");
  const [stockLogDateTo, setStockLogDateTo] = useState("");
  const [staffSearch, setStaffSearch] = useState("");
  const [deliveriesSearch, setDeliveriesSearch] = useState("");
  const [deliveredItemsSearch, setDeliveredItemsSearch] = useState("");
  const [itemWiseSearch, setItemWiseSearch] = useState("");
  const [salesWiseSearch, setSalesWiseSearch] = useState("");
  const [preordersSearch, setPreordersSearch] = useState("");
  const [salesWiseTypeFilter, setSalesWiseTypeFilter] = useState("All");
  const [salesWiseLorryFilter, setSalesWiseLorryFilter] = useState("All Lorries");
  const [customerWiseSearch, setCustomerWiseSearch] = useState("");
  const [repOutstandingSearch, setRepOutstandingSearch] = useState("");
  const [reportDeliverySearch, setReportDeliverySearch] = useState("");
  const [collectedCashSearch, setCollectedCashSearch] = useState("");
  const [collectedCashLorryFilter, setCollectedCashLorryFilter] = useState("All");
  const [selectedCustomerCashPopup, setSelectedCustomerCashPopup] = useState(null);
  const [customerCashPopupDateFrom, setCustomerCashPopupDateFrom] = useState("");
  const [customerCashPopupDateTo, setCustomerCashPopupDateTo] = useState("");
  const [collectedCashDateFrom, setCollectedCashDateFrom] = useState("");
  const [collectedCashDateTo, setCollectedCashDateTo] = useState("");
  const [loadingsSearch, setLoadingsSearch] = useState("");
  const [selectedLoadingPanel, setSelectedLoadingPanel] = useState(ORDER_LORRIES[0]);
  const [deliveryLorry, setDeliveryLorry] = useState("all");
  const [deliveryDateFrom, setDeliveryDateFrom] = useState("");
  const [deliveryDateTo, setDeliveryDateTo] = useState("");
  const [deliveryTimeFrom, setDeliveryTimeFrom] = useState("");
  const [deliveryTimeTo, setDeliveryTimeTo] = useState("");
  const [deliveriesView, setDeliveriesView] = useState("deliveries");
  const [deliveryReportDateFrom, setDeliveryReportDateFrom] = useState("");
  const [deliveryReportDateTo, setDeliveryReportDateTo] = useState("");
  const [dashboardProfitDateFrom, setDashboardProfitDateFrom] = useState("");
  const [dashboardProfitDateTo, setDashboardProfitDateTo] = useState("");
  const [reportDeliveryLorry, setReportDeliveryLorry] = useState("all");
  const [reportDeliveryDateFrom, setReportDeliveryDateFrom] = useState("");
  const [reportDeliveryDateTo, setReportDeliveryDateTo] = useState("");
  const [emptyBottleLogSearch, setEmptyBottleLogSearch] = useState("");
  const [emptyBottleLogRepFilter, setEmptyBottleLogRepFilter] = useState("");
  const [emptyBottleLogDateFrom, setEmptyBottleLogDateFrom] = useState("");
  const [emptyBottleLogDateTo, setEmptyBottleLogDateTo] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [accountingSearch, setAccountingSearch] = useState("");
  const [showAccountingForm, setShowAccountingForm] = useState(false);
  const [accountingForm, setAccountingForm] = useState({ id: "", type: "expense", category: "", amount: "", description: "", staffId: "", date: "", coaType: "Operating Expenses", coaGroup: "Vehicle Expenses", coaSub: "Lorry Fuel", sourceAccountId: "", destinationAccountId: "" });
  const [accountingDateFrom, setAccountingDateFrom] = useState("");
  const [accountingDateTo, setAccountingDateTo] = useState("");
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [payslipData, setPayslipData] = useState(null);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ id: "", name: "", type: "bank", initialBalance: "" });
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ id: "", name: "", company: "", phone: "", address: "" });
  const [showPurchasesModal, setShowPurchasesModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ id: "", supplierId: "", invoiceNo: "", date: "", dueDate: "", totalAmount: "", paidAmount: "", status: "unpaid" });
  const [notice, setNotice] = useState("");

  const [customerForm, setCustomerForm] = useState({ id: "", name: "", phone: "", address: "", route: "", openingOutstanding: "", creditLimit: "", discountLimit: "", outstandingAdjustment: "", outstandingAdjustmentReason: "", openingEmptyBottles: "", itemPrices: {} });
  const [staffForm, setStaffForm] = useState({ id: "", authUserId: "", name: "", role: "", phone: "", monthlySalary: "", username: "", password: "", authRole: "cashier" });
  const [stockMode, setStockMode] = useState("add");
  const [stockForm, setStockForm] = useState({ productId: "", quantity: "", stock: "", sku: "", invoicePrice: "", billingPrice: "", mrp: "" });
  const [stockSearch, setStockSearch] = useState("");
  const [showStockSuggestions, setShowStockSuggestions] = useState(false);
  const [newStockItemForm, setNewStockItemForm] = useState({ sku: "", category: "General", billingPrice: "", invoicePrice: "", mrp: "" });
  const stockFileRef = useRef(null);
  const customerFileRef = useRef(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState("");
  const [editingAdminSaleId, setEditingAdminSaleId] = useState("");
  const [adminSaleEditLines, setAdminSaleEditLines] = useState([]);
  const [adminSaleEditError, setAdminSaleEditError] = useState("");
  const [savingAdminSaleEdit, setSavingAdminSaleEdit] = useState(false);
  const [repOutstandingDetailRep, setRepOutstandingDetailRep] = useState("");
  const [viewSaleId, setViewSaleId] = useState("");
  const [customerDetailName, setCustomerDetailName] = useState("");
  const [deliverySaleId, setDeliverySaleId] = useState("");
  const [deliveryDraft, setDeliveryDraft] = useState({});
  const [deliveryCashReceived, setDeliveryCashReceived] = useState("");
  const [deliveryChequeAmount, setDeliveryChequeAmount] = useState("");
  const [deliveryChequeNo, setDeliveryChequeNo] = useState("");
  const [deliveryChequeDate, setDeliveryChequeDate] = useState("");
  const [deliveryChequeBank, setDeliveryChequeBank] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [resettingLorryCount, setResettingLorryCount] = useState(false);
  const [showResetDataModal, setShowResetDataModal] = useState(false);
  const [resetDataConfirmText, setResetDataConfirmText] = useState("");
  const [resettingData, setResettingData] = useState(false);
  const [loadingMarkPendingKey, setLoadingMarkPendingKey] = useState("");
  const [stockSummaryDetailMode, setStockSummaryDetailMode] = useState("");
  const [tableSort, setTableSort] = useState({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authUsers, setAuthUsers] = useState([]);
  const [managerAccessPending, setManagerAccessPending] = useState(false);
  const [reportSubpage, setReportSubpage] = useState("item-wise");
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const reportMenuRef = useRef(null);
  const isManager = String(user?.role || "").toLowerCase() === "manager";
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const managerFullAccessEnabled = Boolean(state?.settings?.managerFullAccess);
  const canManageStock = !isManager || managerFullAccessEnabled;
  const canManageCustomerOpeningOutstanding = !isManager || managerFullAccessEnabled;
  const canManageCustomerLimits = !isManager || managerFullAccessEnabled;
  const canManageUsers = !isManager || managerFullAccessEnabled;
  const canManageOutstandingAdjustment = isAdmin;

  useEffect(() => {
    if (!notice) return;
    const isErrorNotice = /(error|invalid|required|cannot|unable|failed|not found|select|enter|type|exceeds|no\s.+to\sedit)/i.test(String(notice));
    if (!isErrorNotice) return;
    onError?.(notice);
    setNotice("");
  }, [notice, onError]);

  useEffect(() => {
    setMobileNavOpen(false);
    scrollViewportToTop();
  }, [activePage]);

  useEffect(() => {
    if (!reportMenuOpen) return;
    const handlePointerDown = (event) => {
      if (!reportMenuRef.current?.contains(event.target)) {
        setReportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [reportMenuOpen]);

  useEffect(() => {
    if (!canManageUsers) {
      setAuthUsers([]);
      return;
    }
    fetchAuthUsers()
      .then((rows) => setAuthUsers(Array.isArray(rows) ? rows : []))
      .catch(() => setAuthUsers([]));
  }, [canManageUsers, state.staff]);

  const inDateTimeRange = (iso, fromDate, toDate, fromTime, toTime) => {
    const value = new Date(iso).getTime();
    if (Number.isNaN(value)) return false;
    const fromBound = fromDate ? new Date(`${fromDate}T${fromTime || "00:00"}:00`).getTime() : null;
    const toBound = toDate ? new Date(`${toDate}T${toTime || "23:59"}:59`).getTime() : null;
    if (fromBound !== null && !Number.isNaN(fromBound) && value < fromBound) return false;
    if (toBound !== null && !Number.isNaN(toBound) && value > toBound) return false;
    return true;
  };

  const toggleSort = (table, key) => {
    setTableSort((current) => {
      const prev = current[table];
      if (prev?.key === key) {
        return { ...current, [table]: { key, dir: prev.dir === "asc" ? "desc" : "asc" } };
      }
      return { ...current, [table]: { key, dir: "asc" } };
    });
  };

  const sortMark = (table, key) => {
    const sort = tableSort[table];
    if (!sort || sort.key !== key) return "";
    return sort.dir === "asc" ? " ▲" : " ▼";
  };

  const sortRows = (rows, table, defaultKey, getters) => {
    const sort = tableSort[table] || { key: defaultKey, dir: "asc" };
    const getValue = getters[sort.key] || (() => "");
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      const aNum = typeof av === "number" ? av : Number.NaN;
      const bNum = typeof bv === "number" ? bv : Number.NaN;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return (aNum - bNum) * factor;
      return String(av || "").localeCompare(String(bv || ""), undefined, { numeric: true, sensitivity: "base" }) * factor;
    });
  };
  const chartData = useMemo(() => {
    const base = [];
    const today = new Date();
    const endDate = chartDateTo ? new Date(`${chartDateTo}T00:00:00`) : today;
    const startDate = chartDateFrom
      ? new Date(`${chartDateFrom}T00:00:00`)
      : (() => {
        const d = new Date(endDate);
        d.setDate(endDate.getDate() - 7);
        return d;
      })();
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [];
    const cursor = new Date(startDate);
    let guard = 0;
    while (cursor <= endDate && guard < 62) {
      const key = toColomboDateKey(cursor);
      const short = cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const daySales = state.sales.filter((sale) => toColomboDateKey(sale.createdAt) === key);
      const count = daySales.length;
      const revenue = daySales.reduce((acc, sale) => acc + saleNetTotal(sale), 0);
      base.push({ key, short, count, revenue: Number(revenue.toFixed(2)) });
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return base;
  }, [state.sales, chartDateFrom, chartDateTo]);

  const maxCount = Math.max(1, ...chartData.map((item) => item.count));
  const repChartData = useMemo(() => {
    const map = new Map();
    const isRepRole = (value) => {
      const role = String(value || "").trim().toLowerCase();
      return role === "cashier" || role === "rep";
    };
    for (const member of (state.staff || [])) {
      if (!isRepRole(member.role)) continue;
      const repName = String(member.name || "").trim();
      if (!repName) continue;
      map.set(repName, 0);
    }
    for (const authUser of (authUsers || [])) {
      if (!isRepRole(authUser.role)) continue;
      const repName = String(authUser.name || authUser.username || "").trim();
      if (!repName) continue;
      map.set(repName, map.get(repName) || 0);
    }
    for (const sale of state.sales) {
      const saleDay = toColomboDateKey(sale.createdAt);
      if (repDateFrom && saleDay && saleDay < repDateFrom) continue;
      if (repDateTo && saleDay && saleDay > repDateTo) continue;
      const rep = sale.cashier || "Unknown";
      map.set(rep, (map.get(rep) || 0) + 1);
    }
    return [...map.entries()]
      .map(([rep, count]) => ({ rep, count }))
      .sort((a, b) => b.count - a.count);
  }, [state.sales, state.staff, authUsers, repDateFrom, repDateTo]);

  const filteredRepChartData = useMemo(() => {
    if (!selectedRep) return repChartData;
    return repChartData.filter((row) => row.rep === selectedRep);
  }, [selectedRep, repChartData]);
  const repMaxCount = Math.max(1, ...filteredRepChartData.map((item) => item.count), 0);

  const productInfoById = useMemo(() => {
    return new Map(state.products.map((item) => [
      item.id,
      { name: item.name, sku: item.sku, size: item.size, category: item.category, invoicePrice: item.invoicePrice }
    ]));
  }, [state.products]);

  const reportSales = useMemo(
    () => (state.sales || []).filter((sale) => {
      const saleDate = toColomboDateKey(sale.createdAt);
      if (!saleDate) return false;
      const saleTime = toColomboTimeKey(sale.createdAt);
      const safeSaleTime = saleTime || "00:00";
      const saleDateTimeKey = `${saleDate} ${safeSaleTime}`;

      if (salesDateFrom) {
        const fromDateTimeKey = `${salesDateFrom} ${salesTimeFrom || "00:00"}`;
        if (saleDateTimeKey < fromDateTimeKey) return false;
      } else if (salesTimeFrom && safeSaleTime < salesTimeFrom) {
        return false;
      }

      if (salesDateTo) {
        const toDateTimeKey = `${salesDateTo} ${salesTimeTo || "23:59"}`;
        if (saleDateTimeKey > toDateTimeKey) return false;
      } else if (salesTimeTo && safeSaleTime > salesTimeTo) {
        return false;
      }

      return true;
    }),
    [state.sales, salesDateFrom, salesDateTo, salesTimeFrom, salesTimeTo]
  );

  const itemReportSales = useMemo(
    () => (state.sales || []).filter((sale) => inDateRange(sale.createdAt, itemDateFrom, itemDateTo)),
    [state.sales, itemDateFrom, itemDateTo]
  );

  const itemWiseRows = useMemo(() => {
    const salesSource = itemReportLorry === "all"
      ? itemReportSales
      : itemReportSales.filter((sale) => sale.lorry === itemReportLorry);
    const map = new Map();
    for (const sale of salesSource) {
      const returnedByProduct = saleReturnedQtyByProduct(sale, state.returns || []);
      const undeliveredByProduct = saleUndeliveredQtyByProduct(sale);
      for (const line of (sale.lines || [])) {
        const key = line.productId || line.name;
        const info = productInfoById.get(line.productId) || { name: line.name || "Unknown Item", sku: "-", size: "", category: "" };
        const row = map.get(key) || { key, name: info.name, sku: info.sku, size: info.size || "", category: info.category || "", qty: 0, bills: 0, revenue: 0 };
        const lineState = effectiveSaleLineState(sale, line, { returnedByProduct, undeliveredByProduct });
        row.qty += lineState.effectiveQty;
        row.revenue += lineState.effectiveRevenue;
        row.bills += 1;
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [itemReportLorry, itemReportSales, productInfoById, state.returns]);

  const bottleReportSales = useMemo(
    () => (state.sales || []).filter((sale) => inDateRange(sale.createdAt, bottleReportDateFrom, bottleReportDateTo)),
    [state.sales, bottleReportDateFrom, bottleReportDateTo]
  );

  const bottleReportRows = useMemo(() => {
    const map = new Map();
    for (const sale of bottleReportSales) {
      const bucket = saleBottlePaymentBucket(sale);
      const returnedByProduct = saleReturnedQtyByProduct(sale, state.returns || []);
      const undeliveredByProduct = saleUndeliveredQtyByProduct(sale);
      for (const line of (sale.lines || [])) {
        const key = line.productId || line.name;
        const info = productInfoById.get(line.productId) || { name: line.name || "Unknown Item", sku: "-", size: "", category: "" };
        const row = map.get(key) || {
          key, name: info.name, sku: info.sku, size: info.size || "", category: info.category || "",
          totalQty: 0, cashQty: 0, chequeQty: 0, creditQty: 0
        };
        const effectiveQty = effectiveSaleLineState(sale, line, { returnedByProduct, undeliveredByProduct }).effectiveQty;
        row.totalQty += effectiveQty;
        if (bucket === "cash") row.cashQty += effectiveQty;
        else if (bucket === "cheque") row.chequeQty += effectiveQty;
        else row.creditQty += effectiveQty;
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.totalQty - a.totalQty);
  }, [bottleReportSales, productInfoById, state.returns]);

  const bottleReportTotals = useMemo(
    () => bottleReportRows.reduce((acc, row) => ({
      totalQty: acc.totalQty + row.totalQty,
      cashQty: acc.cashQty + row.cashQty,
      chequeQty: acc.chequeQty + row.chequeQty,
      creditQty: acc.creditQty + row.creditQty
    }), { totalQty: 0, cashQty: 0, chequeQty: 0, creditQty: 0 }),
    [bottleReportRows]
  );

  const loadingRowsByLorry = useMemo(() => {
    const loadingMarks = state?.settings?.loadingRowMarks || {};
    const buildRows = (lorryName) => {
      const map = new Map();
      for (const sale of state.sales) {
        if (!inDateTimeRange(sale.createdAt, loadingDateFrom, loadingDateTo, loadingTimeFrom, loadingTimeTo)) continue;
        if (sale.lorry !== lorryName) continue;
        for (const line of (sale.lines || [])) {
          const key = line.productId || line.name;
          const info = productInfoById.get(line.productId) || { name: line.name || "Unknown Item", sku: "-", size: "", category: "" };
          const row = map.get(key) || { key, productId: line.productId || key, name: info.name, sku: info.sku, size: info.size || "", category: info.category || "", qty: 0, value: 0 };
          const qty = Number(line.quantity || 0);
          row.qty += qty;
          row.value += saleLineRevenueForQty(sale, line, qty);
          map.set(key, row);
        }
      }
      const returnedByProduct = new Map();
      for (const ret of (state.returns || [])) {
        const retSale = (state.sales || []).find((s) => String(s.id) === String(ret.saleId));
        if (!retSale || retSale.lorry !== lorryName) continue;
        if (!inDateTimeRange(ret.createdAt, loadingDateFrom, loadingDateTo, loadingTimeFrom, loadingTimeTo)) continue;
        for (const line of (ret.lines || [])) {
          returnedByProduct.set(line.productId, (returnedByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
        }
      }
      const deliveredByProduct = new Map();
      for (const sale of state.sales) {
        if (!inDateTimeRange(sale.createdAt, loadingDateFrom, loadingDateTo, loadingTimeFrom, loadingTimeTo)) continue;
        if (sale.lorry !== lorryName) continue;
        if (!sale.deliveryConfirmedAt && !sale.preOrderConfirmedAt) continue;
        const returnedByProduct = saleReturnedQtyByProduct(sale, state.returns || []);
        const undeliveredByProduct = saleUndeliveredQtyByProduct(sale);
        for (const line of (sale.lines || [])) {
          const lineKey = line.productId || line.name;
          const lineState = effectiveSaleLineState(sale, line, { returnedByProduct, undeliveredByProduct });
          const current = deliveredByProduct.get(lineKey) || { qty: 0, value: 0 };
          current.qty += lineState.effectiveQty;
          current.value += lineState.effectiveRevenue;
          deliveredByProduct.set(lineKey, current);
        }
      }
      return [...map.values()]
        .map((row) => {
          const bundleSize = getBundleSize(row);
          const bundles = bundleSize ? Math.floor(row.qty / bundleSize) : 0;
          const balance = bundleSize ? row.qty % bundleSize : row.qty;
          const deliveredRaw = deliveredByProduct.get(row.key) || { qty: 0, value: 0 };
          const deliveredQty = Math.max(0, Number(deliveredRaw.qty || 0));
          const deliveredValue = Number(deliveredRaw.value || 0);
          const markKey = buildLoadingMarkKey({
            lorry: lorryName,
            rowKey: row.key,
            dateFrom: loadingDateFrom,
            timeFrom: loadingTimeFrom,
            dateTo: loadingDateTo,
            timeTo: loadingTimeTo
          });
          return {
            ...row,
            bundleSize,
            bundles,
            balance,
            orderedQty: row.qty,
            orderedValue: row.value,
            deliveredQty,
            deliveredValue,
            markKey,
            loaded: Boolean(loadingMarks[markKey]?.loaded)
          };
        })
        .sort((a, b) => b.orderedQty - a.orderedQty);
    };

    return ORDER_LORRIES.reduce((acc, lorryName) => {
      acc[lorryName] = buildRows(lorryName);
      return acc;
    }, {});
  }, [state.sales, state.returns, state?.settings?.loadingRowMarks, loadingDateFrom, loadingDateTo, loadingTimeFrom, loadingTimeTo, productInfoById]);

  const salesWiseRows = useMemo(() => {
    return reportSales.map((sale) => ({
      id: sale.id,
      when: new Date(sale.createdAt).toLocaleDateString(),
      whenTs: new Date(sale.createdAt).getTime(),
      rep: sale.cashier || "-",
      lorry: sale.lorry || "-",
      total: saleNetTotal(sale),
      raw: sale
    }));
  }, [reportSales]);

  const customerWiseRows = useMemo(() => {
    const map = new Map();
    for (const sale of reportSales) {
      const key = String(sale.customerId || sale.customerName || "Walk-in").trim();
      const current = map.get(key) || { id: key, name: sale.customerName || "Walk-in", orders: 0, spent: 0, lastAt: "" };
      current.orders += 1;
      current.spent += saleNetTotal(sale);
      if (!current.lastAt || new Date(sale.createdAt).getTime() > new Date(current.lastAt).getTime()) {
        current.lastAt = sale.createdAt;
      }
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent);
  }, [reportSales]);

  const customerCreditMap = useMemo(() => {
    const map = new Map();
    for (const entry of (state.customerCredits || [])) {
      const key = String(entry.customerId || entry.customerName || "").trim();
      if (!key) continue;
      const remainingAmount = Number(entry.remainingAmount ?? entry.amount ?? 0);
      if (remainingAmount <= 0) continue;
      map.set(key, Number(map.get(key) || 0) + remainingAmount);
    }
    return map;
  }, [state.customerCredits]);

  const customerRows = useMemo(() => {
    const map = new Map();
    for (const sale of state.sales) {
      const customerNameKey = String(sale.customerName || "").trim();
      if (customerNameKey.toLowerCase() === "walk-in") continue;
      const key = String(sale.customerId || sale.customerName || "").trim();
      if (!key) continue;
      const existing = map.get(key) || { id: key, name: sale.customerName, orders: 0, spent: 0, outstanding: 0, openingOutstanding: 0, outstandingAdjustment: 0, outstandingAdjustmentReason: "", liveOutstandingRaw: 0, creditLimit: 0, discountLimit: 0, bundleDiscountLimit: 0, availableCredit: 0, phone: "", address: "", oldestOutstandingSale: null, topOutstandingRep: "" };
      existing.orders += 1;
      existing.spent += saleNetTotal(sale);
      const saleOutstanding = Number(
        sale.outstandingAmount !== undefined
          ? sale.outstandingAmount
          : (sale.paymentType === "credit" ? saleNetTotal(sale) : 0)
      ) || 0;
      existing.outstanding += saleOutstanding;
      existing.liveOutstandingRaw += saleOutstanding;
      if (saleOutstanding > 0) {
        const currentOldest = existing.oldestOutstandingSale ? new Date(existing.oldestOutstandingSale.createdAt || 0).getTime() : Infinity;
        const candidate = new Date(sale.createdAt || 0).getTime();
        if (candidate < currentOldest) {
          existing.oldestOutstandingSale = sale;
        }
        existing.topOutstandingRep = existing.topOutstandingRep || String(sale.cashier || "-").trim() || "-";
      }
      map.set(key, existing);
    }
    for (const customer of (state.customers || [])) {
      const key = String(customer.id || customer.name).trim();
      const existing = map.get(key) || { id: key, name: customer.name, orders: 0, spent: 0, outstanding: 0, openingOutstanding: 0, outstandingAdjustment: 0, outstandingAdjustmentReason: "", liveOutstandingRaw: 0, creditLimit: 0, discountLimit: 0, bundleDiscountLimit: 0, availableCredit: 0, phone: "", address: "", oldestOutstandingSale: null, topOutstandingRep: "" };
      const openingOutstanding = Math.max(Number(existing.openingOutstanding || 0), Number(customer.openingOutstanding || 0));
      const outstandingAdjustment = Math.max(Number(existing.outstandingAdjustment || 0), Number(customer.outstandingAdjustment || 0));
      const outstandingAdjustmentReason = String(customer.outstandingAdjustmentReason || "").trim() || String(existing.outstandingAdjustmentReason || "").trim();
      const creditLimit = Math.max(Number(existing.creditLimit || 0), Number(customer.creditLimit || 0));
      const discountLimit = Math.max(Number(existing.discountLimit || 0), Number(customer.discountLimit || 0));
      const bundleDiscountLimit = Math.max(Number(existing.bundleDiscountLimit || 0), Number(customer.bundleDiscountLimit || 0));
      const phone = String(customer.phone || "").trim() || String(existing.phone || "").trim();
      const address = String(customer.address || "").trim() || String(existing.address || "").trim();
      const liveOutstanding = Math.max(0, Number(existing.liveOutstandingRaw || 0));
      const aging = existing.oldestOutstandingSale
        ? customerOutstandingAging(existing.oldestOutstandingSale)
        : (openingOutstanding > 0 ? { daysLeft: null, label: "Opening due" } : { daysLeft: null, label: "-" });
      map.set(key, {
        ...existing,
        ...customer,
        phone,
        address,
        openingOutstanding,
        outstandingAdjustment,
        outstandingAdjustmentReason,
        creditLimit,
        discountLimit,
        bundleDiscountLimit,
        liveOutstandingRaw: liveOutstanding,
        outstanding: Math.max(0, Number((liveOutstanding + openingOutstanding - outstandingAdjustment).toFixed(2))),
        outstandingDaysLeft: aging.daysLeft,
        outstandingDaysLabel: aging.label
      });
    }
    for (const [key, credit] of customerCreditMap.entries()) {
      const existing = map.get(key) || { id: key, name: key, orders: 0, spent: 0, outstanding: 0, openingOutstanding: 0, outstandingAdjustment: 0, outstandingAdjustmentReason: "", liveOutstandingRaw: 0, creditLimit: 0, discountLimit: 0, bundleDiscountLimit: 0, availableCredit: 0, outstandingDaysLeft: null, outstandingDaysLabel: "-", topOutstandingRep: "" };
      existing.availableCredit = Number(credit || 0);
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.spent - a.spent);
  }, [state.sales, state.customers, customerCreditMap]);
  const uniqueCustomerRoutes = useMemo(() => {
    const routes = new Set(customerRows.map((row) => String(row.route || "").trim()).filter(Boolean));
    return ["All", ...Array.from(routes).sort()];
  }, [customerRows]);

  const filteredCustomerRows = useMemo(() => {
    const term = customerPanelSearch.trim().toLowerCase();
    const routeFilter = customerRouteFilter === "All" ? "" : customerRouteFilter.toLowerCase();
    return customerRows.filter((row) => {
      if (routeFilter && String(row.route || "").trim().toLowerCase() !== routeFilter) return false;
      if (!term) return true;
      return String(row.name || "").toLowerCase().includes(term)
        || String(row.phone || "").toLowerCase().includes(term)
        || String(row.address || "").toLowerCase().includes(term)
        || String(row.route || "").toLowerCase().includes(term);
    });
  }, [customerRows, customerPanelSearch, customerRouteFilter]);
  const sortedCustomerRows = useMemo(
    () => sortRows(filteredCustomerRows, "customers", "name", {
      name: (row) => row.name,
      phone: (row) => row.phone || "",
      orders: (row) => Number(row.orders || 0),
      spent: (row) => Number(row.spent || 0),
      openingOutstanding: (row) => Number(row.openingOutstanding || 0),
      route: (row) => String(row.route || ""),
      outstanding: (row) => Number(row.outstanding || 0),
      daysLeft: (row) => {
        const value = row.outstandingDaysLeft;
        return value === null || value === undefined ? Number.POSITIVE_INFINITY : Number(value);
      },
      availableCredit: (row) => Number(row.availableCredit || 0)
    }),
    [filteredCustomerRows, tableSort]
  );
  const customerPageSummary = useMemo(() => {
    const rows = sortedCustomerRows || [];
    const totalCustomers = rows.length;
    let totalOrders = 0;
    let totalSpent = 0;
    let totalOutstanding = 0;
    let totalAvailableCredit = 0;
    let activeCustomers = 0;
    let customersWithOutstanding = 0;
    let topCustomer = null;
    for (const row of rows) {
      const orders = Number(row.orders || 0);
      const spent = Number(row.spent || 0);
      const outstanding = Number(row.outstanding || 0);
      const availableCredit = Number(row.availableCredit || 0);
      totalOrders += orders;
      totalSpent += spent;
      totalOutstanding += outstanding;
      totalAvailableCredit += availableCredit;
      if (orders > 0) activeCustomers += 1;
      if (outstanding > 0) customersWithOutstanding += 1;
      if (!topCustomer || spent > Number(topCustomer.spent || 0)) topCustomer = row;
    }
    return {
      totalCustomers,
      activeCustomers,
      customersWithOutstanding,
      totalOrders,
      totalSpent: Number(totalSpent.toFixed(2)),
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      totalAvailableCredit: Number(totalAvailableCredit.toFixed(2)),
      averageOrderValue: totalOrders > 0 ? Number((totalSpent / totalOrders).toFixed(2)) : 0,
      topCustomerName: topCustomer?.name || "-",
      topCustomerSpent: Number(topCustomer?.spent || 0)
    };
  }, [sortedCustomerRows]);
  const totalOutstandingExcludingToday = Math.max(
    0,
    Number((Number(customerPageSummary?.totalOutstanding || 0) - Number(dashboard?.todayOutstanding || 0)).toFixed(2))
  );
  const overdueCreditSummary = useMemo(() => {
    const now = Date.now();
    const byCustomer = new Map();
    for (const sale of (state.sales || [])) {
      const outstanding = Number(sale.outstandingAmount || 0);
      if (outstanding <= 0) continue;
      const createdAtTs = new Date(sale.createdAt || 0).getTime();
      if (!Number.isFinite(createdAtTs)) continue;
      const overdueDays = Math.floor((now - createdAtTs) / 86400000);
      if (overdueDays <= 14) continue;
      const key = String(sale.customerName || "Walk-in").trim() || "Walk-in";
      const row = byCustomer.get(key) || { customer: key, amount: 0, bills: 0, maxDays: 0 };
      row.amount += outstanding;
      row.bills += 1;
      row.maxDays = Math.max(row.maxDays, overdueDays);
      byCustomer.set(key, row);
    }
    const rows = [...byCustomer.values()].sort((a, b) => b.amount - a.amount);
    return {
      count: rows.length,
      total: Number(rows.reduce((acc, row) => acc + Number(row.amount || 0), 0).toFixed(2)),
      top: rows[0] || null,
      rows
    };
  }, [state.sales]);
  const creditLimitAlertSummary = useMemo(() => {
    const rows = (customerRows || [])
      .filter((row) => Number(row.creditLimit || 0) > 0)
      .filter((row) => Number(row.outstanding || 0) > Number(row.creditLimit || 0))
      .map((row) => ({
        customer: row.name,
        phone: row.phone || "-",
        rep: row.topOutstandingRep || "-",
        creditLimit: Number(row.creditLimit || 0),
        outstanding: Number(row.outstanding || 0),
        daysLabel: row.outstandingDaysLabel || "-",
        exceededBy: Number((Number(row.outstanding || 0) - Number(row.creditLimit || 0)).toFixed(2))
      }))
      .sort((a, b) => Number(b.exceededBy || 0) - Number(a.exceededBy || 0));
    return {
      count: rows.length,
      totalExceeded: Number(rows.reduce((acc, row) => acc + Number(row.exceededBy || 0), 0).toFixed(2)),
      top: rows[0] || null,
      rows
    };
  }, [customerRows]);
  const upcomingChequeSummary = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = localDateKey(tomorrow);
    const rows = [];
    for (const sale of (state.sales || [])) {
      for (const payment of salePayments(sale)) {
        if (String(payment.method || "").toLowerCase() !== "cheque") continue;
        if (!isChequePaymentPending(payment)) continue;
        const chequeDate = localDateKey(payment.chequeDate);
        if (!chequeDate || chequeDate !== tomorrowKey) continue;
        rows.push({
          saleId: sale.id,
          customer: sale.customerName || "Walk-in",
          amount: Number(payment.amount || 0),
          chequeNo: payment.chequeNo || "-",
          bank: payment.chequeBank || "-",
          rep: sale.cashier || "-"
        });
      }
    }
    return {
      date: tomorrowKey,
      count: rows.length,
      total: Number(rows.reduce((acc, row) => acc + Number(row.amount || 0), 0).toFixed(2)),
      rows
    };
  }, [state.sales]);
  const dashboardProfitSummary = useMemo(() => {
    const productsById = new Map((state.products || []).map((product) => [String(product.id), product]));

    // 1. Sales created within the date range
    const scopedSales = (state.sales || []).filter((sale) => inDateRange(sale.createdAt, dashboardProfitDateFrom, dashboardProfitDateTo));

    // 2. Returns created within the date range
    const scopedReturns = (state.returns || []).filter((ret) => inDateRange(ret.createdAt, dashboardProfitDateFrom, dashboardProfitDateTo));

    // 3. Sales lookup map
    const salesById = new Map((state.sales || []).map((sale) => [String(sale.id), sale]));

    let grossRevenue = 0;
    let initialCost = 0;

    // Calculate gross sales revenue and initial cost
    for (const sale of scopedSales) {
      grossRevenue += Number(sale.total || 0);
      for (const line of (sale.lines || [])) {
        const product = productsById.get(String(line.productId || ""));
        const unitInvoice = line.invoicePrice !== undefined ? Number(line.invoicePrice) : Number(product?.invoicePrice ?? 0);
        initialCost += Number(line.quantity || 0) * unitInvoice;
      }
    }

    let returnedRevenue = 0;
    let returnedCost = 0;

    // Deduct returns created in this date range
    for (const ret of scopedReturns) {
      const parentSale = salesById.get(String(ret.saleId));
      if (!parentSale) continue;

      returnedRevenue += Number(ret.totalAmount || 0);
      for (const line of (ret.lines || [])) {
        const product = productsById.get(String(line.productId || ""));
        const parentLine = (parentSale.lines || []).find(l => String(l.productId) === String(line.productId));
        const unitInvoicePrice = parentLine && parentLine.invoicePrice !== undefined
          ? Number(parentLine.invoicePrice)
          : (line.invoicePrice !== undefined ? Number(line.invoicePrice) : Number(product?.invoicePrice ?? 0));

        returnedCost += Number(line.quantity || 0) * unitInvoicePrice;
      }
    }

    let undeliveredRevenue = 0;
    let undeliveredCost = 0;

    // Deduct delivery adjustments created in this date range
    for (const sale of (state.sales || [])) {
      for (const adj of (sale.deliveryAdjustments || [])) {
        if (!inDateRange(adj.createdAt, dashboardProfitDateFrom, dashboardProfitDateTo)) continue;

        for (const line of (adj.lines || [])) {
          const parentLine = (sale.lines || []).find(l => String(l.productId) === String(line.productId));
          if (!parentLine) continue;

          const preview = returnLinePreview(sale, parentLine, Number(line.quantity || 0));
          undeliveredRevenue += Number(preview.returnAmount || 0);

          const product = productsById.get(String(line.productId || ""));
          const unitInvoice = parentLine.invoicePrice !== undefined
            ? Number(parentLine.invoicePrice)
            : Number(product?.invoicePrice ?? 0);

          undeliveredCost += Number(line.quantity || 0) * unitInvoice;
        }
      }
    }

    let expenses = 0;
    for (const entry of (state.accounting || [])) {
      if (dashboardProfitDateFrom && entry.date < dashboardProfitDateFrom) continue;
      if (dashboardProfitDateTo && entry.date > dashboardProfitDateTo) continue;
      expenses += Number(entry.amount || 0);
    }

    const revenue = Number((grossRevenue - returnedRevenue - undeliveredRevenue).toFixed(2));
    const cost = Number((initialCost - returnedCost - undeliveredCost).toFixed(2));
    const profit = Number((revenue - cost - expenses).toFixed(2));

    return {
      from: dashboardProfitDateFrom,
      to: dashboardProfitDateTo,
      filteredSalesCount: scopedSales.length,
      revenue,
      cost,
      expenses,
      profit,
      margin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0
    };
  }, [dashboardProfitDateFrom, dashboardProfitDateTo, state.products, state.returns, state.sales]);
  const customerDetailData = useMemo(() => {
    const key = String(customerDetailName || "").trim().toLowerCase();
    if (!key) return null;
    const row = customerRows.find((item) => String(item.name || "").trim().toLowerCase() === key);
    if (!row) return null;
    const sales = (state.sales || [])
      .filter((sale) => String(sale.customerName || "").trim().toLowerCase() === key)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const totalBills = sales.length;
    const totalQty = sales.reduce((acc, sale) => {
      const returnedByProduct = saleReturnedQtyByProduct(sale, state.returns || []);
      const undeliveredByProduct = saleUndeliveredQtyByProduct(sale);
      return acc + (sale.lines || []).reduce((lineAcc, line) => {
        const lineState = effectiveSaleLineState(sale, line, { returnedByProduct, undeliveredByProduct });
        return lineAcc + lineState.effectiveQty;
      }, 0);
    }, 0);
    const averageBillValue = totalBills ? Number((Number(row.spent || 0) / totalBills).toFixed(2)) : 0;
    const saleIds = new Set(sales.map((sale) => String(sale.id)));
    const returnSummary = (state.returns || []).reduce((acc, entry) => {
      if (!saleIds.has(String(entry.saleId))) return acc;
      (entry.lines || []).forEach((line) => {
        acc.qty += Number(line.quantity || 0);
        acc.value += Number(line.returnAmount || 0);
      });
      return acc;
    }, { qty: 0, value: 0 });
    return {
      row,
      totalBills,
      totalQty,
      returnedQty: returnSummary.qty,
      returnedValue: Number(returnSummary.value.toFixed(2)),
      averageBillValue,
      lastSaleAt: sales[0]?.createdAt || "",
      openingOutstanding: Number(row.openingOutstanding || 0),
      outstandingAdjustment: Number(row.outstandingAdjustment || 0),
      outstandingAdjustmentReason: String(row.outstandingAdjustmentReason || "").trim(),
      liveSaleOutstanding: Number(row.liveOutstandingRaw || 0),
      availableCredit: Number(row.availableCredit || 0),
      recentSales: sales.slice(0, 4)
    };
  }, [customerDetailName, customerRows, state.sales, state.returns]);

  const stockRows = useMemo(() => {
    return [...state.products].sort((a, b) => a.stock - b.stock);
  }, [state.products]);
  const filteredStockRows = useMemo(() => {
    const term = stockPanelSearch.trim().toLowerCase();
    if (!term) return stockRows;
    return stockRows.filter((row) =>
      String(row.name || "").toLowerCase().includes(term)
      || String(row.sku || "").toLowerCase().includes(term)
      || String(row.size || "").toLowerCase().includes(term)
    );
  }, [stockRows, stockPanelSearch]);
  const sortedStockRows = useMemo(
    () => sortRows(filteredStockRows, "stock", "name", {
      name: (row) => row.name,
      size: (row) => row.size || "",
      sku: (row) => row.sku,
      invoicePrice: (row) => Number(row.invoicePrice ?? 0),
      billingPrice: (row) => Number(row.billingPrice ?? row.price ?? 0),
      mrp: (row) => Number(row.mrp ?? row.price ?? 0),
      stock: (row) => Number(row.stock || 0)
    }),
    [filteredStockRows, tableSort]
  );
  const stockPageSummary = useMemo(() => {
    const rows = sortedStockRows || [];
    const totalSkus = rows.length;
    const totalUnits = rows.reduce((acc, row) => acc + Number(row.stock || 0), 0);
    const totalBundles = rows.reduce((acc, row) => {
      const bundleSize = getBundleSize(row);
      return acc + (bundleSize > 0 ? Math.floor(Number(row.stock || 0) / bundleSize) : 0);
    }, 0);
    const lowStockThreshold = Number(state?.settings?.lowStockThreshold ?? 25);
    const lowStockCount = rows.filter((row) => Number(row.stock || 0) <= lowStockThreshold).length;
    const outOfStockCount = rows.filter((row) => Number(row.stock || 0) <= 0).length;
    const inventoryCost = Number(rows.reduce((acc, row) => (
      acc + (Number(row.stock || 0) * Number(row.billingPrice ?? row.price ?? 0))
    ), 0).toFixed(2));
    const inventoryInvoice = Number(rows.reduce((acc, row) => (
      acc + (Number(row.stock || 0) * Number(row.invoicePrice ?? 0))
    ), 0).toFixed(2));
    const inventoryMrp = Number(rows.reduce((acc, row) => (
      acc + (Number(row.stock || 0) * Number(row.mrp ?? row.price ?? 0))
    ), 0).toFixed(2));
    const topStockItem = rows.reduce(
      (best, row) => (Number(row.stock || 0) > Number(best?.stock || -1) ? row : best),
      null
    );
    return {
      totalSkus,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      inventoryInvoice,
      inventoryCost,
      inventoryMrp,
      topStockName: topStockItem?.name || topStockItem?.sku || "-",
      topStockUnits: Number(topStockItem?.stock || 0)
    };
  }, [sortedStockRows, state?.settings?.lowStockThreshold]);
  const stockSummaryDetailRows = useMemo(() => {
    const rows = sortedStockRows || [];
    const lowStockThreshold = Number(state?.settings?.lowStockThreshold ?? 25);
    if (stockSummaryDetailMode === "bundles") {
      return rows
        .map((row) => {
          const bundleSize = getBundleSize(row);
          const totalBundles = bundleSize > 0 ? Math.floor(Number(row.stock || 0) / bundleSize) : 0;
          return { ...row, bundleSize };
        })
        .filter((row) => Number(row.bundleSize || 0) > 0 && Number(row.totalBundles || 0) > 0);
    }
    if (stockSummaryDetailMode === "low") {
      return rows.filter((row) => Number(row.stock || 0) > 0 && Number(row.stock || 0) <= lowStockThreshold);
    }
    if (stockSummaryDetailMode === "out") {
      return rows.filter((row) => Number(row.stock || 0) <= 0);
    }
    return [];
  }, [sortedStockRows, state?.settings?.lowStockThreshold, stockSummaryDetailMode]);

  const adminReturnRows = useMemo(() => {
    const rows = [];
    for (const ret of (state.returns || [])) {
      for (const line of (ret.lines || [])) {
        rows.push({
          id: `${ret.id}-${line.productId}`,
          saleId: ret.saleId,
          item: line.name || line.productId,
          qty: Number(line.quantity || 0),
          amount: Number(line.returnAmount || 0),
          rep: ret.rep || "-",
          at: ret.createdAt
        });
      }
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [state.returns]);
  const sortedAdminReturnRows = useMemo(
    () => sortRows(adminReturnRows, "returns", "at", {
      saleId: (row) => Number(row.saleId || 0),
      item: (row) => String(row.item || ""),
      qty: (row) => Number(row.qty || 0),
      amount: (row) => Number(row.amount || 0),
      rep: (row) => String(row.rep || ""),
      at: (row) => new Date(row.at || 0).getTime()
    }),
    [adminReturnRows, tableSort]
  );
  const filteredStockMovementRows = useMemo(() => {
    const term = String(stockLogSearch || "").trim().toLowerCase();
    return (state.stockMovements || [])
      .filter((entry) => inDateRange(entry.at, stockLogDateFrom, stockLogDateTo))
      .filter((entry) => {
        if (!term) return true;
        return [
          entry.name,
          entry.sku,
          entry.by,
          entry.action,
          entry.productId
        ].some((value) => String(value || "").toLowerCase().includes(term));
      })
      .map((entry) => ({
        id: entry.id || `${entry.productId || "p"}-${entry.at || ""}`,
        at: entry.at || "",
        atLabel: entry.at ? new Date(entry.at).toLocaleString() : "-",
        product: entry.name || "-",
        sku: entry.sku || "-",
        beforeStock: Number(entry.beforeStock || 0),
        changeQty: Number(entry.changeQty || 0),
        afterStock: Number(entry.afterStock || 0),
        by: entry.by || "-",
        action: String(entry.action || "-").replace(/_/g, " "),
        atTs: new Date(entry.at || 0).getTime()
      }));
  }, [state.stockMovements, stockLogDateFrom, stockLogDateTo, stockLogSearch]);
  const sortedStockMovementRows = useMemo(() => {
    const getters = {
      at: (row) => Number(row.atTs || 0),
      product: (row) => String(row.product || ""),
      sku: (row) => String(row.sku || ""),
      beforeStock: (row) => Number(row.beforeStock || 0),
      changeQty: (row) => Number(row.changeQty || 0),
      afterStock: (row) => Number(row.afterStock || 0),
      by: (row) => String(row.by || ""),
      action: (row) => String(row.action || "")
    };
    if (!tableSort.stockLog) {
      return [...filteredStockMovementRows].sort((a, b) => Number(b.atTs || 0) - Number(a.atTs || 0));
    }
    return sortRows(filteredStockMovementRows, "stockLog", "at", getters);
  }, [filteredStockMovementRows, tableSort]);

  const stockSearchMatches = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();
    if (!term) return state.products.slice(0, 8);
    return state.products
      .filter((item) => item.name.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term))
      .slice(0, 8);
  }, [stockSearch, state.products]);

  const staffRows = useMemo(() => {
    const map = new Map();
    const keyForName = (value) => String(value || "").trim().toLowerCase();
    for (const sale of state.sales) {
      const name = sale.cashier || "Unknown";
      const key = keyForName(name);
      const existing = map.get(key) || { name, orders: 0, revenue: 0, role: "", phone: "", username: "", authRole: "", authUserId: "", staffId: "" };
      existing.orders += 1;
      existing.revenue += saleNetTotal(sale);
      map.set(key, existing);
    }
    for (const member of (state.staff || [])) {
      const key = keyForName(member.name);
      const existing = map.get(key) || { name: member.name, orders: 0, revenue: 0, username: "", authRole: "", authUserId: "" };
      map.set(key, { ...existing, ...member, staffId: member.id });
    }
    for (const authUser of (authUsers || [])) {
      const key = keyForName(authUser.name || authUser.username);
      const existing = map.get(key) || { name: authUser.name || authUser.username, orders: 0, revenue: 0, role: "", phone: "", staffId: "" };
      map.set(key, {
        ...existing,
        name: authUser.name || existing.name,
        username: authUser.username || existing.username || "",
        authRole: authUser.role || existing.authRole || "",
        authUserId: authUser.id || existing.authUserId || ""
      });
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [state.sales, state.staff, authUsers]);
  const sortedStaffRows = useMemo(
    () => sortRows(staffRows, "staff", "name", {
      name: (row) => row.name,
      username: (row) => row.username || "",
      role: (row) => row.authRole || row.role || "",
      salary: (row) => Number(row.monthlySalary || 0),
      orders: (row) => Number(row.orders || 0),
      revenue: (row) => Number(row.revenue || 0)
    }),
    [staffRows, tableSort]
  );
  
  const payrollPreview = useMemo(() => {
    if (!showPayrollModal) return [];
    const [year, month] = payrollMonth.split("-");
    const monthStart = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const monthEnd = `${year}-${month}-${lastDay}`;
    
    return (state.staff || [])
      .filter(s => Number(s.monthlySalary) > 0)
      .map(staff => {
        const staffAdvances = (state.accounting || []).filter(item => 
          item.staffId === staff.id && 
          item.type === "advance" &&
          item.date >= monthStart && item.date <= monthEnd
        );
        
        const totalAdvance = staffAdvances.reduce((acc, item) => acc + Number(item.amount || 0), 0);
        const netPay = Number(staff.monthlySalary) - totalAdvance;
        
        return {
          staffId: staff.id,
          name: staff.name,
          baseSalary: Number(staff.monthlySalary),
          totalAdvance,
          netPay,
          monthStr: `${year}-${month}`
        };
      });
  }, [showPayrollModal, payrollMonth, state.staff, state.accounting]);

  const staffPageSummary = useMemo(() => {
    const rows = sortedStaffRows || [];
    const totalStaff = rows.length;
    const activeStaff = rows.filter((row) => Number(row.orders || 0) > 0).length;
    const totalOrders = rows.reduce((acc, row) => acc + Number(row.orders || 0), 0);
    const totalRevenue = Number(rows.reduce((acc, row) => acc + Number(row.revenue || 0), 0).toFixed(2));
    const avgRevenuePerStaff = totalStaff ? Number((totalRevenue / totalStaff).toFixed(2)) : 0;
    const topPerformer = rows.reduce(
      (best, row) => (Number(row.revenue || 0) > Number(best?.revenue || -1) ? row : best),
      null
    );
    return {
      totalStaff,
      activeStaff,
      totalOrders,
      totalRevenue,
      avgRevenuePerStaff,
      topPerformerName: topPerformer?.name || "-",
      topPerformerOrders: Number(topPerformer?.orders || 0),
      topPerformerRevenue: Number(topPerformer?.revenue || 0)
    };
  }, [sortedStaffRows]);

  const sortedItemWiseRows = useMemo(
    () => sortRows(itemWiseRows, "itemWise", "name", {
      name: (row) => row.name,
      sku: (row) => row.sku,
      qty: (row) => Number(row.qty || 0),
      singles: (row) => {
        const { singles } = getBundleBreakdown(row);
        return singles;
      }
    }),
    [itemWiseRows, tableSort]
  );

  const sortedBottleReportRows = useMemo(
    () => sortRows(bottleReportRows, "bottlePayment", "name", {
      name: (row) => row.name,
      sku: (row) => row.sku,
      totalQty: (row) => Number(row.totalQty || 0),
      cashQty: (row) => Number(row.cashQty || 0),
      chequeQty: (row) => Number(row.chequeQty || 0),
      creditQty: (row) => Number(row.creditQty || 0)
    }),
    [bottleReportRows, tableSort]
  );

  const filteredSalesWiseRows = useMemo(() => {
    return salesWiseRows.filter((row) => {
      if (salesWiseTypeFilter !== "All" && saleBottlePaymentBucket(row.raw).toLowerCase() !== salesWiseTypeFilter.toLowerCase()) return false;
      if (salesWiseLorryFilter !== "All Lorries" && row.lorry !== salesWiseLorryFilter) return false;
      return true;
    });
  }, [salesWiseRows, salesWiseTypeFilter, salesWiseLorryFilter]);

  const sortedSalesWiseRows = useMemo(
    () => sortRows(filteredSalesWiseRows, "salesWise", "when", {
      id: (row) => Number(row.id || 0),
      when: (row) => Number(row.whenTs || 0),
      lorry: (row) => String(row.lorry || ""),
      customer: (row) => String(row.raw?.customerName || ""),
      total: (row) => Number(row.total || 0)
    }),
    [filteredSalesWiseRows, tableSort]
  );


  const filteredCustomerWiseRows = useMemo(() => {
    const term = customerReportSearch.trim().toLowerCase();
    if (!term) return customerWiseRows;
    return customerWiseRows.filter((row) => String(row.name || "").toLowerCase().includes(term));
  }, [customerWiseRows, customerReportSearch]);
  const sortedCustomerWiseRows = useMemo(
    () => sortRows(filteredCustomerWiseRows, "customerWise", "spent", {
      name: (row) => row.name,
      orders: (row) => Number(row.orders || 0),
      spent: (row) => Number(row.spent || 0),
      lastAt: (row) => (row.lastAt ? new Date(row.lastAt).getTime() : 0)
    }),
    [filteredCustomerWiseRows, tableSort]
  );

  const collectedCashRows = useMemo(() => {
    return (state.sales || [])
      .filter((sale) => inDateRange(sale.createdAt, collectedCashDateFrom, collectedCashDateTo))
      .map((sale) => {
        const payments = salePayments(sale);
        const cashAmount = payments
          .filter((payment) => String(payment.method || "").toLowerCase() === "cash")
          .reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
        
        const d = new Date(sale.createdAt);
        const whenStr = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
          id: sale.id,
          when: whenStr,
          whenTs: d.getTime(),
          rep: sale.cashier || "-",
          customer: sale.customerName || "Walk-in",
          lorry: sale.lorry || "-",
          cashAmount: Number(cashAmount.toFixed(2)),
          raw: sale
        };
      })
      .filter((row) => row.cashAmount > 0);
  }, [state.sales, collectedCashDateFrom, collectedCashDateTo]);

  const filteredCollectedCashRows = useMemo(() => {
    if (collectedCashLorryFilter === "All") return collectedCashRows;
    return collectedCashRows.filter((row) => String(row.lorry || "").toLowerCase() === collectedCashLorryFilter.toLowerCase());
  }, [collectedCashRows, collectedCashLorryFilter]);

  const sortedCollectedCashRows = useMemo(
    () => sortRows(filteredCollectedCashRows, "collectedCash", "when", {
      id: (row) => Number(row.id || 0),
      when: (row) => Number(row.whenTs || 0),
      rep: (row) => String(row.rep || ""),
      customer: (row) => String(row.customer || ""),
      lorry: (row) => String(row.lorry || ""),
      cashAmount: (row) => Number(row.cashAmount || 0)
    }),
    [filteredCollectedCashRows, tableSort]
  );

  const collectedCashTotal = useMemo(() => Number(sortedCollectedCashRows.reduce((acc, row) => acc + row.cashAmount, 0).toFixed(2)), [sortedCollectedCashRows]);

  const customerCashPopupTotal = useMemo(() => {
    if (!selectedCustomerCashPopup) return 0;
    
    return (state.sales || [])
      .filter((sale) => (sale.customerName || "Walk-in") === selectedCustomerCashPopup)
      .filter((sale) => inDateRange(sale.createdAt, customerCashPopupDateFrom, customerCashPopupDateTo))
      .reduce((total, sale) => {
        const cashAmount = salePayments(sale)
          .filter((payment) => String(payment.method || "").toLowerCase() === "cash")
          .reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
        return total + cashAmount;
      }, 0);
  }, [state.sales, selectedCustomerCashPopup, customerCashPopupDateFrom, customerCashPopupDateTo]);

  const sortedLoadingByLorry = useMemo(
    () => LOADING_PANEL_CONFIG.reduce((acc, panel) => {
      acc[panel.name] = sortRows(loadingRowsByLorry[panel.name] || [], panel.sortKey, "orderedQty", {
        sku: (row) => row.sku || "",
        size: (row) => row.size || "",
        name: (row) => row.name,
        orderedQty: (row) => Number(row.orderedQty || 0),
        orderedValue: (row) => Number(row.orderedValue || 0),
        deliveredQty: (row) => Number(row.deliveredQty || 0),
        deliveredValue: (row) => Number(row.deliveredValue || 0),
        bundles: (row) => Number(row.bundles || 0),
        singles: (row) => Number(row.balance || 0),
        loaded: (row) => (row.loaded ? 1 : 0)
      });
      return acc;
    }, {}),
    [loadingRowsByLorry, tableSort]
  );

  const salesRangeTotal = useMemo(
    () => Number(sortedSalesWiseRows.reduce((acc, row) => acc + Number(row.total || 0), 0).toFixed(2)),
    [sortedSalesWiseRows]
  );
  const chequePaymentEntries = useMemo(() => {
    return (state.sales || []).flatMap((sale) => (
      salePayments(sale)
        .filter((payment) => String(payment.method || "").toLowerCase() === "cheque")
        .filter((payment) => isChequePaymentPending(payment))
        .filter((payment) => Number(payment.amount || 0) > 0)
        .map((payment, index) => ({
          rowId: `${sale.id || "sale"}-${payment.id || index}-${payment.createdAt || sale.createdAt || ""}`,
          saleId: sale.id || "-",
          saleCreatedAt: sale.createdAt || "",
          customer: sale.customerName || "Walk-in",
          rep: sale.cashier || "-",
          outstanding: Number(sale.outstandingAmount || 0),
          amount: Number(payment.amount || 0),
          chequeNo: payment.chequeNo || sale.chequeNo || "-",
          chequeDate: payment.chequeDate || sale.chequeDate || "-",
          bank: payment.chequeBank || sale.chequeBank || "-",
          createdAtTs: new Date(payment.createdAt || sale.createdAt || 0).getTime()
        }))
    ));
  }, [state.sales]);
  const chequeReportSummary = useMemo(() => {
    const chequeCount = chequePaymentEntries.length;
    const totalChequeAmount = Number(chequePaymentEntries.reduce((acc, row) => acc + Number(row.amount || 0), 0).toFixed(2));
    const outstandingBySale = new Map();
    for (const row of chequePaymentEntries) {
      const key = String(row.saleId || "");
      if (!key) continue;
      if (!outstandingBySale.has(key)) outstandingBySale.set(key, Number(row.outstanding || 0));
    }
    const totalOutstanding = Number(
      [...outstandingBySale.values()].reduce((acc, value) => acc + Number(value || 0), 0).toFixed(2)
    );
    const avgChequeAmount = chequeCount ? Number((totalChequeAmount / chequeCount).toFixed(2)) : 0;
    const latestCheque = chequePaymentEntries
      .slice()
      .sort((a, b) => b.createdAtTs - a.createdAtTs)[0];
    return {
      chequeCount,
      totalChequeAmount,
      totalOutstanding,
      avgChequeAmount,
      latestChequeNo: latestCheque?.chequeNo || "-",
      latestChequeDate: latestCheque?.chequeDate || "-",
      latestChequeBank: latestCheque?.bank || "-"
    };
  }, [chequePaymentEntries]);
  const chequeSummaryRows = useMemo(() => {
    return chequePaymentEntries
      .map((row) => ({
        rowId: row.rowId,
        saleId: row.saleId,
        date: row.saleCreatedAt ? new Date(row.saleCreatedAt).toLocaleDateString() : "-",
        customer: row.customer,
        amount: Number(row.amount || 0),
        chequeNo: row.chequeNo,
        chequeDate: row.chequeDate,
        bank: row.bank,
        rep: row.rep,
        createdAtTs: row.createdAtTs
      }))
      .sort((a, b) => b.createdAtTs - a.createdAtTs);
  }, [chequePaymentEntries]);
  const sortedChequeSummaryRows = useMemo(
    () => sortRows(chequeSummaryRows, "chequeSummary", "createdAt", {
      saleId: (row) => Number(row.saleId || 0),
      date: (row) => String(row.date || ""),
      customer: (row) => String(row.customer || ""),
      amount: (row) => Number(row.amount || 0),
      chequeNo: (row) => String(row.chequeNo || ""),
      chequeDate: (row) => String(row.chequeDate || ""),
      bank: (row) => String(row.bank || ""),
      rep: (row) => String(row.rep || ""),
      createdAt: (row) => Number(row.createdAtTs || 0)
    }),
    [chequeSummaryRows, tableSort]
  );
  const repOutstandingRows = useMemo(() => {
    const map = new Map();
    for (const sale of reportSales) {
      const outstanding = Number(sale.outstandingAmount || 0);
      if (outstanding <= 0) continue;
      const rep = String(sale.cashier || "-").trim() || "-";
      const row = map.get(rep) || { rep, bills: 0, customers: new Set(), outstanding: 0 };
      row.bills += 1;
      row.outstanding += outstanding;
      row.customers.add(String(sale.customerName || "Walk-in").trim() || "Walk-in");
      map.set(rep, row);
    }
    return [...map.values()]
      .map((row) => ({
        rep: row.rep,
        bills: row.bills,
        customers: row.customers.size,
        outstanding: Number(row.outstanding.toFixed(2))
      }))
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [reportSales]);
  const repOutstandingDetailRows = useMemo(() => {
    const repKey = String(repOutstandingDetailRep || "").trim();
    if (!repKey) return [];
    const map = new Map();
    for (const sale of reportSales) {
      const outstanding = Number(sale.outstandingAmount || 0);
      if (outstanding <= 0) continue;
      if ((String(sale.cashier || "-").trim() || "-") !== repKey) continue;
      const customerName = String(sale.customerName || "Walk-in").trim() || "Walk-in";
      const row = map.get(customerName) || { customerName, bills: 0, outstanding: 0, oldestOutstandingSale: null };
      row.bills += 1;
      row.outstanding += outstanding;
      const saleTime = new Date(sale.createdAt || 0).getTime();
      const oldestTime = row.oldestOutstandingSale ? new Date(row.oldestOutstandingSale.createdAt || 0).getTime() : Number.POSITIVE_INFINITY;
      if (!row.oldestOutstandingSale || saleTime < oldestTime) {
        row.oldestOutstandingSale = sale;
      }
      map.set(customerName, row);
    }
    return [...map.values()]
      .map((row) => ({
        customerName: row.customerName,
        bills: row.bills,
        outstanding: Number(row.outstanding.toFixed(2)),
        daysLabel: row.oldestOutstandingSale ? customerOutstandingAging(row.oldestOutstandingSale).label : "-"
      }))
      .sort((a, b) => Number(b.outstanding || 0) - Number(a.outstanding || 0));
  }, [repOutstandingDetailRep, reportSales]);
  const repOutstandingSummary = useMemo(() => ({
    reps: repOutstandingRows.length,
    bills: repOutstandingRows.reduce((acc, row) => acc + Number(row.bills || 0), 0),
    customers: repOutstandingRows.reduce((acc, row) => acc + Number(row.customers || 0), 0),
    outstanding: Number(repOutstandingRows.reduce((acc, row) => acc + Number(row.outstanding || 0), 0).toFixed(2))
  }), [repOutstandingRows]);
  const sortedRepOutstandingRows = useMemo(
    () => sortRows(repOutstandingRows, "repOutstanding", "outstanding", {
      rep: (row) => String(row.rep || ""),
      customers: (row) => Number(row.customers || 0),
      bills: (row) => Number(row.bills || 0),
      outstanding: (row) => Number(row.outstanding || 0)
    }),
    [repOutstandingRows, tableSort]
  );

  const loadingSummaryByLorry = useMemo(
    () => ORDER_LORRIES.reduce((acc, lorryName) => {
      const rows = loadingRowsByLorry[lorryName] || [];
      acc[lorryName] = {
        orderedQty: rows.reduce((sum, row) => sum + Number(row.orderedQty || 0), 0),
        orderedValue: rows.reduce((sum, row) => sum + Number(row.orderedValue || 0), 0),
        orderedSingles: rows.reduce((sum, row) => sum + Number(row.balance || 0), 0),
        deliveredQty: rows.reduce((sum, row) => sum + Number(row.deliveredQty || 0), 0),
        deliveredValue: rows.reduce((sum, row) => sum + Number(row.deliveredValue || 0), 0),
        deliveredSingles: rows.reduce((sum, row) => sum + Number(row.deliveredQty || 0), 0),
        stockSingles: rows.reduce((sum, row) => sum + Number(row.stock || 0), 0),
        loadedRows: rows.reduce((sum, row) => sum + (row.loaded ? 1 : 0), 0)
      };
      return acc;
    }, {}),
    [loadingRowsByLorry]
  );

  const deliveryRows = useMemo(() => {
    const rows = (state.sales || [])
      .filter((sale) => inDateTimeRange(sale.createdAt, deliveryDateFrom, deliveryDateTo, deliveryTimeFrom, deliveryTimeTo))
      .filter((sale) => (deliveryLorry === "all" ? true : sale.lorry === deliveryLorry))
      .map((sale) => {
        const undeliveredQty = (sale.deliveryAdjustments || []).reduce(
          (acc, adj) => acc + (adj.lines || []).reduce((lineAcc, line) => lineAcc + Number(line.quantity || 0), 0),
          0
        );
        const soldQty = (sale.lines || []).reduce((acc, line) => acc + Number(line.quantity || 0), 0);
        return {
          sale,
          id: sale.id,
          when: new Date(sale.createdAt).toLocaleString(),
          rep: sale.cashier || "-",
          lorry: sale.lorry || "-",
          total: saleNetTotal(sale),
          soldQty,
          undeliveredQty,
          confirmed: Boolean(sale.deliveryConfirmedAt)
        };
      });
    return rows.sort((a, b) => new Date(b.sale.createdAt).getTime() - new Date(a.sale.createdAt).getTime());
  }, [state.sales, deliveryDateFrom, deliveryDateTo, deliveryTimeFrom, deliveryTimeTo, deliveryLorry]);
  const sortedDeliveryRows = useMemo(
    () => sortRows(deliveryRows, "deliveries", "when", {
      id: (row) => Number(row.id || 0),
      when: (row) => new Date(row.sale?.createdAt || 0).getTime(),
      rep: (row) => String(row.rep || ""),
      lorry: (row) => String(row.lorry || ""),
      total: (row) => Number(row.total || 0),
      status: (row) => row.confirmed ? 1 : 0
    }),
    [deliveryRows, tableSort]
  );
  const notDeliveredRows = useMemo(() => {
    const rows = [];
    for (const sale of (state.sales || [])) {
      if (deliveryLorry !== "all" && sale.lorry !== deliveryLorry) continue;
      for (const adjustment of (sale.deliveryAdjustments || [])) {
        const adjustmentAt = adjustment?.createdAt || sale.deliveryConfirmedAt || sale.createdAt;
        if (!inDateTimeRange(adjustmentAt, deliveryDateFrom, deliveryDateTo, deliveryTimeFrom, deliveryTimeTo)) continue;
        for (const line of (adjustment.lines || [])) {
          const qty = Number(line.quantity || 0);
          if (qty <= 0) continue;
          const matchedSaleLine = (sale.lines || []).find((saleLine) => String(saleLine.productId || "") === String(line.productId || ""));
          const unitPrice = Number(matchedSaleLine?.price || matchedSaleLine?.basePrice || 0);
          rows.push({
            key: `${sale.id}-${line.productId}-${adjustmentAt}`,
            saleId: sale.id || "-",
            when: adjustmentAt ? new Date(adjustmentAt).toLocaleString() : "-",
            rep: sale.cashier || "-",
            lorry: sale.lorry || "-",
            customer: sale.customerName || "Walk-in",
            item: line.name || matchedSaleLine?.name || line.productId || "-",
            qty,
            value: Number((unitPrice * qty).toFixed(2)),
            createdAtTs: new Date(adjustmentAt || 0).getTime()
          });
        }
      }
    }
    return rows.sort((a, b) => Number(b.createdAtTs || 0) - Number(a.createdAtTs || 0));
  }, [state.sales, deliveryLorry, deliveryDateFrom, deliveryDateTo, deliveryTimeFrom, deliveryTimeTo]);
  const notDeliveredItemRows = useMemo(() => {
    const map = new Map();
    for (const row of notDeliveredRows) {
      const key = String(row.item || "-").trim() || "-";
      map.set(key, Number(map.get(key) || 0) + Number(row.qty || 0));
    }
    return Array.from(map.entries())
      .map(([item, qty]) => ({ item, qty: Number(qty || 0) }))
      .sort((a, b) => String(a.item || "").localeCompare(String(b.item || "")));
  }, [notDeliveredRows]);

  const deliveryReportSales = useMemo(
    () => (state.sales || [])
      .filter((sale) => inDateRange(sale.createdAt, deliveryReportDateFrom, deliveryReportDateTo))
      .filter((sale) => (deliveryLorry === "all" ? true : sale.lorry === deliveryLorry)),
    [state.sales, deliveryReportDateFrom, deliveryReportDateTo, deliveryLorry]
  );

  const deliveredItemRows = useMemo(() => {
    const sales = deliveryReportSales.filter((sale) => Boolean(sale.deliveryConfirmedAt));
    const map = new Map();
    for (const sale of sales) {
      const undeliveredByProduct = new Map();
      for (const adj of (sale.deliveryAdjustments || [])) {
        for (const line of (adj.lines || [])) {
          undeliveredByProduct.set(line.productId, (undeliveredByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
        }
      }
      for (const line of (sale.lines || [])) {
        const lineState = effectiveSaleLineState(sale, line, {
          returnedByProduct: saleReturnedQtyByProduct(sale, state.returns || []),
          undeliveredByProduct
        });
        if (lineState.effectiveQty <= 0) continue;
        const key = line.productId || line.name;
        const current = map.get(key) || {
          key,
          item: line.name || productInfoById.get(line.productId)?.name || "Unknown",
          sku: productInfoById.get(line.productId)?.sku || "-",
          qty: 0,
          value: 0
        };
        current.qty += lineState.effectiveQty;
        current.value += lineState.effectiveRevenue;
        map.set(key, current);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [deliveryReportSales, productInfoById]);

  const deliveredTotals = useMemo(() => ({
    qty: deliveredItemRows.reduce((acc, row) => acc + Number(row.qty || 0), 0),
    value: Number(deliveredItemRows.reduce((acc, row) => acc + Number(row.value || 0), 0).toFixed(2))
  }), [deliveredItemRows]);
  const sortedDeliveredItemRows = useMemo(
    () => sortRows(deliveredItemRows, "deliveredItems", "qty", {
      item: (row) => String(row.item || ""),
      sku: (row) => String(row.sku || ""),
      qty: (row) => Number(row.qty || 0),
      value: (row) => Number(row.value || 0)
    }),
    [deliveredItemRows, tableSort]
  );

  const soldTotals = useMemo(() => ({
    qty: deliveryReportSales.reduce(
      (acc, sale) => acc + (sale.lines || []).reduce((lineAcc, line) => lineAcc + Number(line.quantity || 0), 0),
      0
    ),
    value: Number(deliveryReportSales.reduce((acc, sale) => acc + saleNetTotal(sale), 0).toFixed(2))
  }), [deliveryReportSales]);

  const reportDeliverySales = useMemo(
    () => (state.sales || [])
      .filter((sale) => inDateRange(sale.createdAt, reportDeliveryDateFrom, reportDeliveryDateTo))
      .filter((sale) => (reportDeliveryLorry === "all" ? true : sale.lorry === reportDeliveryLorry)),
    [state.sales, reportDeliveryDateFrom, reportDeliveryDateTo, reportDeliveryLorry]
  );

  const reportDeliveryRows = useMemo(() => {
    const rows = reportDeliverySales.map((sale) => {
      const soldQty = (sale.lines || []).reduce((acc, line) => acc + Number(line.quantity || 0), 0);
      const isConfirmed = Boolean(sale.deliveryConfirmedAt);
      const undeliveredByProduct = new Map();
      if (isConfirmed) {
        for (const adj of (sale.deliveryAdjustments || [])) {
          for (const line of (adj.lines || [])) {
            undeliveredByProduct.set(line.productId, (undeliveredByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
          }
        }
      }
      let undeliveredQty = 0;
      let deliveredQty = 0;
      let deliveredValue = 0;
      for (const line of (sale.lines || [])) {
        const lineState = isConfirmed
          ? effectiveSaleLineState(sale, line, {
            returnedByProduct: saleReturnedQtyByProduct(sale, state.returns || []),
            undeliveredByProduct
          })
          : { undeliveredQty: 0, effectiveQty: 0, effectiveRevenue: 0 };
        undeliveredQty += Number(lineState.undeliveredQty || 0);
        deliveredQty += Number(lineState.effectiveQty || 0);
        deliveredValue += Number(lineState.effectiveRevenue || 0);
      }
      return {
        id: sale.id,
        date: sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "-",
        rep: sale.cashier || "-",
        lorry: sale.lorry || "-",
        status: isConfirmed ? "Confirmed" : "Pending",
        soldQty,
        undeliveredQty,
        deliveredQty,
        deliveredValue: Number(deliveredValue.toFixed(2))
      };
    });
    return rows.sort((a, b) => Number(b.id) - Number(a.id));
  }, [reportDeliverySales]);

  const reportDeliverySummary = useMemo(() => {
    const totalBills = reportDeliveryRows.length;
    const confirmedBills = reportDeliveryRows.filter((row) => row.status === "Confirmed").length;
    const pendingBills = totalBills - confirmedBills;
    const soldQtyTotal = reportDeliveryRows.reduce((acc, row) => acc + Number(row.soldQty || 0), 0);
    const undeliveredQtyTotal = reportDeliveryRows.reduce((acc, row) => acc + Number(row.undeliveredQty || 0), 0);
    const deliveredQtyTotal = reportDeliveryRows.reduce((acc, row) => acc + Number(row.deliveredQty || 0), 0);
    const deliveredValueTotal = Number(reportDeliveryRows.reduce((acc, row) => acc + Number(row.deliveredValue || 0), 0).toFixed(2));
    const deliveryRate = soldQtyTotal > 0 ? Number(((deliveredQtyTotal / soldQtyTotal) * 100).toFixed(1)) : 0;
    return {
      totalBills,
      confirmedBills,
      pendingBills,
      soldQtyTotal,
      undeliveredQtyTotal,
      deliveredQtyTotal,
      deliveredValueTotal,
      deliveryRate
    };
  }, [reportDeliveryRows]);
  const sortedReportDeliveryRows = useMemo(
    () => sortRows(reportDeliveryRows, "deliveryReport", "id", {
      id: (row) => Number(row.id || 0),
      date: (row) => new Date(row.date || 0).getTime(),
      rep: (row) => String(row.rep || ""),
      lorry: (row) => String(row.lorry || ""),
      status: (row) => String(row.status || ""),
      soldQty: (row) => Number(row.soldQty || 0),
      undeliveredQty: (row) => Number(row.undeliveredQty || 0),
      deliveredQty: (row) => Number(row.deliveredQty || 0),
      deliveredValue: (row) => Number(row.deliveredValue || 0)
    }),
    [reportDeliveryRows, tableSort]
  );

  const emptyBottleLogRows = useMemo(() => {
    return (state.emptyBottleCollections || [])
      .filter((entry) => inDateRange(entry.createdAt, emptyBottleLogDateFrom, emptyBottleLogDateTo))
      .filter((entry) => !emptyBottleLogRepFilter || String(entry.collectedBy || "").trim().toLowerCase() === emptyBottleLogRepFilter.trim().toLowerCase())
      .map((entry) => {
        const sale = (state.sales || []).find((s) => String(s.id) === String(entry.saleId));
        const remaining = sale ? Math.max(0, Number(sale.emptyBottlesOwed || 0) - Number(sale.emptyBottlesCollected || 0)) : 0;
        return { ...entry, when: new Date(entry.createdAt).toLocaleString(), remaining };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.emptyBottleCollections, state.sales, emptyBottleLogDateFrom, emptyBottleLogDateTo, emptyBottleLogRepFilter]);
  const emptyBottleLogSummary = useMemo(() => {
    const totalQty = emptyBottleLogRows.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
    const collectors = new Set(emptyBottleLogRows.map((row) => row.collectedBy).filter(Boolean));
    const customers = new Set(emptyBottleLogRows.map((row) => row.customerName).filter(Boolean));

    let totalOutstanding = 0;
    const salesToCheck = state.sales || [];
    for (const sale of salesToCheck) {
      if (emptyBottleLogRepFilter && String(sale.cashier || "").trim().toLowerCase() !== emptyBottleLogRepFilter.trim().toLowerCase()) continue;
      totalOutstanding += Math.max(0, Number(sale.emptyBottlesOwed || 0) - Number(sale.emptyBottlesCollected || 0));
    }

    return {
      entries: emptyBottleLogRows.length,
      totalQty,
      collectors: collectors.size,
      customers: customers.size,
      totalOutstanding
    };
  }, [emptyBottleLogRows, state.sales, emptyBottleLogRepFilter]);

  const viewedSale = useMemo(
    () => (state.sales || []).find((sale) => String(sale.id) === String(viewSaleId)) || null,
    [state.sales, viewSaleId]
  );
  const viewedSaleReturnByProduct = useMemo(() => {
    const map = new Map();
    if (!viewedSale) return map;
    for (const ret of (state.returns || [])) {
      if (String(ret.saleId) !== String(viewedSale.id)) continue;
      for (const line of (ret.lines || [])) {
        const key = String(line.productId || "");
        if (!key) continue;
        const current = map.get(key) || { qty: 0, amount: 0 };
        current.qty += Number(line.quantity || 0);
        current.amount += Number(line.returnAmount || 0);
        map.set(key, current);
      }
    }
    return map;
  }, [state.returns, viewedSale]);
  const viewedSaleUndeliveredByProduct = useMemo(() => {
    const map = new Map();
    if (!viewedSale) return map;
    for (const adjustment of (viewedSale.deliveryAdjustments || [])) {
      for (const line of (adjustment.lines || [])) {
        const key = String(line.productId || "");
        if (!key) continue;
        map.set(key, Number(map.get(key) || 0) + Number(line.quantity || 0));
      }
    }
    return map;
  }, [viewedSale]);
  const viewedSaleReturnedAmount = useMemo(
    () => Number((viewedSale?.returnedAmount || 0).toFixed(2)),
    [viewedSale]
  );
  const viewedSaleNetAmount = useMemo(
    () => saleNetTotal(viewedSale),
    [viewedSale]
  );
  const viewedSalePaymentDisplay = useMemo(
    () => saleDisplayPaymentInfo(viewedSale),
    [viewedSale]
  );

  const deliverySale = useMemo(
    () => (state.sales || []).find((sale) => String(sale.id) === String(deliverySaleId)) || null,
    [state.sales, deliverySaleId]
  );
  const deliveryPaymentRows = useMemo(
    () => salePayments(deliverySale),
    [deliverySale]
  );
  const deliveryPaidSoFar = useMemo(
    () => Number(deliveryPaymentRows.reduce((acc, payment) => acc + Number(payment.amount || 0), 0).toFixed(2)),
    [deliveryPaymentRows]
  );
  const deliveryDraftCash = useMemo(
    () => Math.max(0, Number(deliveryCashReceived || 0) || 0),
    [deliveryCashReceived]
  );
  const deliveryDraftCheque = useMemo(
    () => Math.max(0, Number(deliveryChequeAmount || 0) || 0),
    [deliveryChequeAmount]
  );
  const deliveryDraftSettlement = useMemo(
    () => Number((deliveryDraftCash + deliveryDraftCheque).toFixed(2)),
    [deliveryDraftCash, deliveryDraftCheque]
  );
  const deliveryUndeliveredAmount = useMemo(
    () => deliveryAdjustmentAmount(deliverySale),
    [deliverySale]
  );
  const deliveryUndeliveredAmountWithDraft = useMemo(
    () => deliveryAdjustmentAmount(deliverySale, deliveryDraft),
    [deliverySale, deliveryDraft]
  );
  const deliveryRemaining = useMemo(
    () => Math.max(0, Number((Number(deliverySale?.total || 0) - Number(deliverySale?.returnedAmount || 0) - deliveryUndeliveredAmount - deliveryPaidSoFar).toFixed(2))),
    [deliverySale?.total, deliverySale?.returnedAmount, deliveryUndeliveredAmount, deliveryPaidSoFar]
  );
  const deliveryRemainingAfterDraft = useMemo(
    () => Math.max(0, Number((Number(deliverySale?.total || 0) - Number(deliverySale?.returnedAmount || 0) - deliveryUndeliveredAmountWithDraft - deliveryPaidSoFar - deliveryDraftSettlement).toFixed(2))),
    [deliverySale?.total, deliverySale?.returnedAmount, deliveryUndeliveredAmountWithDraft, deliveryPaidSoFar, deliveryDraftSettlement]
  );
  const deliverySettlementLimit = useMemo(() => {
    const extraUndelivered = Math.max(0, Number((deliveryUndeliveredAmountWithDraft - deliveryUndeliveredAmount).toFixed(2)));
    return Math.max(0, Number((deliveryRemaining - extraUndelivered).toFixed(2)));
  }, [deliveryRemaining, deliveryUndeliveredAmountWithDraft, deliveryUndeliveredAmount]);

  const openAdminSaleEdit = (sale) => {
    const hasReturns = (state.returns || []).some((ret) => String(ret.saleId) === String(sale?.id));
    if (hasReturns) {
      setNotice("This bill cannot be edited after returns have been submitted.");
      return;
    }
    setEditingAdminSaleId(sale.id);
    setAdminSaleEditLines((sale.lines || []).map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: Number(line.quantity || 0)
    })));
    setAdminSaleEditError("");
  };

  const saveAdminSaleEdit = async () => {
    try {
      const lines = adminSaleEditLines
        .map((line) => ({ ...line, quantity: Number(line.quantity || 0) }))
        .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);
      if (!editingAdminSaleId || !lines.length) {
        setAdminSaleEditError("Keep at least one item in bill.");
        return;
      }
      setSavingAdminSaleEdit(true);
      setAdminSaleEditError("");
      await patchSale(editingAdminSaleId, { lines });
      setEditingAdminSaleId("");
      setAdminSaleEditLines([]);
      setNotice("Sale updated.");
    } catch (error) {
      setAdminSaleEditError(error.message);
    } finally {
      setSavingAdminSaleEdit(false);
    }
  };

  const deleteAdminSale = async (sale) => {
    try {
      const hasDeliveryProcessing = Boolean(sale?.deliveryConfirmedAt) || Boolean((sale?.deliveryAdjustments || []).length) || Boolean(sale?.preOrderConfirmedAt);
      if (hasDeliveryProcessing) {
        setNotice("This bill cannot be deleted after delivery processing has started.");
        return;
      }
      const ok = await requestConfirm({
        title: "Delete Sale",
        message: `Are you sure want to delete sale #${sale.id}? This will restore stock and remove linked returns.`,
        confirmLabel: "Delete",
        tone: "danger"
      });
      if (!ok) return;
      setDeletingSaleId(String(sale.id));
      await deleteSale(sale.id);
      onSaleDeleted?.(sale.id);
      setNotice(`Sale #${sale.id} deleted.`);
      if (editingAdminSaleId && String(editingAdminSaleId) === String(sale.id)) {
        setEditingAdminSaleId("");
        setAdminSaleEditLines([]);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDeletingSaleId("");
    }
  };

  const printAdminSaleReceipt = (sale) => {
    const printSale = sale || viewedSale;
    if (!printSale) return;
    const returnByProduct = new Map();
    for (const ret of (state.returns || [])) {
      if (String(ret.saleId) !== String(printSale.id)) continue;
      for (const line of (ret.lines || [])) {
        const key = String(line.productId || "");
        if (!key) continue;
        const current = returnByProduct.get(key) || { qty: 0, amount: 0 };
        current.qty += Number(line.quantity || 0);
        current.amount += Number(line.returnAmount || 0);
        returnByProduct.set(key, current);
      }
    }
    const undeliveredByProduct = new Map();
    for (const adjustment of (printSale.deliveryAdjustments || [])) {
      for (const line of (adjustment.lines || [])) {
        const key = String(line.productId || "");
        if (!key) continue;
        undeliveredByProduct.set(key, Number(undeliveredByProduct.get(key) || 0) + Number(line.quantity || 0));
      }
    }
    openSaleReceiptPrint({
      sale: printSale,
      customers: state.customers || [],
      products: state.products || [],
      allSales: state.sales || [],
      returnByProduct,
      undeliveredByProduct,
      returnedAmountOverride: Number(printSale?.returnedAmount || 0),
      totalOverride: saleNetTotal(printSale),
      onPopupBlocked: () => setNotice("Allow popups to print receipt.")
    });
  };

  const printLoadingBreakdown = ({ lorry, rows, summary }) => {
    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setNotice("Allow popups to print loading breakdown.");
      return;
    }
    const fromLabel = loadingDateFrom ? loadingDateFrom + (loadingTimeFrom ? " " + loadingTimeFrom : "") : "-";
    const toLabel = loadingDateTo ? loadingDateTo + (loadingTimeTo ? " " + loadingTimeTo : "") : "-";
    const dateRangeLabel = `${fromLabel} to ${toLabel}`;
    const rowsHtml = (rows || []).length ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(String(row.sku || "-"))}</td>
        <td>${Number(row.orderedQty || 0)}</td>
        <td>${formatLkrValue(row.orderedValue || 0)}</td>
        
        <td>${Number(row.balance || 0)}</td>
        <td>${Number(row.deliveredQty || 0)}</td>
        <td>${formatLkrValue(row.deliveredValue || 0)}</td>
      </tr>
    `).join("") : `<tr><td colspan="7">No loading records for ${escapeHtml(lorry)} in selected range.</td></tr>`;
    const printHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(lorry)} Loading Breakdown</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { margin: 0; background: #fff; font-family: "Segoe UI", Arial, sans-serif; color: #122640; }
    .sheet { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm; }
    .head { display: grid; grid-template-columns: 82px 1fr; gap: 14px; align-items: center; border: 1px solid #cdd9e8; border-radius: 18px; padding: 14px 16px; background: linear-gradient(135deg, #fbfdff 0%, #eef4fc 46%, #e2ecfa 100%); }
    .head img { width: 74px; height: 74px; object-fit: contain; }
    .head h1 { margin: 0; font-size: 24px; line-height: 1.05; }
    .head p { margin: 6px 0 0; color: #4e647d; font-size: 13px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
    .kpis article { border: 1px solid #d2ddea; border-radius: 14px; padding: 10px 12px; background: #f7fbff; }
    .kpis span { display: block; color: #536980; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .kpis strong { display: block; margin-top: 5px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #afbdd0; padding: 8px 9px; font-size: 13px; }
    th { background: #e5edf8; text-transform: uppercase; font-size: 12px; letter-spacing: .04em; }
    th:nth-child(n+2), td:nth-child(n+2) { text-align: center; }
    .footer { margin-top: 18px; display: flex; justify-content: space-between; gap: 16px; color: #5b6f86; font-size: 12px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <img src="/lucky-logo.png" alt="Lucky" />
      <div>
        <h1>${escapeHtml(lorry)} Loading Breakdown</h1>
        <p>Lucky Distributor POS • Date Range: ${escapeHtml(dateRangeLabel)}</p>
      </div>
    </div>
    <div class="kpis">
      <article><span>Ordered Qty</span><strong>${Number(summary?.orderedQty || 0)}</strong></article>
      <article><span>Ordered Value</span><strong>LKR ${formatLkrValue(summary?.orderedValue || 0)}</strong></article>
      <article><span>Delivered Qty</span><strong>${Number(summary?.deliveredQty || 0)}</strong></article>
      <article><span>Delivered Value</span><strong>LKR ${formatLkrValue(summary?.deliveredValue || 0)}</strong></article>
      
      <article><span>Ordered Singles</span><strong>${Number(summary?.orderedSingles || 0)}</strong></article>
      
      <article><span>Delivered Singles</span><strong>${Number(summary?.deliveredSingles || 0)}</strong></article>
    </div>
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Ord Qty</th>
          <th>Ord Value (LKR)</th>
          
          <th>Singles</th>
          <th>Del Qty</th>
          <th>Del Value (LKR)</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="footer">
      <div>Generated on ${escapeHtml(new Date().toLocaleString())}</div>
      <div>J&amp;Co. Software Solutions</div>
    </div>
  </div>
</body>
</html>`;
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const printRepOutstandingCustomers = ({ rep, rows }) => {
    const printWindow = window.open("", "_blank", "width=980,height=900");
    if (!printWindow) {
      setNotice("Allow popups to print rep outstanding details.");
      return;
    }
    const generatedAt = new Date().toLocaleString();
    const totalBills = Number((rows || []).reduce((acc, row) => acc + Number(row.bills || 0), 0));
    const totalOutstanding = Number((rows || []).reduce((acc, row) => acc + Number(row.outstanding || 0), 0).toFixed(2));
    const bodyRows = (rows || []).length
      ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(String(row.customerName || "-"))}</td>
          <td>${Number(row.bills || 0)}</td>
          <td>LKR ${formatLkrValue(row.outstanding || 0)}</td>
          <td>${escapeHtml(String(row.daysLabel || "-"))}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="4">No outstanding customers for this rep in the selected range.</td></tr>`;
    const printHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(rep)} Customer Outstanding</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { margin: 0; background: #fff; font-family: "Segoe UI", Arial, sans-serif; color: #122640; }
    .sheet { width: 100%; max-width: 190mm; margin: 0 auto; padding: 4mm; }
    .head { display: grid; grid-template-columns: 82px 1fr; gap: 14px; align-items: center; border: 1px solid #cdd9e8; border-radius: 18px; padding: 14px 16px; background: linear-gradient(135deg, #fbfdff 0%, #eef4fc 46%, #e2ecfa 100%); }
    .head img { width: 74px; height: 74px; object-fit: contain; }
    .head h1 { margin: 0; font-size: 24px; line-height: 1.05; }
    .head p { margin: 6px 0 0; color: #4e647d; font-size: 13px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .summary article { border: 1px solid #d2ddea; border-radius: 14px; padding: 10px 12px; background: #f7fbff; }
    .summary span { display: block; color: #536980; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .summary strong { display: block; margin-top: 5px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #afbdd0; padding: 9px 10px; font-size: 13px; }
    th { background: #e5edf8; text-transform: uppercase; font-size: 12px; letter-spacing: .04em; text-align: left; }
    th:nth-child(2), th:nth-child(3), td:nth-child(2), td:nth-child(3) { text-align: center; }
    .footer { margin-top: 18px; display: flex; justify-content: space-between; gap: 16px; color: #5b6f86; font-size: 12px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <img src="/lucky-logo.png" alt="Lucky" />
      <div>
        <h1>${escapeHtml(rep)} Customer Outstanding</h1>
        <p>Outstanding customer summary by rep</p>
      </div>
    </div>
    <div class="summary">
      <article><span>Customers</span><strong>${Number(rows?.length || 0)}</strong></article>
      <article><span>Bills</span><strong>${totalBills}</strong></article>
      <article><span>Outstanding</span><strong>LKR ${formatLkrValue(totalOutstanding)}</strong></article>
    </div>
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Bills</th>
          <th>Outstanding (LKR)</th>
          <th>Days Left</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="footer">
      <div>Generated on ${escapeHtml(generatedAt)}</div>
      <div>J&amp;Co. Software Solutions</div>
    </div>
  </div>
</body>
</html>`;
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const printNotDeliveredReport = (rows) => {
    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      setNotice("Allow popups to print not delivered report.");
      return;
    }
    const fromLabel = deliveryDateFrom ? deliveryDateFrom + (deliveryTimeFrom ? " " + deliveryTimeFrom : "") : "-";
    const toLabel = deliveryDateTo ? deliveryDateTo + (deliveryTimeTo ? " " + deliveryTimeTo : "") : "-";
    const rangeLabel = `${fromLabel} to ${toLabel}`;
    const lorryLabel = deliveryLorry === "all" ? "All Lorries" : deliveryLorry;
    const totalQty = Number((rows || []).reduce((sum, row) => sum + Number(row.qty || 0), 0));
    const totalValue = Number((notDeliveredRows || []).reduce((sum, row) => sum + Number(row.value || 0), 0).toFixed(2));
    const bodyRows = (rows || []).length
      ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(String(row.item || "-"))}</td>
          <td>${Number(row.qty || 0)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="2">No not-delivered items found for the selected range.</td></tr>`;
    const printHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Not Delivered Report</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { margin: 0; background: #fff; font-family: "Segoe UI", Arial, sans-serif; color: #122640; }
    .sheet { width: 100%; margin: 0 auto; }
    .head { border: 1px solid #cdd9e8; border-radius: 16px; padding: 12px 14px; background: linear-gradient(135deg, #fbfdff 0%, #eef4fc 46%, #e2ecfa 100%); }
    .head h1 { margin: 0; font-size: 24px; line-height: 1.05; }
    .head p { margin: 6px 0 0; color: #4e647d; font-size: 13px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
    .summary article { border: 1px solid #d2ddea; border-radius: 12px; padding: 8px 10px; background: #f7fbff; }
    .summary span { display: block; color: #536980; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .summary strong { display: block; margin-top: 4px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #afbdd0; padding: 8px 9px; font-size: 12px; }
    th { background: #e5edf8; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; text-align: left; }
    td:nth-child(2), th:nth-child(2) { text-align: right; }
    .footer { margin-top: 14px; display: flex; justify-content: space-between; gap: 12px; color: #5b6f86; font-size: 12px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <h1>Not Delivered Report</h1>
      <p>Date/Time Range: ${escapeHtml(rangeLabel)} | Lorry: ${escapeHtml(lorryLabel)}</p>
    </div>
    <div class="summary">
      <article><span>Rows</span><strong>${Number(rows?.length || 0)}</strong></article>
      <article><span>ND Qty</span><strong>${totalQty}</strong></article>
      <article><span>ND Value</span><strong>LKR ${formatLkrValue(totalValue)}</strong></article>
      <article><span>Generated</span><strong>${escapeHtml(new Date().toLocaleString())}</strong></article>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>ND Qty</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <div class="footer">
      <div>Lucky Distributor POS</div>
      <div>J&amp;Co. Software Solutions</div>
    </div>
  </div>
</body>
</html>`;
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const openDeliveryModal = (sale) => {
    setDeliverySaleId(String(sale.id));
    setDeliveryDraft({});
    const payments = sale.payments || [];
    const cashP = payments.find((p) => String(p.method || "").toLowerCase() === "cash");
    const chequeP = payments.find((p) => String(p.method || "").toLowerCase() === "cheque");
    setDeliveryCashReceived(cashP ? String(cashP.amount || "") : (sale.cashReceived ? String(sale.cashReceived) : ""));
    setDeliveryChequeAmount(chequeP ? String(chequeP.amount || "") : (sale.chequeAmount ? String(sale.chequeAmount) : ""));
    setDeliveryChequeNo(chequeP?.chequeNo || sale.chequeNo || "");
    setDeliveryChequeDate(chequeP?.chequeDate || sale.chequeDate || "");
    setDeliveryChequeBank(chequeP?.chequeBank || sale.chequeBank || "");
    setDeliveryError("");
  };

  const onDeliveryDraftChange = (productId, value) => {
    setDeliveryDraft((current) => ({ ...current, [productId]: value }));
  };

  const saveDeliveryAdjust = async (shouldPrint = false) => {
    try {
      if (!deliverySale) {
        setDeliveryError("Sale not found.");
        return;
      }
      const lines = (deliverySale.lines || [])
        .map((line) => ({
          productId: line.productId,
          quantity: Number(deliveryDraft[line.productId] || 0)
        }))
        .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);
      const cash = Number(deliveryCashReceived || 0);
      const cheque = Number(deliveryChequeAmount || 0);
      if (!Number.isFinite(cash) || cash < 0) {
        setDeliveryError("Cash received must be 0 or more.");
        return;
      }
      if (!Number.isFinite(cheque) || cheque < 0) {
        setDeliveryError("Cheque amount must be 0 or more.");
        return;
      }
      if ((cash + cheque) > Number((deliverySettlementLimit + 0.01).toFixed(2))) {
        setDeliveryError(`Cash and cheque total cannot exceed remaining balance (${currency(deliverySettlementLimit)}).`);
        return;
      }
      if (cheque > 0 && (!deliveryChequeNo.trim() || !deliveryChequeDate || !deliveryChequeBank.trim())) {
        setDeliveryError("Enter cheque number, date, and bank.");
        return;
      }
      setSavingDelivery(true);
      setDeliveryError("");
      const updatedSale = await submitDeliveryAdjustment(deliverySale.id, {
        lines,
        markConfirmed: true,
        cashReceived: cash,
        chequeAmount: cheque,
        chequeNo: deliveryChequeNo.trim(),
        chequeDate: deliveryChequeDate,
        chequeBank: deliveryChequeBank.trim()
      });

      const freshState = await fetchState();

      const targetSale = (freshState?.sales || state.sales || []).find((s) => String(s.id) === String(deliverySale.id)) || updatedSale || deliverySale;

      if (shouldPrint) {
        openSaleReceiptPrint({
          sale: targetSale,
          customers: freshState?.customers || state.customers || [],
          products: freshState?.products || state.products || [],
          allSales: freshState?.sales || state.sales || [],
          onPopupBlocked: () => setDeliveryError("Popup blocked. Please allow popups to print receipts.")
        });
      }

      const wasAlreadyConfirmed = Boolean(deliverySale.deliveryConfirmedAt);
      setDeliverySaleId("");
      setDeliveryDraft({});
      setDeliveryCashReceived("");
      setDeliveryChequeAmount("");
      setDeliveryChequeNo("");
      setDeliveryChequeDate("");
      setDeliveryChequeBank("");
      setNotice(wasAlreadyConfirmed ? `Payment updated for sale #${deliverySale.id}.` : `Delivery confirmed for sale #${deliverySale.id}.`);
    } catch (error) {
      setDeliveryError(error.message);
    } finally {
      setSavingDelivery(false);
    }
  };

  const openCustomerAdd = () => {
    setCustomerForm({ id: "", name: "", phone: "", address: "", route: "", openingOutstanding: "", creditLimit: "", discountLimit: "", outstandingAdjustment: "", outstandingAdjustmentReason: "", openingEmptyBottles: "", itemPrices: {} });
    setShowCustomerForm(true);
  };

  const openCustomerEdit = () => {
    const first = (state.customers || [])[0];
    if (!first) {
      setNotice("No customer to edit.");
      return;
    }
    setCustomerForm({
      id: first.id,
      name: first.name,
      phone: first.phone || "",
      address: first.address || "",
      route: first.route || "",
      openingOutstanding: first.openingOutstanding ? String(first.openingOutstanding) : "",
      creditLimit: first.creditLimit ? String(first.creditLimit) : "",
      discountLimit: first.discountLimit ? String(first.discountLimit) : "",
      bundleDiscountLimit: first.bundleDiscountLimit ? String(first.bundleDiscountLimit) : "",
      outstandingAdjustment: first.outstandingAdjustment ? String(first.outstandingAdjustment) : "",
      outstandingAdjustmentReason: first.outstandingAdjustmentReason || "",
      openingEmptyBottles: first.openingEmptyBottles ? String(first.openingEmptyBottles) : "",
      itemPrices: first.itemPrices || {}
    });
    setShowCustomerForm(true);
  };

  const openCustomerEditByRow = (row) => {
    if (!row) return;
    const matched = (state.customers || []).find((item) => String(item.name || "").trim().toLowerCase() === String(row.name || "").trim().toLowerCase());
    if (!matched) {
      setNotice("Selected customer was not found in saved list.");
      return;
    }
    setCustomerForm({
      id: matched.id,
      name: matched.name || row.name || "",
      phone: matched.phone || row.phone || "",
      address: matched.address || row.address || "",
      route: matched.route || row.route || "",
      openingOutstanding: matched.openingOutstanding ? String(matched.openingOutstanding) : "",
      creditLimit: matched.creditLimit ? String(matched.creditLimit) : "",
      discountLimit: matched.discountLimit ? String(matched.discountLimit) : "",
      outstandingAdjustment: matched.outstandingAdjustment ? String(matched.outstandingAdjustment) : "",
      outstandingAdjustmentReason: matched.outstandingAdjustmentReason || "",
      openingEmptyBottles: matched.openingEmptyBottles ? String(matched.openingEmptyBottles) : "",
      itemPrices: matched.itemPrices || {}
    });
    setShowCustomerForm(true);
  };

  const saveCustomer = () => {
    if (!customerForm.name.trim()) {
      setNotice("Customer name is required.");
      return;
    }
    if (isManager && !managerFullAccessEnabled && customerForm.id) {
      setNotice("Manager limited access cannot edit customers.");
      return;
    }
    const openingOutstanding = Number(customerForm.openingOutstanding || 0);
    const creditLimit = Number(customerForm.creditLimit || 0);
    const discountLimit = Number(customerForm.discountLimit || 0);
    const bundleDiscountLimit = Number(customerForm.bundleDiscountLimit || 0);
    const outstandingAdjustment = Number(customerForm.outstandingAdjustment || 0);
    const outstandingAdjustmentReason = String(customerForm.outstandingAdjustmentReason || "").trim();
    const openingEmptyBottles = Number(customerForm.openingEmptyBottles || 0);
    if (!Number.isFinite(openingOutstanding) || openingOutstanding < 0) {
      setNotice("Opening outstanding must be 0 or more.");
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setNotice("Credit limit must be 0 or more.");
      return;
    }
    if (!Number.isFinite(discountLimit) || discountLimit < 0) {
      setNotice("Discount limit must be 0 or more.");
      return;
    }
    if (!Number.isFinite(bundleDiscountLimit) || bundleDiscountLimit < 0) {
      setNotice("Bundle discount limit must be 0 or more.");
      return;
    }
    if (!Number.isFinite(outstandingAdjustment) || outstandingAdjustment < 0) {
      setNotice("Outstanding adjustment must be 0 or more.");
      return;
    }
    const payload = {
      name: customerForm.name.trim(),
      phone: customerForm.phone,
      address: customerForm.address,
      route: (customerForm.route || "").trim(),
      openingEmptyBottles
    };
    if (canManageCustomerOpeningOutstanding) {
      payload.openingOutstanding = Number(openingOutstanding.toFixed(2));
    }
    if (canManageCustomerLimits) {
      payload.creditLimit = Number(creditLimit.toFixed(2));
      payload.discountLimit = Number(discountLimit.toFixed(2));
      payload.bundleDiscountLimit = Number(bundleDiscountLimit.toFixed(2));
      
      const cleanItemPrices = {};
      for (const [pId, price] of Object.entries(customerForm.itemPrices || {})) {
        if (price !== "" && Number.isFinite(Number(price)) && Number(price) >= 0) {
          cleanItemPrices[pId] = Number(price);
        }
      }
      payload.itemPrices = cleanItemPrices;
    }
    if (canManageOutstandingAdjustment) {
      payload.outstandingAdjustment = Number(outstandingAdjustment.toFixed(2));
      payload.outstandingAdjustmentReason = outstandingAdjustmentReason;
    }
    const action = customerForm.id ? updateCustomer(customerForm.id, payload) : createCustomer(payload);
    return action.then(() => {
        setShowCustomerForm(false);
        setNotice("Customer saved.");
      })
      .catch((error) => setNotice(error.message));
  };

  const deleteCustomerByRow = async (row) => {
    if (!row?.id) {
      setNotice("Selected customer was not found in saved list.");
      return;
    }
    if (!(isAdmin || (isManager && managerFullAccessEnabled))) {
      setNotice("Manager limited access cannot delete customers.");
      return;
    }
    const ok = await requestConfirm({
      title: "Delete Customer",
      message: `Are you sure you want to delete ${row.name}? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger"
    });
    if (!ok) return;
    try {
      await deleteCustomer(row.id);
      setNotice(`Customer deleted: ${row.name}.`);
      setCustomerDetailName("");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const openStaffAdd = () => {
    if (!canManageUsers) {
      setNotice("Manager access cannot create or edit users.");
      return;
    }
    setStaffForm({ id: "", authUserId: "", name: "", role: "", phone: "", monthlySalary: "", username: "", password: "", authRole: "cashier" });
    setShowStaffForm(true);
  };

  const openStaffEditByRow = (row) => {
    if (!canManageUsers) {
      setNotice("Manager access cannot create or edit users.");
      return;
    }
    if (!row) return;
    const matched = (state.staff || []).find((item) => String(item.id || "") === String(row.staffId || ""))
      || (state.staff || []).find(
        (item) => String(item.name || "").trim().toLowerCase() === String(row.name || "").trim().toLowerCase()
      );
    const matchedAuth = (authUsers || []).find((item) => String(item.id || "") === String(row.authUserId || ""))
      || (authUsers || []).find(
        (item) => String(item.username || "").trim().toLowerCase() === String(row.username || "").trim().toLowerCase()
      )
      || (authUsers || []).find(
        (item) => String(item.name || "").trim().toLowerCase() === String(row.name || "").trim().toLowerCase()
      );
    if (!matched && !matchedAuth) {
      setNotice("Selected user was not found.");
      return;
    }
    setStaffForm({
      id: matched?.id || "",
      authUserId: matchedAuth?.id || "",
      name: matchedAuth?.name || matched?.name || row.name || "",
      role: matched?.role || row.role || "",
      phone: matched?.phone || row.phone || "",
      monthlySalary: matched?.monthlySalary || row.monthlySalary || "",
      username: matchedAuth?.username || row.username || "",
      password: "",
      authRole: matchedAuth?.role || row.authRole || "cashier"
    });
    setShowStaffForm(true);
  };

  const saveAccount = () => {
    if (!accountForm.name.trim()) {
      setNotice("Account name is required.");
      return;
    }
    const payload = {
      name: accountForm.name.trim(),
      type: accountForm.type,
      initialBalance: Number(accountForm.initialBalance || 0)
    };
    const action = accountForm.id ? updateAccount(accountForm.id, payload) : createAccount(payload);
    return action.then(() => {
      setShowAccountsModal(false);
      setAccountForm({ id: "", name: "", type: "bank", initialBalance: "" });
      setNotice("Account saved successfully!");
    }).catch((err) => setNotice(err.message || "Failed to save account"));
  };

  const deleteAccountHandler = (id) => {
    if (confirm("Are you sure you want to delete this account?")) {
      deleteAccount(id).catch((err) => setNotice(err.message || "Failed to delete account"));
    }
  };

  const saveSupplier = () => {
    if (!supplierForm.name.trim()) {
      setNotice("Supplier name is required.");
      return;
    }
    const payload = { ...supplierForm };
    const action = supplierForm.id ? updateSupplier(supplierForm.id, payload) : createSupplier(payload);
    return action.then(() => {
      setSupplierForm({ id: "", name: "", company: "", phone: "", address: "" });
      setNotice("Supplier saved successfully!");
      fetchState();
    }).catch((err) => setNotice(err.message || "Failed to save supplier"));
  };

  const deleteSupplierHandler = async (id) => {
    const confirmed = await requestConfirm({ title: "Delete Supplier", message: "Are you sure you want to delete this supplier?", confirmLabel: "Delete" });
    if (!confirmed) return;
    deleteSupplier(id).then(() => {
      setNotice("Supplier deleted!");
      fetchState();
    }).catch((err) => setNotice(err.message || "Failed to delete supplier"));
  };

  const savePurchase = () => {
    if (!purchaseForm.supplierId || Number(purchaseForm.totalAmount) <= 0) {
      setNotice("Supplier and positive Total Amount are required.");
      return;
    }
    const payload = { ...purchaseForm };
    const action = purchaseForm.id ? updatePurchase(purchaseForm.id, payload) : createPurchase(payload);
    return action.then(() => {
      setPurchaseForm({ id: "", supplierId: "", invoiceNo: "", date: new Date().toISOString().split("T")[0], dueDate: "", totalAmount: "", paidAmount: "", status: "unpaid" });
      setShowPurchasesModal(false);
      setNotice("Purchase invoice saved successfully!");
      fetchState();
    }).catch((err) => setNotice(err.message || "Failed to save purchase invoice"));
  };

  const deletePurchaseHandler = async (id) => {
    const confirmed = await requestConfirm({ title: "Delete Invoice", message: "Are you sure you want to delete this purchase invoice?", confirmLabel: "Delete" });
    if (!confirmed) return;
    deletePurchase(id).then(() => {
      setNotice("Purchase invoice deleted!");
      fetchState();
    }).catch((err) => setNotice(err.message || "Failed to delete purchase invoice"));
  };

  const saveStaff = () => {
    if (!canManageUsers) {
      setNotice("Manager access cannot create or edit users.");
      return;
    }
    if (!staffForm.name.trim()) {
      setNotice("Staff name is required.");
      return;
    }
    if (!staffForm.id) {
      if (!String(staffForm.username || "").trim()) {
        setNotice("Username is required for new staff.");
        return;
      }
      if (!String(staffForm.password || "").trim()) {
        setNotice("Password is required for new staff.");
        return;
      }
    }
    const payload = { name: staffForm.name.trim(), role: staffForm.role, phone: staffForm.phone, monthlySalary: Number(staffForm.monthlySalary || 0) };
    const isEdit = Boolean(staffForm.id || staffForm.authUserId);
    const actions = [];
    if (isEdit) {
      if (staffForm.id) {
        actions.push(updateStaff(staffForm.id, payload));
      } else if (String(staffForm.phone || "").trim() || String(staffForm.role || "").trim()) {
        actions.push(createStaff(payload));
      }
      if (staffForm.authUserId) {
        actions.push(updateAuthUser(staffForm.authUserId, {
          name: staffForm.name.trim(),
          role: staffForm.authRole || "cashier",
          password: String(staffForm.password || "").trim() || undefined
        }));
      }
    } else {
      actions.push(createStaff(payload));
      actions.push(createAuthUser({
        name: staffForm.name.trim(),
        username: String(staffForm.username || "").trim(),
        password: String(staffForm.password || ""),
        role: staffForm.authRole || "cashier"
      }));
    }
    const action = Promise.all(actions);
    return action.then(() => {
        setShowStaffForm(false);
        if (canManageUsers) {
          fetchAuthUsers().then((rows) => setAuthUsers(Array.isArray(rows) ? rows : [])).catch(() => { });
        }
        setNotice(isEdit ? "User saved." : "User created.");
      })
      .catch((error) => setNotice(error.message));
  };

  const deleteUserByRow = async (row) => {
    if (!canManageUsers) {
      setNotice("Manager access cannot create or edit users.");
      return;
    }
    if (!row?.authUserId && !row?.staffId) {
      setNotice("Selected user cannot be deleted.");
      return;
    }
    if (String(row.authUserId || "") && String(row.authUserId || "") === String(user?.id || "")) {
      setNotice("You cannot delete your own login.");
      return;
    }
    const accepted = await requestConfirm({
      title: "Delete User",
      message: `Delete ${row.name || "this user"}? This removes the login and linked staff profile, but keeps historical sales records.`,
      confirmLabel: "Delete User",
      cancelLabel: "Cancel",
      tone: "danger"
    });
    if (!accepted) return;

    const actions = [];
    if (row.authUserId) {
      actions.push(deleteAuthUser(row.authUserId));
    }
    if (row.staffId) {
      actions.push(deleteStaff(row.staffId));
    }

    try {
      await Promise.all(actions);
      if (canManageUsers) {
        fetchAuthUsers().then((rows) => setAuthUsers(Array.isArray(rows) ? rows : [])).catch(() => { });
      }
      setShowStaffForm(false);
      setNotice("User deleted.");
    } catch (error) {
      setNotice(error.message || "Unable to delete user.");
    }
  };

  const confirmPayroll = async () => {
    try {
      const entries = payrollPreview.map(p => ({
        type: "salary",
        category: "Payroll & Staff > Salaries > Staff Salary",
        description: `Salary - ${p.monthStr}`,
        amount: Number(p.netPay),
        staffId: p.staffId,
        date: new Date().toISOString().split("T")[0]
      }));

      for (const payload of entries) {
        if (payload.amount > 0) {
          await createAccounting(payload);
        }
      }
      setShowPayrollModal(false);
      setNotice("Payroll generated successfully.");
      fetchState();
    } catch (error) {
      console.error(error);
      setNotice("Failed to generate payroll.");
    }
  };

  const saveAccountingEntry = async () => {
    try {
      if (Number(accountingForm.amount) <= 0) {
        setNotice("A positive amount is required.");
        return;
      }
      const payload = {
        type: accountingForm.type,
        category: accountingForm.type === "expense" 
          ? `${accountingForm.coaType} > ${accountingForm.coaGroup} > ${accountingForm.coaSub}`
          : accountingForm.type === "salary" ? "Payroll & Staff > Salaries > Staff Salary" 
          : accountingForm.type === "advance" ? "Payroll & Staff > Advances > Staff Advance"
          : accountingForm.type === "income" ? "Income"
          : accountingForm.type === "supplier_payment" ? accountingForm.category
          : "Transfer",
        amount: Number(accountingForm.amount),
        description: accountingForm.description.trim(),
        date: accountingForm.date,
        staffId: ["salary", "advance"].includes(accountingForm.type) ? accountingForm.staffId : null,
        sourceAccountId: ["expense", "transfer", "supplier_payment"].includes(accountingForm.type) ? accountingForm.sourceAccountId : null,
        destinationAccountId: ["income", "transfer"].includes(accountingForm.type) ? accountingForm.destinationAccountId : null,
        supplierInvoiceId: accountingForm.type === "supplier_payment" ? accountingForm.supplierInvoiceId : null
      };

      if (accountingForm.id) {
        await updateAccounting(accountingForm.id, payload);
        setNotice("Accounting entry updated.");
      } else {
        await createAccounting(payload);
        setNotice("Accounting entry created.");
      }
      setShowAccountingForm(false);
    } catch (error) {
      setNotice(error.message || "Failed to save accounting entry");
    }
  };

  const deleteAccountingEntry = async (id) => {
    const accepted = await requestConfirm({
      title: "Delete Entry",
      message: "Are you sure you want to delete this accounting entry?",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger"
    });
    if (!accepted) return;
    try {
      await deleteAccounting(id);
      setNotice("Entry deleted.");
    } catch (error) {
      setNotice(error.message || "Failed to delete entry");
    }
  };

  const handleResetAllData = async (mode) => {
    if (!isAdmin) {
      setNotice("Only admin can reset data.");
      return;
    }
    if (resetDataConfirmText.trim().toUpperCase() !== "DELETE") {
      setNotice('Type "DELETE" to confirm.');
      return;
    }
    try {
      setResettingData(true);
      await resetAllData(mode);
      setNotice(
        mode === "full"
          ? "All data deleted, including products."
          : "All data deleted except products (SKUs)."
      );
      setShowResetDataModal(false);
      setResetDataConfirmText("");
    } catch (error) {
      setNotice(error.message || "Unable to reset data.");
    } finally {
      setResettingData(false);
    }
  };

  const handleResetLorryCount = async () => {
    const accepted = await requestConfirm({
      title: "Reset Lorry Count",
      message: "Reset both lorry counts to 0 for new orders? This will not change stock, sales, deliveries, or loading reports.",
      confirmLabel: "Reset Count",
      cancelLabel: "Cancel",
      tone: "danger"
    });
    if (!accepted) return;
    try {
      setResettingLorryCount(true);
      await resetLorryCount();
      setNotice("Lorry count reset to 0 for new orders.");
    } catch (error) {
      setNotice(error.message || "Unable to reset lorry count.");
    } finally {
      setResettingLorryCount(false);
    }
  };

  const handleToggleLoadingRow = async (row) => {
    const markKey = String(row?.markKey || "").trim();
    if (!markKey) return;
    try {
      setLoadingMarkPendingKey(markKey);
      await setLoadingRowMark({ markKey, loaded: !row.loaded });
      setNotice(!row.loaded ? "Loading row marked as loaded." : "Loading row marked as not loaded.");
    } catch (error) {
      setNotice(error.message || "Unable to update loading row status.");
    } finally {
      setLoadingMarkPendingKey("");
    }
  };

  const handleManagerFullAccessToggle = async () => {
    if (isManager) return;
    try {
      setManagerAccessPending(true);
      await setManagerFullAccess({ enabled: !managerFullAccessEnabled });
      setNotice(!managerFullAccessEnabled ? "Manager full access enabled." : "Manager full access disabled.");
    } catch (error) {
      setNotice(error.message || "Unable to update manager full access.");
    } finally {
      setManagerAccessPending(false);
    }
  };

  const openStockAdd = () => {
    if (!canManageStock) {
      setNotice("Manager access cannot edit stock.");
      return;
    }
    setStockMode("add");
    setStockForm({ productId: "", quantity: "", stock: "", sku: "", invoicePrice: "", billingPrice: "", mrp: "" });
    setStockSearch("");
    setShowStockSuggestions(false);
    setNewStockItemForm({ sku: "", category: "General", billingPrice: "", invoicePrice: "", mrp: "" });
    setShowStockForm(true);
  };

  const openStockEdit = () => {
    if (!canManageStock) {
      setNotice("You do not have stock edit access.");
      return;
    }
    setStockMode("edit");
    setStockForm({
      productId: state.products[0]?.id || "",
      quantity: "",
      stock: state.products[0]?.stock || "",
      sku: state.products[0]?.sku || "",
      invoicePrice: String(state.products[0]?.invoicePrice ?? ""),
      billingPrice: String(state.products[0]?.billingPrice ?? state.products[0]?.price ?? ""),
      mrp: String(state.products[0]?.mrp ?? state.products[0]?.price ?? "")
    });
    setShowStockForm(true);
  };

  const openStockEditByRow = (row) => {
    if (!canManageStock) {
      setNotice("You do not have stock edit access.");
      return;
    }
    if (!row) return;
    const matched = (state.products || []).find((item) => item.id === row.id);
    if (!matched) {
      setNotice("Selected stock item was not found.");
      return;
    }
    setStockMode("edit");
    setStockForm({
      productId: matched.id,
      quantity: "",
      stock: String(matched.stock ?? ""),
      sku: matched.sku || "",
      invoicePrice: String(matched.invoicePrice ?? ""),
      billingPrice: String(matched.billingPrice ?? matched.price ?? ""),
      mrp: String(matched.mrp ?? matched.price ?? "")
    });
    setShowStockForm(true);
  };

  const onStockProductChange = (productId) => {
    const selected = state.products.find((item) => item.id === productId);
    setStockForm((current) => ({
      ...current,
      productId,
      sku: selected?.sku || "",
      invoicePrice: stockMode === "edit" ? String(selected?.invoicePrice ?? "") : current.invoicePrice,
      billingPrice: stockMode === "edit" ? String(selected?.billingPrice ?? selected?.price ?? "") : current.billingPrice,
      mrp: stockMode === "edit" ? String(selected?.mrp ?? selected?.price ?? "") : current.mrp,
      stock: stockMode === "edit" ? String(selected?.stock ?? "") : current.stock
    }));
  };

  const onStockSearchChange = (value) => {
    setStockSearch(value);
    setShowStockSuggestions(true);
    setStockForm((current) => ({ ...current, productId: "", sku: "" }));
  };

  const onSelectExistingStockItem = (product) => {
    setStockSearch(product.name);
    setStockForm((current) => ({
      ...current,
      productId: product.id,
      sku: product.sku
    }));
    setNewStockItemForm((current) => ({
      ...current,
      billingPrice: String(product.billingPrice ?? ""),
      invoicePrice: String(product.invoicePrice ?? ""),
      mrp: String(product.mrp ?? product.price ?? "")
    }));
    setShowStockSuggestions(false);
  };

  const exportStockReport = () => {
    try {
      const rows = (sortedStockRows || []).map((item) => ({
        sku: String(item.sku || ""),
        billingPrice: formatLkrValue(item.billingPrice ?? item.price ?? 0),
        mrp: formatLkrValue(item.mrp ?? item.price ?? 0),
        stock: Number(item.stock || 0)
      }));
      const header = ["SKU", "Billing Price (LKR)", "MRP (LKR)", "Stock"];
      const csvRows = [
        header.join(","),
        ...rows.map((row) => [
          `"${String(row.sku).replace(/"/g, '""')}"`,
          row.billingPrice,
          row.mrp,
          row.stock
        ].join(","))
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `stock-report-${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setNotice("Stock report exported.");
    } catch (error) {
      setNotice(error.message || "Unable to export stock report.");
    }
  };

  const exportCustomerReport = () => {
    try {
      const rows = (sortedCustomerRows || []).map((row) => ({
        name: String(row.name || ""),
        phone: String(row.phone || ""),
        address: String(row.address || "")
      }));
      const header = ["Name", "Phone", "Address"];
      const csvRows = [
        header.join(","),
        ...rows.map((row) => [
          `"${row.name.replace(/"/g, '""')}"`,
          `"${row.phone.replace(/"/g, '""')}"`,
          `"${row.address.replace(/"/g, '""')}"`
        ].join(","))
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateTag = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `customers-${dateTag}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setNotice("Customer report exported.");
    } catch (error) {
      setNotice(error.message || "Unable to export customer report.");
    }
  };

  const importCustomers = async (csvText) => {
    try {
      const lines = String(csvText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (!lines.length) {
        setNotice("Paste or upload customer rows first.");
        return;
      }
      const parseCsvLine = (line) => {
        const parts = [];
        let current = "";
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
          const char = line[i];
          if (char === '"') {
            if (quoted && line[i + 1] === '"') {
              current += '"';
              i += 1;
            } else {
              quoted = !quoted;
            }
          } else if (char === "," && !quoted) {
            parts.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        parts.push(current.trim());
        return parts.map((part) => part.replace(/^"(.*)"$/, "$1").trim());
      };
      const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
      const nameIndex = header.indexOf("name");
      const phoneIndex = header.indexOf("phone");
      const addressIndex = header.indexOf("address");
      const routeIndex = header.indexOf("route");
      if (nameIndex < 0) {
        setNotice("Customer import requires at least: name");
        return;
      }
      const rows = lines.slice(1).map(parseCsvLine).map((cols) => ({
        name: String(cols[nameIndex] || "").trim(),
        phone: phoneIndex >= 0 ? String(cols[phoneIndex] || "").trim() : "",
        address: addressIndex >= 0 ? String(cols[addressIndex] || "").trim() : "",
        route: routeIndex >= 0 ? String(cols[routeIndex] || "").trim() : ""
      })).filter((row) => row.name);
      if (!rows.length) {
        setNotice("No valid customer rows found.");
        return;
      }
      const existingByName = new Map((state.customers || []).map((row) => [String(row.name || "").trim().toLowerCase(), row]));
      let created = 0;
      let updated = 0;
      for (const row of rows) {
        const matched = existingByName.get(row.name.toLowerCase());
        if (matched) {
          await updateCustomer(matched.id, row);
          updated += 1;
        } else {
          await createCustomer(row);
          created += 1;
        }
      }
      setNotice(`Imported ${updated} updates, created ${created} customers.`);
    } catch (error) {
      setNotice(error.message || "Unable to import customers.");
    }
  };

  const onCustomerImportFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importCustomers(text);
    event.target.value = "";
  };

  const saveStock = async () => {
    try {
      if (!canManageStock) {
        setNotice("You do not have stock edit access.");
        return;
      }
      const selected = state.products.find((item) => item.id === stockForm.productId);
      if (stockMode === "add") {
        const qty = Number(stockForm.quantity || 0);
        const billingPrice = Number(newStockItemForm.billingPrice);
        const invoicePrice = Number(newStockItemForm.invoicePrice || 0);
        const mrp = Number(newStockItemForm.mrp);
        if (Number.isNaN(qty) || qty <= 0) {
          setNotice("Enter a valid quantity.");
          return;
        }
        if (Number.isNaN(billingPrice) || billingPrice < 0 || Number.isNaN(invoicePrice) || invoicePrice < 0 || Number.isNaN(mrp) || mrp <= 0) {
          setNotice("Invoice Price, Billing Price and MRP are required.");
          return;
        }

        if (selected) {
          await patchProduct(selected.id, {
            stock: Number(selected.stock) + qty,
            invoicePrice,
            billingPrice,
            mrp,
            price: mrp
          });
          setNotice(`Stock added to ${selected.name}.`);
        } else {
          const name = stockSearch.trim();
          if (!name) {
            setNotice("Type item name.");
            return;
          }
          const generatedSkuBase = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ITEM";
          const generatedSku = `${generatedSkuBase}${Math.floor(100 + Math.random() * 900)}`;
          await createProduct({
            name,
            sku: newStockItemForm.sku.trim() || generatedSku,
            category: newStockItemForm.category.trim() || "General",
            invoicePrice,
            billingPrice,
            mrp,
            price: mrp,
            stock: qty
          });
          setNotice(`New item created: ${name}.`);
        }
      } else {
        if (!selected) {
          setNotice("Select a valid product.");
          return;
        }
        await patchProduct(selected.id, {
          stock: Number(stockForm.stock || selected.stock),
          sku: String(stockForm.sku || selected.sku).trim(),
          invoicePrice: Number(stockForm.invoicePrice || selected.invoicePrice || 0),
          billingPrice: Number(stockForm.billingPrice || selected.billingPrice || selected.price || 0),
          mrp: Number(stockForm.mrp || selected.mrp || selected.price || 0),
          price: Number(stockForm.mrp || selected.mrp || selected.price || 0)
        });
        setNotice("Stock updated.");
      }
      setShowStockForm(false);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const deleteStockProductById = async (product) => {
    try {
      if (!canManageStock) {
        setNotice("Manager access cannot edit stock.");
        return;
      }
      if (!product?.id) return;
      const ok = await requestConfirm({
        title: "Delete Product",
        message: `Are you sure want to delete ${product.name} (${product.sku})? This cannot be undone.`,
        confirmLabel: "Delete",
        tone: "danger"
      });
      if (!ok) return;
      setDeletingProduct(true);
      await deleteProduct(product.id);
      setNotice(`Product deleted: ${product.name}.`);
      if (stockForm.productId === product.id) {
        setShowStockForm(false);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDeletingProduct(false);
    }
  };

  const importStock = async (rawText) => {
    try {
      const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!lines.length) {
        setNotice("Paste stock rows first.");
        return;
      }

      const productBySku = new Map(state.products.map((p) => [p.sku.toLowerCase(), p]));
      const updates = [];
      const creates = [];
      const unknown = [];

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const cells = line.split(",").map((v) => (v || "").trim());
        if (!cells.length) continue;

        const first = cells[0].toLowerCase();
        if (i === 0 && (first === "sku" || first === "name")) {
          continue;
        }

        if (cells.length <= 2) {
          const [skuRaw, stockRaw] = cells;
          if (!skuRaw || stockRaw === "") continue;
          const product = productBySku.get(skuRaw.toLowerCase());
          if (!product) {
            unknown.push(skuRaw);
            continue;
          }
          const stock = Number(stockRaw);
          if (Number.isNaN(stock)) continue;
          updates.push({ productId: product.id, stock });
          continue;
        }

        const hasSizeColumn = cells.length >= 7;
        const name = cells[0];
        const size = hasSizeColumn ? (cells[1] || "") : "";
        const skuRaw = hasSizeColumn ? cells[2] : cells[1];
        const category = hasSizeColumn ? (cells[3] || "General") : (cells[2] || "General");
        const rawA = hasSizeColumn ? cells[4] : cells[3];
        const rawB = hasSizeColumn ? cells[5] : cells[4];
        const rawC = hasSizeColumn ? cells[6] : cells[5];
        if (!name || !skuRaw || rawA === undefined || rawB === undefined) continue;

        const hasBillingAndMrp = rawC !== undefined;
        const billingPrice = Number(rawA);
        const mrp = Number(hasBillingAndMrp ? rawB : rawA);
        const stockRaw = hasBillingAndMrp ? rawC : rawB;
        const stock = Number(stockRaw);
        if (Number.isNaN(billingPrice) || Number.isNaN(mrp) || Number.isNaN(stock)) continue;

        const existing = productBySku.get(skuRaw.toLowerCase());
        if (existing) {
          updates.push({ productId: existing.id, stock, billingPrice, mrp, size });
        } else {
          creates.push({ name, size, sku: skuRaw, category, billingPrice, mrp, price: mrp, stock });
        }
      }

      if (!updates.length && !creates.length) {
        setNotice("No valid stock rows found. Use: sku,stock OR name,sku,category,price,stock OR name,sku,category,billingPrice,mrp,stock OR name,size,sku,category,billingPrice,mrp,stock");
        return;
      }

      await Promise.all(
        updates.map((u) =>
          patchProduct(u.productId, { stock: u.stock, billingPrice: u.billingPrice, mrp: u.mrp, price: u.mrp, size: u.size })
        )
      );
      await Promise.all(creates.map((row) => createProduct(row)));
      setNotice(
        unknown.length
          ? `Imported ${updates.length} updates, created ${creates.length}. Unknown SKU: ${unknown.join(", ")}`
          : `Imported ${updates.length} updates, created ${creates.length} products.`
      );
    } catch (error) {
      setNotice(error.message);
    }
  };

  const onImportFileSelected = async (event) => {
    if (!canManageStock) {
      setNotice("Manager access cannot edit stock.");
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importStock(text);
    event.target.value = "";
  };

  const navItems = [
    {
      id: "dashboard", label: "Dashboard", iconClass: "dashboard", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 13.5 12 5l8 8v6.2a1.3 1.3 0 0 1-1.3 1.3h-3.9v-5h-5.6v5H5.3A1.3 1.3 0 0 1 4 19.2z" />
        </svg>
      )
    },
    {
      id: "customers", label: "Customers", iconClass: "customers", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.8 18.2c0-3.1 2.4-5.4 5.2-5.4s5.2 2.3 5.2 5.4" />
          <circle cx="16.8" cy="9" r="2.4" />
          <path d="M14.4 17.8c.5-2 1.9-3.7 4.3-4.2 1.1-.2 2.1.2 2.9.8" />
        </svg>
      )
    },
    {
      id: "purchases", label: "Purchases", iconClass: "purchases", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-2 0H3V6h14v8zm-7-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
        </svg>
      )
    },
    {
      id: "stock", label: "Stock", iconClass: "stock", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 7.5 12 4l7.5 3.5L12 11z" />
          <path d="M4.5 7.5V16.5L12 20v-9z" />
          <path d="M19.5 7.5V16.5L12 20v-9z" />
        </svg>
      )
    },
    ...(isAdmin ? [{
      id: "accounting", label: "Accounting", iconClass: "accounting", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    }] : []),
    {
      id: "staff", label: "Staff", iconClass: "staff", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="7.5" r="3.2" />
          <path d="M5 19c0-3.6 3-6 7-6s7 2.4 7 6" />
          <path d="M18.8 6.2h2.6M20.1 4.9v2.6" />
        </svg>
      )
    },
    {
      id: "preorders", label: "Pre-Orders", iconClass: "preorders", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
        </svg>
      )
    },
    {
      id: "deliveries", label: "Deliveries", iconClass: "deliveries", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 7.5h10.2v7.2H3.5z" />
          <path d="M13.7 10.2h3.2l2.1 2.4v2.1h-5.3z" />
          <circle cx="8" cy="18" r="1.8" />
          <circle cx="17.4" cy="18" r="1.8" />
        </svg>
      )
    },
    {
      id: "reports", label: "Reports", iconClass: "reports", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 18.5V10.8M12 18.5V6.5M18 18.5V13.2" />
          <path d="M4 19.5h16" />
        </svg>
      )
    },
    {
      id: "loadings", label: "Loadings", iconClass: "loadings", icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.2 8.2h9.7v6.5H4.2z" />
          <path d="M13.9 10.4h3.4l2.5 2.7v1.6h-5.9z" />
          <path d="M7.2 6V4.2M10.8 6V4.2M16.3 6V4.2" />
          <circle cx="8.1" cy="17.8" r="1.6" />
          <circle cx="17.4" cy="17.8" r="1.6" />
        </svg>
      )
    }
  ];

  return (
    <>
      {message && !/(error|invalid|required|cannot|unable|failed|not found|select|enter|type|exceeds)/i.test(String(message)) ? <p className="notice">{message}</p> : null}
      {notice && !/(error|invalid|required|cannot|unable|failed|not found|select|enter|type|exceeds)/i.test(String(notice)) ? <p className="notice">{notice}</p> : null}
      <main className="admin-shell">
        <button
          type="button"
          className={`admin-mobile-nav-toggle menu-toggle-btn ${mobileNavOpen ? "open" : ""}`}
          onClick={() => setMobileNavOpen((current) => !current)}
          aria-expanded={mobileNavOpen}
          aria-controls="admin-sidebar-nav"
          aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
        >
          <span className="menu-toggle-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="menu-toggle-label">{mobileNavOpen ? "Close" : "Menu"}</span>
        </button>

        {mobileNavOpen ? (
          <button
            type="button"
            className="admin-mobile-nav-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          />
        ) : null}

        <aside id="admin-sidebar-nav" className={`admin-sidebar ${mobileNavOpen ? "open" : ""}`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activePage === item.id ? "active" : ""}
              onClick={() => setActivePage(item.id)}
            >
              <span className="admin-sidebar-nav">
                <span className={`admin-sidebar-icon ${item.iconClass}`}>{item.icon}</span>
                <span className="admin-sidebar-label">{item.label}</span>
              </span>
            </button>
          ))}

          <div className="side-menu-footer">
            <a href="https://www.jnco.tech" target="_blank" rel="noreferrer">
              <img src="/powered.png" alt="Powered by" />
            </a>
          </div>
        </aside>

        <section className="admin-content">
          {activePage === "customers" ? (
            <section className="admin-mobile-section admin-customers-panel">
              <div className="customers-head">
                <h2>Customers</h2>
                <div className="customers-head-actions">
                  <button type="button" className="ghost" onClick={exportCustomerReport}>Export</button>
                  <button type="button" className="ghost" onClick={() => customerFileRef.current?.click()}>Import</button>
                  <input
                    ref={customerFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={onCustomerImportFileSelected}
                    hidden
                  />
                  <button type="button" className="customer-add-icon-btn" onClick={openCustomerAdd} title="Add Customer" aria-label="Add Customer">
                    <span className="fab-plus">+</span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4.5 3.6-8 8-8s8 3.5 8 8" />
                    </svg>
                  </button>
                </div>
              </div>
              <section className="customers-summary-card">
                <div className="customers-summary-divider">
                  <span>SUMMARY</span>
                </div>
                <div className="customers-summary-head">
                  <h3>Customer Summary</h3>
                  <p>Based on current list</p>
                </div>
                <div className="customers-summary-grid">
                  <article>
                    <span>Total Customers</span>
                    <strong>{customerPageSummary.totalCustomers}</strong>
                  </article>
                  <article>
                    <span>Active Customers</span>
                    <strong>{customerPageSummary.activeCustomers}</strong>
                  </article>
                  <article>
                    <span>Customers with Outstanding</span>
                    <strong>{customerPageSummary.customersWithOutstanding}</strong>
                  </article>
                  <article>
                    <span>Total Orders</span>
                    <strong>{customerPageSummary.totalOrders}</strong>
                  </article>
                  <article>
                    <span>Total Spent (LKR)</span>
                    <strong>{formatLkrValue(customerPageSummary.totalSpent || 0)}</strong>
                  </article>
                  <article>
                    <span>Available Credit (LKR)</span>
                    <strong>{formatLkrValue(customerPageSummary.totalAvailableCredit || 0)}</strong>
                  </article>
                  <article className="warn">
                    <span>Total Outstanding (LKR)</span>
                    <strong>{formatLkrValue(customerPageSummary.totalOutstanding || 0)}</strong>
                  </article>
                </div>
                <div className="customers-summary-foot">
                  <article>
                    <span>Top Customer</span>
                    <strong>{customerPageSummary.topCustomerName}</strong>
                    <p>LKR {formatLkrValue(customerPageSummary.topCustomerSpent || 0)}</p>
                  </article>
                  <article>
                    <span>Average Order Value</span>
                    <strong>LKR {formatLkrValue(customerPageSummary.averageOrderValue || 0)}</strong>
                  </article>
                </div>
              </section>
              <input
                className="customers-search search-icon-input"
                value={customerPanelSearch}
                onChange={(e) => setCustomerPanelSearch(e.target.value)}
                placeholder="Search Customer"
              />
              {uniqueCustomerRoutes.length > 1 ? (
                <div className="customers-route-filters" style={{ display: "flex", gap: "8px", marginTop: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {uniqueCustomerRoutes.map((route) => (
                    <button
                      key={route}
                      type="button"
                      className={customerRouteFilter === route ? "route-filter-btn active" : "ghost route-filter-btn"}
                      onClick={() => setCustomerRouteFilter(route)}
                      style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "20px" }}
                    >
                      {route}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="admin-table customer-table customers-table">
                <div className="customers-table-divider">
                  <span>CUSTOMERS TABLE</span>
                </div>
                <header>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "name")}>Name{sortMark("customers", "name")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "phone")}>Phone{sortMark("customers", "phone")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "orders")}>Orders{sortMark("customers", "orders")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "spent")}>Total Spent (LKR){sortMark("customers", "spent")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "route")}>Route{sortMark("customers", "route")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "outstanding")}>Outstanding (LKR){sortMark("customers", "outstanding")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("customers", "daysLeft")}>Days Left{sortMark("customers", "daysLeft")}</button>
                </header>
                {sortedCustomerRows.length ? sortedCustomerRows.map((row) => (
                  <article
                    key={row.name}
                    className="customers-clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => setCustomerDetailName(row.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCustomerDetailName(row.name);
                      }
                    }}
                  >
                    <span>{row.name}</span>
                    <span>{row.phone || "-"}</span>
                    <span>{row.orders}</span>
                    <span>{formatLkrValue(row.spent || 0)}</span>
                    <span>{row.route || "-"}</span>
                    <span className={Number(row.outstanding || 0) > 0 ? "outstanding-text" : ""}>{formatLkrValue(row.outstanding || 0)}</span>
                    <span className={String(row.outstandingDaysLabel || "").toLowerCase().includes("overdue") ? "outstanding-text" : ""}>{row.outstandingDaysLabel || "-"}</span>
                  </article>
                )) : <p>No customer records yet.</p>}
              </div>
            </section>
          ) : null}

          {activePage === "stock" ? (
            <section className="admin-mobile-section admin-stock-panel">
              <h2>Stock</h2>
              {showStockForm ? (
                <div className="low-stock-modal" onClick={() => setShowStockForm(false)}>
                  <div className="low-stock-modal-card stock-entry-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="low-stock-modal-head">
                      <h3>{stockMode === "add" ? "Stock Entry" : "Edit Stock"}</h3>
                      <button type="button" className="ghost" onClick={() => setShowStockForm(false)}>Close</button>
                    </div>
                    <div className="admin-inline-form stock-form-panel">
                      {stockMode === "add" ? (
                        <>
                          <label className="stock-form-field">
                            <span>Item Name</span>
                            <input
                              value={stockSearch}
                              onChange={(e) => onStockSearchChange(e.target.value)}
                              onFocus={() => setShowStockSuggestions(true)}
                              placeholder="Type item name"
                            />
                          </label>
                          {showStockSuggestions && stockSearchMatches.length ? (
                            <div className="stock-suggestions">
                              {stockSearchMatches.map((product) => (
                                <button key={product.id} type="button" onClick={() => onSelectExistingStockItem(product)}>
                                  {product.name} ({product.sku})
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {stockForm.productId ? (
                            <p className="form-hint">Existing item selected. Quantity will be added to current stock.</p>
                          ) : (
                            <>
                              <p className="form-hint">No match selected. A new item will be created.</p>
                              <label className="stock-form-field">
                                <span>SKU</span>
                                <input value={newStockItemForm.sku} onChange={(e) => setNewStockItemForm((c) => ({ ...c, sku: e.target.value }))} placeholder="SKU (optional)" />
                              </label>
                              <label className="stock-form-field">
                                <span>Category</span>
                                <input value={newStockItemForm.category} onChange={(e) => setNewStockItemForm((c) => ({ ...c, category: e.target.value }))} placeholder="Category (optional)" />
                              </label>
                            </>
                          )}
                          <label className="stock-form-field">
                            <span>Billing Price (LKR)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={newStockItemForm.billingPrice}
                              onChange={(e) => setNewStockItemForm((c) => ({ ...c, billingPrice: e.target.value }))}
                              placeholder="Billing Price (required)"
                            />
                          </label>
                          <label className="stock-form-field">
                            <span>Invoice Price (LKR)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={newStockItemForm.invoicePrice}
                              onChange={(e) => setNewStockItemForm((c) => ({ ...c, invoicePrice: e.target.value }))}
                              placeholder="Invoice Price (required)"
                            />
                          </label>
                          <label className="stock-form-field">
                            <span>MRP (LKR)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={newStockItemForm.mrp}
                              onChange={(e) => setNewStockItemForm((c) => ({ ...c, mrp: e.target.value }))}
                              placeholder="MRP (required)"
                            />
                          </label>
                          <label className="stock-form-field">
                            <span>Quantity</span>
                            <input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((c) => ({ ...c, quantity: e.target.value }))} placeholder="Quantity" />
                          </label>
                        </>
                      ) : (
                        <>
                          <label className="stock-form-field">
                            <span>Product</span>
                            <select value={stockForm.productId} onChange={(e) => onStockProductChange(e.target.value)}>
                              {state.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                            </select>
                          </label>
                          <label className="stock-form-field">
                            <span>SKU</span>
                            <input value={stockForm.sku || ""} onChange={(e) => setStockForm((c) => ({ ...c, sku: e.target.value }))} placeholder="Edit SKU" />
                          </label>
                          <label className="stock-form-field">
                            <span>Invoice Price (LKR)</span>
                            <input type="number" step="0.01" value={stockForm.invoicePrice || ""} onChange={(e) => setStockForm((c) => ({ ...c, invoicePrice: e.target.value }))} placeholder="Invoice Price" />
                          </label>
                          <label className="stock-form-field">
                            <span>Billing Price (LKR)</span>
                            <input type="number" step="0.01" value={stockForm.billingPrice || ""} onChange={(e) => setStockForm((c) => ({ ...c, billingPrice: e.target.value }))} placeholder="Billing Price" />
                          </label>
                          <label className="stock-form-field">
                            <span>MRP (LKR)</span>
                            <input type="number" step="0.01" value={stockForm.mrp || ""} onChange={(e) => setStockForm((c) => ({ ...c, mrp: e.target.value }))} placeholder="MRP" />
                          </label>
                          <label className="stock-form-field">
                            <span>Stock</span>
                            <input type="number" value={stockForm.stock} onChange={(e) => setStockForm((c) => ({ ...c, stock: e.target.value }))} placeholder="Set stock" />
                          </label>
                        </>
                      )}
                      <div>
                        <SaveButton onClick={saveStock}>Save</SaveButton>
                        <button type="button" className="ghost" onClick={() => setShowStockForm(false)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="stock-current-head">
                <h3>Current Stock</h3>
                <div className="admin-page-actions stock-current-actions stock-actions-tech">
                  {canManageStock ? <button type="button" onClick={openStockAdd}>Add Stock</button> : null}
                  {canManageStock ? <button type="button" onClick={openStockEdit}>Edit Stock</button> : null}
                  <button type="button" onClick={exportStockReport}>Export Stock</button>
                  {canManageStock ? <button type="button" onClick={() => stockFileRef.current?.click()}>Import Stock</button> : null}
                  <input
                    ref={stockFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden-file-input"
                    onChange={onImportFileSelected}
                  />
                </div>
              </div>
              <input
                className="admin-search-input stock-search-input search-icon-input"
                value={stockPanelSearch}
                onChange={(e) => setStockPanelSearch(e.target.value)}
                placeholder="Search product / SKU / size"
              />
              <section className="stock-summary-card">
                <div className="stock-summary-divider">
                  <span>STOCK SUMMARY</span>
                </div>
                <div className="stock-summary-head">
                  <h3>Inventory Snapshot</h3>
                  <p>Live from current filtered stock</p>
                </div>
                <div className="stock-summary-grid">
                  <article>
                    <span>Total SKUs</span>
                    <strong>{stockPageSummary.totalSkus}</strong>
                  </article>
                  <article>
                    <span>Total Units</span>
                    <strong>{stockPageSummary.totalUnits}</strong>
                  </article>
                  <article
                    role="button"
                    tabIndex={0}
                    onClick={() => setStockSummaryDetailMode("bundles")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setStockSummaryDetailMode("bundles");
                      }
                    }}
                  >
                    <span>Total Bundles</span>
                    <strong>{stockPageSummary.totalBundles}</strong>
                  </article>
                  <article
                    className="warn"
                    role="button"
                    tabIndex={0}
                    onClick={() => setStockSummaryDetailMode("low")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setStockSummaryDetailMode("low");
                      }
                    }}
                  >
                    <span>Low Stock</span>
                    <strong>{stockPageSummary.lowStockCount}</strong>
                  </article>
                  <article
                    className="warn soft"
                    role="button"
                    tabIndex={0}
                    onClick={() => setStockSummaryDetailMode("out")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setStockSummaryDetailMode("out");
                      }
                    }}
                  >
                    <span>Out of Stock</span>
                    <strong>{stockPageSummary.outOfStockCount}</strong>
                  </article>
                </div>
                <div className="stock-summary-foot">
                  <article>
                    <span>Invoice Value (LKR)</span>
                    <strong>{formatLkrValue(stockPageSummary.inventoryInvoice)}</strong>
                  </article>
                  <article>
                    <span>Inventory Cost (LKR)</span>
                    <strong>{formatLkrValue(stockPageSummary.inventoryCost)}</strong>
                  </article>
                  <article>
                    <span>Inventory MRP (LKR)</span>
                    <strong>{formatLkrValue(stockPageSummary.inventoryMrp)}</strong>
                  </article>
                  <article className="highlight">
                    <span>Highest Stock</span>
                    <strong>{stockPageSummary.topStockName}</strong>
                    <p>{stockPageSummary.topStockUnits} units</p>
                  </article>
                </div>
              </section>
              <div className="admin-table stock-table stock-table-tech">
                <header>
                  <button type="button" className="th-sort" onClick={() => toggleSort("stock", "sku")}>SKU{sortMark("stock", "sku")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("stock", "invoicePrice")}>Invoice Price (LKR){sortMark("stock", "invoicePrice")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("stock", "billingPrice")}>Billing Price (LKR){sortMark("stock", "billingPrice")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("stock", "mrp")}>MRP (LKR){sortMark("stock", "mrp")}</button>
                  
                  <button type="button" className="th-sort" onClick={() => toggleSort("stock", "stock")}>Stock{sortMark("stock", "stock")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("stock", "returnedStock")}>Returned Lot{sortMark("stock", "returnedStock")}</button>
                  <span className="th-action">Action</span>
                </header>
                {sortedStockRows.map((item) => (
                  <article
                    key={item.id}
                    className="stock-clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (canManageStock) openStockEditByRow(item);
                    }}
                    onKeyDown={(e) => {
                      if (canManageStock && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openStockEditByRow(item);
                      }
                    }}
                  >
                    <span>{item.sku}</span>
                    <span>{formatLkrValue(item.invoicePrice ?? 0)}</span>
                    <span>{formatLkrValue(item.billingPrice ?? item.price ?? 0)}</span>
                    <span>{formatLkrValue(item.mrp ?? item.price ?? 0)}</span>
                    <span>{(() => {
                      const bundleSize = getBundleSize(item);
                      return bundleSize > 0 ? Math.floor(Number(item.stock || 0) / bundleSize) : 0;
                    })()}</span>
                    <span className={item.stock <= 25 ? "low" : ""}>{item.stock}</span>
                    <span>{item.returnedStock || 0}</span>
                    <span className="action-cell">
                      {canManageStock ? (
                        <button
                          type="button"
                          className="row-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStockProductById(item);
                          }}
                          disabled={deletingProduct}
                        >
                          Delete
                        </button>
                      ) : <span>-</span>}
                    </span>
                  </article>
                ))}
              </div>
              <div className="returned-stock-panel returned-stock-tech">
                <h3>Returned Stock</h3>
                <div className="admin-table returns-table">
                  <header>
                    <button type="button" className="th-sort" onClick={() => toggleSort("returns", "saleId")}>Sale ID{sortMark("returns", "saleId")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("returns", "item")}>Item{sortMark("returns", "item")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("returns", "qty")}>Qty{sortMark("returns", "qty")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("returns", "amount")}>Return Value (LKR){sortMark("returns", "amount")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("returns", "rep")}>Rep{sortMark("returns", "rep")}</button>
                  </header>
                  {sortedAdminReturnRows.length ? sortedAdminReturnRows.map((row) => (
                    <article key={row.id}>
                      <span>#{row.saleId}</span>
                      <span>{row.item}</span>
                      <span>{row.qty}</span>
                      <span>{formatLkrValue(row.amount)}</span>
                      <span>{row.rep}</span>
                    </article>
                  )) : <p className="form-hint">No returned stock records yet.</p>}
                </div>
              </div>
              <div className="returned-stock-panel returned-stock-tech">
                <h3>Stock Activity Log</h3>
                <div className="rep-date-filters">
                  <label className="rep-date-field">
                    <span>From</span>
                    <input type="date" value={stockLogDateFrom} onChange={(e) => setStockLogDateFrom(e.target.value)} />
                  </label>
                  <label className="rep-date-field">
                    <span>To</span>
                    <input type="date" value={stockLogDateTo} onChange={(e) => setStockLogDateTo(e.target.value)} />
                  </label>
                </div>
                <input
                  className="search-icon-input imperfect-search-input"
                  value={stockLogSearch}
                  onChange={(e) => setStockLogSearch(e.target.value)}
                  placeholder="Search stock log by item / sku / user / action"
                />
                <div className="admin-table stock-log-table">
                  <header>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "at")}>Date/Time{sortMark("stockLog", "at")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "product")}>Product{sortMark("stockLog", "product")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "sku")}>SKU{sortMark("stockLog", "sku")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "beforeStock")}>Before{sortMark("stockLog", "beforeStock")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "changeQty")}>Change{sortMark("stockLog", "changeQty")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "afterStock")}>After{sortMark("stockLog", "afterStock")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "by")}>By{sortMark("stockLog", "by")}</button>
                    <button type="button" className="th-sort" onClick={() => toggleSort("stockLog", "action")}>Action{sortMark("stockLog", "action")}</button>
                  </header>
                  {sortedStockMovementRows.length ? sortedStockMovementRows.map((row) => (
                    <article key={`stock-log-${row.id}`}>
                      <span>{row.atLabel}</span>
                      <span>{row.product}</span>
                      <span>{row.sku}</span>
                      <span>{Number(row.beforeStock || 0)}</span>
                      <span className={Number(row.changeQty || 0) < 0 ? "low" : ""}>
                        {Number(row.changeQty || 0) > 0 ? `+${row.changeQty}` : row.changeQty}
                      </span>
                      <span>{Number(row.afterStock || 0)}</span>
                      <span>{row.by}</span>
                      <span>{row.action}</span>
                    </article>
                  )) : <p className="form-hint">No stock activity found for selected range.</p>}
                </div>
              </div>
            </section>
          ) : null}

          {activePage === "accounting" && isAdmin ? (
            <section className="admin-mobile-section admin-accounting-panel">
              <div className="accounting-head">
                <h2>Accounting</h2>
                <div className="accounting-actions">
                  <button type="button" className="ghost" onClick={() => setShowAccountsModal(true)}>Manage Accounts</button>
                  <button type="button" className="ghost" onClick={() => setShowPayrollModal(true)}>Run Payroll</button>
                  <button type="button" onClick={() => {
                    setAccountingForm({ id: "", type: "expense", category: "", amount: "", description: "", staffId: "", date: new Date().toISOString().split("T")[0], coaType: "Operating Expenses", coaGroup: "Vehicle Expenses", coaSub: "Lorry Fuel", sourceAccountId: "", destinationAccountId: "" });
                    setShowAccountingForm(true);
                  }}>Add Record</button>
                </div>
              </div>

              {(() => {
                const balances = {};
                let firstCashAccountId = null;
                (state.accounts || []).forEach(acc => {
                  balances[acc.id] = Number(acc.initialBalance || 0);
                  if (acc.type === "cash" && !firstCashAccountId) {
                    firstCashAccountId = acc.id;
                  }
                });
                if (firstCashAccountId) {
                  let totalCashSales = 0;
                  (state.sales || []).forEach(sale => {
                    (sale.payments || []).forEach(payment => {
                      if (payment.method === "cash") {
                        totalCashSales += Number(payment.amount || 0);
                      }
                    });
                  });
                  balances[firstCashAccountId] += totalCashSales;
                }
                (state.accounting || []).forEach(entry => {
                  const amt = Number(entry.amount || 0);
                  const srcId = entry.sourceAccountId || firstCashAccountId;
                  const destId = entry.destinationAccountId || firstCashAccountId;
                  if (["expense", "salary", "advance"].includes(entry.type) && srcId) {
                    balances[srcId] = (balances[srcId] || 0) - amt;
                  } else if (entry.type === "income" && destId) {
                    balances[destId] = (balances[destId] || 0) + amt;
                  } else if (entry.type === "transfer") {
                    if (entry.sourceAccountId) balances[entry.sourceAccountId] = (balances[entry.sourceAccountId] || 0) - amt;
                    if (entry.destinationAccountId) balances[entry.destinationAccountId] = (balances[entry.destinationAccountId] || 0) + amt;
                  }
                });
                return (state.accounts || []).length > 0 ? (
                  <div className="accounting-summary-grid" style={{ marginBottom: "16px" }}>
                    {(state.accounts || []).map(acc => (
                      <article key={acc.id} className={balances[acc.id] < 0 ? "warn" : ""}>
                        <span>{acc.name}</span>
                        <h4 style={{ color: balances[acc.id] >= 0 ? "#1e88e5" : "#e53935", margin: 0 }}>{formatLkrValue(balances[acc.id])}</h4>
                      </article>
                    ))}
                  </div>
                ) : null;
              })()}
              
              <div className="accounting-filters">
                <input
                  type="search"
                  className="admin-search-input search-icon-input"
                  placeholder="Search description or category"
                  value={accountingSearch}
                  onChange={(e) => setAccountingSearch(e.target.value)}
                />
                <div className="accounting-date-filters">
                  <input type="date" value={accountingDateFrom} onChange={(e) => setAccountingDateFrom(e.target.value)} />
                  <span>to</span>
                  <input type="date" value={accountingDateTo} onChange={(e) => setAccountingDateTo(e.target.value)} />
                </div>
              </div>

              <div className="admin-table accounting-table">
                <header>
                  <span>Date</span>
                  <span>Type</span>
                  <span>Category</span>
                  <span>Description</span>
                  <span>Staff</span>
                  <span className="number-cell">Amount</span>
                  <span>Actions</span>
                </header>
                {(state.accounting || [])
                  .filter((item) => {
                    if (accountingSearch && !item.category?.toLowerCase().includes(accountingSearch.toLowerCase()) && !item.description?.toLowerCase().includes(accountingSearch.toLowerCase())) return false;
                    if (accountingDateFrom && item.date < accountingDateFrom) return false;
                    if (accountingDateTo && item.date > accountingDateTo) return false;
                    return true;
                  })
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((item) => {
                    const staffMember = (state.staff || []).find((s) => s.id === item.staffId);
                    return (
                      <article key={item.id}>
                        <span>{item.date}</span>
                        <span><span className={`accounting-badge ${item.type}`}>{item.type}</span></span>
                        <span>{item.category}</span>
                        <span>{item.description}</span>
                        <span>{staffMember ? staffMember.name : "-"}</span>
                        <span className="number-cell amount-cell" style={{ color: "#1e88e5", fontWeight: "600" }}>LKR {formatLkrValue(item.amount)}</span>
                        <span>
                          <div className="table-actions">
                            {item.type === "salary" && staffMember && (
                              <button type="button" className="ghost primary-text" onClick={() => openPayslipPrint({ entry: item, staff: staffMember })}>Print</button>
                            )}
                            <button type="button" className="ghost" onClick={() => {
                              let coaType = "Operating Expenses";
                              let coaGroup = "Vehicle Expenses";
                              let coaSub = "Lorry Fuel";
                              if (item.category && item.category.includes(" > ")) {
                                const parts = item.category.split(" > ");
                                if (parts.length === 3) {
                                  coaType = parts[0].trim();
                                  coaGroup = parts[1].trim();
                                  coaSub = parts[2].trim();
                                }
                              } else if (item.category) {
                                // Fallback for old single-string categories
                                coaType = "Miscellaneous";
                                coaGroup = "Other";
                                coaSub = item.category;
                              }
                              setAccountingForm({ ...item, amount: item.amount.toString(), coaType, coaGroup, coaSub, sourceAccountId: item.sourceAccountId || "", destinationAccountId: item.destinationAccountId || "" });
                              setShowAccountingForm(true);
                            }}>Edit</button>
                            <button type="button" className="ghost danger-text" onClick={() => deleteAccountingEntry(item.id)}>Delete</button>
                          </div>
                        </span>
                      </article>
                    );
                  })}
              </div>
              
              {showAccountingForm ? (
                <div className="low-stock-modal" onClick={() => setShowAccountingForm(false)}>
                  <div className="premium-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="premium-modal-header">
                      <h3>{accountingForm.id ? "Edit Record" : "Add Record"}</h3>
                      <button type="button" onClick={() => setShowAccountingForm(false)}>Close</button>
                    </div>
                    <div className="premium-modal-body">
                      <div className="form-group">
                        <label>Type</label>
                        <select value={accountingForm.type} onChange={(e) => setAccountingForm({ ...accountingForm, type: e.target.value, staffId: ["expense", "income", "transfer"].includes(e.target.value) ? "" : accountingForm.staffId })}>
                          <option value="expense">General Expense</option>
                          <option value="salary">Staff Salary</option>
                          <option value="advance">Staff Advance</option>
                          <option value="income">Income</option>
                          <option value="transfer">Account Transfer</option>
                        </select>
                      </div>
                      {["expense", "transfer", "supplier_payment"].includes(accountingForm.type) && (
                        <div className="form-group">
                          <label>{accountingForm.type === "transfer" ? "Transfer From" : "Paid From (Account)"}</label>
                          <select value={accountingForm.sourceAccountId || ""} onChange={(e) => setAccountingForm({ ...accountingForm, sourceAccountId: e.target.value })}>
                            <option value="">-- Select Account --</option>
                            {(state.accounts || []).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>)}
                          </select>
                        </div>
                      )}
                      {["income", "transfer"].includes(accountingForm.type) && (
                        <div className="form-group">
                          <label>{accountingForm.type === "transfer" ? "Transfer To" : "Deposit To (Account)"}</label>
                          <select value={accountingForm.destinationAccountId || ""} onChange={(e) => setAccountingForm({ ...accountingForm, destinationAccountId: e.target.value })}>
                            <option value="">-- Select Account --</option>
                            {(state.accounts || []).map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>)}
                          </select>
                        </div>
                      )}
                      {accountingForm.type === "expense" && (
                        <>
                          <div className="form-group">
                            <label>Account Type</label>
                            <select value={accountingForm.coaType} onChange={(e) => {
                              const newType = e.target.value;
                              const newGroup = Object.keys(CHART_OF_ACCOUNTS[newType] || {})[0] || "";
                              const newSub = (CHART_OF_ACCOUNTS[newType]?.[newGroup] || [])[0] || "";
                              setAccountingForm({ ...accountingForm, coaType: newType, coaGroup: newGroup, coaSub: newSub });
                            }}>
                              {Object.keys(CHART_OF_ACCOUNTS).filter(k => k !== "Payroll & Staff").map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          {accountingForm.coaType && CHART_OF_ACCOUNTS[accountingForm.coaType] && (
                            <div className="form-group">
                              <label>Account Group</label>
                              <select value={accountingForm.coaGroup} onChange={(e) => {
                                const newGroup = e.target.value;
                                const newSub = (CHART_OF_ACCOUNTS[accountingForm.coaType]?.[newGroup] || [])[0] || "";
                                setAccountingForm({ ...accountingForm, coaGroup: newGroup, coaSub: newSub });
                              }}>
                                {Object.keys(CHART_OF_ACCOUNTS[accountingForm.coaType]).map(group => (
                                  <option key={group} value={group}>{group}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {accountingForm.coaType && accountingForm.coaGroup && CHART_OF_ACCOUNTS[accountingForm.coaType]?.[accountingForm.coaGroup] && (
                            <div className="form-group">
                              <label>Sub-Account</label>
                              <select value={accountingForm.coaSub} onChange={(e) => setAccountingForm({ ...accountingForm, coaSub: e.target.value })}>
                                {CHART_OF_ACCOUNTS[accountingForm.coaType][accountingForm.coaGroup].map(sub => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                      <div className="form-group">
                        <label>Amount (LKR)</label>
                        <input type="number" min="0" step="0.01" value={accountingForm.amount} onChange={(e) => setAccountingForm({ ...accountingForm, amount: e.target.value })} />
                      </div>
                      {["salary", "advance"].includes(accountingForm.type) ? (
                        <div className="form-group">
                          <label>Staff Member</label>
                          <select value={accountingForm.staffId || ""} onChange={(e) => setAccountingForm({ ...accountingForm, staffId: e.target.value })}>
                            <option value="">-- Select Staff --</option>
                            {(state.staff || []).map((s) => (
                              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <div className="form-group">
                        <label>Date</label>
                        <input type="date" value={accountingForm.date} onChange={(e) => setAccountingForm({ ...accountingForm, date: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Description (Optional)</label>
                        <textarea value={accountingForm.description} onChange={(e) => setAccountingForm({ ...accountingForm, description: e.target.value })} />
                      </div>
                    </div>
                    <div className="premium-modal-footer">
                      <button type="button" className="ghost" onClick={() => setShowAccountingForm(false)}>Cancel</button>
                      <SaveButton className="primary" onClick={saveAccountingEntry}>Save Record</SaveButton>
                    </div>
                  </div>
                </div>
              ) : null}

              {showPayrollModal ? (
                <div className="low-stock-modal" onClick={() => setShowPayrollModal(false)}>
                  <div className="premium-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "min(650px, 100%)" }}>
                    <div className="premium-modal-header">
                      <h3>Run Payroll</h3>
                      <button type="button" onClick={() => setShowPayrollModal(false)}>Close</button>
                    </div>
                    <div className="premium-modal-body">
                      <div className="form-group">
                        <label>Payroll Month</label>
                        <input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} />
                      </div>
                      
                      <div className="admin-table payroll-table">
                        <header style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr" }}>
                          <span>Staff Name</span>
                          <span className="number-cell">Base Salary</span>
                          <span className="number-cell">Advances</span>
                          <span className="number-cell">Net Pay</span>
                        </header>
                        {payrollPreview.length > 0 ? payrollPreview.map(p => (
                          <article key={p.staffId} style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr" }}>
                            <span>{p.name}</span>
                            <span className="number-cell">{formatLkrValue(p.baseSalary)}</span>
                            <span className="number-cell danger-text">-{formatLkrValue(p.totalAdvance)}</span>
                            <span className="number-cell" style={{ fontWeight: 800 }}>{formatLkrValue(p.netPay)}</span>
                          </article>
                        )) : (
                          <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>No staff configured with a monthly salary.</div>
                        )}
                      </div>
                    </div>
                    <div className="premium-modal-footer">
                      <button type="button" className="ghost" onClick={() => setShowPayrollModal(false)}>Cancel</button>
                      <button type="button" className="primary" onClick={confirmPayroll} disabled={!payrollPreview.length}>Confirm & Log Payroll</button>
                    </div>
                  </div>
                </div>
              ) : null}

              {showAccountsModal ? (
                <div className="low-stock-modal" onClick={() => setShowAccountsModal(false)}>
                  <div className="premium-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "min(700px, 100%)" }}>
                    <div className="premium-modal-header">
                      <h3>Manage Accounts</h3>
                      <button type="button" onClick={() => setShowAccountsModal(false)}>Close</button>
                    </div>
                    <div className="premium-modal-body">
                      <div className="admin-inline-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "8px", alignItems: "center" }}>
                        <input value={accountForm.name} onChange={e => setAccountForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Account Name" />
                        <select value={accountForm.type} onChange={e => setAccountForm(prev => ({ ...prev, type: e.target.value }))}>
                          <option value="cash">Cash / Till</option>
                          <option value="bank">Bank Account</option>
                        </select>
                        <input type="number" step="0.01" value={accountForm.initialBalance} onChange={e => setAccountForm(prev => ({ ...prev, initialBalance: e.target.value }))} placeholder="Initial Balance" />
                        <div style={{ display: "flex", gap: "4px" }}>
                          <SaveButton onClick={saveAccount} style={{ padding: "8px 12px", background: "#1e88e5", color: "white", borderRadius: "8px", border: "none" }}>{accountForm.id ? "Update" : "Add"}</SaveButton>
                          {accountForm.id && <button type="button" onClick={() => setAccountForm({ id: "", name: "", type: "bank", initialBalance: "" })} style={{ padding: "8px 12px", background: "#f5f5f5", color: "#333", borderRadius: "8px", border: "1px solid #ddd" }}>Cancel</button>}
                        </div>
                      </div>
                      <div className="admin-table">
                        <header style={{ gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr" }}>
                          <span>Account Name</span>
                          <span>Type</span>
                          <span className="number-cell">Initial Balance</span>
                          <span className="number-cell">Actions</span>
                        </header>
                        {(state.accounts || []).length > 0 ? (state.accounts || []).map(acc => (
                          <article key={acc.id} style={{ gridTemplateColumns: "1.5fr 1fr 1.5fr 1fr" }}>
                            <span>{acc.name}</span>
                            <span style={{textTransform:"capitalize"}}>{acc.type}</span>
                            <span className="number-cell" style={{ fontWeight: 600 }}>{formatLkrValue(acc.initialBalance)}</span>
                            <span className="number-cell">
                              <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                                <button type="button" className="ghost" onClick={() => setAccountForm({ id: acc.id, name: acc.name, type: acc.type, initialBalance: acc.initialBalance })}>Edit</button>
                                <button type="button" className="danger-btn" onClick={() => deleteAccountHandler(acc.id)}>Delete</button>
                              </div>
                            </span>
                          </article>
                        )) : (
                          <div style={{textAlign:"center", color:"#888", padding: "20px"}}>No accounts created yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activePage === "staff" ? (
            <section className="admin-mobile-section">
              <div className="staff-head">
                <h2>Staff</h2>
                <div className="staff-head-actions">
                  {canManageUsers ? <button type="button" onClick={openStaffAdd}>Add Staff</button> : null}
                </div>
              </div>
              {showStaffForm ? (
                <div className="admin-inline-form">
                  <input value={staffForm.name} onChange={(e) => setStaffForm((c) => ({ ...c, name: e.target.value }))} placeholder="Staff name" />
                  <input value={staffForm.role} onChange={(e) => setStaffForm((c) => ({ ...c, role: e.target.value }))} placeholder="Role" />
                  <input value={staffForm.phone} onChange={(e) => setStaffForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone" />
                  <input type="number" min="0" step="0.01" value={staffForm.monthlySalary} onChange={(e) => setStaffForm((c) => ({ ...c, monthlySalary: e.target.value }))} placeholder="Monthly Salary (LKR)" />
                  {!staffForm.authUserId ? (
                    <>
                      <input value={staffForm.username} onChange={(e) => setStaffForm((c) => ({ ...c, username: e.target.value }))} placeholder="Username" />
                      <input type="password" value={staffForm.password} onChange={(e) => setStaffForm((c) => ({ ...c, password: e.target.value }))} placeholder="Password" />
                      <select value={staffForm.authRole} onChange={(e) => setStaffForm((c) => ({ ...c, authRole: e.target.value }))}>
                        <option value="cashier">Cashier Login</option>
                        <option value="manager">Manager Login</option>
                        <option value="admin">Admin Login</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <input value={staffForm.username} disabled placeholder="Username" />
                      <select value={staffForm.authRole} onChange={(e) => setStaffForm((c) => ({ ...c, authRole: e.target.value }))}>
                        <option value="cashier">Cashier Login</option>
                        <option value="manager">Manager Login</option>
                        <option value="admin">Admin Login</option>
                      </select>
                      <input
                        type="password"
                        value={staffForm.password}
                        onChange={(e) => setStaffForm((c) => ({ ...c, password: e.target.value }))}
                        placeholder="New Password (leave blank to keep current)"
                      />
                    </>
                  )}
                  <div>
                    <SaveButton onClick={saveStaff}>Save</SaveButton>
                    <button type="button" className="ghost" onClick={() => setShowStaffForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : null}
              <input
                className="search-icon-input imperfect-search-input"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff"
              />
              <div className="admin-table staff-table">
                <header>
                  <button type="button" className="th-sort" onClick={() => toggleSort("staff", "name")}>Staff{sortMark("staff", "name")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("staff", "username")}>Username{sortMark("staff", "username")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("staff", "role")}>Access{sortMark("staff", "role")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("staff", "salary")}>Salary{sortMark("staff", "salary")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("staff", "orders")}>Orders{sortMark("staff", "orders")}</button>
                  <button type="button" className="th-sort" onClick={() => toggleSort("staff", "revenue")}>Revenue{sortMark("staff", "revenue")}</button>
                  <span>Action</span>
                </header>
                {sortedStaffRows.filter((row) => matchesSearch(staffSearch, row.name, row.username, row.authRole, row.role)).length ? sortedStaffRows.filter((row) => matchesSearch(staffSearch, row.name, row.username, row.authRole, row.role)).map((row) => (
                  <article
                    key={`${row.authUserId || "auth-none"}-${row.staffId || "staff-none"}-${row.name}`}
                    className="staff-clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (canManageUsers) openStaffEditByRow(row);
                    }}
                    onKeyDown={(e) => {
                      if (canManageUsers && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        openStaffEditByRow(row);
                      }
                    }}
                  >
                    <span>{row.name}</span>
                    <span>{row.username || "-"}</span>
                    <span>{row.authRole || row.role || "-"}</span>
                    <span>{row.monthlySalary ? currency(row.monthlySalary) : "-"}</span>
                    <span>{row.orders}</span>
                    <span>{currency(row.revenue)}</span>
                    <span className="staff-row-action">
                      {canManageUsers ? (
                        <button
                          type="button"
                          className="danger-inline"
                          disabled={String(row.authUserId || "") === String(user?.id || "")}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteUserByRow(row);
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        "-"
                      )}
                    </span>
                  </article>
                )) : <p>No staff sales records yet.</p>}
              </div>
              <div className="staff-summary-divider">
                <span>STAFF SUMMARY</span>
              </div>
              <section className="staff-summary-card">
                <div className="staff-summary-top">
                  <article>
                    <span>Total Staff</span>
                    <strong>{staffPageSummary.totalStaff}</strong>
                  </article>
                  <article>
                    <span>Active Staff</span>
                    <strong>{staffPageSummary.activeStaff}</strong>
                  </article>
                  <article>
                    <span>Total Orders</span>
                    <strong>{staffPageSummary.totalOrders}</strong>
                  </article>
                  <article>
                    <span>Total Revenue (LKR)</span>
                    <strong>{formatLkrValue(staffPageSummary.totalRevenue)}</strong>
                  </article>
                </div>
                <div className="staff-summary-bottom">
                  <article>
                    <span>Avg Revenue / Staff (LKR)</span>
                    <strong>{formatLkrValue(staffPageSummary.avgRevenuePerStaff)}</strong>
                  </article>
                  <article className="staff-summary-highlight">
                    <span>Top Performer</span>
                    <strong>{staffPageSummary.topPerformerName}</strong>
                    <p>{staffPageSummary.topPerformerOrders} orders • {currency(staffPageSummary.topPerformerRevenue)}</p>
                  </article>
                </div>
              </section>
            </section>
          ) : null}

          {activePage === "preorders" ? (() => {
            const preordersList = (allSalesIncludingPreorders || [])
              .filter(s => s.orderType === "preorder")
              .filter(s => {
                const term = preordersSearch.trim().toLowerCase();
                if (!term) return true;
                return matchesSearch(term, s.id, s.cashier, s.customerName, s.preOrderStatus);
              })
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
            return (
              <section className="admin-mobile-section admin-customers-panel">
                <div className="customers-head">
                  <h2>Pre-Orders</h2>
                  <div className="admin-search-wrapper">
                    <input className="search-icon-input" type="text" placeholder="Search pre-orders..." value={preordersSearch} onChange={e => setPreordersSearch(e.target.value)} />
                  </div>
                </div>
                
                <div className="admin-table purchases-table mt-4">
                  <header>
                    <span>ID / Date</span>
                    <span>Rep</span>
                    <span>Customer</span>
                    <span>Status</span>
                    <span>Total (LKR)</span>
                  </header>
                  <PaginatedGridList
                    items={preordersList}
                    emptyMessage="No pre-orders found."
                    renderItem={(sale) => {
                      const statusClass = sale.preOrderStatus === "confirmed" ? "stock-qty in-stock" : "stock-qty low-stock";
                      return (
                        <article key={sale.id}>
                          <span><strong>#{sale.id}</strong><br/><small>{new Date(sale.createdAt).toLocaleDateString()}</small></span>
                          <span>{sale.cashier || "-"}</span>
                          <span>{sale.customerName || "Walk-in"}</span>
                          <span className={statusClass}>{String(sale.preOrderStatus || "pending").toUpperCase()}</span>
                          <span className="mono">{currency(saleNetTotal(sale))}</span>
                        </article>
                      );
                    }}
                  />
                </div>
              </section>
            );
          })() : null}

          {activePage === "deliveries" ? (
            <section className="admin-mobile-section deliveries-page">
              <div className="deliveries-head-row">
                <h2>Deliveries</h2>
                <div className="deliveries-head-actions">
                  {deliveriesView === "not-delivered" ? (
                    <button
                      type="button"
                      className="receipt-print-action deliveries-head-action-btn deliveries-head-print-btn"
                      onClick={() => printNotDeliveredReport(notDeliveredItemRows)}
                    >
                      Print
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost deliveries-head-action-btn deliveries-head-toggle-btn"
                    onClick={() => setDeliveriesView((current) => (current === "deliveries" ? "not-delivered" : "deliveries"))}
                  >
                    {deliveriesView === "deliveries" ? "Not Delivered" : "Back to Deliveries"}
                  </button>
                </div>
              </div>
              <div className="rep-date-filters">
                <select value={deliveryLorry} onChange={(e) => setDeliveryLorry(e.target.value)}>
                  <option value="all">All Lorries</option>
                  {ORDER_LORRIES.map((lorryName) => <option key={lorryName} value={lorryName}>{lorryName}</option>)}
                </select>
                <label className="rep-date-field">
                  <span>From</span>
                  <input type="date" value={deliveryDateFrom} onChange={(e) => setDeliveryDateFrom(e.target.value)} />
                </label>
                <label className="rep-date-field">
                  <span>To</span>
                  <input type="date" value={deliveryDateTo} onChange={(e) => setDeliveryDateTo(e.target.value)} />
                </label>
                <label className="rep-date-field">
                  <span>From Time</span>
                  <input type="time" value={deliveryTimeFrom} onChange={(e) => setDeliveryTimeFrom(e.target.value)} />
                </label>
                <label className="rep-date-field">
                  <span>To Time</span>
                  <input type="time" value={deliveryTimeTo} onChange={(e) => setDeliveryTimeTo(e.target.value)} />
                </label>
              </div>
              {deliveriesView === "not-delivered" ? (
                <>
                  <div className="admin-table deliveries-report-table not-delivered-min-table">
                    <header>
                      <span>Item</span>
                      <span>ND Qty</span>
                    </header>
                    {notDeliveredItemRows.length ? notDeliveredItemRows.map((row) => (
                      <article key={`nd-item-${row.item}`}>
                        <span>{row.item}</span>
                        <span>{row.qty}</span>
                      </article>
                    )) : <p>No not-delivered items found for selected range.</p>}
                  </div>
                </>
              ) : (
                <>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={deliveriesSearch}
                    onChange={(e) => setDeliveriesSearch(e.target.value)}
                    placeholder="Search deliveries"
                  />
                  <div className="admin-table deliveries-table">
                    <header>
                      <button type="button" className="th-sort delivery-col-id" onClick={() => toggleSort("deliveries", "id")}>Sale ID{sortMark("deliveries", "id")}</button>
                      <button type="button" className="th-sort delivery-col-date" onClick={() => toggleSort("deliveries", "when")}>Date/Time{sortMark("deliveries", "when")}</button>
                      <button type="button" className="th-sort delivery-col-rep" onClick={() => toggleSort("deliveries", "rep")}>Rep{sortMark("deliveries", "rep")}</button>
                      <button type="button" className="th-sort delivery-col-lorry" onClick={() => toggleSort("deliveries", "lorry")}>Lorry{sortMark("deliveries", "lorry")}</button>
                      <button type="button" className="th-sort delivery-col-total" onClick={() => toggleSort("deliveries", "total")}>Total (LKR){sortMark("deliveries", "total")}</button>
                      <button type="button" className="th-sort delivery-col-status" onClick={() => toggleSort("deliveries", "status")}>Status{sortMark("deliveries", "status")}</button>
                      <span className="th-action delivery-col-action">Action</span>
                    </header>
                    <PaginatedGridList
                      items={sortedDeliveryRows.filter((row) => matchesSearch(deliveriesSearch, row.id, row.rep, row.lorry, row.when, row.sale?.customerName, row.confirmed ? "confirmed" : "pending"))}
                      emptyMessage="No delivery bills found for selected filters."
                      renderItem={(row) => (
                        <article key={`d-${row.id}`}>
                          <span className="delivery-col-id delivery-sale-cell">
                            <strong className="delivery-sale-id">#{row.id}</strong>
                            <small className="delivery-sale-customer">{row.sale.customerName || "Walk-in"}</small>
                            <small className="delivery-sale-meta">{row.when} • {row.rep}</small>
                          </span>
                          <span className="delivery-col-date delivery-cell-date">{row.when}</span>
                          <span className="delivery-col-rep">{row.rep}</span>
                          <span className="delivery-col-lorry">{row.lorry}</span>
                          <span className="delivery-col-total">{formatLkrValue(row.total || 0)}</span>
                          <span className="delivery-col-status">
                            <span className={row.confirmed ? "delivery-status confirmed" : "delivery-status pending"}>
                              {row.confirmed ? "Confirmed" : "Pending"}
                            </span>
                          </span>
                          <span className="action-cell delivery-col-action">
                            <button type="button" className="delivery-action-btn" onClick={() => openDeliveryModal(row.sale)}>
                              {row.confirmed ? "Update" : "Confirm"}
                            </button>
                          </span>
                        </article>
                      )}
                    />
                  </div>
                  <div className="report-head deliveries-report-head" style={{ marginTop: "0.65rem" }}>
                    <h3>Delivered Items Report</h3>
                  </div>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={deliveryReportDateFrom} onChange={(e) => setDeliveryReportDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={deliveryReportDateTo} onChange={(e) => setDeliveryReportDateTo(e.target.value)} />
                    </label>
                  </div>
                  <div className="delivery-kpi-grid">
                    <article>
                      <span>Sold Qty</span>
                      <strong>{soldTotals.qty}</strong>
                    </article>
                    <article>
                      <span>Sold Value</span>
                      <strong>{currency(soldTotals.value)}</strong>
                    </article>
                    <article>
                      <span>Delivered Qty</span>
                      <strong>{deliveredTotals.qty}</strong>
                    </article>
                    <article>
                      <span>Delivered Value</span>
                      <strong>{currency(deliveredTotals.value)}</strong>
                    </article>
                  </div>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={deliveredItemsSearch}
                    onChange={(e) => setDeliveredItemsSearch(e.target.value)}
                    placeholder="Search delivered items"
                  />
                  <div className="admin-table deliveries-report-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveredItems", "item")}>Item{sortMark("deliveredItems", "item")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveredItems", "sku")}>SKU{sortMark("deliveredItems", "sku")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveredItems", "qty")}>Delivered Qty{sortMark("deliveredItems", "qty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveredItems", "value")}>Delivered Value{sortMark("deliveredItems", "value")}</button>
                    </header>
                    {sortedDeliveredItemRows.filter((row) => matchesSearch(deliveredItemsSearch, row.item, row.sku)).length ? sortedDeliveredItemRows.filter((row) => matchesSearch(deliveredItemsSearch, row.item, row.sku)).map((row) => (
                      <article key={`dr-${row.key}`}>
                        <span>{row.item}</span>
                        <span>{row.sku}</span>
                        <span>{row.qty}</span>
                        <span>{currency(row.value)}</span>
                      </article>
                    )) : <p>No delivered item records for selected filters.</p>}
                  </div>
                </>
              )}
            </section>
          ) : null}

          {activePage === "dashboard" ? (
            <div className="admin-mobile admin-dashboard">
              <div className="dashboard-notification-row">
                <button
                  type="button"
                  className="dashboard-bell-button"
                  onClick={() => setShowCreditLimitAlertDetails(true)}
                  aria-label="Open credit limit notifications"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 17H5.8c-.7 0-1.1-.8-.7-1.4l1.2-1.8V10a5.7 5.7 0 1 1 11.4 0v3.8l1.2 1.8c.4.6 0 1.4-.7 1.4H15" />
                    <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
                  </svg>
                  {creditLimitAlertSummary.count > 0 ? <span className="dashboard-bell-badge">{creditLimitAlertSummary.count > 9 ? "9+" : creditLimitAlertSummary.count}</span> : null}
                </button>
                <div className="dashboard-notification-copy">
                  <strong>Notifications</strong>
                  <span>{creditLimitAlertSummary.count ? `${creditLimitAlertSummary.count} customer limit alert${creditLimitAlertSummary.count === 1 ? "" : "s"}` : "No credit-limit alerts right now"}</span>
                </div>
              </div>
              {!isManager ? (
                <div className="dashboard-notification-row manager-access-row">
                  <div className="dashboard-notification-copy">
                    <strong>Manager Full Access</strong>
                    <span>{managerFullAccessEnabled ? "Manager can use restricted admin actions" : "Manager is limited to standard manager permissions"}</span>
                  </div>
                  <button
                    type="button"
                    className={`manager-access-switch ${managerFullAccessEnabled ? "on" : ""}`}
                    onClick={handleManagerFullAccessToggle}
                    disabled={managerAccessPending}
                    aria-pressed={managerFullAccessEnabled}
                  >
                    <span>{managerAccessPending ? "..." : managerFullAccessEnabled ? "ON" : "OFF"}</span>
                  </button>
                </div>
              ) : null}
              {isAdmin ? (
                <div className="dashboard-notification-row manager-access-row">
                  <div className="dashboard-notification-copy">
                    <strong>Danger Zone</strong>
                    <span>Permanently delete sales, customers, and other stored data.</span>
                  </div>
                  <button
                    type="button"
                    className="row-danger"
                    onClick={() => {
                      setResetDataConfirmText("");
                      setShowResetDataModal(true);
                    }}
                  >
                    Reset Data
                  </button>
                </div>
              ) : null}
              {upcomingChequeSummary.count ? (
                <button type="button" className="admin-mobile-section dashboard-headline-banner cheque-headline-banner dashboard-headline-button" onClick={() => setShowChequeAlertDetails(true)}>
                  <strong>Cheque Alert Tomorrow</strong>
                  <span>
                    {upcomingChequeSummary.count} cheque{upcomingChequeSummary.count === 1 ? "" : "s"} • LKR {formatLkrValue(upcomingChequeSummary.total)} • {upcomingChequeSummary.rows[0]?.customer || "-"} • #{upcomingChequeSummary.rows[0]?.saleId || "-"} • {upcomingChequeSummary.rows[0]?.bank || "-"}
                  </span>
                </button>
              ) : null}
              <section className="admin-mobile-section dashboard-snapshot-panel">
                <h2>Admin Snapshot</h2>
                <div className="snapshot-layout">
                  <div className="snapshot-grid">
                    <article><p>Total sales</p><strong>{dashboard.salesCount}</strong></article>
                    <article><p>Today sales</p><strong>{dashboard.todaySalesCount}</strong></article>
                    <article className="snapshot-card-outstanding snapshot-card-outstanding-total">
                      <p>Total Outstanding</p>
                      <strong>{formatLkrValue(customerPageSummary.totalOutstanding || 0)}</strong>
                      <small className="snapshot-subvalue">Without Today: {formatLkrValue(totalOutstandingExcludingToday)}</small>
                    </article>
                    <article className="snapshot-card-outstanding snapshot-card-outstanding-today"><p>Today Outstanding</p><strong>{formatLkrValue(dashboard.todayOutstanding || 0)}</strong></article>
                    <article><p>Today Ordered Value</p><strong>{dashboard.todayRevenue.toFixed(0)}</strong></article>
                    <article><p>Low Stock</p><strong>{dashboard.lowStockItems.length}</strong></article>
                  </div>
                  <div className="snapshot-sidecards">
                    <div className="dashboard-profit-card">
                      <div className="dashboard-profit-head">
                        <div>
                          <span className="dashboard-profit-eyebrow">Total Net Profit</span>
                          <div className="dashboard-profit-date-range">
                            <label className="dashboard-profit-date-field">
                              <span>From</span>
                              <input type="date" value={dashboardProfitDateFrom} onChange={(e) => setDashboardProfitDateFrom(e.target.value)} />
                            </label>
                            <label className="dashboard-profit-date-field">
                              <span>To</span>
                              <input type="date" value={dashboardProfitDateTo} onChange={(e) => setDashboardProfitDateTo(e.target.value)} />
                            </label>
                          </div>
                        </div>
                        <strong>LKR {formatLkrValue(dashboardProfitSummary.profit)}</strong>
                      </div>
                      <div className="dashboard-profit-meta">
                        <span>Revenue <b>LKR {formatLkrValue(dashboardProfitSummary.revenue)}</b></span>
                        <span>Invoice Cost <b>LKR {formatLkrValue(dashboardProfitSummary.cost)}</b></span>
                        <span>Total Expenses <b>LKR {formatLkrValue(dashboardProfitSummary.expenses)}</b></span>
                      </div>
                      <div className="dashboard-profit-foot">
                        <span>{dashboardProfitSummary.filteredSalesCount} bill{dashboardProfitSummary.filteredSalesCount === 1 ? "" : "s"} in range</span>
                      </div>
                      <p>Net margin {dashboardProfitSummary.margin}%</p>
                    </div>
                    <button type="button" className="low-stock-card" onClick={() => setShowLowStock(true)}>
                      <strong>Low Stock</strong>
                      <span>Click to popup the list</span>
                    </button>
                    {overdueCreditSummary.count ? (
                      <div className="dashboard-alert-card">
                        <strong>Overdue Credit Alert</strong>
                        <span>{overdueCreditSummary.count} customer(s) • LKR {formatLkrValue(overdueCreditSummary.total)}</span>
                        <p>
                          Top overdue: {overdueCreditSummary.top?.customer || "-"}
                          {" • "}
                          {overdueCreditSummary.top?.maxDays || 0} days
                        </p>
                      </div>
                    ) : null}
                    {creditLimitAlertSummary.count ? (
                      <div className="dashboard-alert-card dashboard-alert-card-credit-limit">
                        <strong>Credit Limit Exceeded</strong>
                        <span>{creditLimitAlertSummary.count} customer(s) • LKR {formatLkrValue(creditLimitAlertSummary.totalExceeded)} over limit</span>
                        <p>
                          Top alert: {creditLimitAlertSummary.top?.customer || "-"}
                          {" • exceeded by "}
                          {formatLkrValue(creditLimitAlertSummary.top?.exceededBy || 0)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="admin-mobile-section sales-day-panel dashboard-chart-panel">
                <h2>Sales Chart by Day</h2>
                <div className="rep-date-filters">
                  <label className="rep-date-field">
                    <span>From</span>
                    <input type="date" value={chartDateFrom} onChange={(e) => setChartDateFrom(e.target.value)} />
                  </label>
                  <label className="rep-date-field">
                    <span>To</span>
                    <input type="date" value={chartDateTo} onChange={(e) => setChartDateTo(e.target.value)} />
                  </label>
                </div>
                <div className="bar-chart">
                  {chartData.map((item) => (
                    <div key={item.key} className="bar-col">
                      <div className="bar-value">{item.count}</div>
                      <div className="bar-wrap">
                        <div className="bar" style={{ height: `${(item.count / maxCount) * 100}%` }} />
                      </div>
                      <div className="bar-meta">{formatLkrValue(item.revenue || 0)}</div>
                      <div className="bar-label">{item.short}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="admin-mobile-section rep-chart-panel dashboard-chart-panel">
                <div className="chart-title-row rep-title-row">
                  <h2 className="rep-chart-title">Sales Chart by Rep</h2>
                  <div className="rep-search rep-search-wide">
                    <select value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}>
                      <option value="">All reps</option>
                      {repChartData.map((item) => (
                        <option key={item.rep} value={item.rep}>{item.rep}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rep-date-filters">
                  <label className="rep-date-field">
                    <span>From</span>
                    <input type="date" value={repDateFrom} onChange={(e) => setRepDateFrom(e.target.value)} />
                  </label>
                  <label className="rep-date-field">
                    <span>To</span>
                    <input type="date" value={repDateTo} onChange={(e) => setRepDateTo(e.target.value)} />
                  </label>
                </div>
                <div className="rep-result">
                  Matched reps: {filteredRepChartData.length}
                  {(repDateFrom || repDateTo) ? ` • Range: ${repDateFrom || "start"} to ${repDateTo || "today"}` : ""}
                </div>
                <div className="rep-chart-metrics">
                  <article>
                    <span>Total Orders</span>
                    <strong>{filteredRepChartData.reduce((sum, item) => sum + Number(item.count || 0), 0)}</strong>
                  </article>
                  <article>
                    <span>Top Rep</span>
                    <strong>{filteredRepChartData[0]?.rep || "-"}</strong>
                  </article>
                  <article>
                    <span>Top Orders</span>
                    <strong>{filteredRepChartData[0]?.count || 0}</strong>
                  </article>
                </div>
                <div className="bar-chart rep-bar-chart">
                  {filteredRepChartData.map((item) => (
                    <div key={item.rep} className="bar-col">
                      <div className="bar-value">{item.count}</div>
                      <div className="bar-wrap">
                        <div className="bar" style={{ height: `${(item.count / repMaxCount) * 100}%` }} />
                      </div>
                      <div className="bar-label">{item.rep}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {activePage === "reports" ? (
            <div className="admin-mobile admin-reports">
              <section className="admin-mobile-section reports-subnav-panel">
                <div className="reports-subnav-head">
                  <div>
                    <span className="reports-subnav-kicker">Reports</span>
                    <h2>{(REPORT_SUBPAGES.find((item) => item.id === reportSubpage) || REPORT_SUBPAGES[0]).label}</h2>
                  </div>
                  <div className="reports-subnav" ref={reportMenuRef}>
                    <button
                      type="button"
                      className={`reports-subnav-trigger ${reportMenuOpen ? "open" : ""}`}
                      onClick={() => setReportMenuOpen((open) => !open)}
                    >
                      {(REPORT_SUBPAGES.find((item) => item.id === reportSubpage) || REPORT_SUBPAGES[0]).label}
                    </button>
                    {reportMenuOpen ? (
                      <div className="reports-subnav-menu">
                        {REPORT_SUBPAGES.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={reportSubpage === item.id ? "active" : ""}
                            onClick={() => {
                              setReportSubpage(item.id);
                              setReportMenuOpen(false);
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              {reportSubpage === "item-wise" ? (
                <section className="admin-mobile-section report-panel report-itemwise-panel">
                  <div className="report-head">
                    <h2>Item Wise Report</h2>
                    <select value={itemReportLorry} onChange={(e) => setItemReportLorry(e.target.value)}>
                      <option value="all">All Lorries</option>
                      {ORDER_LORRIES.map((lorryName) => <option key={lorryName} value={lorryName}>{lorryName}</option>)}
                    </select>
                  </div>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={itemDateFrom} onChange={(e) => setItemDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={itemDateTo} onChange={(e) => setItemDateTo(e.target.value)} />
                    </label>
                  </div>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={itemWiseSearch}
                    onChange={(e) => setItemWiseSearch(e.target.value)}
                    placeholder="Search item wise report"
                  />
                  <div className="admin-table item-wise-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("itemWise", "name")}>Item{sortMark("itemWise", "name")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("itemWise", "sku")}>SKU{sortMark("itemWise", "sku")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("itemWise", "qty")}>Sold Qty{sortMark("itemWise", "qty")}</button>
                      
                      <button type="button" className="th-sort" onClick={() => toggleSort("itemWise", "singles")}>Singles{sortMark("itemWise", "singles")}</button>
                    </header>
                    {sortedItemWiseRows.filter((row) => matchesSearch(itemWiseSearch, row.name, row.sku, row.size, row.category)).length ? sortedItemWiseRows.filter((row) => matchesSearch(itemWiseSearch, row.name, row.sku, row.size, row.category)).map((row) => (
                      <article key={row.key}>
                        <span>{row.name}</span>
                        <span>{row.sku}</span>
                        <span>{row.qty}</span>
                        <span>{getBundleBreakdown(row).bundles}</span>
                        <span>{getBundleBreakdown(row).singles}</span>
                      </article>
                    )) : <p>No item-wise records yet.</p>}
                  </div>
                </section>
              ) : null}

              {reportSubpage === "bottle-payment" ? (
                <section className="admin-mobile-section report-panel report-bottlepayment-panel">
                  <div className="report-head">
                    <h2>Bottle Payment Report</h2>
                  </div>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={bottleReportDateFrom} onChange={(e) => setBottleReportDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={bottleReportDateTo} onChange={(e) => setBottleReportDateTo(e.target.value)} />
                    </label>
                  </div>
                  <div className="rep-chart-metrics">
                    <article>
                      <span>Total Bottles Sold</span>
                      <strong>{bottleReportTotals.totalQty}</strong>
                    </article>
                    <article>
                      <span>Cashed Bottles</span>
                      <strong>{bottleReportTotals.cashQty}</strong>
                    </article>
                    <article>
                      <span>Chequed Bottles</span>
                      <strong>{bottleReportTotals.chequeQty}</strong>
                    </article>
                    <article>
                      <span>Credited Bottles</span>
                      <strong>{bottleReportTotals.creditQty}</strong>
                    </article>
                  </div>
                  <p className="form-hint">
                    A credit bill moves from Credited to Cashed or Chequed once it's fully settled - whichever
                    method paid the larger share of that bill.
                  </p>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={bottleReportSearch}
                    onChange={(e) => setBottleReportSearch(e.target.value)}
                    placeholder="Search bottle payment report"
                  />
                  <div className="admin-table bottle-payment-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("bottlePayment", "name")}>Item{sortMark("bottlePayment", "name")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("bottlePayment", "sku")}>SKU{sortMark("bottlePayment", "sku")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("bottlePayment", "totalQty")}>Total Sold{sortMark("bottlePayment", "totalQty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("bottlePayment", "cashQty")}>Cashed{sortMark("bottlePayment", "cashQty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("bottlePayment", "chequeQty")}>Chequed{sortMark("bottlePayment", "chequeQty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("bottlePayment", "creditQty")}>Credited{sortMark("bottlePayment", "creditQty")}</button>
                    </header>
                    {sortedBottleReportRows.filter((row) => matchesSearch(bottleReportSearch, row.name, row.sku, row.size, row.category)).length ? sortedBottleReportRows.filter((row) => matchesSearch(bottleReportSearch, row.name, row.sku, row.size, row.category)).map((row) => (
                      <article key={row.key}>
                        <span>{row.name}</span>
                        <span>{row.sku}</span>
                        <span>{row.totalQty}</span>
                        <span>{row.cashQty}</span>
                        <span>{row.chequeQty}</span>
                        <span className={row.creditQty > 0 ? "outstanding-text" : ""}>{row.creditQty}</span>
                      </article>
                    )) : <p>No bottle payment records yet.</p>}
                  </div>
                </section>
              ) : null}

              {reportSubpage === "voided-bills" ? (
                <section className="admin-mobile-section report-panel">
                  <h2>Voided Bills</h2>
                  <div className="table-responsive">
                    <table className="mobile-table">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Voided At</th>
                          <th>Voided By</th>
                          <th>Customer</th>
                          <th>Net Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <PaginatedTableBody
                          items={rawState.voidedSales || []}
                          emptyMessage="No voided bills found."
                          colSpan={5}
                          renderItem={(sale) => (
                            <tr key={sale.id}>
                              <td data-label="Bill No">#{sale.id}</td>
                              <td data-label="Voided At">{new Date(sale.voidedAt).toLocaleString()}</td>
                              <td data-label="Voided By">{sale.voidedBy || "system"}</td>
                              <td data-label="Customer">{sale.customerName || "-"}</td>
                              <td data-label="Net Total">{sale.netTotalAfterReturns || sale.total || 0}</td>
                            </tr>
                          )}
                        />
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {reportSubpage === "sales-wise" ? (
                <section className="admin-mobile-section report-panel report-saleswise-panel">
                  <h2>Sales Wise Report</h2>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={salesDateFrom} onChange={(e) => setSalesDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={salesDateTo} onChange={(e) => setSalesDateTo(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>From Time</span>
                      <input type="time" value={salesTimeFrom} onChange={(e) => setSalesTimeFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To Time</span>
                      <input type="time" value={salesTimeTo} onChange={(e) => setSalesTimeTo(e.target.value)} />
                    </label>
                  </div>
                  <div className="row" style={{ justifyContent: "flex-end", marginTop: "-0.2rem", marginBottom: "0.2rem" }}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setSalesDateFrom(loadingDateFrom || "");
                        setSalesDateTo(loadingDateTo || "");
                        setSalesTimeFrom(loadingTimeFrom || "");
                        setSalesTimeTo(loadingTimeTo || "");
                      }}
                    >
                      Use Loadings Date/Time Range
                    </button>
                  </div>
                  <div className="sales-range-kpi">
                    <span className="sales-range-kpi-label">Selected Range Total Sale Value</span>
                    <strong className="sales-range-kpi-value">{currency(salesRangeTotal)}</strong>
                  </div>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <input
                      className="search-icon-input imperfect-search-input"
                      style={{ flex: 1 }}
                      value={salesWiseSearch}
                      onChange={(e) => setSalesWiseSearch(e.target.value)}
                      placeholder="Search sales wise report"
                    />
                    <select
                      className="imperfect-select"
                      style={{ maxWidth: "200px" }}
                      value={salesWiseTypeFilter}
                      onChange={(e) => setSalesWiseTypeFilter(e.target.value)}
                    >
                      <option value="All">All Types</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit">Credit</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                    <select
                      className="imperfect-select"
                      style={{ maxWidth: "200px" }}
                      value={salesWiseLorryFilter}
                      onChange={(e) => setSalesWiseLorryFilter(e.target.value)}
                    >
                      <option value="All Lorries">All Lorries</option>
                      {ORDER_LORRIES.map((lorryName) => <option key={lorryName} value={lorryName}>{lorryName}</option>)}
                    </select>
                  </div>
                  <div className="admin-table sales-wise-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("salesWise", "id")}>Sale ID{sortMark("salesWise", "id")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("salesWise", "when")}>Date{sortMark("salesWise", "when")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("salesWise", "lorry")}>Lorry{sortMark("salesWise", "lorry")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("salesWise", "customer")}>Customer Name{sortMark("salesWise", "customer")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("salesWise", "total")}>Total<br />(LKR){sortMark("salesWise", "total")}</button>
                      <span className="th-action">Actions</span>
                    </header>
                    <PaginatedGridList
                      emptyMessage="No matching sales records."
                      items={sortedSalesWiseRows.filter((row) => matchesSearch(salesWiseSearch, row.id, row.rep, row.lorry, row.when, row.raw?.customerName))}
                      renderItem={(row) => (
                      <article key={row.id}>
                        <span className="sales-id-cell">
                          <strong>#{row.id}</strong>
                          <small>{row.rep}</small>
                        </span>
                        <span>{row.when}</span>
                        <span>{row.lorry}</span>
                        <span>{row.raw?.customerName || "Walk-in"}</span>
                        <span>{formatLkrValue(row.total || 0)}</span>
                        <span className="action-cell">
                          <button type="button" className="ghost" onClick={() => setViewSaleId(String(row.id))}>View</button>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => openAdminSaleEdit(row.raw)}
                            disabled={Boolean(row.raw?.deliveryConfirmedAt) || Boolean((row.raw?.deliveryAdjustments || []).length) || Boolean(row.raw?.preOrderConfirmedAt) || (state.returns || []).some((ret) => String(ret.saleId) === String(row.id))}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="row-danger"
                            onClick={() => deleteAdminSale(row.raw)}
                            disabled={deletingSaleId === String(row.id) || Boolean(row.raw?.deliveryConfirmedAt) || Boolean((row.raw?.deliveryAdjustments || []).length) || Boolean(row.raw?.preOrderConfirmedAt)}
                          >
                            {deletingSaleId === String(row.id) ? "..." : "Delete"}
                          </button>
                        </span>
                      </article>
                      )}
                    />
                  </div>
                </section>
              ) : null}

              {reportSubpage === "cheque-summary" ? (
                <section className="admin-mobile-section report-panel cheque-report-panel">
                  <h2>Cheque Summary</h2>
                  <div className="cheque-summary-grid">
                    <article
                      role="button"
                      tabIndex={0}
                      className="cheque-summary-clickable"
                      onClick={() => setShowChequeSummaryDetails(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowChequeSummaryDetails(true);
                        }
                      }}
                    >
                      <span>Total Cheques</span>
                      <strong>{chequeReportSummary.chequeCount}</strong>
                    </article>
                    <article>
                      <span>Total Cheque Amount (LKR)</span>
                      <strong>{formatLkrValue(chequeReportSummary.totalChequeAmount)}</strong>
                    </article>
                    <article>
                      <span>Average Cheque (LKR)</span>
                      <strong>{formatLkrValue(chequeReportSummary.avgChequeAmount)}</strong>
                    </article>
                    <article className="warn">
                      <span>Outstanding on Cheques (LKR)</span>
                      <strong>{formatLkrValue(chequeReportSummary.totalOutstanding)}</strong>
                    </article>
                  </div>
                  <div className="cheque-summary-meta">
                    <article>
                      <span>Latest Cheque No</span>
                      <strong>{chequeReportSummary.latestChequeNo}</strong>
                    </article>
                    <article>
                      <span>Latest Cheque Date</span>
                      <strong>{chequeReportSummary.latestChequeDate}</strong>
                    </article>
                    <article>
                      <span>Latest Bank</span>
                      <strong>{chequeReportSummary.latestChequeBank}</strong>
                    </article>
                  </div>
                </section>
              ) : null}

              {reportSubpage === "customer-wise" ? (
                <section className="admin-mobile-section report-panel report-customerwise-panel">
                  <h2>Customer Wise Report</h2>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={customerWiseSearch}
                    onChange={(e) => setCustomerWiseSearch(e.target.value)}
                    placeholder="Search customer wise report"
                  />
                  <div className="admin-table customer-wise-report-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("customerWise", "name")}>Customer{sortMark("customerWise", "name")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("customerWise", "orders")}>Orders{sortMark("customerWise", "orders")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("customerWise", "spent")}>Total Spent (LKR){sortMark("customerWise", "spent")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("customerWise", "lastAt")}>Last Purchase{sortMark("customerWise", "lastAt")}</button>
                    </header>
                    <PaginatedGridList
                      emptyMessage="No customer-wise records yet."
                      items={sortedCustomerWiseRows.filter((row) => matchesSearch(customerWiseSearch, row.name, row.lastAt))}
                      renderItem={(row) => (
                      <article key={row.name}>
                        <span>{row.name}</span>
                        <span>{row.orders}</span>
                        <span>{formatLkrValue(row.spent || 0)}</span>
                        <span>{row.lastAt ? new Date(row.lastAt).toLocaleDateString() : "-"}</span>
                      </article>
                      )}
                    />
                  </div>
                  <section className="customers-summary-card">
                    <div className="customers-summary-divider">
                      <span>SUMMARY</span>
                    </div>
                    <div className="customers-summary-head">
                      <h3>Customer Snapshot</h3>
                      <p>Live from filtered customer records</p>
                    </div>
                    <div className="customers-summary-grid">
                      <article>
                        <span>Total Customers</span>
                        <strong>{customerPageSummary.totalCustomers}</strong>
                      </article>
                      <article>
                        <span>Active Customers</span>
                        <strong>{customerPageSummary.activeCustomers}</strong>
                      </article>
                      <article className="warn">
                        <span>With Outstanding</span>
                        <strong>{customerPageSummary.customersWithOutstanding}</strong>
                      </article>
                    </div>
                    <div className="customers-summary-foot">
                      <article>
                        <span>Total Orders</span>
                        <strong>{customerPageSummary.totalOrders}</strong>
                        <p>Avg order value: {currency(customerPageSummary.averageOrderValue)}</p>
                      </article>
                      <article>
                        <span>Total Spent</span>
                        <strong>{currency(customerPageSummary.totalSpent)}</strong>
                        <p className="outstanding-text">Outstanding: {currency(customerPageSummary.totalOutstanding)}</p>
                      </article>
                      <article>
                        <span>Top Customer</span>
                        <strong>{customerPageSummary.topCustomerName}</strong>
                        <p>{currency(customerPageSummary.topCustomerSpent)}</p>
                      </article>
                    </div>
                  </section>
                </section>
              ) : null}

              {reportSubpage === "rep-outstanding" ? (
                <section className="admin-mobile-section report-panel report-rep-outstanding-panel">
                  <h2>Rep Wise Customer Outstanding</h2>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={repOutstandingSearch}
                    onChange={(e) => setRepOutstandingSearch(e.target.value)}
                    placeholder="Search rep outstanding"
                  />
                  <div className="rep-outstanding-summary-grid">
                    <article>
                      <span>Reps with Outstanding</span>
                      <strong>{repOutstandingSummary.reps}</strong>
                    </article>
                    <article>
                      <span>Outstanding Bills</span>
                      <strong>{repOutstandingSummary.bills}</strong>
                    </article>
                    <article>
                      <span>Affected Customers</span>
                      <strong>{repOutstandingSummary.customers}</strong>
                    </article>
                    <article className="warn">
                      <span>Total Outstanding (LKR)</span>
                      <strong>{formatLkrValue(repOutstandingSummary.outstanding)}</strong>
                    </article>
                  </div>
                  <div className="admin-table rep-outstanding-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("repOutstanding", "rep")}>Rep{sortMark("repOutstanding", "rep")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("repOutstanding", "customers")}>Customers{sortMark("repOutstanding", "customers")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("repOutstanding", "bills")}>Bills{sortMark("repOutstanding", "bills")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("repOutstanding", "outstanding")}>Outstanding (LKR){sortMark("repOutstanding", "outstanding")}</button>
                    </header>
                    {sortedRepOutstandingRows.filter((row) => matchesSearch(repOutstandingSearch, row.rep)).length ? sortedRepOutstandingRows.filter((row) => matchesSearch(repOutstandingSearch, row.rep)).map((row) => (
                      <article key={`rep-out-${row.rep}`}>
                        <span>{row.rep}</span>
                        <span
                          className="rep-outstanding-detail-trigger"
                          role="button"
                          tabIndex={0}
                          onClick={() => setRepOutstandingDetailRep(row.rep)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setRepOutstandingDetailRep(row.rep);
                            }
                          }}
                        >
                          {row.customers}
                        </span>
                        <span>{row.bills}</span>
                        <span className="outstanding-text">{formatLkrValue(row.outstanding)}</span>
                      </article>
                    )) : <p>No rep outstanding balances in selected range.</p>}
                  </div>
                </section>
              ) : null}

              {reportSubpage === "delivery-report" ? (
                <section className="admin-mobile-section report-panel report-delivery-panel">
                  <div className="delivery-report-divider">
                    <span>DELIVERY INTELLIGENCE</span>
                  </div>
                  <div className="report-head">
                    <h2>Delivery Report</h2>
                    <select value={reportDeliveryLorry} onChange={(e) => setReportDeliveryLorry(e.target.value)}>
                      <option value="all">All Lorries</option>
                      {ORDER_LORRIES.map((lorryName) => <option key={lorryName} value={lorryName}>{lorryName}</option>)}
                    </select>
                  </div>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={reportDeliveryDateFrom} onChange={(e) => setReportDeliveryDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={reportDeliveryDateTo} onChange={(e) => setReportDeliveryDateTo(e.target.value)} />
                    </label>
                  </div>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={reportDeliverySearch}
                    onChange={(e) => setReportDeliverySearch(e.target.value)}
                    placeholder="Search delivery report"
                  />
                  <div className="delivery-report-kpi-grid">
                    <article><span>Total Bills</span><strong>{reportDeliverySummary.totalBills}</strong></article>
                    <article><span>Confirmed</span><strong>{reportDeliverySummary.confirmedBills}</strong></article>
                    <article><span>Pending</span><strong>{reportDeliverySummary.pendingBills}</strong></article>
                    <article><span>Sold Qty</span><strong>{reportDeliverySummary.soldQtyTotal}</strong></article>
                    <article><span>Delivered Qty</span><strong>{reportDeliverySummary.deliveredQtyTotal}</strong></article>
                    <article><span>Undelivered Qty</span><strong>{reportDeliverySummary.undeliveredQtyTotal}</strong></article>
                    <article><span>Delivered Value (LKR)</span><strong>{formatLkrValue(reportDeliverySummary.deliveredValueTotal)}</strong></article>
                    <article><span>Delivery Rate</span><strong>{reportDeliverySummary.deliveryRate}%</strong></article>
                  </div>
                  <div className="admin-table delivery-report-sales-table">
                    <header>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "id")}>Sale ID{sortMark("deliveryReport", "id")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "date")}>Date{sortMark("deliveryReport", "date")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "rep")}>Rep{sortMark("deliveryReport", "rep")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "lorry")}>Lorry{sortMark("deliveryReport", "lorry")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "status")}>Status{sortMark("deliveryReport", "status")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "soldQty")}>Sold{sortMark("deliveryReport", "soldQty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "undeliveredQty")}>ND{sortMark("deliveryReport", "undeliveredQty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "deliveredQty")}>Delivered{sortMark("deliveryReport", "deliveredQty")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("deliveryReport", "deliveredValue")}>Value (LKR){sortMark("deliveryReport", "deliveredValue")}</button>
                    </header>
                    {sortedReportDeliveryRows.filter((row) => matchesSearch(reportDeliverySearch, row.id, row.date, row.rep, row.lorry, row.status)).length ? sortedReportDeliveryRows.filter((row) => matchesSearch(reportDeliverySearch, row.id, row.date, row.rep, row.lorry, row.status)).map((row) => (
                      <article key={`rdr-${row.id}`}>
                        <span>#{row.id}</span>
                        <span>{row.date}</span>
                        <span>{row.rep}</span>
                        <span>{row.lorry}</span>
                        <span>
                          <span className={row.status === "Confirmed" ? "delivery-status confirmed" : "delivery-status pending"}>
                            {row.status}
                          </span>
                        </span>
                        <span>{row.soldQty}</span>
                        <span>{row.undeliveredQty}</span>
                        <span>{row.deliveredQty}</span>
                        <span>{formatLkrValue(row.deliveredValue)}</span>
                      </article>
                    )) : <p>No delivery report records for selected filters.</p>}
                  </div>
                </section>
              ) : null}

              {reportSubpage === "empty-bottle-log" ? (
                <section className="admin-mobile-section report-panel report-empty-bottle-panel">
                  <div className="report-head">
                    <h2>Empty Bottle Log</h2>
                  </div>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={emptyBottleLogDateFrom} onChange={(e) => setEmptyBottleLogDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={emptyBottleLogDateTo} onChange={(e) => setEmptyBottleLogDateTo(e.target.value)} />
                    </label>
                  </div>
                  <select
                    className="search-icon-input imperfect-search-input"
                    value={emptyBottleLogRepFilter}
                    onChange={(e) => setEmptyBottleLogRepFilter(e.target.value)}
                    style={{ marginBottom: "8px" }}
                  >
                    <option value="">All Reps (Filter by Rep)</option>
                    {[...new Set((state.emptyBottleCollections || []).map(e => String(e.collectedBy || "").trim()).filter(Boolean))].sort().map(rep => (
                      <option key={rep} value={rep}>{rep}</option>
                    ))}
                  </select>
                  <input
                    className="search-icon-input imperfect-search-input"
                    value={emptyBottleLogSearch}
                    onChange={(e) => setEmptyBottleLogSearch(e.target.value)}
                    placeholder="Search by customer or bill"
                  />
                  <div className="delivery-report-kpi-grid">
                    <article><span>Entries</span><strong>{emptyBottleLogSummary.entries}</strong></article>
                    <article><span>Total Bottles Collected</span><strong>{emptyBottleLogSummary.totalQty}</strong></article>
                    <article><span>Available To Collect</span><strong>{emptyBottleLogSummary.totalOutstanding}</strong></article>
                    <article><span>Reps</span><strong>{emptyBottleLogSummary.collectors}</strong></article>
                    <article><span>Customers</span><strong>{emptyBottleLogSummary.customers}</strong></article>
                  </div>
                  <div className="admin-table empty-bottle-log-table">
                    <header style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.6fr 0.8fr" }}>
                      <span>Date/Time</span>
                      <span>Rep</span>
                      <span>Customer</span>
                      <span>Bill</span>
                      <span>Collected</span>
                      <span>Remaining</span>
                    </header>
                    {emptyBottleLogRows.filter((row) => matchesSearch(emptyBottleLogSearch, row.collectedBy, row.customerName, row.saleId)).length ? emptyBottleLogRows.filter((row) => matchesSearch(emptyBottleLogSearch, row.collectedBy, row.customerName, row.saleId)).map((row) => (
                      <article key={row.id} style={{ gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.6fr 0.8fr" }}>
                        <span>{row.when}</span>
                        <span>{row.collectedBy || "-"}</span>
                        <span>{row.customerName || "-"}</span>
                        <span>#{row.saleId}</span>
                        <span>{row.quantity}</span>
                        <span style={{ color: row.remaining > 0 ? "#ef4444" : "#10b981", fontWeight: "bold" }}>{row.remaining}</span>
                      </article>
                    )) : <p>No empty bottle collections in selected range.</p>}
                  </div>
                </section>
              ) : null}

              {reportSubpage === "collected-cash" ? (
                <section className="admin-mobile-section report-panel">
                  <h2>Collected Cash Report</h2>
                  <div className="rep-date-filters">
                    <label className="rep-date-field">
                      <span>From</span>
                      <input type="date" value={collectedCashDateFrom} onChange={(e) => setCollectedCashDateFrom(e.target.value)} />
                    </label>
                    <label className="rep-date-field">
                      <span>To</span>
                      <input type="date" value={collectedCashDateTo} onChange={(e) => setCollectedCashDateTo(e.target.value)} />
                    </label>
                  </div>
                  <div className="sales-range-kpi">
                    <span className="sales-range-kpi-label">Total Collected Cash</span>
                    <strong className="sales-range-kpi-value">{currency(collectedCashTotal)}</strong>
                  </div>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <input
                      className="search-icon-input imperfect-search-input"
                      style={{ flex: 1 }}
                      value={collectedCashSearch}
                      onChange={(e) => setCollectedCashSearch(e.target.value)}
                      placeholder="Search by sale ID, customer, rep, lorry"
                    />
                    <select
                      className="imperfect-select"
                      style={{ maxWidth: "200px" }}
                      value={collectedCashLorryFilter}
                      onChange={(e) => setCollectedCashLorryFilter(e.target.value)}
                    >
                      <option value="All">All Lorries</option>
                      <option value="Lorry A">Lorry A</option>
                      <option value="Lorry B">Lorry B</option>
                    </select>
                  </div>
                  <div className="admin-table">
                    <header style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 1fr 1fr" }}>
                      <button type="button" className="th-sort" onClick={() => toggleSort("collectedCash", "id")}>Sale ID{sortMark("collectedCash", "id")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("collectedCash", "when")}>Date{sortMark("collectedCash", "when")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("collectedCash", "rep")}>Rep / Lorry{sortMark("collectedCash", "rep")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("collectedCash", "customer")}>Customer{sortMark("collectedCash", "customer")}</button>
                      <button type="button" className="th-sort" onClick={() => toggleSort("collectedCash", "cashAmount")}>Cash (LKR){sortMark("collectedCash", "cashAmount")}</button>
                    </header>
                    {sortedCollectedCashRows.filter((row) => matchesSearch(collectedCashSearch, row.id, row.rep, row.lorry, row.customer)).length ? sortedCollectedCashRows.filter((row) => matchesSearch(collectedCashSearch, row.id, row.rep, row.lorry, row.customer)).map((row) => (
                      <article key={row.id} style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 1fr 1fr" }}>
                        <span className="sales-id-cell">
                          <strong>#{row.id}</strong>
                        </span>
                        <span>{row.when}</span>
                        <span>{row.rep}<br/><small>{row.lorry}</small></span>
                        <span style={{ cursor: "pointer", color: "#2563eb", textDecoration: "underline", fontWeight: 600 }} onClick={() => setSelectedCustomerCashPopup(row.customer)}>{row.customer}</span>
                        <span className="mono">{formatLkrValue(row.cashAmount || 0)}</span>
                      </article>
                    )) : <p>No cash collections found.</p>}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {activePage === "loadings" ? (
            <div className="admin-mobile loadings-page">
              <section className="admin-mobile-section loading-range-panel">
                <div className="report-head">
                  <h2>Loading Date Range</h2>
                  <button type="button" onClick={handleResetLorryCount} disabled={resettingLorryCount}>
                    {resettingLorryCount ? "Resetting..." : "Reset Lorry Count"}
                  </button>
                </div>
                <div className="rep-date-filters">
                  <label className="rep-date-field">
                    <span>From</span>
                    <input type="date" value={loadingDateFrom} onChange={(e) => setLoadingDateFrom(e.target.value)} />
                  </label>
                  <label className="rep-date-field">
                    <span>From Time</span>
                    <input type="time" value={loadingTimeFrom} onChange={(e) => setLoadingTimeFrom(e.target.value)} />
                  </label>
                  <label className="rep-date-field">
                    <span>To</span>
                    <input type="date" value={loadingDateTo} onChange={(e) => setLoadingDateTo(e.target.value)} />
                  </label>
                  <label className="rep-date-field">
                    <span>To Time</span>
                    <input type="time" value={loadingTimeTo} onChange={(e) => setLoadingTimeTo(e.target.value)} />
                  </label>
                </div>
                <input
                  className="search-icon-input imperfect-search-input"
                  value={loadingsSearch}
                  onChange={(e) => setLoadingsSearch(e.target.value)}
                  placeholder="Search loading rows"
                />
                <p className="form-hint">
                  Resets only the lorry capacity count used for new orders. Existing sales and loading reports stay unchanged.
                </p>
              </section>
              <section className="admin-mobile-section loading-lorry-selector-panel">
                <div className="loading-lorry-selector-grid">
                  {LOADING_PANEL_CONFIG.map((panel) => (
                    <button
                      key={`loading-selector-${panel.name}`}
                      type="button"
                      className={`loading-lorry-selector-card${selectedLoadingPanel === panel.name ? " is-active" : ""}`}
                      onClick={() => setSelectedLoadingPanel(panel.name)}
                    >
                      {panel.name}
                    </button>
                  ))}
                </div>
              </section>
              {LOADING_PANEL_CONFIG.filter((panel) => panel.name === selectedLoadingPanel).map((panel) => {
                const rows = (sortedLoadingByLorry[panel.name] || []).filter((row) => matchesSearch(loadingsSearch, row.name, row.sku, row.size, panel.name));
                const summary = loadingSummaryByLorry[panel.name] || {};
                return (
                  <section key={panel.name} className={`admin-mobile-section loading-lorry-panel ${panel.className}`}>
                    <div className="loading-panel-head">
                      <h2>{panel.name} Loading</h2>
                      <button type="button" className="receipt-print-action" onClick={() => printLoadingBreakdown({ lorry: panel.name, rows, summary })}>Print</button>
                    </div>
                    <div className="loading-summary-grid">
                      <article><span>Ordered Qty</span><strong>{summary.orderedQty || 0}</strong></article>
                      <article><span>Ordered Value</span><strong>{currency(summary.orderedValue || 0)}</strong></article>
                      <article><span>Delivered Qty</span><strong>{summary.deliveredQty || 0}</strong></article>
                      <article><span>Delivered Value</span><strong>{currency(summary.deliveredValue || 0)}</strong></article>
                      
                      <article className="loading-summary-accent loading-summary-singles">
                        <span className="loading-summary-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24"><path d="M10 3.8h4" /><path d="M11 3.8v2.1l-1.4 1.7v10.1A2.3 2.3 0 0 0 11.9 20h.2a2.3 2.3 0 0 0 2.3-2.3V7.6L13 5.9V3.8" /><path d="M9.6 10.6h4.8" /></svg>
                        </span>
                        <span>Ordered Singles</span>
                        <strong>{summary.orderedSingles || 0}</strong>
                      </article>
                      
                      <article><span>Delivered Singles</span><strong>{summary.deliveredSingles || 0}</strong></article>
                      <article className="loading-summary-status">
                        <span>Rows Loaded</span>
                        <strong>{summary.loadedRows || 0}</strong>
                      </article>
                    </div>
                    <div className="admin-table loading-table">
                      <header>
                        <button type="button" className="th-sort loading-col-item" onClick={() => toggleSort(panel.sortKey, "sku")}>SKU{sortMark(panel.sortKey, "sku")}</button>
                        <button type="button" className="th-sort loading-col-size" onClick={() => toggleSort(panel.sortKey, "size")}>Size{sortMark(panel.sortKey, "size")}</button>
                        <button type="button" className="th-sort loading-col-ordered-qty" onClick={() => toggleSort(panel.sortKey, "orderedQty")}>Ord Qty{sortMark(panel.sortKey, "orderedQty")}</button>
                        <button type="button" className="th-sort loading-col-ordered-value" onClick={() => toggleSort(panel.sortKey, "orderedValue")}>Ord Value{sortMark(panel.sortKey, "orderedValue")}</button>
                        
                        <button type="button" className="th-sort loading-col-singles" onClick={() => toggleSort(panel.sortKey, "singles")}>Singles{sortMark(panel.sortKey, "singles")}</button>
                        <button type="button" className="th-sort loading-col-delivered-qty" onClick={() => toggleSort(panel.sortKey, "deliveredQty")}>Del Qty{sortMark(panel.sortKey, "deliveredQty")}</button>
                        <button type="button" className="th-sort loading-col-delivered-value" onClick={() => toggleSort(panel.sortKey, "deliveredValue")}>Del Value{sortMark(panel.sortKey, "deliveredValue")}</button>
                        <button type="button" className="th-sort loading-col-status" onClick={() => toggleSort(panel.sortKey, "loaded")}>Loaded{sortMark(panel.sortKey, "loaded")}</button>
                      </header>
                      {rows.length ? rows.map((row) => (
                        <article key={`${panel.name}-${row.key}`} className={row.loaded ? "is-loaded" : ""}>
                          <span className="loading-col-item">{row.sku || "-"}</span>
                          <span className="loading-col-size">{row.size || "-"}</span>
                          <span className="loading-col-ordered-qty">{row.orderedQty}</span>
                          <span className="loading-col-ordered-value">{currency(row.orderedValue)}</span>
                          
                          <span className="loading-col-singles">{row.balance}</span>
                          <span className="loading-col-delivered-qty">{row.deliveredQty}</span>
                          <span className="loading-col-delivered-value">{currency(row.deliveredValue)}</span>
                          <span className="loading-col-status">
                            <button
                              type="button"
                              className={`loading-mark-btn${row.loaded ? " is-loaded" : ""}`}
                              onClick={() => handleToggleLoadingRow(row)}
                              disabled={loadingMarkPendingKey === row.markKey}
                            >
                              {loadingMarkPendingKey === row.markKey ? "Saving..." : row.loaded ? "Loaded ?" : "Mark Loaded"}
                            </button>
                          </span>
                        </article>
                      )) : <p>No loading data for {panel.name}.</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : null}

          {activePage === "purchases" ? (
          <section className="admin-mobile-section admin-purchases-panel">
            <div className="accounting-head">
              <h2>Purchases & Suppliers</h2>
              <div className="accounting-actions">
                <button type="button" className="ghost" onClick={() => setShowSuppliersModal(true)}>Manage Suppliers</button>
                <button type="button" onClick={() => {
                  setPurchaseForm({ id: "", supplierId: "", invoiceNo: "", date: new Date().toISOString().split("T")[0], dueDate: "", totalAmount: "", paidAmount: "", status: "unpaid" });
                  setShowPurchasesModal(true);
                }}>Add Purchase Invoice</button>
              </div>
            </div>

            <div className="admin-table purchases-table mt-4">
              <header>
                <span>Date</span>
                <span>Invoice No</span>
                <span>Supplier</span>
                <span>Due Date</span>
                <span className="number-cell">Total Amount</span>
                <span className="number-cell">Paid</span>
                <span className="number-cell">Balance</span>
                <span>Status</span>
                <span>Actions</span>
              </header>
              {(state.purchases || []).map(p => {
                const sup = (state.suppliers || []).find(s => s.id === p.supplierId);
                const bal = Number(p.totalAmount || 0) - Number(p.paidAmount || 0);
                return (
                  <article key={p.id}>
                    <span>{p.date}</span>
                    <span>{p.invoiceNo || "-"}</span>
                    <span>{sup ? sup.name : "Unknown"}</span>
                    <span style={{ color: new Date(p.dueDate) < new Date() && bal > 0 ? "red" : "inherit" }}>{p.dueDate || "-"}</span>
                    <span className="number-cell">{formatLkrValue(p.totalAmount)}</span>
                    <span className="number-cell" style={{ color: "#4caf50" }}>{formatLkrValue(p.paidAmount)}</span>
                    <span className="number-cell" style={{ color: bal > 0 ? "#e53935" : "inherit" }}>{formatLkrValue(bal)}</span>
                    <span style={{ textTransform: "capitalize" }}>{p.status}</span>
                    <span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        {bal > 0 && (
                          <button type="button" className="ghost" style={{ padding: "2px 8px" }} onClick={() => {
                            setAccountingForm({ id: "", type: "supplier_payment", category: `Supplier Payment - ${sup?.name}`, amount: bal.toString(), description: `Payment for Invoice ${p.invoiceNo}`, staffId: "", date: new Date().toISOString().split("T")[0], coaType: "Operating Expenses", coaGroup: "Other", coaSub: "Supplier Payment", sourceAccountId: "", destinationAccountId: "", supplierInvoiceId: p.id });
                            setShowAccountingForm(true);
                            setActivePage("accounting");
                          }}>Pay</button>
                        )}
                        <button type="button" className="ghost" style={{ padding: "2px 8px" }} onClick={() => {
                          setPurchaseForm(p);
                          setShowPurchasesModal(true);
                        }}>Edit</button>
                        <button type="button" className="danger-btn" style={{ padding: "2px 8px" }} onClick={() => deletePurchaseHandler(p.id)}>Delete</button>
                      </div>
                    </span>
                  </article>
                );
              })}
              {(!state.purchases || state.purchases.length === 0) && (
                <p style={{ textAlign: "center", color: "#888", padding: "1rem" }}>No purchases found.</p>
              )}
            </div>

            {showSuppliersModal && (
              <div className="modal-overlay">
                <div className="modal-content admin-modal">
                  <h3>Manage Suppliers</h3>
                  <div className="admin-inline-form" style={{ marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <input value={supplierForm.name} onChange={e => setSupplierForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Supplier Name *" />
                    <input value={supplierForm.company} onChange={e => setSupplierForm(prev => ({ ...prev, company: e.target.value }))} placeholder="Company Name" />
                    <input value={supplierForm.phone} onChange={e => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone Number" />
                    <input value={supplierForm.address} onChange={e => setSupplierForm(prev => ({ ...prev, address: e.target.value }))} placeholder="Address" />
                    <SaveButton onClick={saveSupplier} style={{ gridColumn: "1 / -1" }}>{supplierForm.id ? "Update Supplier" : "Add Supplier"}</SaveButton>
                    {supplierForm.id && <button type="button" className="ghost" style={{ gridColumn: "1 / -1" }} onClick={() => setSupplierForm({ id: "", name: "", company: "", phone: "", address: "" })}>Cancel Edit</button>}
                  </div>
                  <div className="admin-table suppliers-table mt-4">
                    <header>
                      <span>Name</span>
                      <span>Company</span>
                      <span>Phone</span>
                      <span>Actions</span>
                    </header>
                    {(state.suppliers || []).map(s => (
                      <article key={s.id}>
                        <span>{s.name}</span>
                        <span>{s.company || "-"}</span>
                        <span>{s.phone || "-"}</span>
                        <span>
                          <button type="button" className="ghost" style={{ padding: "2px 8px", marginRight: "4px" }} onClick={() => setSupplierForm(s)}>Edit</button>
                          <button type="button" className="danger-btn" style={{ padding: "2px 8px" }} onClick={() => deleteSupplierHandler(s.id)}>Delete</button>
                        </span>
                      </article>
                    ))}
                    {(!state.suppliers || state.suppliers.length === 0) && (
                      <p style={{ textAlign: "center", color: "#888", padding: "1rem" }}>No suppliers added.</p>
                    )}
                  </div>
                  <div className="form-actions" style={{ marginTop: "16px" }}>
                    <button type="button" className="ghost" onClick={() => setShowSuppliersModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {showPurchasesModal && (
              <div className="modal-overlay">
                <div className="modal-content admin-modal">
                  <h3>{purchaseForm.id ? "Edit Purchase Invoice" : "Add Purchase Invoice"}</h3>
                  <div className="form-group">
                    <label>Supplier *</label>
                    <select value={purchaseForm.supplierId} onChange={e => setPurchaseForm(prev => ({ ...prev, supplierId: e.target.value }))}><option value="">-- Select Supplier --</option>
                      {(state.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ""}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Invoice Number</label>
                    <input value={purchaseForm.invoiceNo} onChange={e => setPurchaseForm(prev => ({ ...prev, invoiceNo: e.target.value }))} placeholder="e.g. INV-2023-001" />
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" value={purchaseForm.date} onChange={e => setPurchaseForm(prev => ({ ...prev, date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Due Date</label>
                    <input type="date" value={purchaseForm.dueDate} onChange={e => setPurchaseForm(prev => ({ ...prev, dueDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Total Amount *</label>
                    <input type="number" step="0.01" value={purchaseForm.totalAmount} onChange={e => setPurchaseForm(prev => ({ ...prev, totalAmount: e.target.value }))} />
                  </div>
                  <div className="form-actions" style={{ marginTop: "16px" }}>
                    <button type="button" className="ghost" onClick={() => setShowPurchasesModal(false)}>Cancel</button>
                    <SaveButton onClick={savePurchase}>Save</SaveButton>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}
        </section>
      </main>

      {selectedCustomerCashPopup && (
        <div className="low-stock-modal" onClick={() => { setSelectedCustomerCashPopup(null); setCustomerCashPopupDateFrom(""); setCustomerCashPopupDateTo(""); }}>
          <div className="low-stock-modal-card" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Cash Collections for {selectedCustomerCashPopup}</h3>
              <button type="button" onClick={() => { setSelectedCustomerCashPopup(null); setCustomerCashPopupDateFrom(""); setCustomerCashPopupDateTo(""); }}>Close</button>
            </div>
            <div style={{ padding: "16px" }}>
              <div className="rep-date-filters" style={{ marginBottom: "1.5rem" }}>
                <label className="rep-date-field">
                  <span>From</span>
                  <input type="date" value={customerCashPopupDateFrom} onChange={(e) => setCustomerCashPopupDateFrom(e.target.value)} />
                </label>
                <label className="rep-date-field">
                  <span>To</span>
                  <input type="date" value={customerCashPopupDateTo} onChange={(e) => setCustomerCashPopupDateTo(e.target.value)} />
                </label>
              </div>
              <div className="sales-range-kpi" style={{ marginBottom: "0.5rem" }}>
                <span className="sales-range-kpi-label">Total Collected Cash</span>
                <strong className="sales-range-kpi-value">{currency(customerCashPopupTotal)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCustomerForm ? (
        <div className="low-stock-modal" onClick={() => setShowCustomerForm(false)}>
          <div className="low-stock-modal-card customer-entry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>{customerForm.id ? "Edit Customer" : "Add Customer"}</h3>
              <button type="button" onClick={() => setShowCustomerForm(false)}>Close</button>
            </div>
            <div className="admin-inline-form customer-entry-grid">
              <label className="customer-entry-field">
                <span>Customer Name</span>
                <input value={customerForm.name} onChange={(e) => setCustomerForm((c) => ({ ...c, name: e.target.value }))} placeholder="Customer name" />
              </label>
              <label className="customer-entry-field">
                <span>Phone</span>
                <input value={customerForm.phone} onChange={(e) => setCustomerForm((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone" />
              </label>
              <label className="customer-entry-field">
                <span>Opening Outstanding (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerForm.openingOutstanding}
                  onChange={(e) => setCustomerForm((c) => ({ ...c, openingOutstanding: e.target.value }))}
                  placeholder="Opening Outstanding (LKR)"
                  disabled={!canManageCustomerOpeningOutstanding}
                />
              </label>
              <label className="customer-entry-field">
                <span>Credit Limit (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerForm.creditLimit}
                  onChange={(e) => setCustomerForm((c) => ({ ...c, creditLimit: e.target.value }))}
                  placeholder="Credit Limit (LKR)"
                  disabled={!canManageCustomerLimits}
                />
              </label>
              <label className="customer-entry-field">
                <span>Discount Limit (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerForm.discountLimit}
                  onChange={(e) => setCustomerForm((c) => ({ ...c, discountLimit: e.target.value }))}
                  placeholder="Discount Limit (LKR)"
                  disabled={!canManageCustomerLimits}
                />
              </label>
              <label className="customer-entry-field">
                <span>Bundle Discount Limit / Bundle (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerForm.bundleDiscountLimit}
                  onChange={(e) => setCustomerForm((c) => ({ ...c, bundleDiscountLimit: e.target.value }))}
                  placeholder="Bundle Discount Limit / Bundle (LKR)"
                  disabled={!canManageCustomerLimits}
                />
              </label>
              <label className="customer-entry-field">
                <span>Outstanding Reduction / Write-off (LKR)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customerForm.outstandingAdjustment}
                  onChange={(e) => setCustomerForm((c) => ({ ...c, outstandingAdjustment: e.target.value }))}
                  placeholder="Outstanding Reduction / Write-off (LKR)"
                  disabled={!canManageOutstandingAdjustment}
                />
              </label>
              <label className="customer-entry-field">
                <span>Reduction Reason</span>
                <input
                  value={customerForm.outstandingAdjustmentReason}
                  onChange={(e) => setCustomerForm((c) => ({ ...c, outstandingAdjustmentReason: e.target.value }))}
                  placeholder="Reason for reducing outstanding"
                  disabled={!canManageOutstandingAdjustment}
                />
              </label>
              {!canManageCustomerLimits ? (
                <p className="form-hint customer-form-lock-note">Manager limited access cannot edit customer details. Enable full access to unlock customer editing.</p>
              ) : null}
              {!canManageCustomerLimits ? (
                <div style={{ height: "4px" }} />
              ) : null}
              {!canManageOutstandingAdjustment ? (
                <p className="form-hint customer-form-lock-note">Only admin can reduce or write off total outstanding.</p>
              ) : null}
              <label className="customer-entry-field customer-entry-field-full">
                <span>Address</span>
                <textarea value={customerForm.address} onChange={(e) => setCustomerForm((c) => ({ ...c, address: e.target.value }))} placeholder="Address" />
              </label>
              <label className="customer-entry-field">
                <span>Route</span>
                <input value={customerForm.route} onChange={(e) => setCustomerForm((c) => ({ ...c, route: e.target.value }))} placeholder="Route (e.g., North District)" />
              </label>
              <label className="customer-entry-field">
                <span>Opening Empty Bottles</span>
                <input type="number" min="0" value={customerForm.openingEmptyBottles} onChange={(e) => setCustomerForm((c) => ({ ...c, openingEmptyBottles: e.target.value }))} placeholder="Initial empty bottles owed" disabled={!canManageCustomerLimits} />
              </label>
              {canManageCustomerLimits ? (
                <div className="customer-entry-field-full" style={{ marginTop: "1rem" }}>
                  <h4 style={{ marginBottom: "0.5rem", color: "#2d3748" }}>Item-Specific Custom Pricing</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "300px", overflowY: "auto", padding: "10px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
                    {(state.products || []).map(p => (
                      <label key={p.id} style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem" }}>
                        <span style={{ fontWeight: 600, color: "#4a5568", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name} (Default: LKR {productSalePrice(p)})</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customerForm.itemPrices?.[p.id] !== undefined ? customerForm.itemPrices[p.id] : ""}
                          onChange={(e) => setCustomerForm(c => ({
                            ...c,
                            itemPrices: { ...(c.itemPrices || {}), [p.id]: e.target.value }
                          }))}
                          placeholder={`Default: LKR ${productSalePrice(p)}`}
                          style={{ padding: "6px 8px", fontSize: "0.9rem", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="customer-entry-actions" style={{ marginTop: "1rem" }}>
                <SaveButton onClick={saveCustomer}>Save Customer</SaveButton>
                <button type="button" className="ghost" onClick={() => setShowCustomerForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {stockSummaryDetailMode ? (
        <div className="low-stock-modal" onClick={() => setStockSummaryDetailMode("")}>
          <div className="low-stock-modal-card stock-summary-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>
                {stockSummaryDetailMode === "low"
                  ? "Low Stock Details"
                  : stockSummaryDetailMode === "out"
                    ? "Out of Stock Details"
                    : "Total Bundles Breakdown"}
              </h3>
              <button type="button" onClick={() => setStockSummaryDetailMode("")}>Close</button>
            </div>
            <p className="stock-summary-detail-note">
              Based on the current filtered stock list. Review SKU and current units clearly before taking action.
            </p>
            <div className="stock-summary-detail-list">
              {stockSummaryDetailRows.length ? stockSummaryDetailRows.map((item) => (
                <article key={`stock-summary-${item.id}`} className="stock-summary-detail-row">
                  <div className="stock-summary-detail-main">
                    <strong>{item.name}</strong>
                    <span>{item.sku || "-"}</span>
                  </div>
                  <div className="stock-summary-detail-side">
                    <span>Current Units</span>
                    <strong>{Number(item.stock || 0)}</strong>
                  </div>
                </article>
              )) : (
                <p className="stock-summary-detail-empty">No matching stock rows in the current filtered list.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {repOutstandingDetailRep ? (
        <div className="low-stock-modal" onClick={() => setRepOutstandingDetailRep("")}>
          <div className="low-stock-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>{repOutstandingDetailRep} Customer Outstanding</h3>
              <div className="modal-head-actions">
                <button
                  type="button"
                  className="receipt-print-action"
                  onClick={() => printRepOutstandingCustomers({ rep: repOutstandingDetailRep, rows: repOutstandingDetailRows })}
                >
                  Print
                </button>
                <button type="button" onClick={() => setRepOutstandingDetailRep("")}>Close</button>
              </div>
            </div>
            <div className="admin-table rep-outstanding-table" style={{ marginTop: "0.75rem" }}>
              <header>
                <span>Customer</span>
                <span>Bills</span>
                <span>Outstanding (LKR)</span>
                <span>Days Left</span>
              </header>
              {repOutstandingDetailRows.length ? repOutstandingDetailRows.map((row) => (
                <article key={`rep-out-detail-${repOutstandingDetailRep}-${row.customerName}`}>
                  <span>{row.customerName}</span>
                  <span>{row.bills}</span>
                  <span className="outstanding-text">{formatLkrValue(row.outstanding)}</span>
                  <span className={String(row.daysLabel || "").toLowerCase().includes("overdue") ? "outstanding-text" : ""}>{row.daysLabel || "-"}</span>
                </article>
              )) : <p>No outstanding customers for this rep in the selected range.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {customerDetailData ? (
        <div className="low-stock-modal" onClick={() => setCustomerDetailName("")}>
          <div className="low-stock-modal-card customer-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>{customerDetailData.row.name}</h3>
              <button type="button" onClick={() => setCustomerDetailName("")}>Close</button>
            </div>
            <div className="customer-detail-grid">
              <article>
                <span>Total Bills</span>
                <strong>{customerDetailData.totalBills}</strong>
              </article>
              <article>
                <span>Total Spent (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.row.spent || 0)}</strong>
              </article>
              <article>
                <span>Available Credit (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.availableCredit || 0)}</strong>
              </article>
              <article>
                <span>Credit Limit (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.row.creditLimit || 0)}</strong>
              </article>
              <article>
                <span>Discount Limit (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.row.discountLimit || 0)}</strong>
              </article>
              
              <article>
                <span>Opening Outstanding (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.openingOutstanding || 0)}</strong>
              </article>
              <article>
                <span>Outstanding Reduction (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.outstandingAdjustment || 0)}</strong>
              </article>
              <article>
                <span>Reduction Reason</span>
                <strong>{customerDetailData.outstandingAdjustmentReason || "-"}</strong>
              </article>
              <article className={Number(customerDetailData.row.outstanding || 0) > 0 ? "warn" : ""}>
                <span>Outstanding (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.row.outstanding || 0)}</strong>
              </article>
              <article>
                <span>Bill Outstanding (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.liveSaleOutstanding || 0)}</strong>
              </article>
              <article>
                <span>Total Item Qty</span>
                <strong>{customerDetailData.totalQty}</strong>
              </article>
              <article>
                <span>Returned Qty</span>
                <strong>{customerDetailData.returnedQty}</strong>
              </article>
              <article>
                <span>Returned Value (LKR)</span>
                <strong>{formatLkrValue(customerDetailData.returnedValue || 0)}</strong>
              </article>
              <article>
                <span>Average Bill Value</span>
                <strong>LKR {formatLkrValue(customerDetailData.averageBillValue || 0)}</strong>
              </article>
              <article>
                <span>Last Purchase</span>
                <strong>{customerDetailData.lastSaleAt ? new Date(customerDetailData.lastSaleAt).toLocaleDateString() : "-"}</strong>
              </article>
            </div>
            <div className="customer-detail-meta">
              <p><strong>Phone:</strong> {customerDetailData.row.phone || "-"}</p>
              <p><strong>Address:</strong> {customerDetailData.row.address || "-"}</p>
            </div>
            <div className="customer-detail-recent">
              <h4>Recent Bills</h4>
              {customerDetailData.recentSales.length ? (
                <div className="customer-detail-recent-list">
                  {customerDetailData.recentSales.map((sale) => (
                    <article key={sale.id}>
                      <span>#{sale.id}</span>
                      <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                      <strong>{currency(saleNetTotal(sale))}</strong>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="form-hint">No recent sales found.</p>
              )}
            </div>
            <div className="customer-detail-actions">
              <button
                type="button"
                onClick={() => {
                  openCustomerEditByRow(customerDetailData.row);
                  setCustomerDetailName("");
                }}
              >
                Edit Customer
              </button>
              {(isAdmin || (isManager && managerFullAccessEnabled)) && customerDetailData.row.id ? (
                <button
                  type="button"
                  className="row-danger"
                  onClick={() => deleteCustomerByRow(customerDetailData.row)}
                >
                  Delete Customer
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {editingAdminSaleId ? (
        <div className="low-stock-modal" onClick={() => { setEditingAdminSaleId(""); setAdminSaleEditLines([]); setAdminSaleEditError(""); }}>
          <div className="low-stock-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Edit Sale #{editingAdminSaleId}</h3>
              <button type="button" onClick={() => { setEditingAdminSaleId(""); setAdminSaleEditLines([]); setAdminSaleEditError(""); }}>Close</button>
            </div>
            <div className="admin-inline-form">
              {adminSaleEditLines.map((line) => (
                <div key={line.productId} className="stock-row">
                  <span>{line.name}</span>
                  <input type="number" min="1" value={line.quantity} onChange={(e) => setAdminSaleEditLines((current) => current.map((l) => (l.productId === line.productId ? { ...l, quantity: e.target.value } : l)))} />
                  <button type="button" className="row-danger" onClick={() => setAdminSaleEditLines((current) => current.filter((l) => l.productId !== line.productId))}>Remove</button>
                </div>
              ))}
              {adminSaleEditError ? <p className="form-hint">{adminSaleEditError}</p> : null}
              <div>
                <button type="button" onClick={saveAdminSaleEdit} disabled={savingAdminSaleEdit}>{savingAdminSaleEdit ? "Saving..." : "Save Edit"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewedSale ? (
        <div className="low-stock-modal" onClick={() => setViewSaleId("")}>
          <div className="low-stock-modal-card receipt-preview-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Receipt #{viewedSale.id}</h3>
              <div className="receipt-preview-head-actions">
                <button type="button" className="ghost" onClick={() => setViewSaleId("")}>← Back</button>
                <button type="button" className="receipt-print-action" onClick={() => printAdminSaleReceipt(viewedSale)}>Print</button>
                <button type="button" className="ghost" onClick={() => setViewSaleId("")}>Close</button>
              </div>
            </div>
            <div className="receipt-preview">
              <h4>LUCKY LANKA DISTRIBUTOR -POLONNARUWA</h4>
              <p>{new Date(viewedSale.createdAt).toLocaleString()} • {viewedSale.customerName} • {viewedSale.lorry || "-"} • {viewedSale.cashier || "-"} • {viewedSalePaymentDisplay.label}{viewedSalePaymentDisplay.detail ? ` (${viewedSalePaymentDisplay.detail})` : ""}</p>
              <div className="admin-table receipt-table">
                <header>
                  <span>Item Name</span>
                  <span>Qty</span>
                  <span>Invoice Price<br />LKR</span>
                  <span>Price<br />LKR</span>
                  <span>Item Discount</span>
                  <span>Total<br />LKR</span>
                </header>
                {(viewedSale.lines || []).map((line) => {
                  const returned = viewedSaleReturnByProduct.get(String(line.productId || "")) || { qty: 0, amount: 0 };
                  const notDeliveredQty = Number(viewedSaleUndeliveredByProduct.get(String(line.productId || "")) || 0);
                  const originalQty = Number(line.quantity || 0);
                  const soldAfterDelivery = Math.max(0, originalQty - notDeliveredQty);
                  const netQty = Math.max(0, soldAfterDelivery - Number(returned.qty || 0));
                  const unitInvoicePrice = line.invoicePrice !== undefined ? Number(line.invoicePrice) : Number(productInfoById.get(line.productId)?.invoicePrice ?? 0);
                  const grossRemaining = Number((Number(line.price || 0) * netQty).toFixed(2));
                  const remainingBillDiscountShare = Number(viewedSale.subTotal || 0) > 0
                    ? Number((Number(viewedSale.discountAmount || viewedSale.discount || 0) * (grossRemaining / Number(viewedSale.subTotal || 1))).toFixed(2))
                    : 0;
                  const netLineAmount = Math.max(0, Number((grossRemaining - remainingBillDiscountShare).toFixed(2)));
                  return (
                    <article key={`${viewedSale.id}-${line.productId}`}>
                      <span>
                        {line.name || productInfoById.get(line.productId)?.name || "-"}
                        {notDeliveredQty > 0 ? <small className="sales-return-note">Not Delivered {notDeliveredQty}</small> : null}
                        {Number(returned.qty || 0) > 0 ? <small className="sales-return-note">Returned {returned.qty}</small> : null}
                      </span>
                      <span>
                        {netQty}
                        
                      </span>
                      <span>{formatLkrValue(unitInvoicePrice)}</span>
                      <span>{formatLkrValue(line.price || 0)}</span>
                      <span>
                        {Number(line.itemDiscount || 0) > 0 ? currency(line.itemDiscount) : "-"}
                        {remainingBillDiscountShare > 0 ? <small className="sales-return-note">Bill disc. {formatLkrValue(remainingBillDiscountShare)}</small> : null}
                      </span>
                      <span>
                        {formatLkrValue(netLineAmount || 0)}
                        {Number(returned.amount || 0) > 0 ? <small className="sales-return-note">- {formatLkrValue(returned.amount)}</small> : null}
                      </span>
                    </article>
                  );
                })}
              </div>
              <div className="receipt-summary-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <div className="receipt-summary-texts">
                  <p className="form-hint">Discount: {currency(viewedSale.discount || 0)}</p>
                  {viewedSaleReturnedAmount > 0 ? <p className="form-hint return-adjust-text">Returns: - {currency(viewedSaleReturnedAmount)}</p> : null}
                  <p className="form-hint"><strong>Total: {currency(viewedSaleNetAmount || 0)}</strong></p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="ghost" onClick={() => setViewSaleId("")}>← Back</button>
                  <button type="button" className="receipt-print-action" onClick={() => printAdminSaleReceipt(viewedSale)}>Print</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deliverySale ? (
        <div className="low-stock-modal" onClick={() => { setDeliverySaleId(""); setDeliveryDraft({}); setDeliveryCashReceived(""); setDeliveryChequeAmount(""); setDeliveryChequeNo(""); setDeliveryChequeDate(""); setDeliveryChequeBank(""); setDeliveryError(""); }}>
          <div className="low-stock-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Confirm Delivery #{deliverySale.id}</h3>
              <button type="button" onClick={() => { setDeliverySaleId(""); setDeliveryDraft({}); setDeliveryCashReceived(""); setDeliveryChequeAmount(""); setDeliveryChequeNo(""); setDeliveryChequeDate(""); setDeliveryChequeBank(""); setDeliveryError(""); }}>Close</button>
            </div>
            <p className="form-hint">{new Date(deliverySale.createdAt).toLocaleString()} • {deliverySale.customerName || "Walk-in"} • {deliverySale.cashier || "-"} • {deliverySale.lorry || "-"}</p>
            <div className="admin-table deliveries-lines-table">
              <header>
                <span>Item</span>
                <span>Sold</span>
                <span>Already ND</span>
                <span>Not Delivered</span>
              </header>
              {(deliverySale.lines || []).map((line) => {
                const prevUndelivered = (deliverySale.deliveryAdjustments || [])
                  .reduce((acc, adj) => acc + (adj.lines || [])
                    .filter((x) => x.productId === line.productId)
                    .reduce((xAcc, x) => xAcc + Number(x.quantity || 0), 0), 0);
                const prevReturnedGood = 0; // Refunds are no longer supported; all returns are replacements
                const maxQty = Math.max(0, Number(line.quantity || 0) - prevUndelivered - prevReturnedGood);
                return (
                  <article key={`dl-${deliverySale.id}-${line.productId}`}>
                    <span>{line.name}</span>
                    <span>{line.quantity}</span>
                    <span>{prevUndelivered}</span>
                    <span>
                      <input
                        type="number"
                        min="0"
                        max={maxQty}
                        value={deliveryDraft[line.productId] ?? ""}
                        onChange={(e) => onDeliveryDraftChange(line.productId, e.target.value)}
                        placeholder={`max ${maxQty}`}
                        disabled={Boolean(deliverySale.deliveryConfirmedAt)}
                      />
                    </span>
                  </article>
                );
              })}
            </div>
            <div className="delivery-settlement-panel">
              <div className="delivery-settlement-head">
                <div>
                  <h4>Settlement At Delivery</h4>
                  <p>Collect the delivery payment clearly before confirming this bill.</p>
                </div>
                <span className={`rep-sale-payment rep-sale-payment-${String(deliverySale.paymentType || "").toLowerCase()}`}>{deliverySale.paymentType}</span>
              </div>
              <div className="delivery-settlement-kpis">
                <article>
                  <span>Order Total</span>
                  <strong>{currency(deliverySale.total || 0)}</strong>
                </article>
                <article>
                  <span>Paid So Far</span>
                  <strong>{currency(deliveryPaidSoFar)}</strong>
                </article>
                <article className="active">
                  <span>This Update</span>
                  <strong>{currency(deliveryDraftSettlement)}</strong>
                </article>
                <article className="warn">
                  <span>Balance After</span>
                  <strong>{currency(deliveryRemainingAfterDraft)}</strong>
                </article>
              </div>
              <div className="delivery-settlement-grid">
                <label className="rep-sale-field">
                  <span>Cash Received</span>
                  <input type="number" min="0" step="0.01" value={deliveryCashReceived} onChange={(e) => setDeliveryCashReceived(e.target.value)} placeholder="0.00" />
                </label>
                <label className="rep-sale-field">
                  <span>Cheque Amount</span>
                  <input type="number" min="0" step="0.01" value={deliveryChequeAmount} onChange={(e) => setDeliveryChequeAmount(e.target.value)} placeholder="0.00" />
                </label>
                <label className="rep-sale-field">
                  <span>Cheque No</span>
                  <input value={deliveryChequeNo} onChange={(e) => setDeliveryChequeNo(e.target.value)} placeholder="Cheque number" />
                </label>
                <label className="rep-sale-field">
                  <span>Cheque Date</span>
                  <input type="date" value={deliveryChequeDate} onChange={(e) => setDeliveryChequeDate(e.target.value)} />
                </label>
                <label className="rep-sale-field delivery-settlement-bank">
                  <span>Bank</span>
                  <input value={deliveryChequeBank} onChange={(e) => setDeliveryChequeBank(e.target.value)} placeholder="Bank name" />
                </label>
              </div>
            </div>
            <div className="delivery-history delivery-payment-history">
              <h4>Payment History</h4>
              {deliveryPaymentRows.length ? (
                <div className="delivery-history-list">
                  {deliveryPaymentRows.map((payment) => (
                    <article key={payment.id} className="delivery-history-row">
                      <p>
                        <strong>{String(payment.method || "").toUpperCase()}</strong>
                        {" • "}
                        {currency(payment.amount || 0)}
                        {" • "}
                        {new Date(payment.createdAt).toLocaleString()}
                      </p>
                      <p>
                        {payment.method === "cheque"
                          ? `Cheque No: ${payment.chequeNo || "-"} | Date: ${payment.chequeDate || "-"} | Bank: ${payment.chequeBank || "-"}`
                          : `Received by: ${payment.receivedBy || "-"}`
                        }
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="form-hint">No payment collected yet.</p>
              )}
            </div>
            <div className="delivery-history">
              <h4>Delivery History</h4>
              {(deliverySale.deliveryAdjustments || []).length ? (
                <div className="delivery-history-list">
                  {deliverySale.deliveryAdjustments.map((adj) => (
                    <article key={adj.id} className="delivery-history-row">
                      <p>
                        <strong>{new Date(adj.createdAt).toLocaleString()}</strong>
                        {" • "}
                        {adj.by || "admin"}
                      </p>
                      <p>
                        {(adj.lines || []).map((line) => `${line.name}: ${line.quantity}`).join(" | ")}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="form-hint">No previous delivery adjustments.</p>
              )}
            </div>
            {deliveryError ? <p className="form-hint">{deliveryError}</p> : null}
            <div className="admin-page-actions">
              <button type="button" onClick={saveDeliveryAdjust} disabled={savingDelivery}>
                {savingDelivery ? "Saving..." : (deliverySale.deliveryConfirmedAt ? "Save Payment Update" : "Confirm Delivery")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLowStock ? (
        <div className="low-stock-modal" onClick={() => setShowLowStock(false)}>
          <div className="low-stock-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Low Stock List</h3>
              <button type="button" onClick={() => setShowLowStock(false)}>Close</button>
            </div>
            <div className="low-stock-modal-list">
              {dashboard.lowStockItems.length ? dashboard.lowStockItems.map((item) => (
                <article key={item.id} className="list-row">
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.sku} • {item.category}</p>
                  </div>
                  <strong>{item.stock}</strong>
                </article>
              )) : <p>No low stock items.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {showChequeAlertDetails ? (
        <div className="low-stock-modal" onClick={() => setShowChequeAlertDetails(false)}>
          <div className="low-stock-modal-card cheque-alert-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Tomorrow Cheques</h3>
              <button type="button" onClick={() => setShowChequeAlertDetails(false)}>Close</button>
            </div>
            <p className="form-hint">
              {upcomingChequeSummary.count} cheque{upcomingChequeSummary.count === 1 ? "" : "s"} due on {upcomingChequeSummary.date} • Total LKR {formatLkrValue(upcomingChequeSummary.total)}
            </p>
            <div className="admin-table cheque-alert-table">
              <header>
                <span>Sale</span>
                <span>Customer</span>
                <span>Amount</span>
                <span>Cheque No</span>
                <span>Bank</span>
                <span>Rep</span>
              </header>
              {upcomingChequeSummary.rows.map((row) => (
                <article key={`cheque-alert-${row.saleId}-${row.chequeNo}-${row.customer}`}>
                  <span>#{row.saleId}</span>
                  <span>{row.customer}</span>
                  <span>LKR {formatLkrValue(row.amount)}</span>
                  <span>{row.chequeNo}</span>
                  <span>{row.bank}</span>
                  <span>{row.rep}</span>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showChequeSummaryDetails ? (
        <div className="low-stock-modal" onClick={() => setShowChequeSummaryDetails(false)}>
          <div className="low-stock-modal-card cheque-alert-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Cheque Details</h3>
              <button type="button" onClick={() => setShowChequeSummaryDetails(false)}>Close</button>
            </div>
            <p className="form-hint">
              {chequeReportSummary.chequeCount} cheque{chequeReportSummary.chequeCount === 1 ? "" : "s"} • Total LKR {formatLkrValue(chequeReportSummary.totalChequeAmount)}
            </p>
            <div className="admin-table cheque-alert-table cheque-summary-details-table">
              <header>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "saleId")}>Sale{sortMark("chequeSummary", "saleId")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "date")}>Date{sortMark("chequeSummary", "date")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "customer")}>Customer{sortMark("chequeSummary", "customer")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "amount")}>Amount{sortMark("chequeSummary", "amount")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "chequeNo")}>Cheque No{sortMark("chequeSummary", "chequeNo")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "chequeDate")}>Cheque Date{sortMark("chequeSummary", "chequeDate")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "bank")}>Bank{sortMark("chequeSummary", "bank")}</button>
                <button type="button" className="th-sort" onClick={() => toggleSort("chequeSummary", "rep")}>Rep{sortMark("chequeSummary", "rep")}</button>
              </header>
              {sortedChequeSummaryRows.length ? sortedChequeSummaryRows.map((row) => (
                <article key={`cheque-summary-${row.rowId}`}>
                  <span>#{row.saleId}</span>
                  <span>{row.date}</span>
                  <span>{row.customer}</span>
                  <span>LKR {formatLkrValue(row.amount)}</span>
                  <span>{row.chequeNo}</span>
                  <span>{row.chequeDate}</span>
                  <span>{row.bank}</span>
                  <span>{row.rep}</span>
                </article>
              )) : <p>No cheque records in selected range.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {showCreditLimitAlertDetails ? (
        <div className="low-stock-modal" onClick={() => setShowCreditLimitAlertDetails(false)}>
          <div className="low-stock-modal-card cheque-alert-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Credit Limit Notifications</h3>
              <button type="button" onClick={() => setShowCreditLimitAlertDetails(false)}>Close</button>
            </div>
            <p className="form-hint">
              {creditLimitAlertSummary.count
                ? `${creditLimitAlertSummary.count} customer${creditLimitAlertSummary.count === 1 ? "" : "s"} exceeded the assigned credit limit. Total over limit: LKR ${formatLkrValue(creditLimitAlertSummary.totalExceeded)}`
                : "No customer is above the assigned credit limit."}
            </p>
            <div className="credit-limit-alert-list">
              {creditLimitAlertSummary.rows.length ? creditLimitAlertSummary.rows.map((row) => (
                <article className="credit-limit-alert-item" key={`credit-limit-alert-${row.customer}-${row.rep}`}>
                  <div className="credit-limit-alert-head">
                    <div>
                      <h4>{row.customer}</h4>
                      <p>{row.phone && row.phone !== "-" ? row.phone : "No phone number"}</p>
                    </div>
                    <div className="credit-limit-alert-tags">
                      <span className="credit-limit-alert-rep">{row.rep && row.rep !== "-" ? row.rep : "No rep linked"}</span>
                      <span className={`credit-limit-alert-days ${String(row.daysLabel || "").toLowerCase().includes("overdue") ? "is-overdue" : ""}`}>{row.daysLabel || "-"}</span>
                    </div>
                  </div>
                  <div className="credit-limit-alert-metrics">
                    <div>
                      <span>Outstanding</span>
                      <strong>LKR {formatLkrValue(row.outstanding)}</strong>
                    </div>
                    <div>
                      <span>Credit Limit</span>
                      <strong>LKR {formatLkrValue(row.creditLimit)}</strong>
                    </div>
                    <div className="credit-limit-alert-over">
                      <span>Exceeded By</span>
                      <strong>LKR {formatLkrValue(row.exceededBy)}</strong>
                    </div>
                  </div>
                </article>
              )) : <p className="credit-limit-alert-empty">No credit limit notifications right now.</p>}
            </div>
          </div>
        </div>
      ) : null}
      {showResetDataModal ? (
        <div className="low-stock-modal" onClick={() => { setShowResetDataModal(false); setResetDataConfirmText(""); }}>
          <div className="low-stock-modal-card confirm-modal-card confirm-modal-card-danger" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Reset Data</h3>
              <button type="button" onClick={() => { setShowResetDataModal(false); setResetDataConfirmText(""); }}>Close</button>
            </div>
            <p className="confirm-modal-text">
              This permanently deletes system records (sales, returns, stock movements, staff, etc.). Choose an option below to specify what data to retain. This action cannot be undone.
            </p>
            <label className="stock-form-field">
              <span>Type DELETE to confirm</span>
              <input
                value={resetDataConfirmText}
                onChange={(e) => setResetDataConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </label>
            <div className="confirm-modal-actions" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                className="row-danger"
                disabled={resettingData || resetDataConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={() => handleResetAllData("keep-customers")}
              >
                Delete all data except Customer details
              </button>
              <button
                type="button"
                className="row-danger"
                disabled={resettingData || resetDataConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={() => handleResetAllData("keep-customers-and-products")}
              >
                Delete all data except Customers & Products
              </button>
              <button
                type="button"
                className="row-danger"
                disabled={resettingData || resetDataConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={() => handleResetAllData("keep-products")}
              >
                Delete all data except Products (SKUs)
              </button>
              <button
                type="button"
                className="row-danger"
                disabled={resettingData || resetDataConfirmText.trim().toUpperCase() !== "DELETE"}
                onClick={() => handleResetAllData("full")}
              >
                Delete all data (Full Reset)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};











