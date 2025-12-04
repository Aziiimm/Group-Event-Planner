import { useEffect, useState } from 'react';

import { router, useLocalSearchParams } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { eventsApi, expensesApi } from '@/lib/api';

interface EventRSVP {
  id: string;
  user_id: string;
  status: 'going' | 'not_going';
  user: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  };
}

type SplitType = 'equal' | 'individual' | 'custom';

export default function EditExpenseScreen() {
  const { expenseId, eventId } = useLocalSearchParams<{ expenseId: string; eventId: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<
    { user_id: string; amount_owed: string }[]
  >([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(true);
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);

  useEffect(() => {
    if (eventId && expenseId) {
      fetchEventRSVPs();
      fetchExpense();
    }
  }, [eventId, expenseId]);

  useEffect(() => {
    // Initialize custom splits when attendees change
    if (splitType === 'custom' || splitType === 'individual') {
      const newCustomSplits = selectedAttendees.map((userId) => {
        const existing = customSplits.find((s) => s.user_id === userId);
        return existing || { user_id: userId, amount_owed: '' };
      });
      setCustomSplits(newCustomSplits);
    }
  }, [selectedAttendees, splitType]);

  const fetchEventRSVPs = async () => {
    if (!eventId) return;

    try {
      const rsvpsData = await eventsApi.getEventRSVPs(eventId);
      // Filter to only "going" RSVPs
      const goingRsvps = (rsvpsData || []).filter(
        (rsvp: EventRSVP) => rsvp.status === 'going',
      );
      setRsvps(goingRsvps);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load event attendees');
    }
  };

  const fetchExpense = async () => {
    if (!expenseId) return;

    try {
      setLoadingExpense(true);
      const expense = await expensesApi.getExpense(expenseId);

      setTitle(expense.title || '');
      setAmount(expense.amount?.toString() || '');
      setSplitType(expense.split_type || 'equal');
      setDescription(expense.description || '');

      // Set selected attendees from splits
      if (expense.splits && expense.splits.length > 0) {
        const attendeeIds = expense.splits.map((split: any) => split.user_id);
        setSelectedAttendees(attendeeIds);

        // Set custom splits if needed
        if (expense.split_type === 'custom' || expense.split_type === 'individual') {
          const splits = expense.splits.map((split: any) => ({
            user_id: split.user_id,
            amount_owed: split.amount_owed?.toString() || '',
          }));
          setCustomSplits(splits);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load expense');
      router.back();
    } finally {
      setLoadingExpense(false);
    }
  };

  const toggleAttendee = (userId: string) => {
    if (selectedAttendees.includes(userId)) {
      setSelectedAttendees(selectedAttendees.filter((id) => id !== userId));
      // Remove from custom splits if exists
      if (splitType === 'custom' || splitType === 'individual') {
        setCustomSplits(customSplits.filter((s) => s.user_id !== userId));
      }
    } else {
      setSelectedAttendees([...selectedAttendees, userId]);
      // Add to custom splits if needed
      if (splitType === 'custom' || splitType === 'individual') {
        setCustomSplits([
          ...customSplits,
          { user_id: userId, amount_owed: '' },
        ]);
      }
    }
  };

  const updateCustomSplit = (userId: string, value: string) => {
    setCustomSplits(
      customSplits.map((split) =>
        split.user_id === userId ? { ...split, amount_owed: value } : split,
      ),
    );
  };

  const getDisplayName = (rsvp: EventRSVP) => {
    return (
      rsvp.user.display_name ||
      `${rsvp.user.first_name || ''} ${rsvp.user.last_name || ''}`.trim() ||
      'Unknown User'
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter an expense title');
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }

    if (selectedAttendees.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one attendee');
      return;
    }

    if (
      (splitType === 'custom' || splitType === 'individual') &&
      customSplits.length === 0
    ) {
      Alert.alert(
        'Validation Error',
        'Please enter split amounts for all selected attendees',
      );
      return;
    }

    if (splitType === 'custom' || splitType === 'individual') {
      const total = customSplits.reduce(
        (sum, split) => sum + (parseFloat(split.amount_owed) || 0),
        0,
      );
      const expectedTotal = parseFloat(amount);
      if (Math.abs(total - expectedTotal) > 0.01) {
        Alert.alert(
          'Validation Error',
          `Custom splits must sum to $${expectedTotal.toFixed(2)}. Current total: $${total.toFixed(2)}`,
        );
        return;
      }
    }

    try {
      setLoading(true);
      const updateData: any = {
        title: title.trim(),
        amount: parseFloat(amount),
        split_type: splitType,
        attendee_ids: selectedAttendees,
        ...(description.trim() && { description: description.trim() }),
      };

      if (splitType === 'custom' || splitType === 'individual') {
        updateData.custom_splits = customSplits.map((split) => ({
          user_id: split.user_id,
          amount_owed: parseFloat(split.amount_owed) || 0,
        }));
      }

      await expensesApi.updateExpense(expenseId!, updateData);
      Alert.alert('Success', 'Expense updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update expense');
    } finally {
      setLoading(false);
    }
  };

  const goingRsvps = rsvps.filter((rsvp) => rsvp.status === 'going');

  if (loadingExpense) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-600">Loading expense...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-blue-600 pb-6">
        <View className="flex-row items-center px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="flex-1 text-2xl font-bold text-white">
            Edit Expense
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6">
          {/* Expense Title */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Expense Title *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Dinner, Gas, Supplies"
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              maxLength={255}
            />
          </View>

          {/* Amount */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Amount *
            </Text>
            <View className="flex-row items-center">
              <Text className="absolute left-4 z-10 text-base text-gray-500">
                $
              </Text>
              <TextInput
                value={amount}
                onChangeText={(text) => {
                  // Allow only numbers and one decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  // Prevent multiple decimal points
                  const parts = cleaned.split('.');
                  if (parts.length > 2) {
                    setAmount(parts[0] + '.' + parts.slice(1).join(''));
                  } else {
                    setAmount(cleaned);
                  }
                }}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 pl-8 text-base text-gray-900"
              />
            </View>
          </View>

          {/* Split Type */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Split Type *
            </Text>
            <View className="flex-row space-x-3">
              {(['equal', 'individual', 'custom'] as SplitType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setSplitType(type)}
                  className={`flex-1 rounded-xl border-2 px-4 py-3 ${
                    splitType === type
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${
                      splitType === type ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Attendees Selection */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Select Attendees *
            </Text>
            <View className="space-y-2">
              {goingRsvps.map((rsvp) => {
                const isSelected = selectedAttendees.includes(rsvp.user_id);
                return (
                  <TouchableOpacity
                    key={rsvp.id}
                    onPress={() => toggleAttendee(rsvp.user_id)}
                    className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <View
                      className={`mr-3 h-5 w-5 items-center justify-center rounded border-2 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <Text
                      className={`flex-1 text-base ${
                        isSelected ? 'font-semibold text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      {getDisplayName(rsvp)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Custom Splits */}
          {(splitType === 'custom' || splitType === 'individual') &&
            selectedAttendees.length > 0 && (
              <View className="mb-6">
                <Text className="mb-2 text-base font-semibold text-gray-700">
                  {splitType === 'custom'
                    ? 'Custom Split Amounts *'
                    : 'Individual Amounts *'}
                </Text>
                <View className="space-y-3">
                  {customSplits.map((split) => {
                    const rsvp = goingRsvps.find((r) => r.user_id === split.user_id);
                    if (!rsvp) return null;
                    return (
                      <View key={split.user_id} className="space-y-1">
                        <Text className="text-sm text-gray-600">
                          {getDisplayName(rsvp)}
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="absolute left-4 z-10 text-base text-gray-500">
                            $
                          </Text>
                          <TextInput
                            value={split.amount_owed}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/[^0-9.]/g, '');
                              const parts = cleaned.split('.');
                              if (parts.length > 2) {
                                updateCustomSplit(
                                  split.user_id,
                                  parts[0] + '.' + parts.slice(1).join(''),
                                );
                              } else {
                                updateCustomSplit(split.user_id, cleaned);
                              }
                            }}
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                            className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 pl-8 text-base text-gray-900"
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text className="mt-2 text-xs text-gray-500">
                  Total: $
                  {customSplits
                    .reduce(
                      (sum, split) => sum + (parseFloat(split.amount_owed) || 0),
                      0,
                    )
                    .toFixed(2)}{' '}
                  / ${parseFloat(amount) || 0}
                </Text>
              </View>
            )}

          {/* Description */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Description (Optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a note about this expense..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              maxLength={1000}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className={`mb-8 rounded-xl px-6 py-4 ${
              loading ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            <Text className="text-center text-base font-semibold text-white">
              {loading ? 'Updating...' : 'Update Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

