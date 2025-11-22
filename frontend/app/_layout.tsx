import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

import { AuthProvider } from '@/contexts/AuthContext';
// import 'react-native-reanimated'; // Temporarily disabled - requires development build for mobile

import { useColorScheme } from '@/hooks/use-color-scheme';

import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen 
            name="circle/[id]" 
            options={{ 
              headerShown: false,
              title: 'Circle Details'
            }} 
          />
          <Stack.Screen 
            name="create-circle" 
            options={{ 
              headerShown: false,
              title: 'Create Circle'
            }} 
          />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
