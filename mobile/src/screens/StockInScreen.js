/**
 * StockInScreen.js
 * Screen for recording Stock IN transactions (Admin only).
 * Wraps StockTransactionScreen with mode="IN".
 */

import React from 'react';
import StockTransactionScreen from './StockTransactionScreen';

export default function StockInScreen(props) {
  return <StockTransactionScreen {...props} mode="IN" />;
}
