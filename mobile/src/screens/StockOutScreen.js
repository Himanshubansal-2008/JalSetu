/**
 * StockOutScreen.js
 * Screen for recording Stock OUT transactions (Admin and Worker).
 * Wraps StockTransactionScreen with mode="OUT".
 */

import React from 'react';
import StockTransactionScreen from './StockTransactionScreen';

export default function StockOutScreen(props) {
  return <StockTransactionScreen {...props} mode="OUT" />;
}
