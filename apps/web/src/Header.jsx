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
export const Header = ({ dashboard, user, onLogout, managerFullAccess = false }) => {
  const headerUser = user.role === "admin" ? "Kanishka Perera" : (user.name || user.username || "").toUpperCase();
  const roleLabel = user.role === "cashier"
    ? "Cashier Dashboard"
    : user.role === "manager"
      ? "Manager Dashboard"
      : "Admin Dashboard";

  return (
    <header className="topbar">
      <div className="header-card">
        <div className="brand">
          <img className="brand-logo" src="/lucky-logo.png" alt="Lucky logo" />
          <div className="brand-copy">
            <h1>Lucky Distributor</h1>
            <p className="brand-user">{headerUser}</p>
            <p className="brand-role">{roleLabel}</p>
            {user.role === "manager" ? (
              <span className={`header-pill manager-mode-pill ${managerFullAccess ? "manager-mode-pill-full" : "manager-mode-pill-limited"}`}>
                {managerFullAccess ? "Full Access Enabled" : "Limited Access"}
              </span>
            ) : null}
          </div>
        </div>
        <button className="logout-btn" type="button" onClick={onLogout}>LOG OUT</button>
      </div>

    </header>
  );
};




