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

export default function CreateExpenseScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
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
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);

  useEffect(() => {
    if (eventId) {
      fetchEventRSVPs();
    }
  }, [eventId]);

  useEffect(() => {
    // Initialize selected attendees with current user if available
    if (user?.id && rsvps.length > 0) {
      const userRsvp = rsvps.find((r) => r.user_id === user.id);
      if (userRsvp && selectedAttendees.length === 0) {
        setSelectedAttendees([user.id]);
      }
    }
  }, [rsvps, user?.id]);

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

  const updateCustomSplit = (userId: string, amount: string) => {
    setCustomSplits(
      customSplits.map((split) =>
        split.user_id === userId ? { ...split, amount_owed: amount } : split,
      ),
    );
  };

  const getDisplayName = (rsvp: EventRSVP) => {
    if (rsvp.user.first_name && rsvp.user.last_name) {
      return `${rsvp.user.first_name} ${rsvp.user.last_name}`;
    }
    return rsvp.user.display_name || 'Unknown User';
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an expense title');
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (selectedAttendees.length === 0) {
      Alert.alert('Error', 'Please select at least one attendee');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to create an expense');
      return;
    }

    if (!eventId) {
      Alert.alert('Error', 'Event ID is missing');
      return;
    }

    // Validate custom splits if needed
    if (splitType === 'custom' || splitType === 'individual') {
      const totalAmount = parseFloat(amount);
      const splitTotal = customSplits.reduce(
        (sum, split) => sum + (parseFloat(split.amount_owed) || 0),
        0,
      );

      if (Math.abs(splitTotal - totalAmount) > 0.01) {
        Alert.alert(
          'Error',
          `Custom splits must sum to ${totalAmount.toFixed(2)}. Current total: ${splitTotal.toFixed(2)}`,
        );
        return;
      }

      // Check all splits have values
      const emptySplits = customSplits.filter(
        (split) => !split.amount_owed || parseFloat(split.amount_owed) <= 0,
      );
      if (emptySplits.length > 0) {
        Alert.alert('Error', 'All attendees must have a split amount');
        return;
      }
    }

    setLoading(true);
    try {
      const expenseData: any = {
        title: title.trim(),
        amount: parseFloat(amount),
        paid_by: user.id,
        split_type: splitType,
        attendee_ids: selectedAttendees,
        description: description.trim() || undefined,
      };

      if (splitType === 'custom' || splitType === 'individual') {
        expenseData.custom_splits = customSplits.map((split) => ({
          user_id: split.user_id,
          amount_owed: parseFloat(split.amount_owed),
        }));
      }

      await expensesApi.createExpense(eventId, expenseData);
      Alert.alert('Success', 'Expense created successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  const goingRsvps = rsvps.filter((rsvp) => rsvp.status === 'going');

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
            Add Expense
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
            <View className="flex-row items-center rounded-xl border border-gray-300 bg-white px-4">
              <Text className="text-base text-gray-500">$</Text>
              <TextInput
                value={amount}
                onChangeText={(text) => {
                  // Allow only numbers and one decimal point
                  const cleaned = text.replace(/[^0-9.]/g, '');
                  const parts = cleaned.split('.');
                  if (parts.length > 2) return;
                  if (parts[1] && parts[1].length > 2) return; // Max 2 decimal places
                  setAmount(cleaned);
                }}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
                className="flex-1 py-3 pl-2 text-base text-gray-900"
              />
            </View>
          </View>

          {/* Split Type */}
          <View className="mb-6">
            <Text className="mb-3 text-base font-semibold text-gray-700">
              Split Type *
            </Text>
            <View className="space-y-2">
              <TouchableOpacity
                onPress={() => setSplitType('equal')}
                className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
                  splitType === 'equal'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                    splitType === 'equal'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-400'
                  }`}
                >
                  {splitType === 'equal' && (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-900">
                    Equal Split
                  </Text>
                  <Text className="text-sm text-gray-500">
                    Divide equally among selected attendees
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSplitType('individual')}
                className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
                  splitType === 'individual'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                    splitType === 'individual'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-400'
                  }`}
                >
                  {splitType === 'individual' && (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-900">
                    Individual
                  </Text>
                  <Text className="text-sm text-gray-500">
                    Each person pays their own amount
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSplitType('custom')}
                className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
                  splitType === 'custom'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <View
                  className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${
                    splitType === 'custom'
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-400'
                  }`}
                >
                  {splitType === 'custom' && (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-900">
                    Custom
                  </Text>
                  <Text className="text-sm text-gray-500">
                    Set custom amounts for each person
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Attendees Selection */}
          <View className="mb-6">
            <Text className="mb-3 text-base font-semibold text-gray-700">
              Select Attendees *
            </Text>
            {goingRsvps.length === 0 ? (
              <Text className="text-sm text-gray-500">
                No attendees have RSVP'd as "going" yet
              </Text>
            ) : (
              <View className="space-y-2">
                {goingRsvps.map((rsvp) => (
                  <TouchableOpacity
                    key={rsvp.id}
                    onPress={() => toggleAttendee(rsvp.user_id)}
                    className={`flex-row items-center rounded-xl border-2 px-4 py-3 ${
                      selectedAttendees.includes(rsvp.user_id)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <MaterialIcons
                      name={
                        selectedAttendees.includes(rsvp.user_id)
                          ? 'check-circle'
                          : 'radio-button-unchecked'
                      }
                      size={24}
                      color={
                        selectedAttendees.includes(rsvp.user_id)
                          ? '#2563EB'
                          : '#9CA3AF'
                      }
                    />
                    <Text className="ml-3 flex-1 text-base text-gray-900">
                      {getDisplayName(rsvp)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Custom Splits */}
          {(splitType === 'custom' || splitType === 'individual') &&
            selectedAttendees.length > 0 && (
              <View className="mb-6">
                <Text className="mb-3 text-base font-semibold text-gray-700">
                  Split Amounts *
                </Text>
                <Text className="mb-3 text-sm text-gray-500">
                  Total must equal ${amount || '0.00'}
                </Text>
                <View className="space-y-3">
                  {selectedAttendees.map((userId) => {
                    const rsvp = goingRsvps.find((r) => r.user_id === userId);
                    if (!rsvp) return null;

                    const split = customSplits.find((s) => s.user_id === userId);
                    const splitAmount = split?.amount_owed || '';

                    return (
                      <View
                        key={userId}
                        className="rounded-xl border border-gray-300 bg-white p-4"
                      >
                        <Text className="mb-2 text-sm font-medium text-gray-700">
                          {getDisplayName(rsvp)}
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="text-base text-gray-500">$</Text>
                          <TextInput
                            value={splitAmount}
                            onChangeText={(text) => {
                              const cleaned = text.replace(/[^0-9.]/g, '');
                              const parts = cleaned.split('.');
                              if (parts.length > 2) return;
                              if (parts[1] && parts[1].length > 2) return;
                              updateCustomSplit(userId, cleaned);
                            }}
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                            className="flex-1 py-2 pl-2 text-base text-gray-900"
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
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
              placeholder="Add expense details..."
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          {/* Create Button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={
              loading ||
              !title.trim() ||
              !amount.trim() ||
              selectedAttendees.length === 0
            }
            className="mb-6 flex-row items-center justify-center rounded-xl bg-blue-600 py-4 shadow-sm"
            style={{
              opacity:
                loading ||
                !title.trim() ||
                !amount.trim() ||
                selectedAttendees.length === 0
                  ? 0.6
                  : 1,
            }}
          >
            {loading ? (
              <Text className="text-base font-semibold text-white">
                Creating...
              </Text>
            ) : (
              <>
                <MaterialIcons name="check" size={24} color="#FFFFFF" />
                <Text className="ml-2 text-base font-semibold text-white">
                  Create Expense
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

