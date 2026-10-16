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
export const LoginScreen = ({ onLogin, error }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleKeyDown = (e) => { if (e.key === "Enter") onLogin({ username, password }); };

  return (
    <div className="minimal-login-shell">
      <div className="minimal-login-card">
        <h1 className="minimal-title">SIGN IN</h1>
        
        <div className="minimal-form">
          <div className="minimal-input-group">
            <svg className="minimal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"></path><path d="M20 21c0-3.31-3.58-6-8-6s-8 2.69-8 6"></path></svg>
            <input 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder="Username" 
              autoComplete="username" 
            />
          </div>
          
          <div className="minimal-input-group">
            <svg className="minimal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder="Password" 
              autoComplete="current-password" 
            />
          </div>

          {error && <p className="minimal-error">{error}</p>}
          
          <div className="minimal-button-container">
            <button className="minimal-submit-btn" type="button" onClick={() => onLogin({ username, password })}>
              LOGIN
            </button>
          </div>
        </div>
      </div>

      <a href="https://www.jnco.tech" target="_blank" rel="noreferrer" className="minimal-footer-badge">
        <span>Powered by</span>
        <img src="/powered.png" alt="J&co." className="minimal-footer-logo" />
      </a>
    </div>
  );
};




