import React from 'react';
import { Platform, View, StatusBar as RNStatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/tokens';
import { LoadingState } from '../components/FeedbackStates';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { PatientPortalScreen } from '../screens/PatientPortalScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { ClinicalRecordsScreen } from '../screens/ClinicalRecordsScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { theme } = useAppTheme();
  const { isAdmin, isReceptionist, isKinesiologist } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topInset = isWeb ? 0 : Math.max(insets.top, RNStatusBar.currentHeight || 0, 28);

  return (
    <View style={{ flex: 1, paddingTop: topInset, backgroundColor: theme.background }}>
      <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: isWeb ? 'top' : 'bottom',
        tabBarShowIcon: true,
        tabBarShowLabel: true,
        tabBarIcon: ({ color }) => {
          let iconName: React.ComponentProps<typeof MaterialIcons>['name'] = 'space-dashboard';
          if (route.name === 'Dashboard') iconName = 'space-dashboard';
          else if (route.name === 'Appointments') iconName = 'event';
          else if (route.name === 'Patients') iconName = 'people-outline';
          else if (route.name === 'ClinicalRecords') iconName = 'medical-services';
          else if (route.name === 'Exercises') iconName = 'fitness-center';
          else if (route.name === 'Payments') iconName = 'payments';
          else if (route.name === 'Settings') iconName = 'tune';

          return <MaterialIcons name={iconName} size={isWeb ? 20 : 22} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: isWeb ? 0 : 1,
          borderBottomColor: theme.border,
          borderBottomWidth: isWeb ? 1 : 0,
          height: isWeb ? 62 : 58 + Math.max(insets.bottom, 6),
          paddingTop: 6,
          paddingBottom: isWeb ? 6 : Math.max(insets.bottom, 6)
        },
        tabBarItemStyle: {
          paddingHorizontal: 2
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: isWeb ? typography.fontSize.tiny : 11,
          fontWeight: typography.fontWeight.semibold,
          letterSpacing: 0.1,
          marginTop: isWeb ? 0 : 2
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Agenda' }} />
      <Tab.Screen name="Patients" component={PatientsScreen} options={{ title: isAdmin ? 'Personas' : 'Pacientes' }} />
      {/* Historias clínicas y ejercicios solo para kinesiólogos y administradores */}
      {!isReceptionist && (
        <>
          <Tab.Screen name="ClinicalRecords" component={ClinicalRecordsScreen} options={{ title: 'Historias' }} />
          <Tab.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Ejercicios' }} />
        </>
      )}
      {/* Pagos administrativos visibles para Admin y Recepcionista */}
      {!isKinesiologist && (
        <Tab.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Pagos' }} />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      </Tab.Navigator>
    </View>
  );
};

export const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const { theme } = useAppTheme();

  if (isLoading) {
    return <LoadingState message="Iniciando sistema..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background }
        }}
      >
        {user ? (
          user.role === 'paciente' ? (
            <Stack.Screen name="PatientPortal" component={PatientPortalScreen} />
          ) : (
            <Stack.Screen name="MainApp" component={MainTabs} />
          )
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
