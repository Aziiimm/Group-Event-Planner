import React, { useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { eventsApi, expensesApi } from '@/lib/api';

interface EventHost {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
}

interface Event {
  id: string;
  title: string;
  date_time: string;
  location: string;
  description: string | null;
  status: 'upcoming' | 'completed';
  host_id: string;
  host: EventHost;
  circle_id: string;
  created_at: string;
}

interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'going' | 'not_going';
  created_at: string;
  user: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [userRsvp, setUserRsvp] = useState<'going' | 'not_going' | null>(null);

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id]);

  // Refresh expenses when screen comes into focus (e.g., after creating an expense)
  useFocusEffect(
    React.useCallback(() => {
      if (id && userRsvp === 'going') {
        fetchExpenses();
      }
    }, [id, userRsvp]),
  );

  const handleDeleteExpense = async (expenseId: string, expenseTitle: string) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expenseTitle}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await expensesApi.deleteExpense(expenseId);
              Alert.alert('Success', 'Expense deleted successfully');
              fetchExpenses();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete expense');
            }
          },
        },
      ],
    );
  };

  const fetchEventData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [eventData, rsvpsData] = await Promise.all([
        eventsApi.getEvent(id),
        eventsApi.getEventRSVPs(id).catch(() => []), // Don't fail if RSVPs fail
      ]);

      setEvent(eventData);
      setRsvps(rsvpsData || []);

      // Find user's RSVP
      const userRsvpData = (rsvpsData || []).find((rsvp: EventRSVP) => rsvp.user_id === user?.id);
      setUserRsvp(userRsvpData?.status || null);

      // Fetch expenses if user is going
      if (userRsvpData?.status === 'going') {
        fetchExpenses();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load event data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    if (!id) return;

    try {
      setExpensesLoading(true);
      const [expensesData, summaryData] = await Promise.all([
        expensesApi.getEventExpenses(id).catch(() => []),
        expensesApi.getExpenseSummary(id).catch(() => null),
      ]);

      setExpenses(expensesData || []);
      setExpenseSummary(summaryData);
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
    } finally {
      setExpensesLoading(false);
    }
  };

  const handleRSVP = async (status: 'going' | 'not_going') => {
    if (!id || !user?.id) return;

    try {
      setRsvpLoading(true);
      await eventsApi.rsvpToEvent(id, status);
      setUserRsvp(status);
      // Refresh RSVPs
      const rsvpsData = await eventsApi.getEventRSVPs(id);
      setRsvps(rsvpsData || []);
      // Fetch expenses if user is now going
      if (status === 'going') {
        fetchExpenses();
      } else {
        setExpenses([]);
        setExpenseSummary(null);
      }
      Alert.alert(
        'Success',
        `You've marked yourself as ${status === 'going' ? 'going' : 'not going'}`,
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateTimeString;
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null, displayName: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (displayName) {
      return displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  const getDisplayName = (user: {
    first_name: string | null;
    last_name: string | null;
    display_name: string;
  }) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.display_name || 'Unknown User';
  };

  const goingRsvps = rsvps.filter((rsvp) => rsvp.status === 'going');
  const notGoingRsvps = rsvps.filter((rsvp) => rsvp.status === 'not_going');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-600">Event not found</Text>
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
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">{event.title}</Text>
            {event.status === 'completed' && (
              <View className="mt-1 self-start rounded bg-white/20 px-2 py-1">
                <Text className="text-xs font-semibold text-white">Completed</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Event Details */}
        <View className="px-6 pt-6">
          <View className="rounded-xl bg-white p-5 shadow-sm">
            {/* Date & Time */}
            <View className="mb-4 flex-row items-start">
              <MaterialIcons name="event" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-500">Date & Time</Text>
                <Text className="mt-1 text-base text-gray-900">
                  {formatDateTime(event.date_time)}
                </Text>
              </View>
            </View>

            {/* Location */}
            <View className="mb-4 flex-row items-start">
              <MaterialIcons name="location-on" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-500">Location</Text>
                <Text className="mt-1 text-base text-gray-900">{event.location}</Text>
              </View>
            </View>

            {/* Host */}
            <View className="flex-row items-start">
              <MaterialIcons name="person" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-500">Host</Text>
                <Text className="mt-1 text-base text-gray-900">{getDisplayName(event.host)}</Text>
              </View>
            </View>

            {/* Description */}
            {event.description && (
              <View className="mt-4 border-t border-gray-200 pt-4">
                <Text className="mb-2 text-sm font-semibold text-gray-500">Description</Text>
                <Text className="text-base text-gray-900">{event.description}</Text>
              </View>
            )}
          </View>
        </View>

        {/* RSVP Section */}
        <View className="px-6 pt-6">
          <Text className="mb-4 text-xl font-bold text-gray-900">RSVP</Text>

          {/* RSVP Buttons */}
          <View className="mb-6 flex-row space-x-3">
            <TouchableOpacity
              onPress={() => handleRSVP('going')}
              disabled={rsvpLoading || userRsvp === 'going'}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                userRsvp === 'going' ? 'bg-green-600' : 'bg-green-100'
              }`}
              style={{ opacity: rsvpLoading || userRsvp === 'going' ? 1 : 0.8 }}
            >
              {rsvpLoading && userRsvp !== 'going' ? (
                <ActivityIndicator size="small" color="#16A34A" />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={userRsvp === 'going' ? '#FFFFFF' : '#16A34A'}
                  />
                  <Text
                    className={`ml-2 text-base font-semibold ${userRsvp === 'going' ? 'text-white' : 'text-green-700'}`}
                  >
                    Going
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleRSVP('not_going')}
              disabled={rsvpLoading || userRsvp === 'not_going'}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                userRsvp === 'not_going' ? 'bg-red-600' : 'bg-red-100'
              }`}
              style={{ opacity: rsvpLoading || userRsvp === 'not_going' ? 1 : 0.8 }}
            >
              {rsvpLoading && userRsvp !== 'not_going' ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <MaterialIcons
                    name="cancel"
                    size={20}
                    color={userRsvp === 'not_going' ? '#FFFFFF' : '#DC2626'}
                  />
                  <Text
                    className={`ml-2 text-base font-semibold ${userRsvp === 'not_going' ? 'text-white' : 'text-red-700'}`}
                  >
                    Not Going
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Going List */}
          {goingRsvps.length > 0 && (
            <View className="mb-6">
              <Text className="mb-3 text-base font-semibold text-gray-700">
                Going ({goingRsvps.length})
              </Text>
              {goingRsvps.map((rsvp, index) => (
                <View
                  key={rsvp.id}
                  className={`mb-3 flex-row items-center rounded-xl bg-white p-4 shadow-sm ${index === 0 ? '' : ''}`}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-10 w-10 items-center justify-center rounded-xl"
                  >
                    <Text className="text-sm font-bold text-white">
                      {getInitials(
                        rsvp.user.first_name,
                        rsvp.user.last_name,
                        rsvp.user.display_name,
                      )}
                    </Text>
                  </LinearGradient>
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {getDisplayName(rsvp.user)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Not Going List */}
          {notGoingRsvps.length > 0 && (
            <View className="mb-6">
              <Text className="mb-3 text-base font-semibold text-gray-700">
                Not Going ({notGoingRsvps.length})
              </Text>
              {notGoingRsvps.map((rsvp, index) => (
                <View
                  key={rsvp.id}
                  className={`mb-3 flex-row items-center rounded-xl bg-white p-4 opacity-75 shadow-sm ${index === 0 ? '' : ''}`}
                >
                  <LinearGradient
                    colors={['#9CA3AF', '#6B7280']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-10 w-10 items-center justify-center rounded-xl"
                  >
                    <Text className="text-sm font-bold text-white">
                      {getInitials(
                        rsvp.user.first_name,
                        rsvp.user.last_name,
                        rsvp.user.display_name,
                      )}
                    </Text>
                  </LinearGradient>
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {getDisplayName(rsvp.user)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {goingRsvps.length === 0 && notGoingRsvps.length === 0 && (
            <View className="items-center py-8">
              <MaterialIcons name="people-outline" size={48} color="#9CA3AF" />
              <Text className="mt-4 text-gray-600">No RSVPs yet</Text>
            </View>
          )}
        </View>

        {/* Expenses Section */}
        {userRsvp === 'going' && (
          <View className="px-6 pt-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-gray-900">Expenses</Text>
              <TouchableOpacity
                onPress={() => router.push(`/expenses/create?eventId=${id}` as any)}
                className="flex-row items-center rounded-lg bg-blue-600 px-4 py-2"
              >
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
                <Text className="ml-1 text-sm font-semibold text-white">Add Expense</Text>
              </TouchableOpacity>
            </View>

            {/* Expense Summary */}
            {expenseSummary && expenseSummary.total_expenses > 0 && (
              <View className="mb-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                <Text className="mb-2 text-sm font-semibold text-gray-700">Total Expenses</Text>
                <Text className="text-2xl font-bold text-gray-900">
                  ${expenseSummary.total_expenses.toFixed(2)}
                </Text>
                {expenseSummary.balances && expenseSummary.balances.length > 0 && (
                  <View className="mt-3">
                    <Text className="mb-2 text-xs font-semibold text-gray-600">Balances</Text>
                    {expenseSummary.balances.map((balance: any) => {
                      const balanceUser = rsvps.find((r) => r.user_id === balance.user_id)?.user;
                      if (!balanceUser) return null;
                      return (
                        <View key={balance.user_id} className="mb-1 flex-row justify-between">
                          <Text className="text-sm text-gray-700">
                            {balanceUser.display_name ||
                              `${balanceUser.first_name} ${balanceUser.last_name}`}
                          </Text>
                          <Text
                            className={`text-sm font-semibold ${
                              balance.net > 0
                                ? 'text-green-600'
                                : balance.net < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                            }`}
                          >
                            {balance.net > 0
                              ? `+$${balance.net.toFixed(2)}`
                              : balance.net < 0
                                ? `-$${Math.abs(balance.net).toFixed(2)}`
                                : '$0.00'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Expenses List */}
            {expensesLoading ? (
              <View className="rounded-xl bg-white p-8 shadow-sm">
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            ) : expenses.length > 0 ? (
              <View className="space-y-3">
                {expenses.map((expense: any) => {
                  const paidByUser = rsvps.find((r) => r.user_id === expense.paid_by)?.user;
                  const canEdit = expense.paid_by === user?.id;
                  return (
                    <View key={expense.id} className="rounded-xl bg-white p-4 shadow-sm">
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-gray-900">
                            {expense.title}
                          </Text>
                          {expense.description && (
                            <Text className="mt-1 text-sm text-gray-600">
                              {expense.description}
                            </Text>
                          )}
                          <View className="mt-2 flex-row items-center">
                            <Text className="text-sm text-gray-500">
                              Paid by:{' '}
                              {paidByUser?.display_name ||
                                `${paidByUser?.first_name} ${paidByUser?.last_name}`}
                            </Text>
                            <Text className="mx-2 text-gray-400">•</Text>
                            <Text className="text-sm font-semibold text-gray-900">
                              ${expense.amount.toFixed(2)}
                            </Text>
                          </View>
                          {expense.splits && expense.splits.length > 0 && (
                            <View className="mt-2">
                              <Text className="mb-1 text-xs font-semibold text-gray-500">
                                Split among {expense.splits.length} person
                                {expense.splits.length > 1 ? 's' : ''}:
                              </Text>
                              {expense.splits.slice(0, 3).map((split: any) => {
                                const splitUser = rsvps.find(
                                  (r) => r.user_id === split.user_id,
                                )?.user;
                                if (!splitUser) return null;
                                return (
                                  <Text key={split.id} className="text-xs text-gray-600">
                                    •{' '}
                                    {splitUser.display_name ||
                                      `${splitUser.first_name} ${splitUser.last_name}`}
                                    : ${split.amount_owed.toFixed(2)}
                                  </Text>
                                );
                              })}
                              {expense.splits.length > 3 && (
                                <Text className="text-xs text-gray-500">
                                  +{expense.splits.length - 3} more
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                        {canEdit && (
                          <View className="ml-3 flex-row gap-2">
                            <TouchableOpacity
                              onPress={() =>
                                router.push(
                                  `/expenses/edit?expenseId=${expense.id}&eventId=${id}` as any,
                                )
                              }
                              className="h-8 w-8 items-center justify-center rounded-lg bg-blue-100"
                            >
                              <MaterialIcons name="edit" size={18} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteExpense(expense.id, expense.title)}
                              className="h-8 w-8 items-center justify-center rounded-lg bg-red-100"
                            >
                              <MaterialIcons name="delete" size={18} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="rounded-xl bg-white p-4 shadow-sm">
                <Text className="text-center text-gray-500">
                  No expenses yet. Tap "Add Expense" to get started.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
