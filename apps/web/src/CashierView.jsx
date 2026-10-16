import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
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
export const CashierView = ({
  state,
  dashboard,
  search,
  setSearch,
  cashier,
  user,
  customerId,
  setCustomerId,
  customerName,
  setCustomerName,
  showPostSaleHomeButton,
  setShowPostSaleHomeButton,
  lorry,
  setLorry,
  isPreOrderMode,
  setIsPreOrderMode,
  preOrderReservedMap,
  paymentType,
  setPaymentType,
  cashReceived,
  setCashReceived,
  creditDueDate,
  setCreditDueDate,
  chequeAmount,
  setChequeAmount,
  chequeNo,
  setChequeNo,
  chequeDate,
  setChequeDate,
  chequeBank,
  setChequeBank,
  discountMode,
  setDiscountMode,
  discountValue,
  setDiscountValue,
  selectedCustomerCreditLimit,
  selectedCustomerDiscountLimit,
  selectedCustomerBundleDiscountLimit,
  selectedCustomerAvailableCredit,
  cartDiscountTotal,
  customerCreditDraft,
  setCustomerCreditDraft,
  appliedCustomerCredit,
  totalAfterCustomerCredit,
  lorryLoadMap,
  currentCartQty,
  cart,
  setCart,
  totals,
  message,
  setMessage,
  onSaleDeleted,
  onSuccess,
  onLogout,
  onBillingFocusChange,
  requestConfirm,
  savingCheckout,
  checkout,
  showQuickPayOutstanding,
  setShowQuickPayOutstanding,
  quickPayOutstandingDraft,
  setQuickPayOutstandingDraft,
  savingQuickPayOutstanding,
  submitQuickPayOutstanding,
  checkoutEmptyBottlesCollected,
  setCheckoutEmptyBottlesCollected,
  checkoutTotalEmptiesOutstanding
}) => {
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerRoute, setNewCustomerRoute] = useState("");
  const [newCustomerOpeningEmptyBottles, setNewCustomerOpeningEmptyBottles] = useState("");
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);

  const openCustomerAdd = () => {
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerAddress("");
    setNewCustomerRoute("");
    setNewCustomerOpeningEmptyBottles("");
    setShowAddCustomerModal(true);
  };

  const [deliveriesSearch, setDeliveriesSearch] = useState("");
  const [deliverySaleId, setDeliverySaleId] = useState("");
  const [deliveryDraft, setDeliveryDraft] = useState({});
  const [deliveryCashReceived, setDeliveryCashReceived] = useState("");
  const [deliveryChequeAmount, setDeliveryChequeAmount] = useState("");
  const [deliveryChequeNo, setDeliveryChequeNo] = useState("");
  const [deliveryChequeDate, setDeliveryChequeDate] = useState("");
  const [deliveryChequeBank, setDeliveryChequeBank] = useState("");
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");

  const deliverySale = useMemo(() => (state.sales || []).find((s) => String(s.id) === String(deliverySaleId)), [state.sales, deliverySaleId]);
  const deliverySettlementLimit = deliverySale ? Math.max(0, Number(deliverySale.netTotalAfterReturns ?? deliverySale.total ?? 0) - Number(deliverySale.paidAmount ?? deliverySale.totalPaymentReceived ?? 0)) : 0;

  const sortedDeliveryRows = useMemo(() => {
    const rows = [];
    for (const sale of (state.sales || [])) {
      if (!isSameRep(sale.cashier, cashier, user)) continue;
      rows.push({
        id: sale.id,
        sale,
        when: new Date(sale.createdAt).toLocaleString(),
        rep: sale.cashier || "-",
        lorry: sale.lorry || "-",
        total: sale.total,
        confirmed: Boolean(sale.deliveryConfirmedAt)
      });
    }
    return rows.sort((a, b) => new Date(b.sale.createdAt).getTime() - new Date(a.sale.createdAt).getTime());
  }, [state.sales, cashier, user]);

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

  const onDeliveryDraftChange = (productId, value) => setDeliveryDraft((c) => ({ ...c, [productId]: value }));

  const saveDeliveryAdjust = async (shouldPrint = false) => {
    try {
      if (!deliverySale) return setDeliveryError("Sale not found.");
      const lines = (deliverySale.lines || []).map((line) => ({ productId: line.productId, quantity: Number(deliveryDraft[line.productId] || 0) })).filter((line) => line.quantity > 0);
      const cash = Number(deliveryCashReceived || 0);
      const cheque = Number(deliveryChequeAmount || 0);
      if (cash < 0) return setDeliveryError("Cash received must be 0 or more.");
      if (cheque < 0) return setDeliveryError("Cheque amount must be 0 or more.");
      if ((cash + cheque) > Number((deliverySettlementLimit + 0.01).toFixed(2))) return setDeliveryError(`Cannot exceed ${currency(deliverySettlementLimit)}.`);
      if (cheque > 0 && (!deliveryChequeNo.trim() || !deliveryChequeDate || !deliveryChequeBank.trim())) return setDeliveryError("Enter cheque details.");
      
      setSavingDelivery(true);
      setDeliveryError("");
      const updatedSale = await submitDeliveryAdjustment(deliverySale.id, { lines, markConfirmed: true, cashReceived: cash, chequeAmount: cheque, chequeNo: deliveryChequeNo.trim(), chequeDate: deliveryChequeDate, chequeBank: deliveryChequeBank.trim() });
      
      let targetSale = updatedSale || deliverySale;
      try {
        const freshState = await fetchState();
        if (freshState?.sales) {
          targetSale = freshState.sales.find((s) => String(s.id) === String(deliverySale.id)) || targetSale;
        }
        if (shouldPrint) {
          openSaleReceiptPrint({
            sale: targetSale,
            customers: freshState?.customers || state.customers || [],
            products: freshState?.products || state.products || [],
            allSales: freshState?.sales || state.sales || [],
            onPopupBlocked: () => requestConfirm({ title: "Popup Blocked", message: "Please allow popups to print receipts.", confirmLabel: "OK", cancelLabel: false })
          });
        }
      } catch (e) {
        console.error("Failed to fetch fresh state for print", e);
        if (shouldPrint) {
          openSaleReceiptPrint({
            sale: targetSale,
            customers: state.customers || [],
            products: state.products || [],
            allSales: state.sales || [],
            onPopupBlocked: () => requestConfirm({ title: "Popup Blocked", message: "Please allow popups to print receipts.", confirmLabel: "OK", cancelLabel: false })
          });
        }
      }

      openDeliveryModal({ id: "" });
      setMessage(`Delivery confirmed for sale #${deliverySale.id}.`);
    } catch (err) {
      setDeliveryError(err.message);
    } finally {
      setSavingDelivery(false);
    }
  };

  const saveNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      requestConfirm({ title: "Validation Error", message: "Customer name is required.", confirmLabel: "OK", cancelLabel: false });
      return;
    }
    setSavingNewCustomer(true);
    try {
      const newCust = await createCustomer({ 
        name: newCustomerName.trim(), 
        phone: newCustomerPhone.trim(), 
        address: newCustomerAddress.trim(), 
        route: newCustomerRoute.trim(),
        openingEmptyBottles: Number(newCustomerOpeningEmptyBottles) || 0
      });
      setShowAddCustomerModal(false);
      setCustomerName(newCustomerName.trim());
      if (newCust && newCust.id) {
        setCustomerId(newCust.id);
      }
    } catch (err) {
      requestConfirm({ title: "Error", message: err.message || "An error occurred", confirmLabel: "OK", cancelLabel: false });
    } finally {
      setSavingNewCustomer(false);
    }
  };

  const LORRY_CAPACITY = 2880;
  const deferredSearch = useDeferredValue(search || "");
  const filteredProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return state.products;
    return state.products.filter((item) =>
      item.name.toLowerCase().includes(term)
      || item.sku.toLowerCase().includes(term)
      || item.category.toLowerCase().includes(term)
      || String(item.size || "").toLowerCase().includes(term)
      || productDisplayName(item).toLowerCase().includes(term)
    );
  }, [deferredSearch, state.products]);

  const itemSizeGroups = useMemo(() => {
    const groups = new Map();
    for (const product of filteredProducts) {
      const explicitSize = String(product?.size || "").trim();
      const sizeMl = extractSizeMl(explicitSize || product?.name || "");
      let label = explicitSize || (sizeMl > 0 ? `${sizeMl} ml` : "Other");

      if (label === "200 ml" || label === "200ml") {
        label = "Mixed Fruit";
      } else if (label === "Other") {
        label = "Chips";
      }

      const numericSort = sizeMl > 0 ? sizeMl : Number.POSITIVE_INFINITY;
      if (!groups.has(label)) groups.set(label, { label, sort: numericSort, products: [] });
      groups.get(label).products.push(product);
    }
    
    if (!groups.has("Sweets")) {
      groups.set("Sweets", { label: "Sweets", sort: Number.POSITIVE_INFINITY, products: [] });
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.sort !== b.sort) return a.sort - b.sort;
      return String(a.label).localeCompare(String(b.label));
    });
  }, [filteredProducts]);
  const cartQtyByProduct = useMemo(() => {
    const map = new Map();
    for (const line of (cart || [])) {
      map.set(line.productId, (map.get(line.productId) || 0) + Number(line.quantity || 0));
    }
    return map;
  }, [cart]);

  const getCatalogStock = (product) => {
    const currentStock = Number(product?.stock || 0);
    const reserved = Number(cartQtyByProduct.get(product?.id) || 0);
    const otherPreOrderReserved = isPreOrderMode ? Number(preOrderReservedMap?.get(product?.id) || 0) : 0;
    return Math.max(0, currentStock - reserved - otherPreOrderReserved);
  };
  const lowStockThreshold = Number(state?.settings?.lowStockThreshold ?? 20);

  const savedCustomers = useMemo(() => {
    return [...(state.customers || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [state.customers]);
  const [repCustomerSearch, setRepCustomerSearch] = useState("");
  const filteredRepCustomers = useMemo(() => {
    const term = String(repCustomerSearch || "").trim().toLowerCase();
    if (!term) return savedCustomers;
    return savedCustomers.filter((customer) => 
      String(customer.name || "").toLowerCase().includes(term) ||
      String(customer.route || "").toLowerCase().includes(term)
    );
  }, [repCustomerSearch, savedCustomers]);
  const customerOpeningOutstandingMap = useMemo(() => {
    const map = new Map();
    for (const customer of (state.customers || [])) {
      const key = String(customer.id || customer.name || "").trim();
      if (!key) continue;
      const openingOutstanding = Number(customer.openingOutstanding || 0);
      if (openingOutstanding > 0) {
        map.set(key, openingOutstanding);
      }
    }
    return map;
  }, [state.customers]);
  const customerOutstandingAdjustmentMap = useMemo(() => {
    const map = new Map();
    for (const customer of (state.customers || [])) {
      const key = String(customer.id || customer.name || "").trim();
      if (!key) continue;
      const adjustment = Number(customer.outstandingAdjustment || 0);
      if (adjustment > 0) {
        map.set(key, Math.max(Number(map.get(key) || 0), adjustment));
      }
    }
    return map;
  }, [state.customers]);
  const customerOutstandingMap = useMemo(() => {
    const map = new Map(customerOpeningOutstandingMap);
    for (const sale of (state.sales || [])) {
      const customerNameKey = String(sale.customerName || "").trim();
      if (customerNameKey.toLowerCase() === "walk-in") continue;
      const key = String(sale.customerId || sale.customerName || "").trim();
      if (!key) continue;
      const outstanding = Number(
        sale.outstandingAmount !== undefined
          ? sale.outstandingAmount
          : (sale.paymentType === "credit" ? saleNetTotal(sale) : 0)
      ) || 0;
      if (outstanding > 0) {
        map.set(key, (map.get(key) || 0) + outstanding);
      }
    }
    for (const [key, adjustment] of customerOutstandingAdjustmentMap.entries()) {
      map.set(key, Math.max(0, Number((Number(map.get(key) || 0) - Number(adjustment || 0)).toFixed(2))));
    }
    return map;
  }, [state.sales, customerOpeningOutstandingMap, customerOutstandingAdjustmentMap]);
  const selectedCustomerOutstanding = useMemo(() => {
    const key = String(customerId || customerName || "").trim();
    if (!key) return 0;
    return Number(customerOutstandingMap.get(key) || 0);
  }, [customerId, customerName, customerOutstandingMap]);
  const repSessionStats = useMemo(() => {
    const today = toColomboDateKey();
    let orders = 0;
    let revenue = 0;
    for (const sale of (state.sales || [])) {
      if (!isSameRep(sale.cashier, cashier, user)) continue;
      if (toColomboDateKey(sale.createdAt) !== today) continue;
      orders += 1;
      revenue += saleNetTotal(sale);
    }
    return { orders, revenue: Number(revenue.toFixed(2)) };
  }, [cashier, user, state.sales]);
  const [repProductivityDateFrom, setRepProductivityDateFrom] = useState("");
  const [repProductivityDateTo, setRepProductivityDateTo] = useState("");
  const [repSalesSearch, setRepSalesSearch] = useState("");
  const [repRecentSalesSearch, setRepRecentSalesSearch] = useState("");
  const [repComparisonSearch, setRepComparisonSearch] = useState("");
  const [repStockSearch, setRepStockSearch] = useState("");

  const damagedQtyByProduct = useMemo(() => {
    const map = new Map();
    for (const ret of (state.returns || [])) {
      for (const line of (ret.lines || [])) {
        if (String(line.condition || "").toLowerCase() !== "damaged") continue;
        map.set(line.productId, (map.get(line.productId) || 0) + Number(line.quantity || 0));
      }
    }
    return map;
  }, [state.returns]);

  const repStockRows = useMemo(() => {
    return (state.products || [])
      .map((product) => {
        const remaining = Number(product.stock || 0);
        const damaged = Number(damagedQtyByProduct.get(product.id) || 0);
        return {
          id: product.id,
          name: productDisplayName(product),
          billingPrice: Number(product?.billingPrice ?? product?.price ?? 0),
          mrp: Number(product?.mrp ?? product?.price ?? 0),
          remaining,
          damaged
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.products, damagedQtyByProduct]);
  const filteredRepStockBaseRows = useMemo(() => {
    const term = String(repStockSearch || "").trim().toLowerCase();
    if (!term) return repStockRows;
    return repStockRows.filter((row) => matchesSearch(term, row.name, row.id));
  }, [repStockRows, repStockSearch]);

  const repStockSummary = useMemo(() => {
    let remainingTotal = 0;
    let damagedTotal = 0;
    for (const row of repStockRows) {
      remainingTotal += Number(row.remaining || 0);
      damagedTotal += Number(row.damaged || 0);
    }
    return {
      remainingItems: remainingTotal,
      damagedItems: damagedTotal,
      damagedSkus: repStockRows.filter((row) => row.damaged > 0).length
    };
  }, [repStockRows]);
  const [repStockSort, setRepStockSort] = useState({ key: "name", dir: "asc" });
  const toggleRepStockSort = (key) => {
    setRepStockSort((current) => current.key === key
      ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" });
  };
  const repStockSortMark = (key) => repStockSort.key === key ? (repStockSort.dir === "asc" ? " â–²" : " â–¼") : "";
  const sortedRepStockRows = useMemo(
    () => {
      const factor = repStockSort.dir === "asc" ? 1 : -1;
      const getValue = {
        name: (row) => String(row.name || ""),
        billingPrice: (row) => Number(row.billingPrice || 0),
        mrp: (row) => Number(row.mrp || 0),
        remaining: (row) => Number(row.remaining || 0)
      }[repStockSort.key] || ((row) => String(row.name || ""));
      return [...filteredRepStockBaseRows].sort((a, b) => {
        const av = getValue(a);
        const bv = getValue(b);
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
        return String(av || "").localeCompare(String(bv || ""), undefined, { numeric: true, sensitivity: "base" }) * factor;
      });
    },
    [filteredRepStockBaseRows, repStockSort]
  );
  const sortedRepDamagedRows = useMemo(
    () => {
      const factor = repStockSort.dir === "asc" ? 1 : -1;
      const getValue = {
        name: (row) => String(row.name || ""),
        billingPrice: (row) => Number(row.billingPrice || 0),
        mrp: (row) => Number(row.mrp || 0),
        damaged: (row) => Number(row.damaged || 0)
      }[repStockSort.key] || ((row) => String(row.name || ""));
      return [...filteredRepStockBaseRows]
        .filter((row) => row.damaged > 0)
        .sort((a, b) => {
          const av = getValue(a);
          const bv = getValue(b);
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
          return String(av || "").localeCompare(String(bv || ""), undefined, { numeric: true, sensitivity: "base" }) * factor;
        });
    },
    [filteredRepStockBaseRows, repStockSort]
  );

  const customerOptions = useMemo(() => {
    return (state.customers || [])
      .filter((item) => String(item.name || "").trim())
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [state.customers]);

  const filteredCustomerOptions = useMemo(() => {
    const term = customerName.trim().toLowerCase();
    if (!term) return [];
    return customerOptions.filter((c) => String(c.name || "").toLowerCase().includes(term)).slice(0, 8);
  }, [customerName, customerOptions]);
  const allowedLorries = useMemo(
    () => getAllowedLorriesForUser(cashier, user),
    [cashier, user]
  );

  useEffect(() => {
    if (allowedLorries.length > 0 && !allowedLorries.includes(lorry)) {
      setLorry(allowedLorries[0]);
    }
  }, [allowedLorries, lorry, setLorry]);

  const lorryLoadRows = useMemo(
    () => allowedLorries.map((name) => ({ name, load: Number(lorryLoadMap?.[name] || 0), isOverflow: !BASE_LORRIES.includes(name) })),
    [allowedLorries, lorryLoadMap]
  );
  const selectedSavedCustomer = useMemo(() => {
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
  const [customerPhoneDraft, setCustomerPhoneDraft] = useState("");
  const [customerAddressDraft, setCustomerAddressDraft] = useState("");
  const [savingCustomerDetails, setSavingCustomerDetails] = useState(false);

  useEffect(() => {
    setCustomerPhoneDraft(String(selectedSavedCustomer?.phone || ""));
    setCustomerAddressDraft(String(selectedSavedCustomer?.address || ""));
  }, [selectedSavedCustomer?.id, selectedSavedCustomer?.phone, selectedSavedCustomer?.address]);

  const triggerAddHaptic = () => {
    const now = Date.now();
    if (now - lastHapticAtRef.current < 120) return;
    lastHapticAtRef.current = now;
    try {
      if (typeof window === "undefined") return;
      const vibrate = window.navigator?.vibrate;
      if (typeof vibrate !== "function") return;
      const ok = vibrate.call(window.navigator, [18, 12, 22]);
      if (!ok) vibrate.call(window.navigator, 28);
    } catch { }
  };

  const addToCartWithQty = (product, requestedQty) => {
    if (getCatalogStock(product) <= 0) return;
    triggerAddHaptic();
    const requested = Math.floor(Number(requestedQty || 1));
    const requestQty = Number.isFinite(requested) && requested > 0 ? requested : 1;
    const otherPreOrderReserved = isPreOrderMode ? Number(preOrderReservedMap?.get(product.id) || 0) : 0;
    setCart((current) => {
      const idx = current.findIndex((line) => line.productId === product.id);
      const alreadyInCart = idx === -1 ? 0 : Number(current[idx].quantity || 0);
      const available = Math.max(0, Number(product.stock || 0) - otherPreOrderReserved - alreadyInCart);
      if (available <= 0) return current;
      const addQty = Math.min(available, requestQty);
      if (idx === -1) return [...current, {
        productId: product.id,
        name: productDisplayName(product),
        basePrice: productSalePrice(product),
        itemDiscount: 0,
        itemDiscountMode: "amount",
        price: productSalePrice(product),
        quantity: addQty
      }];
      const clone = [...current];
      clone[idx] = { ...clone[idx], quantity: clone[idx].quantity + addQty };
      return clone;
    });
    setCatalogQtyDrafts((current) => ({ ...current, [product.id]: "" }));
  };

  const addToCart = (product) => {
    const requested = Math.floor(Number(catalogQtyDrafts[product.id]));
    if (!Number.isFinite(requested) || requested <= 0) return;
    addToCartWithQty(product, requested);
  };
  const removeFromCartWithQty = (product, requestedQty) => {
    const requested = Math.floor(Number(requestedQty || 1));
    const removeQty = Number.isFinite(requested) && requested > 0 ? requested : 1;
    const currentQty = Math.max(0, Number(cartQtyByProduct.get(product?.id) || 0));
    if (currentQty <= 0) return;
    triggerAddHaptic();
    updateQty(product.id, Math.max(0, currentQty - removeQty));
  };

  const updateQty = (productId, quantity) => {
    if (quantity === "") return;
    const parsed = Number(quantity);
    if (!Number.isFinite(parsed)) return;
    let nextQty = Math.floor(parsed);
    if (nextQty <= 0) {
      setCart((current) => current.filter((line) => line.productId !== productId));
      return;
    }
    const product = state?.products?.find((p) => p.id === productId);
    if (product) {
      const otherPreOrderReserved = isPreOrderMode ? Number(preOrderReservedMap?.get(productId) || 0) : 0;
      const stockLimit = Math.max(0, Number(product.stock || 0) - otherPreOrderReserved);
      if (nextQty > stockLimit) nextQty = stockLimit;
    }
    setCart((current) => current.map((line) => (line.productId === productId ? { ...line, quantity: nextQty } : line)));
  };
  const updateQtyByBundle = (line, direction) => {
    const bundleSize = getBundleSize(line);
    if (!(bundleSize > 0)) return;
    const currentQty = Math.max(0, Number(line?.quantity || 0));
    const nextQty = direction === "down"
      ? Math.max(0, currentQty - bundleSize)
      : currentQty + bundleSize;
    updateQty(line.productId, nextQty);
  };
  const updateItemDiscount = (productId, value) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setCart((current) => current.map((line) => {
      if (line.productId !== productId) return line;
      const base = lineBasePrice(line);
      const mode = String(line.itemDiscountMode || "amount");
      if (mode === "percent") return { ...line, itemDiscount: Math.min(parsed, 100) };
      return { ...line, itemDiscount: Math.min(parsed, base) };
    }));
  };
  const updateItemDiscountMode = (productId, mode) => {
    setCart((current) => current.map((line) => {
      if (line.productId !== productId) return line;
      const nextMode = mode === "percent" ? "percent" : "amount";
      const currentValue = Number(line.itemDiscount || 0);
      const clamped = nextMode === "percent"
        ? Math.min(Math.max(0, currentValue), 100)
        : Math.min(Math.max(0, currentValue), lineBasePrice(line));
      return { ...line, itemDiscountMode: nextMode, itemDiscount: clamped };
    }));
  };

  const updateItemCustomPrice = (productId, value) => {
    setCart((current) => current.map((line) => {
      if (line.productId !== productId) return line;
      if (value === "") {
        const product = state?.products?.find(p => p.id === productId);
        const defaultPrice = productSalePrice(product);
        return { ...line, priceDraft: "", price: defaultPrice, basePrice: defaultPrice };
      }
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return { ...line, priceDraft: value, price: parsed, basePrice: parsed };
      }
      return { ...line, priceDraft: value };
    }));
  };
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [showItemSizePicker, setShowItemSizePicker] = useState(false);
  const [activeItemSize, setActiveItemSize] = useState("");
  const [sizeProductSearch, setSizeProductSearch] = useState("");
  const [expandedSizeProductId, setExpandedSizeProductId] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [catalogQtyDrafts, setCatalogQtyDrafts] = useState({});
  const [cashierPage, setCashierPage] = useState("billing");
  const [returnSaleId, setReturnSaleId] = useState("");
  const [returnCustomerName, setReturnCustomerName] = useState("");
  const [showReturnCustomerSuggestions, setShowReturnCustomerSuggestions] = useState(false);
  const [returnLinesDraft, setReturnLinesDraft] = useState({});
  const [returnError, setReturnError] = useState("");
  const [savingReturn, setSavingReturn] = useState(false);
  const [preorderSaleId, setPreorderSaleId] = useState("");
  const [preorderCustomerName, setPreorderCustomerName] = useState("");
  const [showPreorderCustomerSuggestions, setShowPreorderCustomerSuggestions] = useState(false);
  const [preorderDeliveredDraft, setPreorderDeliveredDraft] = useState({});
  const [preorderPaymentMethod, setPreorderPaymentMethod] = useState("cash");
  const [preorderCashReceived, setPreorderCashReceived] = useState("");
  const [preorderChequeNo, setPreorderChequeNo] = useState("");
  const [preorderChequeDate, setPreorderChequeDate] = useState("");
  const [preorderChequeBank, setPreorderChequeBank] = useState("");
  const [preorderEmptyCollected, setPreorderEmptyCollected] = useState("");
  const [preorderError, setPreorderError] = useState("");
  const [savingPreorderConfirm, setSavingPreorderConfirm] = useState(false);
  const [emptyBottleSaleId, setEmptyBottleSaleId] = useState("");
  const [emptyBottleCustomerName, setEmptyBottleCustomerName] = useState("");
  const [showEmptyBottleCustomerSuggestions, setShowEmptyBottleCustomerSuggestions] = useState(false);
  const [emptyBottleQtyDraft, setEmptyBottleQtyDraft] = useState("");
  const [emptyBottleError, setEmptyBottleError] = useState("");
  const [savingEmptyBottleCollect, setSavingEmptyBottleCollect] = useState(false);
  const [openingEmptyBottleQtyDraft, setOpeningEmptyBottleQtyDraft] = useState("");
  const [savingOpeningEmptyBottleCollect, setSavingOpeningEmptyBottleCollect] = useState(false);
  const lastHapticAtRef = useRef(0);
  const [mobileCashierNavOpen, setMobileCashierNavOpen] = useState(false);
  const [repBillingStep, setRepBillingStep] = useState("customer");

  const [repLoadingLorry, setRepLoadingLorry] = useState(lorry || ORDER_LORRIES[0]);
  const [repLoadingDate, setRepLoadingDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [repLoadingSearch, setRepLoadingSearch] = useState("");

  useEffect(() => {
    if (allowedLorries.length > 0 && !allowedLorries.includes(repLoadingLorry)) {
      setRepLoadingLorry(allowedLorries[0]);
    }
  }, [allowedLorries, repLoadingLorry]);

  const productInfoById = useMemo(() => {
    const map = new Map();
    for (const p of (state.products || [])) {
      map.set(p.id, p);
    }
    return map;
  }, [state.products]);

  const repLoadingRows = useMemo(() => {
    const selectedLorry = repLoadingLorry || lorry || ORDER_LORRIES[0];
    const map = new Map();

    for (const sale of (state.sales || [])) {
      if (sale.lorry !== selectedLorry) continue;
      if (repLoadingDate) {
        const saleDate = new Date(sale.createdAt).toLocaleDateString("en-CA");
        if (saleDate !== repLoadingDate) continue;
      }

      for (const line of (sale.lines || [])) {
        const key = line.productId || line.name;
        const info = productInfoById.get(line.productId) || { name: line.name || "Unknown Item", sku: "-", size: "", category: "" };
        const row = map.get(key) || {
          key,
          productId: line.productId || key,
          name: info.name,
          sku: info.sku,
          size: info.size || "",
          category: info.category || "",
          qty: 0
        };
        row.qty += Number(line.quantity || 0);
        map.set(key, row);
      }
    }

    return [...map.values()]
      .map((row) => {
        const bundleSize = getBundleSize(row);
        const bundles = bundleSize ? Math.floor(row.qty / bundleSize) : 0;
        const balance = bundleSize ? row.qty % bundleSize : row.qty;
        return {
          ...row,
          bundleSize,
          bundles,
          balance
        };
      })
      .filter((row) => row.qty > 0)
      .sort((a, b) => b.qty - a.qty);
  }, [state.sales, repLoadingLorry, lorry, repLoadingDate, productInfoById]);

  const filteredRepLoadingRows = useMemo(() => {
    return repLoadingRows.filter((row) =>
      matchesSearch(repLoadingSearch, row.name, row.sku, row.category, row.size)
    );
  }, [repLoadingRows, repLoadingSearch]);

  const repLoadingStats = useMemo(() => {
    let totalQty = 0;
    let totalBundles = 0;
    for (const row of repLoadingRows) {
      totalQty += row.qty;
      totalBundles += row.bundles;
    }
    return {
      totalSkus: repLoadingRows.length,
      totalQty,
      totalBundles
    };
  }, [repLoadingRows]);

  useEffect(() => {
    setMobileCashierNavOpen(false);
    scrollViewportToTop();
  }, [cashierPage]);

  useEffect(() => {
    if (cashierPage === "billing") scrollViewportToTop();
  }, [cashierPage, repBillingStep]);

  useEffect(() => {
    if (repBillingStep !== "items") {
      setShowItemSizePicker(false);
      setSizeProductSearch("");
      setExpandedSizeProductId("");
    }
  }, [repBillingStep]);
  useEffect(() => {
    if (!showItemSizePicker) setExpandedSizeProductId("");
  }, [showItemSizePicker]);
  useEffect(() => {
    if ((cart || []).length > 0) setShowPostSaleHomeButton(false);
  }, [cart]);

  useEffect(() => {
    onBillingFocusChange?.(cashierPage === "billing");
    return () => onBillingFocusChange?.(false);
  }, [cashierPage, onBillingFocusChange]);

  const returnSale = useMemo(
    () => state.sales.find((sale) => String(sale.id) === String(returnSaleId).trim()) || null,
    [state.sales, returnSaleId]
  );
  const activeSizeProducts = useMemo(() => {
    if (!activeItemSize) return [];
    const group = itemSizeGroups.find((row) => row.label === activeItemSize);
    if (!group) return [];
    const term = String(sizeProductSearch || "").trim().toLowerCase();
    if (!term) return group.products;
    return group.products.filter((item) =>
      productDisplayName(item).toLowerCase().includes(term)
      || String(item.sku || "").toLowerCase().includes(term)
      || String(item.category || "").toLowerCase().includes(term)
    );
  }, [activeItemSize, itemSizeGroups, sizeProductSearch]);

  const returnCustomerOptions = useMemo(() => {
    const names = new Set(
      (state.sales || [])
        .filter((sale) => isSameRep(sale.cashier, cashier, user))
        .map((sale) => String(sale.customerName || "").trim())
        .filter(Boolean)
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [state.sales, cashier, user]);

  const filteredReturnCustomerOptions = useMemo(() => {
    const term = String(returnCustomerName || "").trim().toLowerCase();
    if (!term) return [];
    return returnCustomerOptions.filter((name) => name.toLowerCase().includes(term)).slice(0, 8);
  }, [returnCustomerName, returnCustomerOptions]);

  const returnSalesForCustomer = useMemo(() => {
    const selected = String(returnCustomerName || "").trim().toLowerCase();
    if (!selected) return [];
    return (state.sales || [])
      .filter((sale) =>
        isSameRep(sale.cashier, cashier, user)
        && String(sale.customerName || "").trim().toLowerCase() === selected
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.sales, cashier, user, returnCustomerName]);

  const returnedQtyByProduct = useMemo(() => {
    const map = new Map();
    const saleId = String(returnSaleId).trim();
    if (!saleId) return map;
    for (const ret of (state.returns || [])) {
      if (String(ret.saleId) !== saleId) continue;
      for (const line of (ret.lines || [])) {
        map.set(line.productId, (map.get(line.productId) || 0) + Number(line.quantity || 0));
      }
    }
    return map;
  }, [state.returns, returnSaleId]);
  const returnDraftSummary = useMemo(() => {
    if (!returnSale) return { qty: 0, amount: 0, goodQty: 0, damagedQty: 0 };
    return (returnSale.lines || []).reduce((acc, line) => {
      const draft = returnLinesDraft[line.productId] || {};
      const qty = Number(draft.quantity || 0);
      if (!Number.isFinite(qty) || qty <= 0) return acc;
      const preview = returnLinePreview(returnSale, line, qty);
      acc.qty += qty;
      acc.damagedQty += qty;
      return acc;
    }, { qty: 0, amount: 0, goodQty: 0, damagedQty: 0 });
  }, [returnLinesDraft, returnSale]);

  const onReturnDraftChange = (productId, patch) => {
    setReturnLinesDraft((current) => ({
      ...current,
      [productId]: { quantity: current[productId]?.quantity || "", condition: "damaged", ...patch }
    }));
  };

  const preorderSale = useMemo(
    () => state.sales.find((sale) => String(sale.id) === String(preorderSaleId).trim()) || null,
    [state.sales, preorderSaleId]
  );
  const preorderCustomerOptions = useMemo(() => {
    const names = new Set(
      (state.sales || [])
        .filter((sale) => sale.orderType === "preorder" && sale.preOrderStatus === "pending" && isSameRep(sale.cashier, cashier, user))
        .map((sale) => String(sale.customerName || "").trim())
        .filter(Boolean)
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [state.sales, cashier, user]);
  const filteredPreorderCustomerOptions = useMemo(() => {
    const term = String(preorderCustomerName || "").trim().toLowerCase();
    if (!term) return [];
    return preorderCustomerOptions.filter((name) => name.toLowerCase().includes(term)).slice(0, 8);
  }, [preorderCustomerName, preorderCustomerOptions]);
  const preorderSalesForCustomer = useMemo(() => {
    const selected = String(preorderCustomerName || "").trim().toLowerCase();
    if (!selected) return [];
    return (state.sales || [])
      .filter((sale) =>
        sale.orderType === "preorder"
        && sale.preOrderStatus === "pending"
        && isSameRep(sale.cashier, cashier, user)
        && String(sale.customerName || "").trim().toLowerCase() === selected
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.sales, cashier, user, preorderCustomerName]);
  const preorderDeliveredQty = (productId, orderedQty) => {
    const draftVal = preorderDeliveredDraft[productId];
    if (draftVal === undefined || draftVal === "") return orderedQty;
    return Math.max(0, Math.min(orderedQty, Number(draftVal) || 0));
  };
  const preorderDeliveredLines = useMemo(() => {
    if (!preorderSale) return [];
    return (preorderSale.lines || [])
      .map((line) => ({ ...line, quantity: preorderDeliveredQty(line.productId, Number(line.quantity || 0)) }))
      .filter((line) => line.quantity > 0);
  }, [preorderSale, preorderDeliveredDraft]);
  const preorderDeliveredTotals = useMemo(
    () => calculateTotals({
      lines: preorderDeliveredLines,
      taxRate: preorderSale?.taxRate ?? 0,
      discount: preorderSale?.discountAmount ?? preorderSale?.discount ?? 0
    }),
    [preorderDeliveredLines, preorderSale]
  );
  
  const preorderTotalEmptiesOutstanding = useMemo(() => {
    if (!preorderCustomerName.trim()) return 0;
    const customerNameKey = preorderCustomerName.trim().toLowerCase();
    
    const thisPreorderOwed = preorderDeliveredLines.reduce((acc, line) => {
      const product = (state.products || []).find((p) => String(p.id) === String(line.productId));
      const is250ml = String(product?.size || "").includes("250");
      if (!product || product.returnableBottle === false || !is250ml) return acc;
      return acc + Number(line.quantity || 0);
    }, 0);

    const otherSalesOwed = (state.sales || [])
      .filter((s) => String(s.id) !== String(preorderSaleId).trim() && String(s.customerName || "").trim().toLowerCase() === customerNameKey)
      .reduce((acc, s) => acc + Math.max(0, Number(s.emptyBottlesOwed || 0) - Number(s.emptyBottlesCollected || 0)), 0);

    let openingOwed = 0;
    const targetCustomer = (state.customers || []).find((c) => String(c.name || "").trim().toLowerCase() === customerNameKey);
    if (targetCustomer) {
      openingOwed = Math.max(0, Number(targetCustomer.openingEmptyBottles || 0) - Number(targetCustomer.collectedOpeningEmptyBottles || 0));
    }

    return thisPreorderOwed + otherSalesOwed + openingOwed;
  }, [preorderCustomerName, preorderSaleId, preorderDeliveredLines, state.sales, state.customers, state.products]);

  const onPreorderDeliveredChange = (productId, value) => {
    setPreorderDeliveredDraft((current) => ({ ...current, [productId]: value }));
  };

  const submitPreorderConfirm = async () => {
    try {
      const saleId = String(preorderSaleId || "").trim();
      if (!saleId) {
        setPreorderError("Select a pre-order bill.");
        return;
      }
      if (!preorderSale) {
        setPreorderError("Pre-order not found.");
        return;
      }
      if (String(preorderSale.cashier || "").trim().toLowerCase() !== String(cashier || "").trim().toLowerCase()) {
        setPreorderError(`Pre-order belongs to ${preorderSale.cashier || "another rep"}. You can confirm only your own pre-orders.`);
        return;
      }
      if (!preorderDeliveredLines.length) {
        setPreorderError("Enter at least one delivered quantity.");
        return;
      }
      const payload = {
        lines: (preorderSale.lines || []).map((line) => ({
          productId: line.productId,
          quantity: preorderDeliveredQty(line.productId, Number(line.quantity || 0))
        })),
        paymentMethod: preorderPaymentMethod,
        emptyBottlesCollected: Number(preorderEmptyCollected || 0)
      };
      if (preorderPaymentMethod === "cash") {
        payload.cashReceived = Number(preorderCashReceived || 0);
      }
      setSavingPreorderConfirm(true);
      setPreorderError("");
      const confirmedSale = await confirmPreorder(saleId, payload);
      setPreorderDeliveredDraft({});
      setPreorderSaleId("");
      setPreorderCustomerName("");
      setPreorderCashReceived("");
      setPreorderChequeNo("");
      setPreorderChequeDate("");
      setPreorderChequeBank("");
      setPreorderEmptyCollected("");
      onSuccess?.(`Pre-order #${confirmedSale.id} confirmed.`);
    } catch (error) {
      setPreorderError(error.message);
    } finally {
      setSavingPreorderConfirm(false);
    }
  };

  const emptyBottleSale = useMemo(
    () => state.sales.find((sale) => String(sale.id) === String(emptyBottleSaleId).trim()) || null,
    [state.sales, emptyBottleSaleId]
  );
  const emptyBottleCustomerOptions = useMemo(() => {
    const names = new Set(
      (state.sales || [])
        .filter((sale) => isSameRep(sale.cashier, cashier, user))
        .filter((sale) => Number(sale.emptyBottlesOwed || 0) - Number(sale.emptyBottlesCollected || 0) > 0)
        .map((sale) => String(sale.customerName || "").trim())
        .filter(Boolean)
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [state.sales, cashier, user]);
  const filteredEmptyBottleCustomerOptions = useMemo(() => {
    const term = String(emptyBottleCustomerName || "").trim().toLowerCase();
    if (!term) return [];
    return emptyBottleCustomerOptions.filter((name) => name.toLowerCase().includes(term)).slice(0, 8);
  }, [emptyBottleCustomerName, emptyBottleCustomerOptions]);
  const emptyBottleSalesForCustomer = useMemo(() => {
    const selected = String(emptyBottleCustomerName || "").trim().toLowerCase();
    if (!selected) return [];
    return (state.sales || [])
      .filter((sale) =>
        isSameRep(sale.cashier, cashier, user)
        && String(sale.customerName || "").trim().toLowerCase() === selected
        && Number(sale.emptyBottlesOwed || 0) > 0
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.sales, cashier, user, emptyBottleCustomerName]);
  const emptyBottleOutstanding = Math.max(
    0,
    Number(emptyBottleSale?.emptyBottlesOwed || 0) - Number(emptyBottleSale?.emptyBottlesCollected || 0)
  );

  const emptyBottleSelectedCustomer = useMemo(() => {
    return state.customers?.find(c => c.name === emptyBottleCustomerName) || null;
  }, [emptyBottleCustomerName, state.customers]);

  const submitOpeningEmptyBottleCollect = async () => {
    if (!emptyBottleSelectedCustomer) return;
    const qty = Number(openingEmptyBottleQtyDraft);
    if (!Number.isFinite(qty) || qty <= 0) {
      setEmptyBottleError("Enter a valid quantity.");
      return;
    }
    const owed = Number(emptyBottleSelectedCustomer.openingEmptyBottles || 0);
    const collected = Number(emptyBottleSelectedCustomer.collectedOpeningEmptyBottles || 0);
    const outstanding = owed - collected;
    if (qty > outstanding) {
      setEmptyBottleError("Cannot collect more than the opening empty bottles owed.");
      return;
    }
    try {
      setSavingOpeningEmptyBottleCollect(true);
      await collectOpeningEmptyBottles(emptyBottleSelectedCustomer.id, { quantity: qty });
      setOpeningEmptyBottleQtyDraft("");
      setEmptyBottleError("");
      setMessage("Opening empty bottles collected successfully.");
    } catch (err) {
      setEmptyBottleError(err.message || "Unable to collect opening empty bottles.");
    } finally {
      setSavingOpeningEmptyBottleCollect(false);
    }
  };

  const submitEmptyBottleCollect = async () => {
    try {
      const saleId = String(emptyBottleSaleId || "").trim();
      if (!saleId) {
        setEmptyBottleError("Select a bill.");
        return;
      }
      if (!emptyBottleSale) {
        setEmptyBottleError("Bill not found.");
        return;
      }
      if (!isSameRep(emptyBottleSale.cashier, cashier, user)) {
        setEmptyBottleError(`Bill belongs to ${emptyBottleSale.cashier || "another rep"}. You can collect only for your own bills.`);
        return;
      }
      const quantity = Number(emptyBottleQtyDraft || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setEmptyBottleError("Enter a quantity greater than 0.");
        return;
      }
      if (quantity > emptyBottleOutstanding) {
        setEmptyBottleError(`Cannot collect more than the outstanding empty bottles (${emptyBottleOutstanding} available).`);
        return;
      }
      setSavingEmptyBottleCollect(true);
      setEmptyBottleError("");
      await collectEmptyBottles(saleId, { quantity });
      setEmptyBottleQtyDraft("");
      onSuccess?.(`Collected ${quantity} empty bottle(s) for #${saleId}.`);
    } catch (error) {
      setEmptyBottleError(error.message);
    } finally {
      setSavingEmptyBottleCollect(false);
    }
  };

  const submitReturnFromSale = async () => {
    try {
      const saleId = String(returnSaleId || "").trim();
      if (!saleId) {
        setReturnError("Enter Sale ID.");
        return;
      }
      if (!returnSale) {
        setReturnError("Sale not found.");
        return;
      }
      if (!isSameRep(returnSale.cashier, cashier, user)) {
        setReturnError(`Sale belongs to ${returnSale.cashier || "another rep"}. You can return only your own sales.`);
        return;
      }
      const lines = (returnSale.lines || [])
        .map((line) => {
          const draft = returnLinesDraft[line.productId] || {};
          const qty = Number(draft.quantity || 0);
          return {
            productId: line.productId,
            quantity: qty,
            condition: "damaged"
          };
        })
        .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);
      if (!lines.length) {
        setReturnError("Enter at least one return quantity.");
        return;
      }
      setSavingReturn(true);
      setReturnError("");
      await submitReturn({ saleId, lines });
      setReturnLinesDraft({});
      setReturnSaleId("");
      onSuccess?.("Return Submitted.");
    } catch (error) {
      setReturnError(error.message);
    } finally {
      setSavingReturn(false);
    }
  };

  const repSales = useMemo(() => {
    return (state.sales || [])
      .filter((sale) => isSameRep(sale.cashier, cashier, user))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cashier, user, state.sales]);
  const repProductivitySales = useMemo(
    () => repSales.filter((sale) => inDateRange(sale.createdAt, repProductivityDateFrom, repProductivityDateTo)),
    [repSales, repProductivityDateFrom, repProductivityDateTo]
  );
  const repProductivityStats = useMemo(() => {
    const customerSet = new Set();
    let value = 0;
    let directValue = 0;
    let preorderValue = 0;
    let directCash = 0;
    let preorderCash = 0;
    let directCheque = 0;
    let preorderCheque = 0;
    let directCredit = 0;
    let preorderCredit = 0;
    let qty = 0;
    let bundles = 0;
    let singles = 0;

    for (const sale of repProductivitySales) {
      customerSet.add(String(sale.customerName || "Walk-in").trim() || "Walk-in");
      const pBreakdown = getSalePaymentBreakdown(sale);
      value += pBreakdown.net;

      if (sale.orderType === "preorder") {
        preorderValue += pBreakdown.net;
        preorderCash += pBreakdown.cash;
        preorderCheque += pBreakdown.cheque;
        preorderCredit += pBreakdown.credit;
      } else {
        directValue += pBreakdown.net;
        directCash += pBreakdown.cash;
        directCheque += pBreakdown.cheque;
        directCredit += pBreakdown.credit;
      }

      const returnedByProduct = saleReturnedQtyByProduct(sale, state.returns || []);
      const undeliveredByProduct = saleUndeliveredQtyByProduct(sale);
      for (const line of (sale.lines || [])) {
        const lineState = effectiveSaleLineState(sale, line, { returnedByProduct, undeliveredByProduct });
        qty += lineState.effectiveQty;
        const breakdown = getBundleBreakdown({ ...line, qty: lineState.effectiveQty });
        bundles += Number(breakdown.bundles || 0);
        singles += Number(breakdown.singles || 0);
      }
    }

    return {
      orders: repProductivitySales.length,
      value: Number(value.toFixed(2)),
      directValue: Number(directValue.toFixed(2)),
      preorderValue: Number(preorderValue.toFixed(2)),

      totalCash: Number((directCash + preorderCash).toFixed(2)),
      directCash: Number(directCash.toFixed(2)),
      preorderCash: Number(preorderCash.toFixed(2)),

      totalCheque: Number((directCheque + preorderCheque).toFixed(2)),
      directCheque: Number(directCheque.toFixed(2)),
      preorderCheque: Number(preorderCheque.toFixed(2)),

      totalCredit: Number((directCredit + preorderCredit).toFixed(2)),
      directCredit: Number(directCredit.toFixed(2)),
      preorderCredit: Number(preorderCredit.toFixed(2)),

      qty,
      bundles,
      singles,
      customers: customerSet.size
    };
  }, [repProductivitySales, state.returns]);
  const repCompareRows = useMemo(() => {
    const map = new Map();
    for (const sale of (state.sales || [])) {
      const rep = String(sale.cashier || "Unknown").trim() || "Unknown";
      const row = map.get(rep) || { rep, bills: 0, revenue: 0 };
      row.bills += 1;
      row.revenue += saleNetTotal(sale);
      map.set(rep, row);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [state.sales]);
  const filteredRepSales = useMemo(
    () =>
      repSales.filter((sale) =>
        matchesSearch(repSalesSearch, sale.id, sale.customerName, sale.lorry, sale.paymentType, sale.createdAt)
      ),
    [repSales, repSalesSearch]
  );
  const filteredRecentSales = useMemo(
    () =>
      (state.sales || [])
        .slice(0, 20)
        .filter((sale) =>
          matchesSearch(
            repRecentSalesSearch,
            sale.id,
            sale.customerName,
            sale.cashier,
            sale.lorry,
            sale.paymentType,
            sale.createdAt
          )
        ),
    [state.sales, repRecentSalesSearch]
  );

  const paginatedRepSales = usePagination(filteredRepSales, 20);
  const paginatedRepCustomers = usePagination(filteredRepCustomers, 20);

  const filteredRepCompareRows = useMemo(
    () => repCompareRows.filter((row) => matchesSearch(repComparisonSearch, row.rep)),
    [repCompareRows, repComparisonSearch]
  );
  const [editingSaleId, setEditingSaleId] = useState("");
  const [saleEditLines, setSaleEditLines] = useState([]);
  const [saleEditPaymentType, setSaleEditPaymentType] = useState("credit");
  const [saleEditBillDiscount, setSaleEditBillDiscount] = useState("");
  const [saleEditCollectEmptyBottles, setSaleEditCollectEmptyBottles] = useState("");
  const [saleEditAddProductId, setSaleEditAddProductId] = useState("");
  const [saleEditAddQty, setSaleEditAddQty] = useState("1");
  const [saleEditCashReceived, setSaleEditCashReceived] = useState("");
  const [saleEditChequeAmount, setSaleEditChequeAmount] = useState("");
  const [saleEditChequeNo, setSaleEditChequeNo] = useState("");
  const [saleEditChequeDate, setSaleEditChequeDate] = useState("");
  const [saleEditChequeBank, setSaleEditChequeBank] = useState("");
  const [saleEditCustomerCreditAmount, setSaleEditCustomerCreditAmount] = useState("");
  const [saleEditCreditDueDate, setSaleEditCreditDueDate] = useState("");
  const [saleEditError, setSaleEditError] = useState("");
  const [savingSaleEdit, setSavingSaleEdit] = useState(false);
  const saleEditSubTotal = useMemo(
    () => Number(saleEditLines.reduce((acc, line) => acc + (lineFinalPrice(line) * Number(line.quantity || 0)), 0).toFixed(2)),
    [saleEditLines]
  );
  const saleEditNetTotal = useMemo(
    () => Math.max(0, Number((saleEditSubTotal - (Number(saleEditBillDiscount || 0) || 0)).toFixed(2))),
    [saleEditSubTotal, saleEditBillDiscount]
  );
  const saleEditPaidTotal = useMemo(
    () => Number((Number(saleEditCashReceived || 0) + Number(saleEditChequeAmount || 0) + Number(saleEditCustomerCreditAmount || 0)).toFixed(2)),
    [saleEditCashReceived, saleEditChequeAmount, saleEditCustomerCreditAmount]
  );
  const saleEditRemainingBalance = useMemo(
    () => Math.max(0, Number((saleEditNetTotal - saleEditPaidTotal).toFixed(2))),
    [saleEditNetTotal, saleEditPaidTotal]
  );
  const availableProductsForSaleEdit = useMemo(() => {
    return [...(state.products || [])].sort((a, b) => productDisplayName(a).localeCompare(productDisplayName(b)));
  }, [state.products]);
  const saleBeingEdited = useMemo(
    () => (state.sales || []).find((sale) => String(sale.id) === String(editingSaleId)) || null,
    [state.sales, editingSaleId]
  );
  const saleEditCustomerAvailableCredit = useMemo(() => {
    if (!saleBeingEdited?.customerName || saleBeingEdited.customerName === "Walk-in") return 0;
    const key = String(saleBeingEdited.customerName).trim().toLowerCase();
    const openCreditSum = (state.customerCredits || [])
      .filter((entry) => String(entry.customerName || "").trim().toLowerCase() === key && entry.status !== "closed")
      .reduce((sum, entry) => sum + Number(entry.remainingAmount ?? entry.amount ?? 0), 0);
    const existingCreditOnSale = (saleBeingEdited.payments || [])
      .filter((p) => String(p.method || "").toLowerCase() === "customer_credit")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return Number((openCreditSum + existingCreditOnSale).toFixed(2));
  }, [state.customerCredits, saleBeingEdited]);

  const saleEditEditedEmptyBottlesOwed = useMemo(() => {
    if (!saleBeingEdited) return 0;
    const isPendingPreOrder = saleBeingEdited.orderType === "preorder" && saleBeingEdited.stockDecremented === false;
    if (isPendingPreOrder) return 0;
    const productMap = new Map((state.products || []).map((p) => [p.id, p]));
    return saleEditLines.reduce((acc, line) => {
      const p = productMap.get(line.productId);
      const is250ml = String(p?.size || "").includes("250");
      if (!p || p.returnableBottle === false || !is250ml) return acc;
      return acc + Number(line.quantity || 0);
    }, 0);
  }, [saleEditLines, saleBeingEdited, state.products]);

  const saleEditCustomerSalesEmptiesOutstanding = useMemo(() => {
    if (!saleBeingEdited?.customerName) return 0;
    const key = String(saleBeingEdited.customerName).trim().toLowerCase();
    return (state.sales || []).reduce((total, s) => {
      if (String(s.customerName || "").trim().toLowerCase() !== key) return total;
      const owed = String(s.id) === String(editingSaleId) ? saleEditEditedEmptyBottlesOwed : Number(s.emptyBottlesOwed || 0);
      const collected = Number(s.emptyBottlesCollected || 0);
      return total + Math.max(0, owed - collected);
    }, 0);
  }, [state.sales, saleBeingEdited?.customerName, editingSaleId, saleEditEditedEmptyBottlesOwed]);

  const saleEditThisBillEmptiesOutstanding = useMemo(() => {
    if (!saleBeingEdited) return 0;
    const owed = saleEditEditedEmptyBottlesOwed;
    const collected = Number(saleBeingEdited.emptyBottlesCollected || 0);
    return Math.max(0, owed - collected);
  }, [saleBeingEdited, saleEditEditedEmptyBottlesOwed]);

  const addProductToSaleEdit = () => {
    if (!saleEditAddProductId) return;
    const product = (state.products || []).find((p) => String(p.id) === String(saleEditAddProductId));
    if (!product) return;

    const qtyToAdd = Math.max(1, Math.floor(Number(saleEditAddQty || 1)));

    setSaleEditLines((current) => {
      const existingIndex = current.findIndex((l) => String(l.productId) === String(product.id));
      if (existingIndex >= 0) {
        return current.map((l, idx) =>
          idx === existingIndex ? { ...l, quantity: Number(l.quantity || 0) + qtyToAdd } : l
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: productDisplayName(product),
          quantity: qtyToAdd,
          basePrice: productSalePrice(product),
          itemDiscount: 0,
          itemDiscountMode: "amount"
        }
      ];
    });

    setSaleEditAddProductId("");
    setSaleEditAddQty("1");
  };

  const closeSaleEdit = () => {
    setEditingSaleId("");
    setSaleEditPaymentType("credit");
    setSaleEditBillDiscount("");
    setSaleEditLines([]);
    setSaleEditCollectEmptyBottles("");
    setSaleEditAddProductId("");
    setSaleEditAddQty("1");
    setSaleEditCashReceived("");
    setSaleEditChequeAmount("");
    setSaleEditChequeNo("");
    setSaleEditChequeDate("");
    setSaleEditChequeBank("");
    setSaleEditCustomerCreditAmount("");
    setSaleEditCreditDueDate("");
    setSaleEditError("");
  };

  const openSaleEdit = (sale) => {
    const hasReturns = (state.returns || []).some((ret) => String(ret.saleId) === String(sale?.id));
    if (hasReturns) {
      setMessage("This bill cannot be edited after returns have been submitted.");
      return;
    }
    setEditingSaleId(sale.id);
    setSaleEditPaymentType(String(sale.paymentType || "credit"));
    setSaleEditBillDiscount(String(Number(sale.discountAmount ?? sale.discount ?? 0) || 0));
    setSaleEditCollectEmptyBottles("");
    setSaleEditAddProductId("");
    setSaleEditAddQty("1");
    setSaleEditLines((sale.lines || []).map((line) => ({
      productId: line.productId,
      name: line.name,
      quantity: Number(line.quantity || 0),
      basePrice: Number(line.basePrice ?? line.price ?? 0),
      itemDiscount: editableLineDiscountValue(line),
      itemDiscountMode: String(line.itemDiscountMode || "amount")
    })));

    const payments = Array.isArray(sale.payments) ? sale.payments : [];
    const cashP = payments.find((p) => String(p.method || "").toLowerCase() === "cash");
    const chequeP = payments.find((p) => String(p.method || "").toLowerCase() === "cheque");
    const creditP = payments.find((p) => String(p.method || "").toLowerCase() === "customer_credit");

    setSaleEditCashReceived(cashP ? String(cashP.amount || "") : (sale.cashReceived ? String(sale.cashReceived) : ""));
    setSaleEditChequeAmount(chequeP ? String(chequeP.amount || "") : (sale.chequeAmount ? String(sale.chequeAmount) : ""));
    setSaleEditChequeNo(chequeP?.chequeNo || sale.chequeNo || "");
    setSaleEditChequeDate(chequeP?.chequeDate || sale.chequeDate || "");
    setSaleEditChequeBank(chequeP?.chequeBank || sale.chequeBank || "");
    setSaleEditCustomerCreditAmount(creditP ? String(creditP.amount || "") : (sale.customerCreditApplied ? String(sale.customerCreditApplied) : ""));
    setSaleEditCreditDueDate(sale.creditDueDate || "");
    setSaleEditError("");
  };

  const saveSaleEdit = async (shouldPrint = false) => {
    let printWindow = null;
    if (shouldPrint) {
      printWindow = window.open("", "_blank", "width=380,height=640");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write("<!doctype html><html><head><title>Updating Receipt...</title></head><body style='font-family: sans-serif; text-align: center; padding: 40px;'><h3>Updating Bill &amp; Preparing Print...</h3><p>Please wait...</p></body></html>");
        printWindow.document.close();
      }
    }
    try {
      const lines = saleEditLines
        .map((line) => ({
          ...line,
          quantity: Number(line.quantity || 0),
          itemDiscount: Number(line.itemDiscount || 0),
          itemDiscountMode: String(line.itemDiscountMode || "amount"),
          price: lineFinalPrice(line)
        }))
        .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);
      if (!editingSaleId || !lines.length) {
        if (printWindow) printWindow.close();
        setSaleEditError("Keep at least one item in bill.");
        return;
      }
      const billDiscount = Math.max(0, Number(saleEditBillDiscount || 0) || 0);
      if (billDiscount > saleEditSubTotal) {
        if (printWindow) printWindow.close();
        setSaleEditError(`Total bill discount cannot exceed subtotal (${currency(saleEditSubTotal)}).`);
        return;
      }
      const collectEmptyBottlesQty = Math.max(0, Number(saleEditCollectEmptyBottles || 0) || 0);
      if (collectEmptyBottlesQty > saleEditCustomerSalesEmptiesOutstanding) {
        if (printWindow) printWindow.close();
        setSaleEditError(`Cannot collect more empty bottles than total customer sales outstanding (${saleEditCustomerSalesEmptiesOutstanding}).`);
        return;
      }
      const currentSaleBeingEdited = (state.sales || []).find((sale) => String(sale.id) === String(editingSaleId));
      const discountLimit = (state.customers || [])
        .filter((item) => String(item.name || "").trim().toLowerCase() === String(currentSaleBeingEdited?.customerName || "").trim().toLowerCase())
        .reduce((max, item) => Math.max(max, Number(item.discountLimit || 0)), 0);
      const bundleDiscountLimit = (state.customers || [])
        .filter((item) => String(item.name || "").trim().toLowerCase() === String(currentSaleBeingEdited?.customerName || "").trim().toLowerCase())
        .reduce((max, item) => Math.max(max, Number(item.bundleDiscountLimit || 0)), 0);
      const totalDiscount = totalDiscountApplied({ lines, billDiscount });
      if (discountLimit > 0 && totalDiscount > discountLimit) {
        if (printWindow) printWindow.close();
        setSaleEditError(`Customer discount limit is ${currency(discountLimit)}. Current discount is ${currency(totalDiscount)}.`);
        return;
      }
      const bundleDiscountViolation = findBundleDiscountViolation({ lines, bundleDiscountLimit });
      if (bundleDiscountViolation) {
        if (printWindow) printWindow.close();
        setSaleEditError(`${bundleDiscountViolation.lineName} exceeds bundle discount limit. Allowed: ${currency(bundleDiscountViolation.allowedBundleDiscount)} for ${bundleDiscountViolation.fullBundles} bundle(s).`);
        return;
      }

      const cashVal = Math.max(0, Number(saleEditCashReceived || 0));
      const chequeVal = Math.max(0, Number(saleEditChequeAmount || 0));
      const customerCreditVal = Math.max(0, Number(saleEditCustomerCreditAmount || 0));
      const paidTotal = Number((cashVal + chequeVal + customerCreditVal).toFixed(2));
      const netTotal = Math.max(0, Number((saleEditSubTotal - billDiscount).toFixed(2)));

      if (paidTotal > netTotal) {
        if (printWindow) printWindow.close();
        setSaleEditError(`Total payments collected (${currency(paidTotal)}) cannot exceed net bill total (${currency(netTotal)}).`);
        return;
      }
      if (chequeVal > 0) {
        if (!saleEditChequeNo.trim()) {
          if (printWindow) printWindow.close();
          setSaleEditError("Cheque number is required when cheque amount is entered.");
          return;
        }
        if (!saleEditChequeDate.trim()) {
          if (printWindow) printWindow.close();
          setSaleEditError("Cheque date is required when cheque amount is entered.");
          return;
        }
        if (!saleEditChequeBank.trim()) {
          if (printWindow) printWindow.close();
          setSaleEditError("Cheque bank name is required when cheque amount is entered.");
          return;
        }
      }
      if (customerCreditVal > saleEditCustomerAvailableCredit) {
        if (printWindow) printWindow.close();
        setSaleEditError(`Customer credit amount (${currency(customerCreditVal)}) exceeds available credit (${currency(saleEditCustomerAvailableCredit)}).`);
        return;
      }

      let resolvedPaymentType = saleEditPaymentType;
      const paymentMethodsCount = (cashVal > 0 ? 1 : 0) + (chequeVal > 0 ? 1 : 0) + (customerCreditVal > 0 ? 1 : 0);
      if (paymentMethodsCount > 1 || (paidTotal > 0 && paidTotal < netTotal)) {
        resolvedPaymentType = "mixed";
      } else if (cashVal > 0 && cashVal === netTotal) {
        resolvedPaymentType = "cash";
      } else if (chequeVal > 0 && chequeVal === netTotal) {
        resolvedPaymentType = "cheque";
      } else if (customerCreditVal > 0 && customerCreditVal === netTotal) {
        resolvedPaymentType = "credit";
      } else if (paidTotal === 0) {
        resolvedPaymentType = saleEditPaymentType || "credit";
      }

      setSavingSaleEdit(true);
      setSaleEditError("");
      const updatedSale = await patchSale(editingSaleId, {
        lines,
        paymentType: resolvedPaymentType,
        discount: billDiscount,
        collectEmptyBottlesQty,
        cashReceived: cashVal,
        chequeAmount: chequeVal,
        chequeNo: saleEditChequeNo.trim(),
        chequeDate: saleEditChequeDate.trim(),
        chequeBank: saleEditChequeBank.trim(),
        customerCreditAmount: customerCreditVal,
        creditDueDate: saleEditCreditDueDate.trim()
      });

      const freshState = await fetchState();

      const targetSale = (freshState?.sales || state.sales || []).find((s) => String(s.id) === String(editingSaleId)) || updatedSale || currentSaleBeingEdited;

      if (shouldPrint) {
        if (targetSale?.orderType === "preorder") {
          openPreOrderReceiptPrint({
            sale: targetSale,
            customers: freshState?.customers || state.customers || [],
            allSales: freshState?.sales || state.sales || [],
            existingPrintWindow: printWindow,
            onPopupBlocked: () => setSaleEditError("Popup blocked. Please allow popups to print receipts.")
          });
        } else {
          openSaleReceiptPrint({
            sale: targetSale,
            customers: freshState?.customers || state.customers || [],
            products: freshState?.products || state.products || [],
            allSales: freshState?.sales || state.sales || [],
            existingPrintWindow: printWindow,
            onPopupBlocked: () => setSaleEditError("Popup blocked. Please allow popups to print receipts.")
          });
        }
      }

      closeSaleEdit();
      onSuccess?.(`Sale saved successfully.`);
    } catch (error) {
      if (printWindow) printWindow.close();
      setSaleEditError(error.message);
    } finally {
      setSavingSaleEdit(false);
    }
  };

  const saveBillingCustomerDetails = async () => {
    if (!selectedSavedCustomer) return;
    try {
      setSavingCustomerDetails(true);
      await updateCustomer(selectedSavedCustomer.id, {
        name: selectedSavedCustomer.name || customerName.trim(),
        phone: customerPhoneDraft.trim(),
        address: customerAddressDraft.trim()
      });
      setMessage("Customer details updated.");
    } catch (error) {
      setMessage(error.message || "Unable to update customer details.");
    } finally {
      setSavingCustomerDetails(false);
    }
  };
  const repBillingSteps = [
    { key: "customer", label: "Customer", icon: "👤" },
    { key: "items", label: "Items", icon: "📦" },
    { key: "cart", label: "Cart", icon: "🛒" },
    { key: "checkout", label: "Complete", icon: "âœ…" }
  ];
  const repBillingStepIndex = Math.max(0, repBillingSteps.findIndex((step) => step.key === repBillingStep));
  const selectedBundleViolation = findBundleDiscountViolation({ lines: cart, bundleDiscountLimit: selectedCustomerBundleDiscountLimit });

  const deleteRepSale = async (sale) => {
    try {
      const saleCashier = String(sale?.cashier || "").trim().toLowerCase();
      const actingRep = String(cashier || "").trim().toLowerCase();
      const hasDeliveryProcessing = Boolean(sale?.deliveryConfirmedAt) || Boolean((sale?.deliveryAdjustments || []).length) || Boolean(sale?.preOrderConfirmedAt);
      if (!sale || !saleCashier || saleCashier !== actingRep) {
        setMessage("You can delete only your own bills.");
        return;
      }
      if (hasDeliveryProcessing) {
        setMessage("This bill cannot be deleted after delivery processing has started.");
        return;
      }
      const ok = await requestConfirm({
        title: "Delete Sale",
        message: `Are you sure want to delete sale #${sale.id}? All items on this bill will be restocked.`,
        confirmLabel: "Delete",
        tone: "danger"
      });
      if (!ok) return;
      await deleteSale(sale.id);
      onSaleDeleted?.(sale.id);
      if (String(editingSaleId || "") === String(sale.id)) {
        setEditingSaleId("");
        setSaleEditPaymentType("credit");
        setSaleEditLines([]);
        setSaleEditError("");
      }
      setMessage(`Sale #${sale.id} deleted.`);
    } catch (error) {
      setMessage(error.message);
    }
  };
  const billingFocusMode = cashierPage === "billing";

  return (
    <div className="rep-redesign-scope">
      {message && !/(error|invalid|required|cannot|unable|failed|not found|select|enter|type|exceeds)/i.test(String(message)) ? <p className="notice">{message}</p> : null}
      {!billingFocusMode ? (
        <button
          type="button"
          className={`cashier-mobile-nav-toggle menu-toggle-btn ${mobileCashierNavOpen ? "open" : ""}`}
          onClick={() => setMobileCashierNavOpen((current) => !current)}
          aria-expanded={mobileCashierNavOpen}
          aria-controls="cashier-sidebar-nav"
          aria-label={mobileCashierNavOpen ? "Close menu" : "Open menu"}
        >
          <span className="menu-toggle-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="menu-toggle-label">{mobileCashierNavOpen ? "Close" : "Menu"}</span>
        </button>
      ) : null}
      {mobileCashierNavOpen ? (
        <button
          type="button"
          className="cashier-mobile-nav-backdrop"
          onClick={() => setMobileCashierNavOpen(false)}
          aria-label="Close menu"
        />
      ) : null}
      <aside id="cashier-sidebar-nav" className={`cashier-mobile-sidebar ${mobileCashierNavOpen ? "open" : ""} ${billingFocusMode ? "billing-focus-mode" : ""}`}>
        <button type="button" className={`cashier-nav-billing ${cashierPage === "billing" ? "active" : ""}`} onClick={() => setCashierPage("billing")}><span className="nav-emoji" aria-hidden="true">🛒</span>Billing</button>
        <button type="button" className={`cashier-nav-returns ${cashierPage === "returns" ? "active" : ""}`} onClick={() => setCashierPage("returns")}><span className="nav-emoji" aria-hidden="true">↩️</span>Returns</button>
        <button type="button" className={`cashier-nav-preorders ${cashierPage === "deliverPreorders" ? "active" : ""}`} onClick={() => setCashierPage("deliverPreorders")}><span className="nav-emoji" aria-hidden="true">🚚</span>Deliver Pre-Orders</button>
        <button type="button" className={`cashier-nav-empty-bottles ${cashierPage === "emptyBottles" ? "active" : ""}`} onClick={() => setCashierPage("emptyBottles")}><span className="nav-emoji" aria-hidden="true">🍾</span>Empty Bottles</button>
        <button type="button" className={`cashier-nav-sales ${cashierPage === "sales" ? "active" : ""}`} onClick={() => setCashierPage("sales")}><span className="nav-emoji" aria-hidden="true">📊</span>Sales</button>
        <button type="button" className={`cashier-nav-stock ${cashierPage === "stock" ? "active" : ""}`} onClick={() => setCashierPage("stock")}><span className="nav-emoji" aria-hidden="true">📦</span>Stock</button>
        <button type="button" className={`cashier-nav-customers ${cashierPage === "customers" ? "active" : ""}`} onClick={() => setCashierPage("customers")}><span className="nav-emoji" aria-hidden="true">👥</span>Customers</button>
        <button type="button" className={`cashier-nav-deliveries ${cashierPage === "deliveries" ? "active" : ""}`} onClick={() => setCashierPage("deliveries")}><span className="nav-emoji" aria-hidden="true">✅</span>Confirm Deliveries</button>
        <button type="button" className={`cashier-nav-loading ${cashierPage === "loadingSheet" ? "active" : ""}`} onClick={() => setCashierPage("loadingSheet")}><span className="nav-emoji" aria-hidden="true">📋</span>Loading Sheet</button>
        <button type="button" className="cashier-sidebar-logout" onClick={onLogout}><span className="nav-emoji" aria-hidden="true">🚪</span>Log Out</button>
        <div className="side-menu-footer">
          <a href="https://www.jnco.tech" target="_blank" rel="noreferrer">
            <img src="/powered.png" alt="Powered by" />
          </a>
        </div>
      </aside>
      <div className={`cashier-tabs ${billingFocusMode ? "billing-focus-mode" : ""}`}>
        <button type="button" className={`cashier-nav-billing ${cashierPage === "billing" ? "active" : ""}`} onClick={() => setCashierPage("billing")}><span className="nav-emoji" aria-hidden="true">🛒</span>Billing</button>
        <button type="button" className={`cashier-nav-returns ${cashierPage === "returns" ? "active" : ""}`} onClick={() => setCashierPage("returns")}><span className="nav-emoji" aria-hidden="true">↩️</span>Returns</button>
        <button type="button" className={`cashier-nav-preorders ${cashierPage === "deliverPreorders" ? "active" : ""}`} onClick={() => setCashierPage("deliverPreorders")}><span className="nav-emoji" aria-hidden="true">🚚</span>Deliver Pre-Orders</button>
        <button type="button" className={`cashier-nav-empty-bottles ${cashierPage === "emptyBottles" ? "active" : ""}`} onClick={() => setCashierPage("emptyBottles")}><span className="nav-emoji" aria-hidden="true">🍾</span>Empty Bottles</button>
        <button type="button" className={`cashier-nav-sales ${cashierPage === "sales" ? "active" : ""}`} onClick={() => setCashierPage("sales")}><span className="nav-emoji" aria-hidden="true">📊</span>Sales</button>
        <button type="button" className={`cashier-nav-stock ${cashierPage === "stock" ? "active" : ""}`} onClick={() => setCashierPage("stock")}><span className="nav-emoji" aria-hidden="true">📦</span>Stock</button>
        <button type="button" className={`cashier-nav-customers ${cashierPage === "customers" ? "active" : ""}`} onClick={() => setCashierPage("customers")}><span className="nav-emoji" aria-hidden="true">👥</span>Customers</button>
        <button type="button" className={`cashier-nav-deliveries ${cashierPage === "deliveries" ? "active" : ""}`} onClick={() => setCashierPage("deliveries")}><span className="nav-emoji" aria-hidden="true">✅</span>Confirm Deliveries</button>
        <button type="button" className={`cashier-nav-loading ${cashierPage === "loadingSheet" ? "active" : ""}`} onClick={() => setCashierPage("loadingSheet")}><span className="nav-emoji" aria-hidden="true">📋</span>Loading Sheet</button>
      </div>

      {cashierPage === "billing" ? (
        <main className="grid rep-billing-wizard rep-ui-2">
          <section className="panel rep-wizard-shell">
            <div className="rep-wizard-top-actions-row">
              <button
                type="button"
                className={`cashier-mobile-nav-toggle menu-toggle-btn billing-focus-mode in-card ${mobileCashierNavOpen ? "open" : ""}`}
                onClick={() => setMobileCashierNavOpen((current) => !current)}
                aria-expanded={mobileCashierNavOpen}
                aria-controls="cashier-sidebar-nav"
                aria-label={mobileCashierNavOpen ? "Close menu" : "Open menu"}
              >
                <span className="menu-toggle-icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="menu-toggle-label">{mobileCashierNavOpen ? "Close" : "Menu"}</span>
              </button>
            </div>
            <div className="rep-wizard-head">
              <div>
                <p className="rep-wizard-eyebrow">Rep Billing</p>
                <h2>{repBillingSteps[repBillingStepIndex]?.label || "Billing"}</h2>
                <p className="form-hint">One focused step at a time for easier mobile billing.</p>
              </div>
              <div className="rep-wizard-meta">
                <span>{cart.length} item(s)</span>
                <strong>{currency(totalAfterCustomerCredit)}</strong>
              </div>
            </div>

            <div className="rep-mode-toggle" role="group" aria-label="Billing mode">
              <button
                type="button"
                className={`rep-mode-toggle-btn ${!isPreOrderMode ? "active" : ""}`}
                onClick={() => setIsPreOrderMode(false)}
                disabled={cart.length > 0}
              >
                Billing
              </button>
              <button
                type="button"
                className={`rep-mode-toggle-btn ${isPreOrderMode ? "active" : ""}`}
                onClick={() => setIsPreOrderMode(true)}
                disabled={cart.length > 0}
              >
                Pre-Order
              </button>
            </div>
            {isPreOrderMode ? (
              <p className="form-hint rep-mode-toggle-hint">Pre-order mode: stock is reserved, not deducted, until the order is delivered and confirmed.</p>
            ) : null}

            <div className="rep-wizard-progress">
              {repBillingSteps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  className={`rep-wizard-step ${repBillingStep === step.key ? "active" : ""} ${index < repBillingStepIndex ? "done" : ""}`}
                  onClick={() => {
                    if (step.key === "items" && !selectedSavedCustomer) return;
                    if (step.key === "cart" && !cart.length) return;
                    if (step.key === "checkout" && !cart.length) return;
                    setRepBillingStep(step.key);
                  }}
                >
                  <span>{step.icon || (index + 1)}</span>
                  <strong>{step.label}</strong>
                </button>
              ))}
            </div>

            <div className="rep-wizard-body">
              {repBillingStep === "customer" ? (
                <section className="rep-step-screen rep-step-customer">
                  <div className="rep-step-card rep-step-card-primary">
                    <h3>Select Customer</h3>
                    <p className="form-hint">Open a full-screen picker to search and select the customer.</p>
                    <button type="button" className="rep-picker-launch" onClick={() => setShowCustomerPicker(true)}>
                      <span>{customerName.trim() || "Select Customer"}</span>
                      <strong>Open</strong>
                    </button>
                    {customerName.trim() ? (
                      <div className="rep-customer-focus-card rep-customer-focus-inline">
                        <strong>{customerName}</strong>
                        {selectedSavedCustomer ? (
                          <>
                            {selectedSavedCustomer?.route ? <p>Route: {selectedSavedCustomer.route}</p> : null}
                            <p>Outstanding: {currency(selectedCustomerOutstanding)}</p>
                            {selectedCustomerCreditLimit > 0 ? <p>Credit Limit: {currency(selectedCustomerCreditLimit)}</p> : null}
                            {selectedCustomerDiscountLimit > 0 ? <p>Discount Limit: {currency(selectedCustomerDiscountLimit)}</p> : null}
                            {selectedCustomerBundleDiscountLimit > 0 ? <p>Bundle Limit: {currency(selectedCustomerBundleDiscountLimit)} per bundle</p> : null}
                            {selectedSavedCustomer?.phone ? <p>Phone: {selectedSavedCustomer.phone}</p> : null}
                            {(!selectedSavedCustomer.phone || !selectedSavedCustomer.address) && (
                              <div className="rep-incomplete-warning-card">
                                <p className="rep-incomplete-warning-title">
                                  <span className="warning-icon">âš ï¸</span> Incomplete Details
                                </p>
                                <p className="rep-incomplete-warning-subtitle">Please fill in the missing customer details.</p>
                                <div className="rep-incomplete-warning-form">
                                  <input 
                                    className="rep-incomplete-warning-input"
                                    value={customerPhoneDraft} 
                                    onChange={e => setCustomerPhoneDraft(e.target.value)} 
                                    placeholder="Mobile Number" 
                                  />
                                  <input 
                                    className="rep-incomplete-warning-input"
                                    value={customerAddressDraft} 
                                    onChange={e => setCustomerAddressDraft(e.target.value)} 
                                    placeholder="Address" 
                                  />
                                  <button 
                                    type="button" 
                                    className="rep-incomplete-warning-button"
                                    onClick={saveBillingCustomerDetails} 
                                    disabled={savingCustomerDetails} 
                                  >
                                    {savingCustomerDetails ? 'Saving...' : 'Update Details'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="outstanding-text">Select an existing saved customer from the list.</p>
                        )}
                      </div>
                    ) : (
                      <p className="form-hint">No customer selected yet.</p>
                    )}
                  </div>
                </section>
              ) : null}

              {repBillingStep === "items" ? (
                <section className="rep-step-screen rep-step-items">
                  <div className="rep-step-card rep-step-card-primary">
                    <div className="rep-size-layout-head">
                      <h3>SELECT ITEMS</h3>
                      <div className="rep-step-chip">{currentCartQty} units in cart</div>
                    </div>
                                        <input
                      className="search-icon-input rep-step-input rep-size-search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && search.trim() !== '') {
                          e.preventDefault();
                          if (filteredProducts.length === 1) {
                            addToCartWithQty(filteredProducts[0], 1);
                            setSearch("");
                            // Visual feedback
                            const input = e.target;
                            input.style.background = "#dcfce7";
                            setTimeout(() => { input.style.background = ""; }, 200);
                          } else {
                            // If multiple or none, just let the user see the filtered list.
                          }
                        }
                      }}
                      placeholder="Search product / sku (Press Enter to quick-add)"
                    />
                    <div className="rep-size-grid">
                      {itemSizeGroups.length ? itemSizeGroups.map((group) => (
                        <button
                          key={group.label}
                          type="button"
                          className="rep-size-tile"
                          onClick={() => {
                            setActiveItemSize(group.label);
                            setSizeProductSearch("");
                            setShowItemSizePicker(true);
                          }}
                        >
                          <strong>{group.label}</strong>
                          <span>Available size</span>
                        </button>
                      )) : (
                        <p className="form-hint">No matching sizes found.</p>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}

              {repBillingStep === "cart" ? (
                <div className="modern-cart-wrapper">
                  <header className="mc-header">
                    <button className="mc-btn-back" onClick={() => setRepBillingStep("items")} aria-label="Back">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <h2>SHOPPING CART</h2>
                    {showPostSaleHomeButton && !cart.length ? (
                      <button
                        className="mc-btn-home"
                        type="button"
                        onClick={() => {
                          setRepBillingStep("customer");
                          setShowPostSaleHomeButton(false);
                        }}
                        aria-label="Go to customer step"
                      >
                        Home
                      </button>
                    ) : (
                      <button className="mc-btn-dots" onClick={() => setShowCartPopup(true)} aria-label="Edit Quantities">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
                      </button>
                    )}
                  </header>

                  <div className="mc-items-list">
                    {cart.map((line) => (
                      <article className="mc-item-card" key={`mc-${line.productId}`}>
                        <div className="mc-item-img">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        </div>
                        <div className="mc-item-content">
                          <div className="mc-item-row1">
                            <strong className="mc-item-name">{line.name}</strong>
                            <span className="mc-qty-text">Ã—{line.quantity}</span>
                          </div>
                          <div className="mc-item-row2">
                            <span className="mc-price-pill">{currency(lineFinalPrice(line))}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={(e) => e.stopPropagation()}>
                              <span>Rs.</span>
                              <input
                                type="number"
                                className="mc-price-input"
                                style={{ width: '4rem', padding: '2px 6px', fontSize: '0.85rem', border: '1px solid #93c5fd', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e3a8a', fontWeight: '600', outline: 'none' }}
                                min="0"
                                step="0.01"
                                value={line.priceDraft ?? line.price}
                                onChange={(e) => updateItemCustomPrice(line.productId, e.target.value)}
                                placeholder="Price"
                              />
                              <span>each</span>
                            </div>
                          </div>
                        </div>
                        <div className="mc-item-disc-row" onClick={(e) => e.stopPropagation()}>
                          <select
                            className="mc-disc-mode"
                            value={line.itemDiscountMode || "amount"}
                            onChange={(e) => updateItemDiscountMode(line.productId, e.target.value)}
                          >
                            <option value="amount">Rs.</option>
                            <option value="percent">%</option>
                          </select>
                          <input
                            className="mc-disc-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.itemDiscount ?? 0}
                            onChange={(e) => updateItemDiscount(line.productId, e.target.value)}
                            placeholder="Item discount"
                          />
                          {lineItemDiscount(line) > 0 && (
                            <span className="mc-disc-badge">-{currency(lineItemDiscount(line))}</span>
                          )}
                        </div>
                      </article>
                    ))}
                    {cart.length === 0 ? <p className="form-hint" style={{ textAlign: 'center', marginTop: '2rem' }}>Cart is empty.</p> : null}
                  </div>

                  {cart.length > 0 && (
                    <div className="mc-order-summary">
                      <div className="mc-summary-head">
                        <h3>ORDER SUMMARY</h3>
                        <span className="mc-summary-date">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>

                      <div className="mc-summary-data">
                        <div className="mc-data-row"><span>Sub Total</span><strong>{currency(totals.subTotal)}</strong></div>
                        <div className="mc-data-row"><span>Item Discounts</span><strong>-{currency(cartDiscountTotal)}</strong></div>

                        <div className="mc-disc-bill-row">
                          <label className="mc-disc-label">Bill Discount</label>
                          <div className="mc-disc-bill-inputs">
                            <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value)}>
                              <option value="amount">Rs.</option>
                              <option value="percent">%</option>
                            </select>
                            <input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
                          </div>
                          {totals.discountAmount > 0 && <span className="mc-data-row"><span>Applied</span><strong>-{currency(totals.discountAmount)}</strong></span>}
                        </div>

                        <div className="mc-summary-divider"></div>
                        <div className="mc-data-row mc-data-total"><span>Total</span><strong>{currency(totals.total)}</strong></div>
                      </div>

                      {/* â”€â”€ REVIEW SECTION â”€â”€ */}
                      <div className="mc-review-section">
                        <h4 className="mc-review-title">Review &amp; Confirm</h4>
                        <div className="mc-review-grid">
                          <article><span>Customer</span><strong>{customerName || "—"}</strong></article>
                          <article><span>Items</span><strong>{cart.length} ({currentCartQty} units)</strong></article>
                          {(() => {
                            let currentEmptyOwed = 0;
                            if (Array.isArray(cart)) {
                              for (const line of cart) {
                                const product = (state.products || []).find((p) => p.id === line.productId);
                                const is250ml = String(product?.size || "").includes("250");
                                if (product && product.returnableBottle !== false && is250ml) {
                                  currentEmptyOwed += Number(line.quantity || 1);
                                }
                              }
                            }
                            let customerEmptyOwed = 0;
                            let customerEmptyCollected = 0;
                            if (state?.sales && Array.isArray(state.sales) && customerName && customerName !== "Walk-in") {
                              for (const s of state.sales) {
                                if (String(s?.customerName || "").trim().toLowerCase() === customerName.trim().toLowerCase()) {
                                  customerEmptyOwed += Number(s.emptyBottlesOwed || 0);
                                  customerEmptyCollected += Number(s.emptyBottlesCollected || 0);
                                }
                              }
                            }
                            const totalEmptiesToCollect = currentEmptyOwed + Math.max(0, customerEmptyOwed - customerEmptyCollected);
                            return totalEmptiesToCollect > 0 ? (
                              <article><span>Empties</span><strong>{totalEmptiesToCollect} to collect</strong></article>
                            ) : null;
                          })()}
                        </div>
                        {customerName.trim() && selectedCustomerOutstanding > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <p className="mc-review-warn" style={{ margin: 0 }}>Outstanding: {currency(selectedCustomerOutstanding)}</p>
                            {showQuickPayOutstanding ? (
                              <div className="mc-disc-bill-inputs">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={quickPayOutstandingDraft}
                                  onChange={(e) => setQuickPayOutstandingDraft(e.target.value)}
                                  placeholder="Payment amount"
                                />
                                <button type="button" className="ghost" onClick={submitQuickPayOutstanding} disabled={savingQuickPayOutstanding}>
                                  {savingQuickPayOutstanding ? "Paying..." : "Confirm"}
                                </button>
                                <button type="button" className="ghost" onClick={() => setShowQuickPayOutstanding(false)} disabled={savingQuickPayOutstanding}>Cancel</button>
                              </div>
                            ) : (
                              <button type="button" className="ghost" onClick={() => { setQuickPayOutstandingDraft(String(selectedCustomerOutstanding)); setShowQuickPayOutstanding(true); }} style={{ alignSelf: "flex-start", padding: "0.25rem 0.5rem", fontSize: "0.85rem", border: "1px solid currentColor", borderRadius: "4px" }}>
                                Quick Pay Outstanding
                              </button>
                            )}
                          </div>
                        ) : null}
                        {selectedBundleViolation ? (
                          <p className="mc-review-warn">{selectedBundleViolation.lineName} exceeds bundle discount limit.</p>
                        ) : null}
                        {customerName.trim() && selectedCustomerAvailableCredit > 0 ? (
                          <div className="mc-review-credit">
                            <label>Apply Credit (avail. {currency(selectedCustomerAvailableCredit)})</label>
                            <div className="mc-disc-bill-inputs">
                              <input type="number" min="0" step="0.01" value={customerCreditDraft} onChange={(e) => setCustomerCreditDraft(e.target.value)} placeholder="Credit amount" />
                              <button type="button" className="ghost" onClick={() => setCustomerCreditDraft(String(selectedCustomerAvailableCredit))}>Max</button>
                            </div>
                            {appliedCustomerCredit > 0 ? <p className="mc-review-hint">Payable: {currency(totalAfterCustomerCredit)}</p> : null}
                          </div>
                        ) : null}
                        {customerName.trim() && checkoutTotalEmptiesOutstanding > 0 ? (
                          <div className="mc-review-credit">
                            <label>Collect Empties (Outstanding: {checkoutTotalEmptiesOutstanding})</label>
                            <div className="mc-disc-bill-inputs">
                              <input
                                type="number"
                                min="0"
                                max={checkoutTotalEmptiesOutstanding}
                                value={checkoutEmptyBottlesCollected}
                                onChange={(e) => setCheckoutEmptyBottlesCollected(e.target.value)}
                                placeholder="Qty"
                              />
                              <button type="button" className="ghost" onClick={() => setCheckoutEmptyBottlesCollected(String(checkoutTotalEmptiesOutstanding))}>Max</button>
                            </div>
                          </div>
                        ) : null}
                        <label className="mc-review-label">Delivery Route</label>
                        <select className="mc-review-select" value={lorry} onChange={(e) => setLorry(e.target.value)}>
                          <option value="">Select delivery lorry</option>
                          {lorryLoadRows.map((row) => {
                            const remaining = Math.max(0, LORRY_CAPACITY - row.load);
                            const full = !row.isOverflow && remaining <= 0;
                            return (
                              <option key={row.name} value={row.name} disabled={full}>
                                {row.isOverflow ? `${row.name} - Overflow` : (full ? `${row.name} - Full` : `${row.name} - ${remaining} left`)}
                              </option>
                            );
                          })}
                        </select>
                        <label className="mc-review-label">Payment Type</label>
                        <select className="mc-review-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                          {PAYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div className="mc-footer-bar">
                      <div className="mc-footer-total">
                        <span>Total Checkout</span>
                        <strong>{currency(appliedCustomerCredit > 0 ? totalAfterCustomerCredit : totals.total)}</strong>
                      </div>
                      <button className="mc-checkout-button" onClick={checkout} disabled={savingCheckout}>
                        {savingCheckout ? "Processing..." : "Checkout"}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}


              {repBillingStep === "checkout" ? (
                <section className="rep-step-screen rep-step-checkout">
                  <div className="rep-step-card rep-step-card-primary">
                    <h3>Review & Complete</h3>
                    <div className="rep-checkout-review-grid">
                      <article>
                        <span>Customer</span>
                        <strong>{customerName || "-"}</strong>
                      </article>
                      <article>
                        <span>Items</span>
                        <strong>{cart.length}</strong>
                      </article>
                      <article>
                        <span>Units</span>
                        <strong>{currentCartQty}</strong>
                      </article>
                      <article>
                        <span>Payable</span>
                        <strong>{currency(totalAfterCustomerCredit)}</strong>
                      </article>
                    </div>
                    <div className="form-grid rep-checkout-form rep-checkout-form-steps">
                      <p className="form-hint">Cashier: {cashier || "-"}</p>
                      {customerName.trim() ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <p className="form-hint outstanding-text" style={{ margin: 0 }}>Outstanding: {currency(selectedCustomerOutstanding)}</p>
                          {selectedCustomerOutstanding > 0 ? (
                            showQuickPayOutstanding ? (
                              <div className="checkout-inline-action">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={quickPayOutstandingDraft}
                                  onChange={(e) => setQuickPayOutstandingDraft(e.target.value)}
                                  placeholder="Payment amount"
                                />
                                <button type="button" className="ghost" onClick={submitQuickPayOutstanding} disabled={savingQuickPayOutstanding}>
                                  {savingQuickPayOutstanding ? "Paying..." : "Confirm"}
                                </button>
                                <button type="button" className="ghost" onClick={() => setShowQuickPayOutstanding(false)} disabled={savingQuickPayOutstanding}>Cancel</button>
                              </div>
                            ) : (
                              <button type="button" className="ghost" onClick={() => { setQuickPayOutstandingDraft(String(selectedCustomerOutstanding)); setShowQuickPayOutstanding(true); }} style={{ alignSelf: "flex-start", padding: "0.25rem 0.5rem", fontSize: "0.85rem", border: "1px solid currentColor", borderRadius: "4px" }}>
                                Quick Pay Outstanding
                              </button>
                            )
                          ) : null}
                        </div>
                      ) : null}
                      {customerName.trim() && selectedCustomerCreditLimit > 0 ? <p className="form-hint">Credit Limit: {currency(selectedCustomerCreditLimit)}</p> : null}
                      {customerName.trim() && selectedCustomerDiscountLimit > 0 ? <p className="form-hint">Discount Limit: {currency(selectedCustomerDiscountLimit)}</p> : null}
                      {customerName.trim() && selectedCustomerBundleDiscountLimit > 0 ? <p className="form-hint">Bundle Discount Limit: {currency(selectedCustomerBundleDiscountLimit)} per bundle</p> : null}
                      {customerName.trim() && selectedCustomerDiscountLimit > 0 && cartDiscountTotal > selectedCustomerDiscountLimit ? (
                        <p className="form-hint outstanding-text">Current discount {currency(cartDiscountTotal)} exceeds allowed limit.</p>
                      ) : null}
                      {selectedBundleViolation ? (
                        <p className="form-hint outstanding-text">
                          {selectedBundleViolation.lineName} exceeds bundle discount limit. Allowed {currency(selectedBundleViolation.allowedBundleDiscount)} for {selectedBundleViolation.fullBundles} bundle(s).
                        </p>
                      ) : null}
                      {customerName.trim() && selectedCustomerAvailableCredit > 0 ? (
                        <>
                          <p className="form-hint">Available Credit: {currency(selectedCustomerAvailableCredit)}</p>
                          <label className="form-hint">Apply Customer Credit</label>
                          <div className="checkout-inline-action">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={customerCreditDraft}
                              onChange={(e) => setCustomerCreditDraft(e.target.value)}
                              placeholder="Customer credit amount"
                            />
                            <button type="button" className="ghost" onClick={() => setCustomerCreditDraft(String(selectedCustomerAvailableCredit))}>
                              Use Full
                            </button>
                          </div>
                          {appliedCustomerCredit > 0 ? <p className="form-hint">Credit applied: {currency(appliedCustomerCredit)} • Payable now: {currency(totalAfterCustomerCredit)}</p> : null}
                        </>
                      ) : null}
                      {selectedSavedCustomer ? (
                        <>
                          <label className="form-hint">Customer Tel</label>
                          <div className="checkout-inline-action">
                            <input
                              value={customerPhoneDraft}
                              onChange={(e) => setCustomerPhoneDraft(e.target.value)}
                              placeholder="Customer phone"
                            />
                            <button type="button" className="ghost" onClick={saveBillingCustomerDetails} disabled={savingCustomerDetails}>
                              {savingCustomerDetails ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </>
                      ) : null}
                      {customerName.trim() && checkoutTotalEmptiesOutstanding > 0 ? (
                        <>
                          <label className="form-hint">Collect Empty Bottles (Outstanding: {checkoutTotalEmptiesOutstanding})</label>
                          <div className="checkout-inline-action">
                            <input
                              type="number"
                              min="0"
                              max={checkoutTotalEmptiesOutstanding}
                              value={checkoutEmptyBottlesCollected}
                              onChange={(e) => setCheckoutEmptyBottlesCollected(e.target.value)}
                              placeholder="Quantity collected"
                            />
                            <button type="button" className="ghost" onClick={() => setCheckoutEmptyBottlesCollected(String(checkoutTotalEmptiesOutstanding))}>
                              Collect All
                            </button>
                          </div>
                        </>
                      ) : null}
                      <label className="form-hint">Bill Discount Applied in Cart</label>
                      <select value={lorry} onChange={(e) => setLorry(e.target.value)}>
                        <option value="">Select delivery lorry</option>
                        {lorryLoadRows.map((row) => {
                          const remaining = Math.max(0, LORRY_CAPACITY - row.load);
                          const full = !row.isOverflow && remaining <= 0;
                          return (
                            <option key={row.name} value={row.name} disabled={full}>
                              {row.isOverflow
                                ? `${row.name} - Overflow bucket`
                                : (full ? `${row.name} - Lorry is full` : `${row.name} - ${remaining} left`)}
                            </option>
                          );
                        })}
                      </select>
                      <div className="form-hint lorry-capacity-note">
                        {lorryLoadRows.map((row) => {
                          const remaining = Math.max(0, LORRY_CAPACITY - row.load);
                          return (
                            <span key={row.name} className={!row.isOverflow && remaining <= 0 ? "outstanding-text" : ""}>
                              {row.isOverflow
                                ? `${row.name}: ${row.load} queued`
                                : `${row.name}: ${row.load}/${LORRY_CAPACITY} ${remaining <= 0 ? "• Lorry is full" : `• ${remaining} left`}`}
                            </span>
                          );
                        })}
                      </div>
                      <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                        {PAYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <p className="form-hint">Payment will be collected and confirmed at delivery.</p>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            {repBillingStep !== "cart" ? (
              <div className="rep-wizard-footer">
                <div className="rep-wizard-footer-copy">
                  <strong>{repBillingSteps[repBillingStepIndex]?.label}</strong>
                  <p>{customerName ? `${customerName} • ${cart.length} item(s)` : "Follow each step to finish the bill."}</p>
                </div>
                <div className="rep-wizard-footer-actions">
                  {repBillingStep !== "customer" ? (
                    <button
                      type="button"
                      className="ghost rep-nav-circle rep-nav-circle-back"
                      onClick={() => setRepBillingStep(repBillingSteps[Math.max(0, repBillingStepIndex - 1)].key)}
                      aria-label="Back"
                    >
                      <span className="rep-nav-action-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></span>
                    </button>
                  ) : (
                    <span className="rep-nav-placeholder" aria-hidden="true" />
                  )}

                  {repBillingStep === "customer" ? (
                    <button type="button" className="rep-nav-circle rep-nav-circle-next" aria-label="Next" onClick={() => setRepBillingStep("items")} disabled={!selectedSavedCustomer}>
                      <span className="rep-nav-action-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></span>
                    </button>
                  ) : null}
                  {repBillingStep === "items" ? (
                    <button type="button" className="rep-nav-circle rep-nav-circle-next" aria-label="Next" onClick={() => setRepBillingStep("cart")} disabled={!cart.length}>
                      <span className="rep-nav-action-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg></span>
                    </button>
                  ) : null}
                  {repBillingStep === "checkout" ? (
                    <button className="checkout rep-nav-action rep-nav-action-complete" type="button" onClick={checkout} disabled={!cart.length || savingCheckout}>
                      <span>{savingCheckout ? "Wait..." : "Done"}</span>
                      <span className="rep-nav-action-icon" aria-hidden="true">âœ“</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
          {cart.length && repBillingStep !== "cart" ? (
            <button type="button" className="rep-cart-fab" onClick={() => setShowCartPopup(true)} aria-label="Open cart">
              <span>{cart.length}</span>
              Cart
            </button>
          ) : null}
        </main>
      ) : null}
      {cashierPage === "returns" ? (
        <main className="grid">
          <section className="panel">
            <h2>Returns</h2>
            <div className="form-grid">
              <p className="form-hint">Rep: {cashier || "-"}</p>
              <input
                value={returnCustomerName}
                onChange={(e) => {
                  setReturnCustomerName(e.target.value);
                  setShowReturnCustomerSuggestions(true);
                  setReturnSaleId("");
                  setReturnLinesDraft({});
                  setReturnError("");
                }}
                onFocus={() => setShowReturnCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowReturnCustomerSuggestions(false), 120)}
                placeholder="Type customer name"
              />
              {showReturnCustomerSuggestions && filteredReturnCustomerOptions.length ? (
                <div className="customer-suggestions">
                  {filteredReturnCustomerOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setReturnCustomerName(name);
                        setShowReturnCustomerSuggestions(false);
                        setReturnSaleId("");
                        setReturnLinesDraft({});
                        setReturnError("");
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
              <select
                value={returnSaleId}
                onChange={(e) => { setReturnSaleId(e.target.value); setReturnLinesDraft({}); setReturnError(""); }}
                disabled={!returnCustomerName.trim()}
              >
                <option value="">{returnCustomerName.trim() ? "Select bill (Sale ID)" : "Select customer first"}</option>
                {returnSalesForCustomer.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    #{sale.id} • {new Date(sale.createdAt).toLocaleDateString()} • {currency(saleNetTotal(sale))}
                  </option>
                ))}
              </select>
              <input value={returnSaleId} onChange={(e) => { setReturnSaleId(e.target.value); setReturnLinesDraft({}); setReturnError(""); }} placeholder="Enter Sale ID (e.g. 00001)" />
            </div>
            {!returnSaleId ? <p className="form-hint">Select customer then bill, or type Sale ID manually to load bill items.</p> : null}
            {returnSaleId && !returnSale ? <p className="form-hint">Sale not found.</p> : null}
            {returnSale ? (
              <>
                <article className="list-row">
                  <div>
                    <strong>Sale #{returnSale.id}</strong>
                    <p>{new Date(returnSale.createdAt).toLocaleString()}</p>
                    <p>{returnSale.customerName} • {returnSale.lorry || "-"}</p>
                  </div>
                  <strong>{currency(saleNetTotal(returnSale))}</strong>
                </article>
                <div className="return-draft-summary">
                  <article>
                    <span>Selected Qty</span>
                    <strong>{returnDraftSummary.qty}</strong>
                  </article>
                  <article>
                    <span>Good Returns</span>
                    <strong>{returnDraftSummary.goodQty}</strong>
                  </article>
                  <article>
                    <span>Damaged Returns</span>
                    <strong>{returnDraftSummary.damagedQty}</strong>
                  </article>
                  <article className="return-draft-summary-amount">
                    <span>Return Credit</span>
                    <strong>{currency(returnDraftSummary.amount)}</strong>
                  </article>
                </div>
                <div className="list">
                  {(returnSale.lines || []).map((line) => {
                    const sold = Number(line.quantity || 0);
                    const returned = Number(returnedQtyByProduct.get(line.productId) || 0);
                    const alreadyNotDelivered = Number(
                      (returnSale.deliveryAdjustments || []).reduce((acc, adjustment) => (
                        acc + (adjustment.lines || [])
                          .filter((item) => String(item.productId) === String(line.productId))
                          .reduce((lineAcc, item) => lineAcc + Number(item.quantity || 0), 0)
                      ), 0)
                    );
                    const soldEffective = Math.max(0, sold - alreadyNotDelivered);
                    const draft = returnLinesDraft[line.productId] || { quantity: "", condition: "damaged" };
                    const draftQty = Number(draft.quantity || 0);
                    const remainingBeforeDraft = Math.max(0, sold - returned - alreadyNotDelivered);
                    const remainingLive = Math.max(0, sold - returned - alreadyNotDelivered - (Number.isFinite(draftQty) ? draftQty : 0));
                    const preview = returnLinePreview(returnSale, line, Number.isFinite(draftQty) ? draftQty : 0);
                    const lineHasItemDiscount = Number(lineItemDiscount(line) || 0) > 0;
                    const lineHasBillDiscount = Number(returnSale.discountAmount || returnSale.discount || 0) > 0;
                    return (
                      <article key={line.productId} className="list-row return-line-card">
                        <div className="return-line-main">
                          <strong>{line.name}</strong>
                          <p>Ordered {sold} • Not Delivered {alreadyNotDelivered} • Sold {soldEffective} • Returned {returned} • Remaining {remainingLive}</p>
                          <p>Sold unit value {currency(line.price || 0)}</p>
                          {draftQty > 0 ? (
                            <p className="return-line-discount-note">
                              Proportional bill discount {currency(preview.billDiscountShare || 0)}
                            </p>
                          ) : null}
                          {lineHasItemDiscount || lineHasBillDiscount ? (
                            <p className="return-line-discount-note">
                              {lineHasItemDiscount ? `Item discount applied${lineHasBillDiscount ? " • " : ""}` : ""}
                              {lineHasBillDiscount ? "Bill discount shared proportionally" : ""}
                            </p>
                          ) : null}
                          {draftQty > 0 ? (
                            <p className="return-line-credit">
                              Replacement issued from stock (No financial credit)
                            </p>
                          ) : null}
                        </div>
                        <div className="return-line-controls">
                          <input type="number" min="0" max={remainingBeforeDraft} value={draft.quantity} onChange={(e) => onReturnDraftChange(line.productId, { quantity: e.target.value })} placeholder="Qty" />
                        </div>
                      </article>
                    );
                  })}
                </div>
                {returnError ? <p className="form-hint">{returnError}</p> : null}
                <button type="button" onClick={submitReturnFromSale} disabled={savingReturn}>{savingReturn ? "Saving Return..." : "Submit Return"}</button>
              </>
            ) : null}
          </section>
        </main>
      ) : null}

      {cashierPage === "deliverPreorders" ? (
        <main className="grid">
          <section className="panel">
            <h2>Deliver Pre-Orders</h2>
            <div className="form-grid">
              <p className="form-hint">Rep: {cashier || "-"}</p>
              <input
                value={preorderCustomerName}
                onChange={(e) => {
                  setPreorderCustomerName(e.target.value);
                  setShowPreorderCustomerSuggestions(true);
                  setPreorderSaleId("");
                  setPreorderDeliveredDraft({});
                  setPreorderEmptyCollected("");
                  setPreorderError("");
                }}
                onFocus={() => setShowPreorderCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPreorderCustomerSuggestions(false), 120)}
                placeholder="Type customer name"
              />
              {showPreorderCustomerSuggestions && filteredPreorderCustomerOptions.length ? (
                <div className="customer-suggestions">
                  {filteredPreorderCustomerOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setPreorderCustomerName(name);
                        setShowPreorderCustomerSuggestions(false);
                        setPreorderSaleId("");
                        setPreorderDeliveredDraft({});
                        setPreorderEmptyCollected("");
                        setPreorderError("");
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
              <select
                value={preorderSaleId}
                onChange={(e) => { setPreorderSaleId(e.target.value); setPreorderDeliveredDraft({}); setPreorderEmptyCollected(""); setPreorderError(""); }}
                disabled={!preorderCustomerName.trim()}
              >
                <option value="">{preorderCustomerName.trim() ? "Select pre-order (Sale ID)" : "Select customer first"}</option>
                {preorderSalesForCustomer.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    #{sale.id} • {new Date(sale.createdAt).toLocaleDateString()} • {currency(sale.total || 0)}
                  </option>
                ))}
              </select>
            </div>
            {!preorderSaleId ? <p className="form-hint">Select customer then pre-order bill.</p> : null}
            {preorderSaleId && !preorderSale ? <p className="form-hint">Pre-order not found.</p> : null}
            {preorderSale ? (
              <>
                <article className="list-row">
                  <div>
                    <strong>Pre-Order #{preorderSale.id}</strong>
                    <p>{new Date(preorderSale.createdAt).toLocaleString()}</p>
                    <p>{preorderSale.customerName} • {preorderSale.lorry || "-"}</p>
                  </div>
                  <strong>{currency(preorderSale.total || 0)}</strong>
                </article>
                <div className="list">
                  {(preorderSale.lines || []).map((line) => {
                    const orderedQty = Number(line.quantity || 0);
                    const draftVal = preorderDeliveredDraft[line.productId];
                    const deliveredQty = preorderDeliveredQty(line.productId, orderedQty);
                    const shortQty = Math.max(0, orderedQty - deliveredQty);
                    return (
                      <article key={line.productId} className="list-row return-line-card">
                        <div className="return-line-main">
                          <strong>{line.name}</strong>
                          <p>Ordered {orderedQty}{shortQty > 0 ? ` • Short ${shortQty}` : ""}</p>
                          <p>Unit price {currency(line.price || 0)}</p>
                        </div>
                        <div className="return-line-controls">
                          <input
                            type="number"
                            min="0"
                            max={orderedQty}
                            value={draftVal === undefined ? orderedQty : draftVal}
                            onChange={(e) => onPreorderDeliveredChange(line.productId, e.target.value)}
                            placeholder="Delivered qty"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="return-draft-summary">
                  <article className="return-draft-summary-amount">
                    <span>Delivered Total</span>
                    <strong>{currency(preorderDeliveredTotals.total)}</strong>
                  </article>
                </div>
                <div className="form-grid">
                  <label className="form-hint">Payment Method</label>
                  <select value={preorderPaymentMethod} onChange={(e) => setPreorderPaymentMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                    <option value="cheque">Cheque</option>
                  </select>
                  {preorderPaymentMethod === "cash" ? (
                    <>
                      <label className="form-hint">Cash Received</label>
                      <div className="checkout-inline-action">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={preorderCashReceived}
                          onChange={(e) => setPreorderCashReceived(e.target.value)}
                          placeholder="Amount received"
                        />
                        <button type="button" className="ghost" onClick={() => setPreorderCashReceived(String(preorderDeliveredTotals.total))}>
                          Full Amount
                        </button>
                      </div>
                      <p className="form-hint">Any shortfall becomes outstanding for this customer.</p>
                    </>
                  ) : null}
                  {preorderPaymentMethod === "cheque" ? (
                    <p className="form-hint">Cheque details will be entered by manager upon delivery confirmation.</p>
                  ) : null}
                  {preorderPaymentMethod === "credit" ? (
                    <p className="form-hint">Full delivered amount will be recorded as outstanding for this customer.</p>
                  ) : null}
                  <label className="form-hint">Collect Empty Bottles (Outstanding: {preorderTotalEmptiesOutstanding})</label>
                  <input
                    type="number"
                    min="0"
                    max={preorderTotalEmptiesOutstanding}
                    value={preorderEmptyCollected}
                    onChange={(e) => setPreorderEmptyCollected(e.target.value)}
                    placeholder="Quantity collected"
                  />
                </div>
                {preorderError ? <p className="form-hint">{preorderError}</p> : null}
                <button type="button" onClick={submitPreorderConfirm} disabled={savingPreorderConfirm}>
                  {savingPreorderConfirm ? "Confirming..." : "Confirm Pre-Order"}
                </button>
              </>
            ) : null}
          </section>
        </main>
      ) : null}

      {cashierPage === "emptyBottles" ? (
        <main className="grid">
          <section className="panel">
            <h2>Empty Bottles</h2>
            <div className="form-grid">
              <p className="form-hint">Rep: {cashier || "-"}</p>
              <input
                value={emptyBottleCustomerName}
                onChange={(e) => {
                  setEmptyBottleCustomerName(e.target.value);
                  setShowEmptyBottleCustomerSuggestions(true);
                  setEmptyBottleSaleId("");
                  setEmptyBottleQtyDraft("");
                  setEmptyBottleError("");
                }}
                onFocus={() => setShowEmptyBottleCustomerSuggestions(true)}
                onBlur={() => setTimeout(() => setShowEmptyBottleCustomerSuggestions(false), 120)}
                placeholder="Type customer name"
              />
              {showEmptyBottleCustomerSuggestions && filteredEmptyBottleCustomerOptions.length ? (
                <div className="customer-suggestions">
                  {filteredEmptyBottleCustomerOptions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setEmptyBottleCustomerName(name);
                        setShowEmptyBottleCustomerSuggestions(false);
                        setEmptyBottleSaleId("");
                        setEmptyBottleQtyDraft("");
                        setEmptyBottleError("");
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
              {emptyBottleSelectedCustomer && (Number(emptyBottleSelectedCustomer.openingEmptyBottles || 0) - Number(emptyBottleSelectedCustomer.collectedOpeningEmptyBottles || 0) > 0) ? (
                <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--card-bg)" }}>
                  <label className="form-hint" style={{ color: "var(--warning)" }}>
                    Collect Opening Empty Bottles (Outstanding: {Number(emptyBottleSelectedCustomer.openingEmptyBottles || 0) - Number(emptyBottleSelectedCustomer.collectedOpeningEmptyBottles || 0)})
                  </label>
                  <div className="checkout-inline-action" style={{ marginTop: "0.5rem" }}>
                    <input
                      type="number"
                      min="0"
                      max={Number(emptyBottleSelectedCustomer.openingEmptyBottles || 0) - Number(emptyBottleSelectedCustomer.collectedOpeningEmptyBottles || 0)}
                      value={openingEmptyBottleQtyDraft}
                      onChange={(e) => setOpeningEmptyBottleQtyDraft(e.target.value)}
                      placeholder="Quantity to collect"
                    />
                    <button type="button" onClick={submitOpeningEmptyBottleCollect} disabled={savingOpeningEmptyBottleCollect}>
                      {savingOpeningEmptyBottleCollect ? "Saving..." : "Collect"}
                    </button>
                  </div>
                </div>
              ) : null}
              <label className="form-hint">Collect Bill Empty Bottles</label>
              <select
                value={emptyBottleSaleId}
                onChange={(e) => { setEmptyBottleSaleId(e.target.value); setEmptyBottleQtyDraft(""); setEmptyBottleError(""); }}
                disabled={!emptyBottleCustomerName.trim()}
              >
                <option value="">{emptyBottleCustomerName.trim() ? "Select bill (Sale ID)" : "Select customer first"}</option>
                {emptyBottleSalesForCustomer.map((sale) => {
                  const owed = Number(sale.emptyBottlesOwed || 0);
                  const collected = Number(sale.emptyBottlesCollected || 0);
                  const outstanding = Math.max(0, owed - collected);
                  return (
                    <option key={sale.id} value={sale.id}>
                      #{sale.id} • {new Date(sale.createdAt).toLocaleDateString()} • Owed {owed} • Outstanding {outstanding}
                    </option>
                  );
                })}
              </select>
            </div>
            {!emptyBottleSaleId ? <p className="form-hint">Select customer then bill.</p> : null}
            {emptyBottleSaleId && !emptyBottleSale ? <p className="form-hint">Bill not found.</p> : null}
            {emptyBottleSale ? (
              <>
                <article className="list-row">
                  <div>
                    <strong>Bill #{emptyBottleSale.id}</strong>
                    <p>{new Date(emptyBottleSale.createdAt).toLocaleString()}</p>
                    <p>{emptyBottleSale.customerName} • {emptyBottleSale.lorry || "-"}</p>
                  </div>
                </article>
                <div className="return-draft-summary">
                  <article>
                    <span>Owed</span>
                    <strong>{Number(emptyBottleSale.emptyBottlesOwed || 0)}</strong>
                  </article>
                  <article>
                    <span>Collected</span>
                    <strong>{Number(emptyBottleSale.emptyBottlesCollected || 0)}</strong>
                  </article>
                  <article className="return-draft-summary-amount">
                    <span>Outstanding</span>
                    <strong>{emptyBottleOutstanding}</strong>
                  </article>
                </div>
                <div className="form-grid">
                  <label className="form-hint">Collect Empty Bottles</label>
                  <input
                    type="number"
                    min="0"
                    max={emptyBottleOutstanding}
                    value={emptyBottleQtyDraft}
                    onChange={(e) => setEmptyBottleQtyDraft(e.target.value)}
                    placeholder="Quantity collected"
                    disabled={emptyBottleOutstanding <= 0}
                  />
                  {emptyBottleOutstanding <= 0 ? <p className="form-hint">All empty bottles collected for this bill.</p> : null}
                </div>
                {emptyBottleError ? <p className="form-hint">{emptyBottleError}</p> : null}
                <button type="button" onClick={submitEmptyBottleCollect} disabled={savingEmptyBottleCollect || emptyBottleOutstanding <= 0}>
                  {savingEmptyBottleCollect ? "Saving..." : "Collect Empty Bottles"}
                </button>
              </>
            ) : null}
          </section>
        </main>
      ) : null}

      {cashierPage === "sales" ? (
        <main className="grid">
          <section className="panel rep-productivity-panel">
            <div className="rep-productivity-head">
              <div>
                <h2>My Productivity</h2>
                <p className="form-hint">Track your orders, value, bundles, and singles by date range.</p>
              </div>
              <div className="rep-productivity-filters" style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "2px" }}>
                  <button
                    type="button"
                    className="ghost"
                    style={{ padding: "4px 10px", fontSize: "0.78rem", background: !repProductivityDateFrom && !repProductivityDateTo ? "#0284c7" : "#f1f5f9", color: !repProductivityDateFrom && !repProductivityDateTo ? "#ffffff" : "#475569", fontWeight: "700", borderRadius: "6px" }}
                    onClick={() => { setRepProductivityDateFrom(""); setRepProductivityDateTo(""); }}
                  >
                    All Time
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    style={{ padding: "4px 10px", fontSize: "0.78rem", background: repProductivityDateFrom === toColomboDateKey() && repProductivityDateTo === toColomboDateKey() ? "#0284c7" : "#f1f5f9", color: repProductivityDateFrom === toColomboDateKey() && repProductivityDateTo === toColomboDateKey() ? "#ffffff" : "#475569", fontWeight: "700", borderRadius: "6px" }}
                    onClick={() => { setRepProductivityDateFrom(toColomboDateKey()); setRepProductivityDateTo(toColomboDateKey()); }}
                  >
                    Today
                  </button>
                </div>
                <label>
                  <span>From</span>
                  <input type="date" value={repProductivityDateFrom} onChange={(e) => setRepProductivityDateFrom(e.target.value)} />
                </label>
                <label>
                  <span>To</span>
                  <input type="date" value={repProductivityDateTo} onChange={(e) => setRepProductivityDateTo(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="rep-productivity-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <article>
                <span>Orders</span>
                <strong>{repProductivityStats.orders}</strong>
              </article>
              <article style={{ borderLeft: "3px solid #16a34a" }}>
                <span>Real Bill Value</span>
                <strong style={{ color: "#16a34a" }}>{currency(repProductivityStats.directValue)}</strong>
              </article>
              <article style={{ borderLeft: "3px solid #d97706" }}>
                <span>Pre-Order Value</span>
                <strong style={{ color: "#d97706" }}>{currency(repProductivityStats.preorderValue)}</strong>
              </article>
              <article style={{ borderLeft: "3px solid #2563eb" }}>
                <span>Total Sales Value</span>
                <strong style={{ color: "#2563eb" }}>{currency(repProductivityStats.value)}</strong>
              </article>
            </div>

            {/* Payment Method Breakdown (Cash, Cheque, Credit) with Direct vs Pre-Order */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px", marginTop: "10px" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#166534", fontWeight: "600" }}>💵 Total Cash Sales</span>
                  <strong style={{ fontSize: "1.05rem", color: "#15803d" }}>{currency(repProductivityStats.totalCash)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#166534", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #bbf7d0" }}>
                  <span>Real Bill: <strong>{currency(repProductivityStats.directCash)}</strong></span>
                  <span>Pre-Order: <strong>{currency(repProductivityStats.preorderCash)}</strong></span>
                </div>
              </div>

              <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: "600" }}>📝 Total Cheque Sales</span>
                  <strong style={{ fontSize: "1.05rem", color: "#b45309" }}>{currency(repProductivityStats.totalCheque)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#92400e", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #fde68a" }}>
                  <span>Real Bill: <strong>{currency(repProductivityStats.directCheque)}</strong></span>
                  <span>Pre-Order: <strong>{currency(repProductivityStats.preorderCheque)}</strong></span>
                </div>
              </div>

              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#991b1b", fontWeight: "600" }}>💳 Total Credit Sales</span>
                  <strong style={{ fontSize: "1.05rem", color: "#dc2626" }}>{currency(repProductivityStats.totalCredit)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#991b1b", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #fca5a5" }}>
                  <span>Real Bill: <strong>{currency(repProductivityStats.directCredit)}</strong></span>
                  <span>Pre-Order: <strong>{currency(repProductivityStats.preorderCredit)}</strong></span>
                </div>
              </div>
            </div>

            <div className="rep-productivity-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginTop: "10px" }}>
              <article>
                <span>Total Qty</span>
                <strong>{repProductivityStats.qty}</strong>
              </article>
              <article>
                <span>Bundles</span>
                <strong>{repProductivityStats.bundles}</strong>
              </article>
              <article>
                <span>Singles</span>
                <strong>{repProductivityStats.singles}</strong>
              </article>
              <article>
                <span>Customers</span>
                <strong>{repProductivityStats.customers}</strong>
              </article>
            </div>
            <p className="form-hint rep-productivity-foot">Today quick view: {repSessionStats.orders} orders • {currency(repSessionStats.revenue)}</p>
          </section>
          <section className="panel rep-sales-panel">
            <h2>My Sales</h2>
            <input
              className="search-icon-input imperfect-search-input"
              value={repSalesSearch}
              onChange={(e) => setRepSalesSearch(e.target.value)}
              placeholder="Search my sales"
            />
            <div className="list rep-sales-list">
              {paginatedRepSales.visibleItems.map((sale) => (
                <article key={sale.id} className="list-row rep-sale-card">
                  <div className="rep-sale-main">
                    <div className="rep-sale-id-row" style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      <strong>#{sale.id}</strong>
                      <span className={`rep-sale-payment rep-sale-payment-${String(sale.paymentType || "").toLowerCase()}`}>{sale.paymentType}</span>
                      {sale.orderType === "preorder" ? (
                        <span className="tag" style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8em", fontWeight: 700 }}>
                          🚚 Pre-Order ({sale.preOrderStatus || "pending"})
                        </span>
                      ) : (
                        <span className="tag" style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8em", fontWeight: 700 }}>
                          💵 Direct Bill
                        </span>
                      )}
                    </div>
                    <p className="rep-sale-meta">{new Date(sale.createdAt).toLocaleString()}</p>
                    <p className="rep-sale-customer">{sale.customerName}</p>
                    <p className="rep-sale-meta">Lorry: {sale.lorry || "-"}</p>
                  </div>
                  <div className="rep-sale-side">
                    <strong className="rep-sale-total" style={{ color: sale.orderType === "preorder" ? "#d97706" : "#0f172a" }}>
                      {currency(saleNetTotal(sale))}
                    </strong>
                    <span style={{ fontSize: "0.78em", color: "#64748b", display: "block", textAlign: "right" }}>
                      {sale.orderType === "preorder" ? "Pre-Order Value" : "Real Bill Value"}
                    </span>
                    <div className="sales-row-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const returnByProduct = new Map();
                          for (const ret of (state.returns || [])) {
                            if (String(ret.saleId) === String(sale.id)) {
                              for (const line of (ret.lines || [])) {
                                returnByProduct.set(line.productId, (returnByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
                              }
                            }
                          }
                          const undeliveredByProduct = new Map();
                          for (const adj of (sale.deliveryAdjustments || [])) {
                            for (const line of (adj.lines || [])) {
                              undeliveredByProduct.set(line.productId, (undeliveredByProduct.get(line.productId) || 0) + Number(line.quantity || 0));
                            }
                          }
                          openSaleReceiptPrint({
                            sale,
                            customers: state.customers || [],
                            products: state.products || [],
                            allSales: state.sales || [],
                            returnByProduct,
                            undeliveredByProduct,
                            onPopupBlocked: () => setMessage("Popup blocked. Please allow popups to print receipts.")
                          });
                        }}
                      >
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => openSaleEdit(sale)}
                        disabled={Boolean((state.returns || []).some((ret) => String(ret.saleId) === String(sale.id)))}
                      >
                        Edit / Pay
                      </button>
                      {isSameRep(sale.cashier, cashier, user) ? (
                        <button
                          type="button"
                          className="row-danger"
                          onClick={() => deleteRepSale(sale)}
                          disabled={Boolean(sale.deliveryConfirmedAt) || Boolean((sale.deliveryAdjustments || []).length) || Boolean(sale.preOrderConfirmedAt)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
              {paginatedRepSales.controls}
            </div>
          </section>
          <section className="panel">
            <h2>Recent Sales</h2>
            <input
              className="search-icon-input imperfect-search-input"
              value={repRecentSalesSearch}
              onChange={(e) => setRepRecentSalesSearch(e.target.value)}
              placeholder="Search recent sales"
            />
            <div className="list">
              {filteredRecentSales.map((sale) => (
                <article key={sale.id} className="list-row">
                  <div>
                    <strong>#{sale.id} ({sale.cashier || "-"})</strong>
                    <p>{new Date(sale.createdAt).toLocaleString()}</p>
                    <p>{sale.customerName} • {sale.paymentType} • {sale.lorry || "-"}</p>
                  </div>
                  <strong>{currency(saleNetTotal(sale))}</strong>
                </article>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Rep Comparison</h2>
            <input
              className="search-icon-input imperfect-search-input"
              value={repComparisonSearch}
              onChange={(e) => setRepComparisonSearch(e.target.value)}
              placeholder="Search rep"
            />
            <div className="list">
              {filteredRepCompareRows.map((row) => (
                <article key={row.rep} className="list-row">
                  <div>
                    <strong>{row.rep}</strong>
                    <p>{row.bills} bill(s)</p>
                  </div>
                  <strong>{currency(row.revenue)}</strong>
                </article>
              ))}
            </div>
          </section>
        </main>
      ) : null}

      {cashierPage === "customers" ? (
        <main className="grid">
          <section className="panel rep-customers-panel">
            <div className="rep-customers-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2>Saved Customers</h2>
                <p>Find customer details and outstanding balance quickly.</p>
              </div>
              <button type="button" className="customer-add-icon-btn" onClick={openCustomerAdd} title="Add Customer" aria-label="Add Customer" style={{ flexShrink: 0, marginTop: "0.25rem" }}>
                <span className="fab-plus">+</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4.5 3.6-8 8-8s8 3.5 8 8" />
                </svg>
              </button>
            </div>
            <input
              className="search-icon-input rep-customers-search"
              value={repCustomerSearch}
              onChange={(e) => setRepCustomerSearch(e.target.value)}
              placeholder="Search customer by name"
            />
            <div className="list rep-customers-list">
              {paginatedRepCustomers.visibleItems.length ? paginatedRepCustomers.visibleItems.map((customer) => (
                <article key={customer.id} className="list-row rep-customer-card">
                  <div className="rep-customer-main">
                    <strong>{customer.name}</strong>
                    <p className="rep-customer-phone">{customer.phone || "-"}</p>
                    <p className="rep-customer-address">{customer.address || "-"}</p>
                  </div>
                  <div className="rep-customer-side">
                    <span className="rep-customer-side-label">Outstanding</span>
                    <strong className={Number(customerOutstandingMap.get(customer.id) || customerOutstandingMap.get(customer.name) || 0) > 0 ? "outstanding-text" : ""}>
                      {currency(customerOutstandingMap.get(customer.id) || customerOutstandingMap.get(customer.name) || 0)}
                    </strong>
                  </div>
                </article>
              )) : <p className="form-hint rep-customers-empty">No matching customers found.</p>}
              {paginatedRepCustomers.controls}
            </div>
          </section>
        </main>
      ) : null}

      {editingSaleId ? (
        <div className="low-stock-modal" onClick={closeSaleEdit}>
          <div className="low-stock-modal-card rep-sale-edit-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Editing sale #{editingSaleId}</h3>
              <button type="button" className="ghost" onClick={closeSaleEdit}>Close</button>
            </div>
            <div className="admin-inline-form rep-sale-edit-form">
              {/* Payment Collection & Split Payment Section */}
              <div className="rep-sale-edit-payment-panel" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', marginTop: '4px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>💳 Payment Collection &amp; Split Payment</strong>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', fontWeight: '700' }}
                      onClick={() => {
                        setSaleEditCashReceived(String(saleEditNetTotal));
                        setSaleEditChequeAmount("");
                        setSaleEditCustomerCreditAmount("");
                        setSaleEditPaymentType("cash");
                      }}
                    >
                      Full Cash ({currency(saleEditNetTotal)})
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: '700' }}
                      onClick={() => {
                        setSaleEditChequeAmount(String(saleEditNetTotal));
                        setSaleEditCashReceived("");
                        setSaleEditCustomerCreditAmount("");
                        setSaleEditPaymentType("cheque");
                      }}
                    >
                      Full Cheque
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 10px', fontSize: '0.78rem', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', fontWeight: '700' }}
                      onClick={() => {
                        setSaleEditCashReceived("");
                        setSaleEditChequeAmount("");
                        setSaleEditCustomerCreditAmount("");
                        setSaleEditPaymentType("credit");
                      }}
                    >
                      Full Credit
                    </button>
                  </div>
                </div>

                {/* Financial Overview Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Net Bill Total</span>
                    <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{currency(saleEditNetTotal)}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Paid</span>
                    <strong style={{ fontSize: '1rem', color: '#16a34a' }}>{currency(saleEditPaidTotal)}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Credit / Balance Due</span>
                    <strong style={{ fontSize: '1rem', color: saleEditRemainingBalance > 0 ? '#dc2626' : '#059669' }}>
                      {currency(saleEditRemainingBalance)}
                    </strong>
                  </div>
                </div>

                {/* Primary Payment Mode Dropdown & Discount */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <label className="rep-sale-field" style={{ flex: '1 1 180px' }}>
                    <span>Primary Payment Method</span>
                    <select value={saleEditPaymentType} onChange={(e) => setSaleEditPaymentType(e.target.value)}>
                      {PAYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      <option value="mixed">mixed (split payment)</option>
                    </select>
                  </label>
                  <label className="rep-sale-field" style={{ flex: '1 1 180px' }}>
                    <span>Total Bill Discount (LKR)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleEditBillDiscount}
                      onChange={(e) => setSaleEditBillDiscount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>

                {/* Split Payment Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginTop: '8px' }}>
                  <label className="rep-sale-field">
                    <span>💵 Cash Amount (LKR)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleEditCashReceived}
                      onChange={(e) => setSaleEditCashReceived(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>

                  <label className="rep-sale-field">
                    <span>🏦 Cheque Amount (LKR)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleEditChequeAmount}
                      onChange={(e) => setSaleEditChequeAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>

                {/* Cheque Detail Panel */}
                {Number(saleEditChequeAmount || 0) > 0 ? (
                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '10px', marginTop: '10px' }}>
                    <strong style={{ fontSize: '0.82rem', color: '#92400e', display: 'block', marginBottom: '8px' }}>Cheque Information (Required)</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      <label className="rep-sale-field">
                        <span>Cheque Number</span>
                        <input value={saleEditChequeNo} onChange={(e) => setSaleEditChequeNo(e.target.value)} placeholder="Cheque No" />
                      </label>
                      <label className="rep-sale-field">
                        <span>Cheque Date</span>
                        <input type="date" value={saleEditChequeDate} onChange={(e) => setSaleEditChequeDate(e.target.value)} />
                      </label>
                      <label className="rep-sale-field">
                        <span>Bank Name</span>
                        <input value={saleEditChequeBank} onChange={(e) => setSaleEditChequeBank(e.target.value)} placeholder="Bank Name" />
                      </label>
                    </div>
                  </div>
                ) : null}

                {/* Customer Credit Usage Panel */}
                {saleEditCustomerAvailableCredit > 0 ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '0.82rem', color: '#166534' }}>Customer Credit Available: {currency(saleEditCustomerAvailableCredit)}</strong>
                      <button
                        type="button"
                        className="ghost"
                        style={{ padding: '2px 8px', fontSize: '0.75rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: '700' }}
                        onClick={() => setSaleEditCustomerCreditAmount(String(Math.min(saleEditNetTotal, saleEditCustomerAvailableCredit)))}
                      >
                        Apply Max ({currency(Math.min(saleEditNetTotal, saleEditCustomerAvailableCredit))})
                      </button>
                    </div>
                    <label className="rep-sale-field">
                      <span>Apply Customer Credit (LKR)</span>
                      <input
                        type="number"
                        min="0"
                        max={saleEditCustomerAvailableCredit}
                        step="0.01"
                        value={saleEditCustomerCreditAmount}
                        onChange={(e) => setSaleEditCustomerCreditAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </label>
                  </div>
                ) : null}

                {/* Credit Due Date Field */}
                {saleEditRemainingBalance > 0 || saleEditPaymentType === "credit" ? (
                  <div style={{ marginTop: '10px' }}>
                    <label className="rep-sale-field">
                      <span>📅 Credit Due Date (Remaining Balance: {currency(saleEditRemainingBalance)})</span>
                      <input
                        type="date"
                        value={saleEditCreditDueDate}
                        onChange={(e) => setSaleEditCreditDueDate(e.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="rep-sale-edit-empty-panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginTop: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>Empty Bottle Collection</strong>
                    <p className="form-hint" style={{ margin: 0 }}>
                      Customer Sales Empties: <strong>{saleEditCustomerSalesEmptiesOutstanding}</strong> • This Bill Owed: <strong>{saleEditEditedEmptyBottlesOwed}</strong> (Collected: {Number(saleBeingEdited?.emptyBottlesCollected || 0)})
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                      onClick={() => setSaleEditCollectEmptyBottles(String(saleEditThisBillEmptiesOutstanding))}
                    >
                      Bill Max ({saleEditThisBillEmptiesOutstanding})
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                      onClick={() => setSaleEditCollectEmptyBottles(String(saleEditCustomerSalesEmptiesOutstanding))}
                    >
                      Customer Total ({saleEditCustomerSalesEmptiesOutstanding})
                    </button>
                  </div>
                </div>
                <label className="rep-sale-field" style={{ width: '100%', marginTop: '6px' }}>
                  <span>Collect Empty Bottles (Qty)</span>
                  <input
                    type="number"
                    min="0"
                    max={saleEditCustomerSalesEmptiesOutstanding}
                    value={saleEditCollectEmptyBottles}
                    onChange={(e) => setSaleEditCollectEmptyBottles(e.target.value)}
                    placeholder={`Max ${saleEditCustomerSalesEmptiesOutstanding} bottles`}
                    style={{ width: '100%', minHeight: '44px', fontSize: '1rem', padding: '8px 12px', fontWeight: '600', boxSizing: 'border-box' }}
                  />
                </label>
              </div>

              <p className="form-hint rep-sale-edit-title">Editable subtotal: {currency(saleEditSubTotal)}</p>
              {(() => {
                const saleBeingEdited = (state.sales || []).find((sale) => String(sale.id) === String(editingSaleId));
                const discountLimit = (state.customers || [])
                  .filter((item) => String(item.name || "").trim().toLowerCase() === String(saleBeingEdited?.customerName || "").trim().toLowerCase())
                  .reduce((max, item) => Math.max(max, Number(item.discountLimit || 0)), 0);
                const bundleDiscountLimit = (state.customers || [])
                  .filter((item) => String(item.name || "").trim().toLowerCase() === String(saleBeingEdited?.customerName || "").trim().toLowerCase())
                  .reduce((max, item) => Math.max(max, Number(item.bundleDiscountLimit || 0)), 0);
                const totalDiscount = totalDiscountApplied({ lines: saleEditLines, billDiscount: saleEditBillDiscount });
                const bundleDiscountViolation = findBundleDiscountViolation({ lines: saleEditLines, bundleDiscountLimit });
                return (
                  <>
                    {discountLimit > 0 ? (
                      <p className={`form-hint rep-sale-edit-title${totalDiscount > discountLimit ? " outstanding-text" : ""}`}>
                        Discount limit: {currency(discountLimit)} • Current discount: {currency(totalDiscount)}
                      </p>
                    ) : null}
                    
                  </>
                );
              })()}
              <div className="rep-sale-edit-add-item-panel" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px', marginTop: '8px', marginBottom: '12px' }}>
                <strong style={{ fontSize: '0.88rem', color: '#0f172a', display: 'block', marginBottom: '8px' }}>Add Product to Bill</strong>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label className="rep-sale-field" style={{ flex: '1 1 200px' }}>
                    <span>Select Product</span>
                    <select value={saleEditAddProductId} onChange={(e) => setSaleEditAddProductId(e.target.value)}>
                      <option value="">Select a product to add...</option>
                      {availableProductsForSaleEdit.map((p) => {
                        const stock = Number(p.stock || 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {productDisplayName(p)} ({currency(productSalePrice(p))}) • Stock: {stock}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="rep-sale-field" style={{ width: '80px' }}>
                    <span>Qty</span>
                    <input
                      type="number"
                      min="1"
                      value={saleEditAddQty}
                      onChange={(e) => setSaleEditAddQty(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={addProductToSaleEdit}
                    disabled={!saleEditAddProductId}
                    style={{ height: '38px', padding: '0 14px', background: '#0284c7', color: '#fff', fontWeight: '600', borderRadius: '6px' }}
                  >
                    + Add to Bill
                  </button>
                </div>
              </div>

              {saleEditLines.map((line) => (
                <div key={line.productId} className="rep-sale-edit-row">
                  <div className="rep-sale-edit-name">{line.name}</div>
                  <div className="rep-sale-edit-controls">
                    <label className="rep-sale-field">
                      <span>Qty</span>
                      <input type="number" min="1" value={line.quantity} onChange={(e) => setSaleEditLines((current) => current.map((l) => (l.productId === line.productId ? { ...l, quantity: e.target.value } : l)))} />
                    </label>
                    <button type="button" className="row-danger" onClick={() => setSaleEditLines((current) => current.filter((l) => l.productId !== line.productId))}>Remove</button>
                  </div>
                </div>
              ))}
              {saleEditError ? <p className="form-hint">{saleEditError}</p> : null}
              <div className="rep-sale-edit-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button type="button" className="ghost" onClick={closeSaleEdit}>Cancel</button>
                <button type="button" className="ghost" onClick={() => saveSaleEdit(false)} disabled={savingSaleEdit}>
                  {savingSaleEdit ? "Saving..." : "Save Edit Only"}
                </button>
                <button type="button" onClick={() => saveSaleEdit(true)} disabled={savingSaleEdit} style={{ background: "#2563eb", color: "#ffffff", fontWeight: "bold" }}>
                  {savingSaleEdit ? "Saving..." : "🖨️ Save & Print"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {cashierPage === "stock" ? (
        <main className="grid">
          <section className="panel rep-stock-panel">
            <h2>Stock Overview</h2>
            <div className="rep-stock-metrics">
              <article>
                <p>Remaining Items</p>
                <strong>{repStockSummary.remainingItems}</strong>
              </article>
              <article className="danger">
                <p>Damaged / Expired</p>
                <strong>{repStockSummary.damagedItems}</strong>
              </article>
              <article>
                <p>Affected SKUs</p>
                <strong>{repStockSummary.damagedSkus}</strong>
              </article>
            </div>
          </section>

          <section className="panel rep-stock-panel">
            <h2>Remaining Stock</h2>
            <input
              className="search-icon-input imperfect-search-input"
              value={repStockSearch}
              onChange={(e) => setRepStockSearch(e.target.value)}
              placeholder="Search stock item"
            />
            <div className="rep-stock-table-wrapper">
              <div className="rep-stock-table">
                <header>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("name")}>Item{repStockSortMark("name")}</button>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("billingPrice")}>B.Price (LKR){repStockSortMark("billingPrice")}</button>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("mrp")}>MRP{repStockSortMark("mrp")}</button>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("remaining")}>Remaining{repStockSortMark("remaining")}</button>
              </header>
              {sortedRepStockRows.map((row) => (
                <article key={`remain-${row.id}`}>
                  <span>{row.name}</span>
                  <span>{formatLkrValue(row.billingPrice || 0)}</span>
                  <span>{formatLkrValue(row.mrp || 0)}</span>
                  <span>{row.remaining}</span>
                </article>
              ))}
              </div>
            </div>
          </section>

          <section className="panel rep-stock-panel">
            <h2>Damaged / Expired Stock</h2>
            <div className="rep-stock-table-wrapper">
              <div className="rep-stock-table rep-stock-table-danger">
                <header>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("name")}>Item{repStockSortMark("name")}</button>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("billingPrice")}>B.Price (LKR){repStockSortMark("billingPrice")}</button>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("mrp")}>MRP{repStockSortMark("mrp")}</button>
                <button type="button" className="th-sort" onClick={() => toggleRepStockSort("damaged")}>Damaged Qty{repStockSortMark("damaged")}</button>
              </header>
              {sortedRepDamagedRows.length ? sortedRepDamagedRows
                .map((row) => (
                  <article key={`damaged-${row.id}`}>
                    <span>{row.name}</span>
                    <span>{formatLkrValue(row.billingPrice || 0)}</span>
                    <span>{formatLkrValue(row.mrp || 0)}</span>
                    <span>{row.damaged}</span>
                  </article>
                )) : <p className="form-hint">No damaged/expired items recorded yet.</p>}
              </div>
            </div>
          </section>
        </main>
      ) : null}

      {cashierPage === "deliveries" ? (
        <main className="grid rep-ui-2">
          <section className="panel rep-sales-panel">
            <h2>Confirm Deliveries</h2>
            <input
              className="search-icon-input imperfect-search-input"
              value={deliveriesSearch}
              onChange={(e) => setDeliveriesSearch(e.target.value)}
              placeholder="Search deliveries"
            />
            <div className="list rep-sales-list">
              {sortedDeliveryRows
                .filter((row) => matchesSearch(deliveriesSearch, row.id, row.lorry, row.when, row.sale?.customerName, row.confirmed ? "confirmed" : "pending"))
                .map((row) => (
                  <article key={`rep-del-${row.id}`} className="list-row rep-sale-card">
                    <div className="rep-sale-main">
                      <div className="rep-sale-id-row">
                        <strong>#{row.id}</strong>
                        <span className={row.confirmed ? "rep-sale-payment rep-sale-payment-cash" : "rep-sale-payment rep-sale-payment-credit"}>
                          {row.confirmed ? "Confirmed" : "Pending"}
                        </span>
                      </div>
                      <p className="rep-sale-meta">{row.when}</p>
                      <p className="rep-sale-customer">{row.sale.customerName || "Walk-in"}</p>
                      <p className="rep-sale-meta">Lorry: {row.lorry}</p>
                    </div>
                    <div className="rep-sale-side">
                      <strong className="rep-sale-total">{currency(row.total)}</strong>
                      <div className="sales-row-actions">
                        <button
                          type="button"
                          onClick={() => openDeliveryModal(row.sale)}
                        >
                          {row.confirmed ? "Update" : "Confirm"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              {sortedDeliveryRows.filter((row) => matchesSearch(deliveriesSearch, row.id, row.lorry, row.when, row.sale?.customerName, row.confirmed ? "confirmed" : "pending")).length === 0 ? (
                <p className="form-hint">No deliveries found.</p>
              ) : null}
            </div>
          </section>
        </main>
      ) : null}

      {deliverySale ? (
        <div className="low-stock-modal rep-fullscreen-sheet-backdrop" onClick={() => openDeliveryModal({ id: "" })}>
          <div className="low-stock-modal-card rep-fullscreen-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head rep-fullscreen-sheet-head">
              <h3>Confirm Delivery #{deliverySale.id}</h3>
              <button type="button" className="rep-close-sheet-btn" onClick={() => openDeliveryModal({ id: "" })}>&times;</button>
            </div>
            <div className="rep-fullscreen-sheet-body" style={{ paddingBottom: "2rem" }}>
              <p className="form-hint" style={{ padding: "0" }}>{new Date(deliverySale.createdAt).toLocaleString()} • {deliverySale.customerName || "Walk-in"} • Lorry: {deliverySale.lorry || "-"}</p>
              <div className="admin-table deliveries-lines-table" style={{ margin: "1rem 0" }}>
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
                  const prevReturnedGood = 0;
                  const maxQty = Math.max(0, Number(line.quantity || 0) - prevUndelivered - prevReturnedGood);
                  return (
                    <article key={`dl-${deliverySale.id}-${line.productId}`}>
                      <span>{line.name}</span>
                                                <input
                            type="number"
                            style={{ width: "3.5rem", textAlign: "center", border: "1px solid #ccc", borderRadius: "4px", margin: "0 5px", fontSize: "1rem" }}
                            value={line.quantity}
                            min="0"
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) {
                                updateQty(line.productId, v);
                              }
                            }}
                          />
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
              <div className="delivery-settlement-panel" style={{ margin: "1rem 0" }}>
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
                    <strong>{currency(deliverySale.netTotalAfterReturns ?? deliverySale.total ?? 0)}</strong>
                  </article>
                  <article>
                    <span>Previously Paid</span>
                    <strong>{currency(deliverySale.paidAmount ?? deliverySale.totalPaymentReceived ?? 0)}</strong>
                  </article>
                  <article>
                    <span>To Settle</span>
                    <strong style={{ color: "#d97706" }}>{currency(deliverySettlementLimit)}</strong>
                  </article>
                </div>
                <div className="delivery-settlement-form">
                  <label>
                    <span>Cash Collected</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={deliveryCashReceived}
                      onChange={(e) => setDeliveryCashReceived(e.target.value)}
                      placeholder="e.g. 1500"
                    />
                  </label>
                  <label>
                    <span>Cheque Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={deliveryChequeAmount}
                      onChange={(e) => setDeliveryChequeAmount(e.target.value)}
                      placeholder="e.g. 5000"
                    />
                  </label>
                </div>
                {Number(deliveryChequeAmount) > 0 ? (
                  <div className="delivery-cheque-details grid-2">
                    <label>
                      <span>Cheque No</span>
                      <input value={deliveryChequeNo} onChange={(e) => setDeliveryChequeNo(e.target.value)} placeholder="000123" />
                    </label>
                    <label>
                      <span>Cheque Date</span>
                      <input type="date" value={deliveryChequeDate} onChange={(e) => setDeliveryChequeDate(e.target.value)} />
                    </label>
                    <label style={{ gridColumn: "span 2" }}>
                      <span>Bank & Branch</span>
                      <input value={deliveryChequeBank} onChange={(e) => setDeliveryChequeBank(e.target.value)} placeholder="BOC Town Branch" />
                    </label>
                  </div>
                ) : null}
              </div>
              {deliveryError ? <p className="notice" style={{ margin: "1rem 0" }}>{deliveryError}</p> : null}
              <div className="low-stock-modal-actions" style={{ padding: "1.5rem 0 2rem", display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {deliverySale.deliveryConfirmedAt ? (
                  <>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => saveDeliveryAdjust(false)}
                      disabled={savingDelivery}
                    >
                      {savingDelivery ? "Updating..." : "Update Payment Only"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeliveryAdjust(true)}
                      disabled={savingDelivery}
                      style={{ background: "#16a34a", color: "#ffffff", fontWeight: "bold" }}
                    >
                      {savingDelivery ? "Saving..." : "🖨️ Update & Print"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => saveDeliveryAdjust(false)}
                      disabled={savingDelivery}
                    >
                      {savingDelivery ? "Confirming..." : "Confirm Delivery Only"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeliveryAdjust(true)}
                      disabled={savingDelivery}
                      style={{ background: "#2563eb", color: "#ffffff", fontWeight: "bold" }}
                    >
                      {savingDelivery ? "Saving..." : "🖨️ Confirm & Print"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {cashierPage === "loadingSheet" ? (
        <main className="panel rep-ui-2" style={{ padding: "1rem" }}>
          <div className="section-head" style={{ marginBottom: "1rem" }}>
            <div>
              <p className="eyebrow" style={{ fontSize: "0.85em", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Rep Live Loading Sheet</p>
              <h2 style={{ margin: "0.2rem 0" }}>Item-Wise Loading Sheet</h2>
              <p className="form-hint">Live summary of total items loaded by lorry and date.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "0.75rem" }}>
              <label className="stock-form-field" style={{ margin: 0, minWidth: "140px" }}>
                <span>Select Lorry</span>
                <select value={repLoadingLorry} onChange={(e) => setRepLoadingLorry(e.target.value)}>
                  {allowedLorries.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="stock-form-field" style={{ margin: 0, minWidth: "150px" }}>
                <span>Date</span>
                <input
                  type="date"
                  value={repLoadingDate}
                  onChange={(e) => setRepLoadingDate(e.target.value)}
                />
              </label>
              {repLoadingDate ? (
                <button type="button" className="ghost" style={{ marginTop: "18px" }} onClick={() => setRepLoadingDate("")}>Clear Date</button>
              ) : null}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "1rem" }}>
            <div className="stat-card" style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.8em", color: "#64748b" }}>Total SKUs</span>
              <strong style={{ display: "block", fontSize: "1.3em", color: "#0f172a" }}>{repLoadingStats.totalSkus}</strong>
            </div>
            <div className="stat-card" style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.8em", color: "#64748b" }}>Total Units</span>
              <strong style={{ display: "block", fontSize: "1.3em", color: "#2563eb" }}>{repLoadingStats.totalQty}</strong>
            </div>
            <div className="stat-card" style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "0.8em", color: "#64748b" }}>Total Cases / Bundles</span>
              <strong style={{ display: "block", fontSize: "1.3em", color: "#16a34a" }}>{repLoadingStats.totalBundles}</strong>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Search loaded items by name, SKU, category..."
              value={repLoadingSearch}
              onChange={(e) => setRepLoadingSearch(e.target.value)}
              className="search-input"
              style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
            />
          </div>

          {filteredRepLoadingRows.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              <p>No loaded items found for {repLoadingLorry}{repLoadingDate ? ` on ${repLoadingDate}` : ""}.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Item Name</th>
                    <th style={{ padding: "8px 12px" }}>Size</th>
                    <th style={{ padding: "8px 12px" }}>SKU</th>
                    <th style={{ padding: "8px 12px" }}>Category</th>
                    <th style={{ padding: "8px 12px" }}>Total Qty</th>
                    <th style={{ padding: "8px 12px" }}>Cases & Loose Singles</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepLoadingRows.map((row) => (
                    <tr key={row.key} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 12px" }}><strong>{row.name}</strong></td>
                      <td style={{ padding: "10px 12px" }}>{row.size || "-"}</td>
                      <td style={{ padding: "10px 12px" }}><code>{row.sku}</code></td>
                      <td style={{ padding: "10px 12px" }}><span className="tag" style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: "4px", fontSize: "0.85em" }}>{row.category || "General"}</span></td>
                      <td style={{ padding: "10px 12px" }}><strong style={{ fontSize: "1.1em", color: "#0f172a" }}>{row.qty}</strong></td>
                      <td style={{ padding: "10px 12px" }}>
                        {row.bundleSize > 0 ? (
                          <span style={{ fontWeight: 600, color: "#16a34a" }}>
                            {row.bundles} Case{row.bundles === 1 ? "" : "s"}
                            {row.balance > 0 ? ` + ${row.balance} Loose` : ""}
                          </span>
                        ) : (
                          <span>{row.qty} Singles</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      ) : null}

      {showCustomerPicker ? (
        <div className="low-stock-modal rep-fullscreen-sheet-backdrop" onClick={() => setShowCustomerPicker(false)}>
          <div className="low-stock-modal-card rep-fullscreen-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Select Customer</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button type="button" onClick={() => {
                  setShowCustomerPicker(false);
                  openCustomerAdd();
                }}>
                  + Add
                </button>
                <button type="button" className="ghost" onClick={() => setShowCustomerPicker(false)}>Close</button>
              </div>
            </div>
            <div className="rep-fullscreen-sheet-body">
              <input
                className="search-icon-input rep-step-input"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowCustomerSuggestions(true);
                }}
                onFocus={() => setShowCustomerSuggestions(true)}
                placeholder="Search customer"
              />
              <div className="rep-step-list rep-step-customer-list rep-sheet-list">
                {filteredCustomerOptions.length ? filteredCustomerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rep-step-list-row"
                    onClick={() => {
                      setCustomerName(c.name);
                      setCustomerId(c.id);
                      setShowCustomerSuggestions(false);
                      setShowCustomerPicker(false);
                    }}
                  >
                    <div>
                      <strong>{c.name}</strong>
                      <p>{customerOutstandingMap.get(c.id) ? `Outstanding ${currency(customerOutstandingMap.get(c.id))}` : "No outstanding"}</p>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                        {c?.route ? <span className="rep-customer-credit-badge" style={{ background: "#e2e8f0", color: "#334155" }}>Route: {c.route}</span> : null}
                        {c && Number(c.creditLimit || 0) > 0 ? <span className="rep-customer-credit-badge">Credit Limit: {currency(Number(c.creditLimit || 0))}</span> : null}
                      </div>
                    </div>
                    <span>Use</span>
                  </button>
                )) : (
                  <p className="form-hint">Type the customer name to search.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showCartPopup ? (
        <div className="low-stock-modal rep-fullscreen-sheet-backdrop" onClick={() => setShowCartPopup(false)}>
          <div className="low-stock-modal-card kiosk-cart-popup" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>My Cart</h3>
              <button type="button" className="ghost" onClick={() => setShowCartPopup(false)}>Close</button>
            </div>
            <div className="kiosk-cart-popup-body">
              <div className="list cart-list rep-cart-list rep-sheet-list">
                {cart.length ? cart.map((line) => (
                  <article className="list-row rep-cart-step-row" key={`sheet-${line.productId}`}>
                    <div className="cart-line-head">
                      <strong>{line.name}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>Price:</span>
                        <input
                          type="number"
                          style={{ width: '5rem', padding: '2px 6px', fontSize: '0.85rem', border: '1px solid #93c5fd', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1e3a8a', fontWeight: '600', outline: 'none' }}
                          min="0"
                          step="0.01"
                          value={line.priceDraft ?? line.price}
                          onChange={(e) => updateItemCustomPrice(line.productId, e.target.value)}
                          placeholder="Price"
                        />
                        <span>each • Item Disc {currency(lineItemDiscount(line))} • Net {currency(lineFinalPrice(line))}</span>
                      </div>
                    </div>
                    <div className="cart-line-controls">
                      <div className="rep-cart-qty-cluster">
                        <div className="qty-box">
                          <button type="button" onClick={() => updateQty(line.productId, line.quantity - 1)}>-</button>
                                                    <input
                            type="number"
                            style={{ width: "3.5rem", textAlign: "center", border: "1px solid #ccc", borderRadius: "4px", margin: "0 5px", fontSize: "1rem" }}
                            value={line.quantity}
                            min="0"
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) {
                                updateQty(line.productId, v);
                              }
                            }}
                          />
                          <button type="button" onClick={() => updateQty(line.productId, line.quantity + 1)}>+</button>
                        </div>
                        
                      </div>
                      <div className="rep-cart-discount-row" onClick={(e) => e.stopPropagation()}>
                        <select
                          className="rep-cart-discount-mode"
                          value={line.itemDiscountMode || "amount"}
                          onChange={(e) => updateItemDiscountMode(line.productId, e.target.value)}
                        >
                          <option value="amount">Rs.</option>
                          <option value="percent">%</option>
                        </select>
                        <input
                          className="rep-cart-discount-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.itemDiscount ?? 0}
                          onChange={(e) => updateItemDiscount(line.productId, e.target.value)}
                          placeholder="Item discount"
                        />
                        {lineItemDiscount(line) > 0 ? (
                          <strong className="rep-cart-discount-applied">-{currency(lineItemDiscount(line))}</strong>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )) : <p className="form-hint">Cart is empty.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showItemSizePicker ? (
        <div className="low-stock-modal rep-fullscreen-sheet-backdrop" onClick={() => setShowItemSizePicker(false)}>
          <div className="low-stock-modal-card rep-fullscreen-sheet rep-size-products-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>{activeItemSize || "Select Size"} Items</h3>
              <button type="button" className="ghost" onClick={() => setShowItemSizePicker(false)}>Close</button>
            </div>
            <div className="rep-fullscreen-sheet-body">
              <input
                className="search-icon-input rep-step-input"
                value={sizeProductSearch}
                onChange={(e) => setSizeProductSearch(e.target.value)}
                placeholder="Search product / sku / category"
              />
              <div className="rep-step-list rep-step-product-list rep-sheet-list">
                {activeSizeProducts.length ? activeSizeProducts.map((product) => (
                  <article
                    key={`size-${product.id}`}
                    className={`rep-product-pick-card ${expandedSizeProductId === String(product.id) ? "expanded" : "collapsed"}`}
                    onClick={() => setExpandedSizeProductId((current) => (current === String(product.id) ? "" : String(product.id)))}
                  >
                    <div className="rep-product-pick-copy">
                      <strong>{productDisplayName(product)}</strong>
                      <p>{product.sku} • {product.category}</p>
                      <p>{currency(productSalePrice(product))} • <span className={getCatalogStock(product) <= lowStockThreshold ? "stock-low-text" : ""}>Stock {getCatalogStock(product)}</span></p>
                      
                      {expandedSizeProductId !== String(product.id) ? <p className="catalog-edit-hint">Tap card to edit qty</p> : null}
                    </div>
                    {expandedSizeProductId === String(product.id) ? (
                      <div className="rep-product-pick-actions" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min="1"
                          value={catalogQtyDrafts[product.id] ?? ""}
                          onChange={(e) => setCatalogQtyDrafts((current) => ({ ...current, [product.id]: e.target.value }))}
                          placeholder="Custom qty"
                          className="catalog-qty-input"
                        />
                        <div className="catalog-quick-groups">
                          
                          <div className="catalog-quick-group catalog-quick-group-single">
                            <span className="catalog-quick-group-label">Singles</span>
                            <div className="catalog-quick-group-actions">
                              <button
                                className="catalog-single-minus-btn"
                                type="button"
                                onTouchStart={triggerAddHaptic}
                                onPointerDown={triggerAddHaptic}
                                onClick={() => removeFromCartWithQty(product, 1)}
                                disabled={Number(cartQtyByProduct.get(product.id) || 0) <= 0}
                              >
                                -1
                              </button>
                              <button
                                className="catalog-single-btn"
                                type="button"
                                onTouchStart={triggerAddHaptic}
                                onPointerDown={triggerAddHaptic}
                                onClick={() => addToCartWithQty(product, 1)}
                                disabled={getCatalogStock(product) <= 0}
                              >
                                +1
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          className="add-feedback-btn"
                          type="button"
                          onTouchStart={triggerAddHaptic}
                          onPointerDown={triggerAddHaptic}
                          onClick={() => addToCart(product)}
                          disabled={
                            getCatalogStock(product) <= 0
                            || !Number.isFinite(Number(catalogQtyDrafts[product.id]))
                            || Math.floor(Number(catalogQtyDrafts[product.id])) <= 0
                          }
                        >
                          Add Qty
                        </button>
                        <p className="catalog-in-cart-chip">
                          In cart: {Number(cartQtyByProduct.get(product.id) || 0)}
                          
                        </p>
                      </div>
                    ) : null}
                  </article>
                )) : <p className="form-hint">No items in this size for the current search.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAddCustomerModal ? (
        <div className="low-stock-modal" onClick={() => setShowAddCustomerModal(false)}>
          <div className="low-stock-modal-card customer-entry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="low-stock-modal-head">
              <h3>Add Customer</h3>
              <button type="button" onClick={() => setShowAddCustomerModal(false)}>Close</button>
            </div>
            <div className="admin-inline-form customer-entry-grid">
              <label className="customer-entry-field">
                <span>Customer Name</span>
                <input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name" />
              </label>
              <label className="customer-entry-field">
                <span>Phone</span>
                <input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="Phone" />
              </label>
              <label className="customer-entry-field customer-entry-field-full">
                <span>Address</span>
                <textarea value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} placeholder="Address" />
              </label>
              <label className="customer-entry-field">
                <span>Route</span>
                <input value={newCustomerRoute} onChange={(e) => setNewCustomerRoute(e.target.value)} placeholder="Route (e.g., North District)" />
              </label>
              <label className="customer-entry-field">
                <span>Opening Empty Bottles</span>
                <input type="number" min="0" value={newCustomerOpeningEmptyBottles} onChange={(e) => setNewCustomerOpeningEmptyBottles(e.target.value)} placeholder="Initial empty bottles owed" />
              </label>
              <div className="customer-entry-actions">
                <button type="button" onClick={saveNewCustomer} disabled={savingNewCustomer}>{savingNewCustomer ? "Saving..." : "Save Customer"}</button>
                <button type="button" className="ghost" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};











