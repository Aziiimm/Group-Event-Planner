import { useCallback, useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { circlesApi, eventsApi } from '@/lib/api';

interface Circle {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
  date_time: string;
  location: string;
  status: 'upcoming' | 'completed';
  circle_id: string;
  host_id: string;
  circle?: Circle;
}

export default function EventsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchEvents();
      }
    }, [user?.id]),
  );

  const fetchEvents = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      // Fetch all user's circles
      const circles = await circlesApi.getUserCircles();

      // Fetch events for all circles in parallel
      const eventsPromises = circles.map(
        (circle: Circle) =>
          eventsApi
            .getCircleEvents(circle.id)
            .then((circleEvents: Event[]) =>
              circleEvents.map((event: Event) => ({
                ...event,
                circle: { id: circle.id, name: circle.name },
              })),
            )
            .catch(() => []), // Don't fail if one circle's events fail
      );

      const eventsArrays = await Promise.all(eventsPromises);
      const allEvents = eventsArrays.flat();

      // Filter to only upcoming events and sort by date
      const upcomingEvents = allEvents
        .filter((event) => event.status === 'upcoming')
        .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

      setEvents(upcomingEvents);
    } catch (error) {
      // Silently fail - events will be empty
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      const date = new Date(dateTimeString);
      const now = new Date();
      const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // If within 7 days, show relative date
      if (diffDays === 0) {
        return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      } else if (diffDays > 1 && diffDays <= 7) {
        return `${date.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }
    } catch {
      return dateTimeString;
    }
  };

  if (loading && !refreshing) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-blue-600 pb-6">
        <View className="px-6">
          <Text className="text-2xl font-bold text-white">Events</Text>
          <Text className="mt-1 text-sm text-white/90">Upcoming events from your circles</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {events.length === 0 ? (
          <View className="items-center px-6 py-16">
            <MaterialIcons name="event" size={64} color="#9CA3AF" />
            <Text className="mt-4 text-xl font-semibold text-gray-900">No upcoming events</Text>
            <Text className="mt-2 text-center text-gray-600">
              Events from your circles will appear here
            </Text>
          </View>
        ) : (
          <View className="px-6 pt-6">
            {events.map((event, index) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => router.push(`/events/${event.id}` as any)}
                className={`mb-4 rounded-xl bg-white p-5 shadow-sm ${index === events.length - 1 ? 'mb-6' : ''}`}
              >
                {/* Event Title & Circle */}
                <View className="mb-3">
                  <Text className="text-lg font-bold text-gray-900">{event.title}</Text>
                  {event.circle && (
                    <View className="mt-1 flex-row items-center">
                      <MaterialIcons name="group" size={16} color="#6B7280" />
                      <Text className="ml-1 text-sm text-gray-600">{event.circle.name}</Text>
                    </View>
                  )}
                </View>

                {/* Date & Time */}
                <View className="mb-3 flex-row items-center">
                  <LinearGradient
                    colors={['#60A5FA', '#A78BFA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-10 w-10 items-center justify-center rounded-xl"
                  >
                    <MaterialIcons name="event" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-gray-500">Date & Time</Text>
                    <Text className="mt-0.5 text-base text-gray-900">
                      {formatDateTime(event.date_time)}
                    </Text>
                  </View>
                </View>

                {/* Location */}
                <View className="flex-row items-center">
                  <MaterialIcons name="location-on" size={20} color="#6B7280" />
                  <Text className="ml-2 flex-1 text-base text-gray-700">{event.location}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
