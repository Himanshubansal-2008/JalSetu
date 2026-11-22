/**
 * DateField.js
 * A reusable accessible date picker component supporting Android (DateTimePickerAndroid)
 * and iOS (Modal DateTimePicker), displaying formatted date with calendar icon and clear button.
 *
 * Props:
 * - label (string): Label above the field
 * - value (string): Selected date in YYYY-MM-DD format (or empty string)
 * - onChange (function): Callback receiving the updated YYYY-MM-DD string
 * - error (string, optional): Error message shown below input
 * - hint (string, optional): Helper text shown below input when there is no error
 * - maximumDate (string, optional): Maximum selectable date in YYYY-MM-DD
 * - minimumDate (string, optional): Minimum selectable date in YYYY-MM-DD
 * - placeholder (string, optional): Placeholder text when value is empty
 * - required (boolean, optional): Displays a red asterisk next to the label
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  Modal,
  StyleSheet,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { formatDisplay, dateStringToDate, dateToString } from '../utils/dateUtil';
import { strings } from '../strings';
import { colors, spacing, radius } from '../theme';

export default function DateField({
  label,
  value = '',
  onChange,
  error,
  hint,
  maximumDate,
  minimumDate,
  placeholder = strings.selectDatePlaceholder,
  required = false,
}) {
  const [iosModalVisible, setIosModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const currentDate = value ? dateStringToDate(value) || new Date() : new Date();
  const maxD = maximumDate ? dateStringToDate(maximumDate) : undefined;
  const minD = minimumDate ? dateStringToDate(minimumDate) : undefined;

  const handleOpenPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentDate,
        onChange: (event, selectedDate) => {
          if (event.type === 'set' && selectedDate) {
            onChange(dateToString(selectedDate));
          }
        },
        mode: 'date',
        maximumDate: maxD,
        minimumDate: minD,
      });
    } else {
      setTempDate(currentDate);
      setIosModalVisible(true);
    }
  };

  const handleIosDone = () => {
    setIosModalVisible(false);
    onChange(dateToString(tempDate));
  };

  const handleClear = () => {
    onChange('');
  };

  const displayValue = value ? formatDisplay(value) : '';
  const accessibilityText = label
    ? `${label}${required ? ', required' : ''}, ${displayValue || placeholder}`
    : displayValue || placeholder;

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredAsterisk}> *</Text> : null}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.fieldContainer,
          error ? styles.fieldError : null,
        ]}
        onPress={handleOpenPicker}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityText}
        accessibilityHint={hint}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={colors.muted}
          style={styles.calendarIcon}
        />

        <Text
          style={[
            styles.valueText,
            !displayValue ? styles.placeholderText : null,
          ]}
          numberOfLines={1}
        >
          {displayValue || placeholder}
        </Text>

        {value ? (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel={strings.clearDate}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIosModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={handleIosDone}
                  style={styles.doneButton}
                  accessibilityRole="button"
                  accessibilityLabel={strings.done}
                >
                  <Text style={styles.doneText}>{strings.done}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) setTempDate(date);
                }}
                maximumDate={maxD}
                minimumDate={minD}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  requiredAsterisk: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm + 2,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  calendarIcon: {
    marginRight: spacing.sm,
  },
  valueText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.muted,
  },
  clearButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  hintText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  doneButton: {
    minHeight: 44,
    minWidth: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  doneText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
