import React, { useEffect, useMemo, useRef, useState } from "react";
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
  openPreOrderReceiptPrint,
  useLocalStorage
} from './utils.jsx';
import { LoginScreen } from './LoginScreen.jsx';
import { Header } from './Header.jsx';
const CashierView = React.lazy(() => import('./CashierView.jsx').then(m => ({ default: m.CashierView })));
const AdminView = React.lazy(() => import('./AdminView.jsx').then(m => ({ default: m.AdminView })));

export const App = () => {
  const [state, setState] = useState({ settings: {}, products: [], sales: [], returns: [], customers: [], staff: [], accounting: [], accounts: [] });
  const [dashboard, setDashboard] = useState({ salesCount: 0, todaySalesCount: 0, todayRevenue: 0, todayOutstanding: 0, lowStockItems: [] });
  const [appConfig, setAppConfig] = useState({ appMode: "live", demo: { enabled: false, readOnly: false, hasSnapshot: false } });
  const [search, setSearch] = useState("");
  const [cashier, setCashier] = useState("");
  const [customerName, setCustomerName] = useLocalStorage("pos_customer_name", "");
  const [customerId, setCustomerId] = useLocalStorage("pos_customer_id", "");
  const [lorry, setLorry] = useLocalStorage("pos_lorry", "");
  const [isPreOrderMode, setIsPreOrderMode] = useState(false);
  const [paymentType, setPaymentType] = useLocalStorage("pos_payment_type", "credit");
  const [cashReceived, setCashReceived] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [chequeAmount, setChequeAmount] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [customerCreditDraft, setCustomerCreditDraft] = useState("");
  const [cart, setCart] = useLocalStorage("pos_cart", []);
  const [message, setMessage] = useState("");
  const [savingCheckout, setSavingCheckout] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState(() => typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const [showQuickPayOutstanding, setShowQuickPayOutstanding] = useState(false);
  const [quickPayOutstandingDraft, setQuickPayOutstandingDraft] = useState("");
  const [savingQuickPayOutstanding, setSavingQuickPayOutstanding] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [successModal, setSuccessModal] = useState("");
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmModalLocked, setConfirmModalLocked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [session, setSession] = useState(null);
  const [cashierBillingFocusMode, setCashierBillingFocusMode] = useState(false);
  const [showPostSaleHomeButton, setShowPostSaleHomeButton] = useState(false);
  const confirmResolverRef = useRef(null);

  const showErrorModal = (text) => {
    const value = String(text || "").trim();
    setMessage("");
    setErrorModal(value || "Something went wrong.");
  };

  const showSuccessModal = (text) => {
    const value = String(text || "").trim();
    setMessage("");
    setSuccessModal(value || "Done.");
  };

  const requestConfirm = ({ title = "Confirm Delete", message = "Are you sure want to delete?", confirmLabel = "Delete", cancelLabel = "Cancel", tone = "danger" } = {}) =>
    new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmModal({ title, message, confirmLabel, cancelLabel, tone });
      setConfirmModalLocked(true);
      setTimeout(() => setConfirmModalLocked(false), 1200);
    });

  const resolveConfirm = (accepted) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmModal(null);
    if (typeof resolver === "function") resolver(Boolean(accepted));
  };

  const selectedBillingCustomer = useMemo(() => {
    if (customerId) {
      const match = (state.customers || []).find((c) => String(c.id) === String(customerId));
      if (match) return match;
    }
    const key = String(customerName || "").trim().toLowerCase();
    if (!key) return null;
    const matches = (state.customers || []).filter((item) => String(item.name || "").trim().toLowerCase() === key);
    if (!matches.length) return null;
    return matches[0];
  }, [customerId, customerName, state.customers]);

  const taxRate = 0;
  const effectiveCartLines = useMemo(
    () => cart.map((line) => {
      let contextualBasePrice = lineBasePrice(line);
      if (line.priceDraft === undefined || line.priceDraft === "") {
         const customPrice = selectedBillingCustomer?.itemPrices?.[line.productId];
         if (customPrice !== undefined && customPrice !== null && customPrice !== "") {
           const parsed = Number(customPrice);
           if (Number.isFinite(parsed) && parsed >= 0) {
             contextualBasePrice = parsed;
           }
         } else {
           const product = state?.products?.find(p => String(p.id) === String(line.productId));
           if (product) {
             contextualBasePrice = productSalePrice(product);
           }
         }
      }

      const contextualLine = { ...line, basePrice: contextualBasePrice };
      return { 
        ...contextualLine, 
        itemDiscount: lineItemDiscount(contextualLine), 
        price: lineFinalPrice(contextualLine)
      };
    }),
    [cart, selectedBillingCustomer, state.products]
  );
  
  const [checkoutEmptyBottlesCollected, setCheckoutEmptyBottlesCollected] = useState("");
  
  const checkoutTotalEmptiesOutstanding = useMemo(() => {
    if (!customerName || customerName.trim().toLowerCase() === "walk-in") return 0;
    const customerNameKey = customerName.trim().toLowerCase();
    let thisBillOwed = 0;
    if (!isPreOrderMode) {
      thisBillOwed = effectiveCartLines.reduce((acc, line) => {
        const product = (state.products || []).find((p) => String(p.id) === String(line.productId));
        const is250ml = String(product?.size || "").includes("250");
        if (!product || product.returnableBottle === false || !is250ml) return acc;
        return acc + Number(line.quantity || 0);
      }, 0);
    }
    const otherSalesOwed = (state.sales || [])
      .filter((s) => String(s.customerName || "").trim().toLowerCase() === customerNameKey)
      .reduce((acc, s) => acc + Math.max(0, Number(s.emptyBottlesOwed || 0) - Number(s.emptyBottlesCollected || 0)), 0);
    let openingOwed = 0;
    const targetCustomer = (state.customers || []).find((c) => String(c.name || "").trim().toLowerCase() === customerNameKey);
    if (targetCustomer) {
      openingOwed = Math.max(0, Number(targetCustomer.openingEmptyBottles || 0) - Number(targetCustomer.collectedOpeningEmptyBottles || 0));
    }
    return thisBillOwed + otherSalesOwed + openingOwed;
  }, [customerName, isPreOrderMode, effectiveCartLines, state.sales, state.customers, state.products]);

  const discountAmount = useMemo(() => billDiscountValue(discountMode, discountValue, effectiveCartLines), [effectiveCartLines, discountMode, discountValue]);
  const totals = useMemo(() => calculateTotals({ lines: effectiveCartLines, taxRate, discount: discountAmount }), [effectiveCartLines, taxRate, discountAmount]);

  const selectedCustomerCreditLimit = useMemo(() => Number(selectedBillingCustomer?.creditLimit || 0), [selectedBillingCustomer?.creditLimit]);
  const selectedCustomerDiscountLimit = useMemo(() => Number(selectedBillingCustomer?.discountLimit || 0), [selectedBillingCustomer?.discountLimit]);
  const selectedCustomerBundleDiscountLimit = useMemo(() => Number(selectedBillingCustomer?.bundleDiscountLimit || 0), [selectedBillingCustomer?.bundleDiscountLimit]);
  const selectedCustomerOutstandingForLimit = useMemo(() => {
    const key = String(customerName || "").trim().toLowerCase();
    if (!key || key === "walk-in") return 0;
    const liveOutstanding = (state.sales || []).reduce((total, sale) => {
      const match = customerId 
        ? String(sale.customerId) === String(customerId)
        : String(sale?.customerName || "").trim().toLowerCase() === key;
      if (!match) return total;
      const outstanding = Number(
        sale.outstandingAmount !== undefined
          ? sale.outstandingAmount
          : (sale.paymentType === "credit" ? saleNetTotal(sale) : 0)
      ) || 0;
      return total + outstanding;
    }, 0);

    return Number(Math.max(
      0,
      liveOutstanding
      + Number(selectedBillingCustomer?.openingOutstanding || 0)
      - Number(selectedBillingCustomer?.outstandingAdjustment || 0)
    ).toFixed(2));
  }, [customerId, customerName, selectedBillingCustomer?.openingOutstanding, selectedBillingCustomer?.outstandingAdjustment, state.sales]);
  const cartDiscountTotal = useMemo(() => totalDiscountApplied({ lines: effectiveCartLines, billDiscount: discountAmount }), [effectiveCartLines, discountAmount]);
  const customerCreditMap = useMemo(() => {
    const map = new Map();
    for (const entry of (state.customerCredits || [])) {
      const key = String(entry.customerId || entry.customerName || "").trim();
      if (!key) continue;
      const remaining = Number(entry.remainingAmount ?? entry.amount ?? 0);
      if (remaining <= 0) continue;
      map.set(key, Number(map.get(key) || 0) + remaining);
    }
    return map;
  }, [state.customerCredits]);
  const selectedCustomerAvailableCredit = useMemo(() => {
    const key = String(customerId || customerName || "").trim();
    if (!key) return 0;
    return Number(customerCreditMap.get(key) || 0);
  }, [customerId, customerName, customerCreditMap]);
  const appliedCustomerCredit = useMemo(() => {
    const requested = Number(customerCreditDraft || 0);
    if (!Number.isFinite(requested) || requested <= 0) return 0;
    return Number(Math.max(0, Math.min(requested, selectedCustomerAvailableCredit, Number(totals.total || 0))).toFixed(2));
  }, [customerCreditDraft, selectedCustomerAvailableCredit, totals.total]);
  const totalAfterCustomerCredit = useMemo(
    () => Number(Math.max(0, Number(totals.total || 0) - appliedCustomerCredit).toFixed(2)),
    [totals.total, appliedCustomerCredit]
  );
  const currentCartQty = useMemo(
    () => effectiveCartLines.reduce((acc, line) => acc + Number(line.quantity || 0), 0),
    [effectiveCartLines]
  );
  const lorryLoadMap = useMemo(() => {
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
      
      const soldQty = (sale.lines || []).reduce((acc, line) => acc + Number(line.quantity || 0), 0);
      next[lorryName] += soldQty;
    }
    return next;
  }, [state.sales, state?.settings?.lorryCountResetAt]);
  const preOrderReservedMap = useMemo(() => {
    const map = new Map();
    for (const sale of (state.sales || [])) {
      if (sale.orderType !== "preorder" || sale.preOrderStatus !== "pending" || sale.stockDecremented !== false) continue;
      for (const line of (sale.lines || [])) {
        const key = String(line.productId || "").trim();
        if (!key) continue;
        map.set(key, Number(map.get(key) || 0) + Number(line.quantity || 0));
      }
    }
    return map;
  }, [state.sales]);

  useEffect(() => {
    const handleInvalidSession = () => {
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      setAuthError("Session expired. Please sign in again.");
    };

    setAuthCallbacks({
      onRefresh: (nextSession) => {
        setSession(nextSession);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      },
      onInvalid: handleInvalidSession
    });

    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.accessToken) {
        setAuthSession(parsed);
        setSession(parsed);
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!customerName.trim() || selectedCustomerAvailableCredit <= 0) {
      setCustomerCreditDraft("");
      return;
    }
    const current = Number(customerCreditDraft || 0);
    if (!Number.isFinite(current) || current < 0) {
      setCustomerCreditDraft("");
      return;
    }
    if (current > selectedCustomerAvailableCredit) {
      setCustomerCreditDraft(String(selectedCustomerAvailableCredit));
    }
  }, [customerName, selectedCustomerAvailableCredit]);

  useEffect(() => {
    if (!session) return undefined;
    let mounted = true;

    const load = async () => {
      try {
        await fetchMe();
        const [freshState, freshDashboard, freshConfig] = await Promise.all([fetchState(), fetchDashboard(), fetchAppConfig()]);
        if (!mounted) return;
        setState(freshState);
        setDashboard(freshDashboard);
        setAppConfig(freshConfig || { appMode: "live", demo: { enabled: false, readOnly: false, hasSnapshot: false } });
      } catch (error) {
        if (mounted) showErrorModal(error.message);
      }
    };

    load();

    const socket = io(getApiBase(), {
      transports: ["websocket", "polling"],
      auth: { token: getAccessToken() }
    });

    socket.on(SOCKET_EVENTS.STATE_SYNC, (next) => {
      if (mounted) setState(next);
    });
    socket.on(SOCKET_EVENTS.SALE_CREATED, () => fetchDashboard().then((d) => mounted && setDashboard(d)).catch(() => { }));

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [session?.accessToken]);

  useEffect(() => {
    if (session?.user?.role === "cashier") {
      setCashier(session.user.username || "");
    }
    const activeUser = session?.user?.username || session?.user?.name || cashier || "";
    const defaultLorry = getDefaultLorryForUsername(activeUser);
    if (defaultLorry) {
      setLorry(defaultLorry);
    }
  }, [session?.user?.role, session?.user?.username, session?.user?.name, cashier]);

  useEffect(() => {
    if (paymentType !== "cash") setCashReceived("");
    if (paymentType !== "credit") setCreditDueDate("");
    if (paymentType !== "cheque") {
      setChequeAmount("");
      setChequeNo("");
      setChequeDate("");
      setChequeBank("");
    }
  }, [paymentType]);

  useEffect(() => {
    if (!session?.user || typeof window === "undefined") return undefined;

    const marker = { luckyPosGuard: true, ts: Date.now() };
    window.history.pushState(marker, "", window.location.href);

    const handlePopState = async () => {
      window.history.pushState({ luckyPosGuard: true, ts: Date.now() }, "", window.location.href);
      const shouldExit = await requestConfirm({ title: "Exit", message: "Are you sure you want to exit?", confirmLabel: "Exit" });
      if (shouldExit) {
        window.removeEventListener("popstate", handlePopState);
        window.history.go(-2);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [session?.user]);

  const applyLocalSaleDelete = (saleId) => {
    setState((current) => {
      const targetSale = (current.sales || []).find((sale) => String(sale.id) === String(saleId));
      if (!targetSale) return current;

      const returnedByProduct = new Map();
      const replacedByProduct = new Map();
      for (const ret of (current.returns || [])) {
        if (String(ret.saleId) !== String(saleId)) continue;
        for (const line of (ret.lines || [])) {
          replacedByProduct.set(line.productId, (replacedByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
        }
      }

      return {
        ...current,
        products: (current.products || []).map((product) => {
          const saleLine = (targetSale.lines || []).find((line) => line.productId === product.id);
          if (!saleLine) return product;
          const sold = Number(saleLine.quantity || 0);
          const alreadyReturnedGood = Number(returnedByProduct.get(product.id) || 0);
          const replaced = Number(replacedByProduct.get(product.id) || 0);
          const netSold = Math.max(0, sold - alreadyReturnedGood + replaced);
          return {
            ...product,
            stock: Number((Number(product.stock || 0) + netSold).toFixed(2))
          };
        }),
        sales: (current.sales || []).filter((sale) => String(sale.id) !== String(saleId)),
        returns: (current.returns || []).filter((ret) => String(ret.saleId) !== String(saleId))
      };
    });
  };

  const login = async ({ username, password }) => {
    const attempts = [
      { role: "admin", username, password },
      { role: "manager", username, password },
      { role: "cashier", username, password }
    ];
    try {
      let nextSession = null;
      for (const payload of attempts) {
        try {
          nextSession = await loginApi(payload);
          break;
        } catch { }
      }
      if (!nextSession) throw new Error("Invalid credentials");
      setAuthSession(nextSession);
      setSession(nextSession);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setAuthError("");
      setMessage("");
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const logout = async () => {
    await logoutApi();
    clearAuthSession();
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCart([]);
    setMessage("");
  };



  const submitQuickPayOutstanding = async () => {
    try {
      if (savingQuickPayOutstanding) return;
      const amount = Number(quickPayOutstandingDraft);
      if (!Number.isFinite(amount) || amount <= 0) {
        showErrorModal("Enter a valid amount to pay.");
        return;
      }
      setSavingQuickPayOutstanding(true);
      await payCustomerOutstanding({ customerId, customerName, amount });
      setState(await fetchState());
      setShowQuickPayOutstanding(false);
      setQuickPayOutstandingDraft("");
      showSuccessModal("Outstanding balance paid successfully.");
    } catch (error) {
      showErrorModal(error.message);
    } finally {
      setSavingQuickPayOutstanding(false);
    }
  };

  const checkout = async () => {
    try {
      if (savingCheckout) return;
      setSavingCheckout(true);
      const LORRY_CAPACITY = 2880;
      const matchedCustomer = (state.customers || []).find(
        (item) => String(item.name || "").trim().toLowerCase() === String(customerName || "").trim().toLowerCase()
      );
      if (!matchedCustomer) {
        showErrorModal("Select a saved customer before checkout.");
        return;
      }
      if (!lorry) {
        showErrorModal("Select a delivery bucket.");
        return;
      }
      const pendingLoad = Number(lorryLoadMap[lorry] || 0);
      if (BASE_LORRIES.includes(lorry)) {
        if (pendingLoad >= LORRY_CAPACITY) {
          showErrorModal("Selected lorry is full.");
          return;
        }
        if ((pendingLoad + currentCartQty) > LORRY_CAPACITY) {
          showErrorModal(`Selected lorry exceeds capacity. Only ${Math.max(0, LORRY_CAPACITY - pendingLoad)} items left.`);
          return;
        }
      }
      if (selectedCustomerDiscountLimit > 0 && cartDiscountTotal > selectedCustomerDiscountLimit) {
        showErrorModal(`Customer discount limit is ${currency(selectedCustomerDiscountLimit)}. Current discount is ${currency(cartDiscountTotal)}.`);
        return;
      }
      const bundleDiscountViolation = findBundleDiscountViolation({ lines: effectiveCartLines, bundleDiscountLimit: selectedCustomerBundleDiscountLimit });
      if (bundleDiscountViolation) {
        showErrorModal(`${bundleDiscountViolation.lineName} exceeds bundle discount limit. Allowed ${currency(bundleDiscountViolation.allowedBundleDiscount)} for ${bundleDiscountViolation.fullBundles} bundle(s).`);
        return;
      }
      if (!isPreOrderMode && selectedCustomerOutstandingForLimit > 0) {
        showErrorModal(`Cannot create bill. ${customerName} has an outstanding balance of ${currency(selectedCustomerOutstandingForLimit)}.`);
        return;
      }
      const sale = await submitSale({
        requestId: checkoutRequestId,
        cashier,
        customerId,
        customerName,
        customerPhone: matchedCustomer?.phone ? String(matchedCustomer.phone).trim() : undefined,
        lorry,
        orderType: isPreOrderMode ? "preorder" : "direct",
        paymentType,
        customerCreditAmount: appliedCustomerCredit,
        discount: discountAmount,
        taxRate: 0,
        emptyBottlesCollected: checkoutEmptyBottlesCollected,
        lines: effectiveCartLines
      });
      const saleWithPhone = {
        ...sale,
        customerPhone: sale?.customerPhone || (matchedCustomer?.phone ? String(matchedCustomer.phone).trim() : "")
      };
      if (isPreOrderMode) {
        openPreOrderReceiptPrint({
          sale: saleWithPhone,
          customers: state.customers || [],
          allSales: state.sales || [],
          fallbackCustomerName: customerName,
          onPopupBlocked: () => showErrorModal(`Pre-order ${sale.id} completed, but popup is blocked. Allow popups to print receipt.`)
        });
        showSuccessModal("Pre-order saved.");
      } else {
        openSaleReceiptPrint({
          sale: saleWithPhone,
          customers: state.customers || [],
          products: state.products || [],
          allSales: state.sales || [],
          fallbackCustomerName: customerName,
          onPopupBlocked: () => showErrorModal(`Sale ${sale.id} completed, but popup is blocked. Allow popups to print receipt.`)
        });
        showSuccessModal("Order completed.");
      }
      setCart([]);
      setCheckoutRequestId(typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `sale-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      setShowPostSaleHomeButton(true);
      setDiscountValue("");
      setCustomerCreditDraft("");
      setCashReceived("");
      setCreditDueDate("");
      setPaymentType("credit");
      setChequeAmount("");
      setChequeNo("");
      setChequeDate("");
      setChequeBank("");
      setCheckoutEmptyBottlesCollected("");
      const activeUser = session?.user?.username || session?.user?.name || cashier || "";
      const defaultLorry = getDefaultLorryForUsername(activeUser);
      if (defaultLorry) {
        setLorry(defaultLorry);
      }
      setDashboard(await fetchDashboard());
    } catch (error) {
      showErrorModal(error.message);
    } finally {
      setSavingCheckout(false);
    }
  };

  if (!session?.user) {
    return <LoginScreen onLogin={login} error={authError} />;
  }

  return (
    <React.Suspense fallback={<div>Loading view...</div>}>
    <div className={`shell ${session.user.role === "cashier" && cashierBillingFocusMode ? "cashier-billing-shell" : ""}`}>
      {appConfig?.demo?.enabled ? (
        <div className="demo-mode-banner">
          DEMO MODE {appConfig?.demo?.readOnly ? "• READ ONLY" : "• EDITABLE"}
        </div>
      ) : null}
      {!(session.user.role === "cashier" && cashierBillingFocusMode) ? (
        <Header dashboard={dashboard} user={session.user} onLogout={logout} managerFullAccess={Boolean(state?.settings?.managerFullAccess)} />
      ) : null}
      {session.user.role === "cashier" ? (
        <CashierView
          state={state}
          dashboard={dashboard}
          search={search}
          setSearch={setSearch}
          cashier={cashier}
          user={session.user}
          customerId={customerId}
          setCustomerId={setCustomerId}
          customerName={customerName}
          setCustomerName={setCustomerName}
          lorry={lorry}
          setLorry={setLorry}
          isPreOrderMode={isPreOrderMode}
          setIsPreOrderMode={setIsPreOrderMode}
          preOrderReservedMap={preOrderReservedMap}
          paymentType={paymentType}
          setPaymentType={setPaymentType}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          creditDueDate={creditDueDate}
          setCreditDueDate={setCreditDueDate}
          chequeAmount={chequeAmount}
          setChequeAmount={setChequeAmount}
          chequeNo={chequeNo}
          setChequeNo={setChequeNo}
          chequeDate={chequeDate}
          setChequeDate={setChequeDate}
          chequeBank={chequeBank}
          setChequeBank={setChequeBank}
          discountMode={discountMode}
          setDiscountMode={setDiscountMode}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          selectedCustomerCreditLimit={selectedCustomerCreditLimit}
          selectedCustomerDiscountLimit={selectedCustomerDiscountLimit}
          selectedCustomerAvailableCredit={selectedCustomerAvailableCredit}
          cartDiscountTotal={cartDiscountTotal}
          customerCreditDraft={customerCreditDraft}
          setCustomerCreditDraft={setCustomerCreditDraft}
          appliedCustomerCredit={appliedCustomerCredit}
          totalAfterCustomerCredit={totalAfterCustomerCredit}
          lorryLoadMap={lorryLoadMap}
          currentCartQty={currentCartQty}
          cart={cart}
          setCart={setCart}
          totals={totals}
          message={message}
          setMessage={setMessage}
          onSaleDeleted={applyLocalSaleDelete}
          onSuccess={showSuccessModal}
          onLogout={logout}
          onBillingFocusChange={setCashierBillingFocusMode}
          requestConfirm={requestConfirm}
          savingCheckout={savingCheckout}
          showPostSaleHomeButton={showPostSaleHomeButton}
          setShowPostSaleHomeButton={setShowPostSaleHomeButton}
          checkout={checkout}
          showQuickPayOutstanding={showQuickPayOutstanding}
          setShowQuickPayOutstanding={setShowQuickPayOutstanding}
          quickPayOutstandingDraft={quickPayOutstandingDraft}
          setQuickPayOutstandingDraft={setQuickPayOutstandingDraft}
          savingQuickPayOutstanding={savingQuickPayOutstanding}
          submitQuickPayOutstanding={submitQuickPayOutstanding}
          checkoutEmptyBottlesCollected={checkoutEmptyBottlesCollected}
          setCheckoutEmptyBottlesCollected={setCheckoutEmptyBottlesCollected}
          checkoutTotalEmptiesOutstanding={checkoutTotalEmptiesOutstanding}
        />
      ) : (
        <AdminView
          state={state}
          dashboard={dashboard}
          message={message}
          onError={showErrorModal}
          requestConfirm={requestConfirm}
          onSaleDeleted={applyLocalSaleDelete}
          user={session.user}
        />
      )}
      {errorModal ? (
        <div className="low-stock-modal" onClick={() => setErrorModal("")}>
          <div className="low-stock-modal-card error-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Error</h3>
              <button type="button" onClick={() => setErrorModal("")}>Close</button>
            </div>
            <p className="error-modal-text">{errorModal}</p>
          </div>
        </div>
      ) : null}
      {successModal ? (
        <div className="low-stock-modal" onClick={() => setSuccessModal("")}>
          <div className="low-stock-modal-card success-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>
                <span className="success-modal-icon" aria-hidden="true">
                  <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.5 7L5.5 11L14.5 2" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/>
                  </svg>
                </span>
                Success
              </h3>
              <button type="button" onClick={() => setSuccessModal("")}>Close</button>
            </div>
            <p className="success-modal-text">{successModal}</p>
          </div>
        </div>
      ) : null}
      {confirmModal ? (
        <div className="low-stock-modal" onClick={() => resolveConfirm(false)}>
          <div className={`low-stock-modal-card confirm-modal-card confirm-modal-card-${confirmModal.tone || "danger"}`} onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>{confirmModal.title}</h3>
              <button type="button" onClick={() => resolveConfirm(false)}>Close</button>
            </div>
            <p className="confirm-modal-text">{confirmModal.message}</p>
            <div className="confirm-modal-actions">
              {confirmModal.cancelLabel !== false && (
                <button type="button" className="ghost" onClick={() => resolveConfirm(false)}>{confirmModal.cancelLabel || "Cancel"}</button>
              )}
              <button type="button" className={confirmModal.tone === "danger" ? "row-danger" : ""} onClick={() => resolveConfirm(true)} disabled={confirmModalLocked}>{confirmModalLocked ? "Wait..." : (confirmModal.confirmLabel || "Confirm")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </React.Suspense>
  );
};







