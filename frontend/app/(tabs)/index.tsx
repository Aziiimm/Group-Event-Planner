import { useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { circlesApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface Circle {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  memberCount: number;
  owner?: {
    id: string;
    display_name: string;
    first_name: string;
    last_name: string;
  };
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

interface PendingInvitation {
  id: string;
  circle_id: string;
  created_at: string;
  circle: {
    id: string;
    name: string;
    description: string | null;
  };
  inviter: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invitationModalVisible, setInvitationModalVisible] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<PendingInvitation | null>(null);
  const [respondingToInvitation, setRespondingToInvitation] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user?.id) return;

    try {
      // Fetch user profile for avatar
      const { data: profileData } = await supabase
        .from('users')
        .select('first_name, last_name, display_name')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch circles and pending invitations
      const [circlesData, invitationsData] = await Promise.all([
        circlesApi.getUserCircles(),
        circlesApi.getPendingInvitations().catch((err) => {
          console.error('Error fetching pending invitations:', err);
          return []; // Return empty array on error
        }),
      ]);
      setCircles(circlesData);
      setPendingInvitations(invitationsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleInvitationPress = (invitation: PendingInvitation) => {
    setSelectedInvitation(invitation);
    setInvitationModalVisible(true);
  };

  const handleRespondToInvitation = async (response: 'accept' | 'decline') => {
    if (!selectedInvitation) return;

    try {
      setRespondingToInvitation(true);
      await circlesApi.respondToInvitation(selectedInvitation.id, response);

      if (response === 'accept') {
        const circleId = selectedInvitation.circle.id;
        setInvitationModalVisible(false);
        // Refresh data to update circles and remove invitation
        fetchData();
        // Show success and navigate
        Alert.alert('Success', 'You have joined the circle!', [
          {
            text: 'OK',
            onPress: () => {
              setSelectedInvitation(null);
              router.push(`/circle/${circleId}`);
            },
          },
        ]);
      } else {
        Alert.alert('Success', 'Invitation declined', [
          {
            text: 'OK',
            onPress: () => {
              setInvitationModalVisible(false);
              setSelectedInvitation(null);
              // Refresh data to remove invitation from list
              fetchData();
            },
          },
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to respond to invitation');
    } finally {
      setRespondingToInvitation(false);
    }
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.display_name) {
      return profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  const getCircleImage = (circleName: string) => {
    // For now, return a placeholder. You can add actual images later
    // This could be a URL to an image stored in Supabase Storage
    return null;
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-blue-600 pb-6"
      >
        <View className="flex-row items-center justify-between px-6">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-white">My Circles</Text>
            <Text className="mt-1 text-base text-white/90">Plan events with your groups</Text>
          </View>
          {/* User Avatar */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            className="h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-white"
          >
            <Text className="text-lg font-bold text-blue-700">{getInitials()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Create Circle Button */}
        <View className="px-6 pt-6">
          <TouchableOpacity
            onPress={() => router.push('/create-circle')}
            className="flex-row items-center justify-center rounded-xl bg-blue-600 py-4 shadow-sm"
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
            <Text className="ml-2 text-base font-semibold text-white">Create New Circle</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Invitations Section */}
        {pendingInvitations && pendingInvitations.length > 0 && (
          <View className="px-6 pt-6">
            <Text className="mb-4 text-xl font-bold text-gray-900">
              Pending Invitations ({pendingInvitations.length})
            </Text>
            {pendingInvitations.map((invitation) => (
              <TouchableOpacity
                key={invitation.id}
                onPress={() => handleInvitationPress(invitation)}
                className="mb-4 flex-row items-center rounded-2xl border-2 border-yellow-300 bg-yellow-50 p-4 shadow-sm"
              >
                {/* Circle Image/Icon */}
                <LinearGradient
                  colors={['#FCD34D', '#F59E0B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="h-16 w-16 items-center justify-center rounded-xl"
                >
                  <Text className="text-2xl font-bold text-white">
                    {invitation.circle.name.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>

                {/* Invitation Info */}
                <View className="ml-4 flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-gray-900">
                      {invitation.circle.name}
                    </Text>
                    <View className="ml-2 rounded bg-yellow-200 px-2 py-0.5">
                      <Text className="text-xs font-semibold text-yellow-800">Pending</Text>
                    </View>
                  </View>
                  <Text className="mt-1 text-sm text-gray-600">
                    Invited by{' '}
                    {invitation.inviter.first_name && invitation.inviter.last_name
                      ? `${invitation.inviter.first_name} ${invitation.inviter.last_name}`
                      : invitation.inviter.display_name}
                  </Text>
                </View>

                {/* Arrow */}
                <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Circles List */}
        <View className="px-6 pt-6">
          {circles.length === 0 ? (
            <View className="items-center py-12">
              <MaterialIcons name="group" size={64} color="#9CA3AF" />
              <Text className="mt-4 text-lg font-semibold text-gray-600">No circles yet</Text>
              <Text className="mt-2 text-center text-gray-500">
                Create your first circle to start planning events with friends
              </Text>
            </View>
          ) : (
            circles.map((circle) => (
              <TouchableOpacity
                key={circle.id}
                onPress={() => router.push(`/circle/${circle.id}`)}
                className="mb-4 flex-row items-center rounded-2xl bg-white p-4 shadow-sm"
              >
                {/* Circle Image/Icon */}
                <LinearGradient
                  colors={['#60A5FA', '#A78BFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="h-16 w-16 items-center justify-center rounded-xl"
                >
                  {getCircleImage(circle.name) ? (
                    <Image
                      source={{ uri: getCircleImage(circle.name) || '' }}
                      className="h-full w-full rounded-xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-2xl font-bold text-white">
                      {circle.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </LinearGradient>

                {/* Circle Info */}
                <View className="ml-4 flex-1">
                  <Text className="text-lg font-semibold text-gray-900">{circle.name}</Text>
                  <View className="mt-1 flex-row items-center">
                    <MaterialIcons name="people" size={16} color="#6B7280" />
                    <Text className="ml-1 text-sm text-gray-600">
                      {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                </View>

                {/* Arrow */}
                <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Invitation Response Modal */}
      <Modal
        visible={invitationModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setInvitationModalVisible(false);
          setSelectedInvitation(null);
        }}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="mx-6 w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
            {/* Close Button */}
            <View className="mb-2 flex-row justify-end">
              <TouchableOpacity
                onPress={() => {
                  setInvitationModalVisible(false);
                  setSelectedInvitation(null);
                }}
                className="h-8 w-8 items-center justify-center rounded-full bg-gray-100"
              >
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Circle Info */}
            {selectedInvitation && (
              <>
                <View className="mb-4 items-center">
                  <LinearGradient
                    colors={['#FCD34D', '#F59E0B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-16 w-16 items-center justify-center rounded-xl"
                  >
                    <Text className="text-2xl font-bold text-white">
                      {selectedInvitation.circle.name.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  <Text className="mt-3 text-xl font-bold text-gray-900">
                    {selectedInvitation.circle.name}
                  </Text>
                  {selectedInvitation.circle.description && (
                    <Text className="mt-1 text-center text-sm text-gray-600">
                      {selectedInvitation.circle.description}
                    </Text>
                  )}
                  <Text className="mt-2 text-center text-sm text-gray-500">
                    Invited by{' '}
                    {selectedInvitation.inviter.first_name && selectedInvitation.inviter.last_name
                      ? `${selectedInvitation.inviter.first_name} ${selectedInvitation.inviter.last_name}`
                      : selectedInvitation.inviter.display_name}
                  </Text>
                </View>

                {/* Question */}
                <Text className="mb-6 text-center text-base text-gray-700">
                  Would you like to join this circle?
                </Text>

                {/* Buttons */}
                <View className="flex-row justify-center">
                  <TouchableOpacity
                    onPress={() => handleRespondToInvitation('decline')}
                    disabled={respondingToInvitation}
                    className="flex-row items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-6 py-2.5"
                    style={{ opacity: respondingToInvitation ? 0.6 : 1, marginRight: 16 }}
                  >
                    <MaterialIcons name="close" size={18} color="#6B7280" />
                    <Text className="ml-1.5 text-sm font-semibold text-gray-700">Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespondToInvitation('accept')}
                    disabled={respondingToInvitation}
                    className="flex-row items-center justify-center rounded-xl bg-green-600 px-6 py-2.5"
                    style={{ opacity: respondingToInvitation ? 0.6 : 1, marginLeft: 16 }}
                  >
                    {respondingToInvitation ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="check" size={18} color="#FFFFFF" />
                        <Text className="ml-1.5 text-sm font-semibold text-white">Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
