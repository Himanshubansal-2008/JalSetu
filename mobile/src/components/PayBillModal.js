/**
 * PayBillModal.js
 * Modal component for recording consumer bill payments in the JalKosh mobile app.
 *
 * Features:
 * - Bill Summary Header: Consumer name, house number, billing month, and formatted amount
 * - Payment Mode Selector: Cash, UPI, and Cheque pills (defaults to Cash)
 * - Dynamic Reference Input: Contextual placeholder based on selected mode
 * - Double-Tap Protection: Button disabled during submission with ActivityIndicator
 * - Atomic Backend Sync: Calls POST /api/bills/:id/pay
 * - Receipt Confirmation Screen:
 *   - Success checkmark & "Payment recorded — ₹X.XX added to Water tax ledger"
 *   - "Share Receipt PDF" action button
 *   - "Done" button that dismisses modal and triggers parent auto-refresh
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient, { getErrorMessage } from '../api/apiClient';
import { formatPaiseToRupees } from '../utils/currency';
import { strings } from '../strings';
import { colors, tones, spacing, radius } from '../theme';
import { generateAndShareBillPdf } from '../utils/billPdf';

// Helper to format "YYYY-MM" to "Month Year" (e.g. "November 2026")
function formatMonthName(monthStr) {
  if (!monthStr || typeof monthStr !== 'string' || !monthStr.includes('-')) {
    return monthStr || '';
  }
  const [year, month] = monthStr.split('-');
  const date = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Payment mode options
const PAYMENT_MODES = [
  { id: 'Cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'UPI', label: 'UPI', icon: 'qr-code-outline' },
  { id: 'Cheque', label: 'Cheque', icon: 'document-text-outline' },
];

export default function PayBillModal({
  visible = false,
  bill = null,
  onClose,
  onSuccess,
}) {
  const [mode, setMode] = useState('Cash');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [sharingPdf, setSharingPdf] = useState(false);

  // Reset form states when modal opens or bill changes
  useEffect(() => {
    if (visible && bill) {
      setMode('Cash');
      setReference('');
      setSubmitting(false);
      setError('');
      setSuccessData(null);
      setSharingPdf(false);
    }
  }, [visible, bill?.id]);

  if (!visible || !bill) {
    return null;
  }

  const consumerName = bill.consumer?.name || 'Consumer';
  const houseNumber = bill.consumer?.houseNumber || '';
  const monthDisplay = formatMonthName(bill.month);
  const amountFormatted = formatPaiseToRupees(bill.amountPaise || 0);

  // Dynamic placeholder based on mode
  const getReferencePlaceholder = () => {
    switch (mode) {
      case 'Cash':
        return strings.refPlaceholderCash;
      case 'UPI':
        return strings.refPlaceholderUpi;
      case 'Cheque':
        return strings.refPlaceholderCheque;
      default:
        return strings.paymentReference;
    }
  };

  // Submit payment to backend with strict double-tap protection
  const handleConfirmPayment = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const cleanRef = reference.trim() || null;
      const res = await apiClient.post(`/bills/${bill.id}/pay`, {
        mode,
        reference: cleanRef,
      });

      // Payment successful, transition to receipt confirmation state
      setSuccessData(res.data || {});
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Share Receipt PDF handler
  const handleShareReceipt = async () => {
    if (sharingPdf) return;
    setSharingPdf(true);
    try {
      const paidBill = {
        ...bill,
        ...(successData?.bill || {}),
        status: 'PAID',
        paidAt: successData?.bill?.paidAt || new Date().toISOString(),
        mode,
        reference: reference.trim() || null,
      };

      await generateAndShareBillPdf({
        bill: paidBill,
        consumer: bill.consumer,
        gp: bill.gp,
      });
    } finally {
      setSharingPdf(false);
    }
  };

  // Dismiss on Done or close after success -> triggers auto-refresh on caller
  const handleDismissSuccess = () => {
    if (onSuccess) {
      onSuccess(successData);
    } else if (onClose) {
      onClose();
    }
  };

  // Close modal safely (guarded against active submission)
  const handleClose = () => {
    if (submitting) return;
    if (successData) {
      handleDismissSuccess();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
        >
          <View style={styles.dialogCard}>
            {/* Modal Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <Ionicons
                  name={successData ? 'receipt-outline' : 'wallet-outline'}
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.headerTitle}>
                  {successData
                    ? strings.paymentSuccessTitle
                    : strings.payBillTitle}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                disabled={submitting}
                style={[
                  styles.closeButton,
                  submitting && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* SUCCESS VIEW */}
              {successData ? (
                <View style={styles.successContainer}>
                  {/* Green Success Badge Icon */}
                  <View style={styles.successIconCircle}>
                    <Ionicons
                      name="checkmark"
                      size={36}
                      color={tones.success.fg}
                    />
                  </View>

                  <Text style={styles.successHeading}>
                    {strings.paymentSuccessTitle}
                  </Text>

                  {/* Highlight Ledger Info */}
                  <View style={styles.successHighlightBox}>
                    <Ionicons
                      name="book-outline"
                      size={18}
                      color={tones.success.fg}
                      style={{ marginRight: 8, marginTop: 1 }}
                    />
                    <Text style={styles.successHighlightText}>
                      {strings.paymentRecordedSuccess.replace(
                        '{amount}',
                        amountFormatted
                      )}
                    </Text>
                  </View>

                  {/* Receipt Summary Card */}
                  <View style={styles.receiptSummaryCard}>
                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>{strings.consumer}:</Text>
                      <Text style={styles.receiptValue}>
                        {consumerName} {houseNumber ? `(${houseNumber})` : ''}
                      </Text>
                    </View>

                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>{strings.billingMonthLabel}:</Text>
                      <Text style={styles.receiptValue}>{monthDisplay}</Text>
                    </View>

                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptLabel}>{strings.paymentMode}:</Text>
                      <Text style={styles.receiptValue}>{mode}</Text>
                    </View>

                    {reference.trim() ? (
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>{strings.paymentReference}:</Text>
                        <Text style={styles.receiptValue}>{reference.trim()}</Text>
                      </View>
                    ) : null}

                    {bill.billNumber ? (
                      <View style={styles.receiptRow}>
                        <Text style={styles.receiptLabel}>{strings.billNumberLabel}:</Text>
                        <Text style={styles.receiptValue}>{bill.billNumber}</Text>
                      </View>
                    ) : null}

                    <View style={styles.receiptDivider} />

                    <View style={styles.receiptRow}>
                      <Text style={styles.receiptTotalLabel}>{strings.billedLabel}:</Text>
                      <Text style={styles.receiptTotalValue}>{amountFormatted}</Text>
                    </View>
                  </View>

                  {/* Actions: Share Receipt PDF & Done */}
                  <View style={styles.successActions}>
                    <TouchableOpacity
                      style={[
                        styles.shareReceiptBtn,
                        sharingPdf && styles.buttonDisabled,
                      ]}
                      onPress={handleShareReceipt}
                      disabled={sharingPdf}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={strings.shareReceiptPdf}
                    >
                      {sharingPdf ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      ) : (
                        <>
                          <Ionicons
                            name="share-social-outline"
                            size={18}
                            color={colors.primary}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.shareReceiptBtnText}>
                            {strings.shareReceiptPdf}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={handleDismissSuccess}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={strings.done}
                    >
                      <Ionicons
                        name="checkmark-outline"
                        size={18}
                        color={colors.white}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.doneBtnText}>{strings.done}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* PAYMENT FORM VIEW */
                <View>
                  {/* Error Banner */}
                  {error ? (
                    <View style={styles.errorBox}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={18}
                        color={tones.danger.fg}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {/* Bill Summary Card */}
                  <View style={styles.billSummaryCard}>
                    <View style={styles.billSummaryTop}>
                      <View style={styles.billSummaryInfo}>
                        <Text style={styles.billConsumerName} numberOfLines={1}>
                          {consumerName}
                        </Text>
                        {houseNumber ? (
                          <View style={styles.houseBadge}>
                            <Text style={styles.houseBadgeText}>
                              {houseNumber}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.monthBadge}>
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={tones.neutral.fg}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.monthBadgeText}>{monthDisplay}</Text>
                      </View>
                    </View>

                    {bill.billNumber ? (
                      <Text style={styles.billNumberSubtext}>
                        {bill.billNumber}
                      </Text>
                    ) : null}

                    <View style={styles.amountContainer}>
                      <Text style={styles.amountLabel}>
                        {strings.billAmountToPay}
                      </Text>
                      <Text style={styles.amountValue}>{amountFormatted}</Text>
                    </View>
                  </View>

                  {/* Payment Mode Selector */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>{strings.paymentMode}</Text>
                    <View style={styles.modePillsRow}>
                      {PAYMENT_MODES.map((item) => {
                        const isSelected = mode === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.modePill,
                              isSelected
                                ? styles.modePillSelected
                                : styles.modePillUnselected,
                            ]}
                            onPress={() => setMode(item.id)}
                            disabled={submitting}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                          >
                            <Ionicons
                              name={item.icon}
                              size={16}
                              color={
                                isSelected ? colors.white : tones.neutral.fg
                              }
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                styles.modePillText,
                                isSelected
                                  ? styles.modePillTextSelected
                                  : styles.modePillTextUnselected,
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Payment Reference Input */}
                  <View style={styles.sectionContainer}>
                    <Text style={styles.sectionLabel}>
                      {strings.paymentReference}
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={reference}
                      onChangeText={setReference}
                      placeholder={getReferencePlaceholder()}
                      placeholderTextColor={colors.muted}
                      editable={!submitting}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                  </View>

                  {/* Actions: Cancel & Confirm Payment */}
                  <View style={styles.formActionsRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={handleClose}
                      disabled={submitting}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel"
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.confirmBtn,
                        submitting && styles.buttonDisabled,
                      ]}
                      onPress={handleConfirmPayment}
                      disabled={submitting}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={strings.confirmPayment}
                    >
                      {submitting ? (
                        <View style={styles.submittingWrap}>
                          <ActivityIndicator
                            size="small"
                            color={colors.white}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.confirmBtnText}>
                            {strings.recordingPayment}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.submittingWrap}>
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color={colors.white}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.confirmBtnText}>
                            {strings.confirmPayment}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  keyboardAvoid: {
    width: '100%',
    maxWidth: 440,
  },
  dialogCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md + 4,
    maxHeight: '90%',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '55',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Error Banner
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.danger.bg,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: tones.danger.fg + '33',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: tones.danger.fg,
    fontWeight: '500',
  },

  // Bill Summary Card
  billSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  billSummaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  billSummaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  billConsumerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginRight: spacing.xs,
  },
  houseBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  houseBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tones.neutral.fg,
  },
  monthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tones.neutral.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: tones.neutral.fg,
  },
  billNumberSubtext: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  amountContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  amountLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },

  // Mode Selector
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  modePillsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  modePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modePillUnselected: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  modePillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modePillTextSelected: {
    color: colors.white,
  },
  modePillTextUnselected: {
    color: tones.neutral.fg,
  },

  // Reference Input
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },

  // Form Actions
  formActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: tones.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tones.neutral.fg,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  submittingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SUCCESS SCREEN
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tones.success.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: tones.success.fg + '33',
  },
  successHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successHighlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tones.success.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: tones.success.fg + '44',
  },
  successHighlightText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: tones.success.fg,
    lineHeight: 18,
  },
  receiptSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  receiptLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: spacing.xs + 2,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: tones.success.fg,
  },
  successActions: {
    width: '100%',
    gap: spacing.sm,
  },
  shareReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  shareReceiptBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: tones.success.fg,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
