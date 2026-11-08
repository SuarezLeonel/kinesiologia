/**
 * @file RootNavigator.tsx
 * @description Navegador raíz de React Navigation.
 * Presenta la pila de autenticación pública o la interfaz privada condicional según el rol del usuario.
 * Incorpora navegación responsive integral:
 *  - Escritorio / Tablet (>= 768px): Barra superior con marca de consultorio, badge de rol, tabs horizontales y logout.
 *  - Móvil (< 768px): Barra inferior adaptativa con 4 secciones prioritarias + pestaña "Más" con sheet accesible para pantallas compactas (320px - 430px).
 */
import React, { useState } from 'react';
import {
  Platform,
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar as RNStatusBar
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { useResponsive } from '../theme/useResponsive';
import { typography, spacing, radii } from '../theme/tokens';
import { LoadingState } from '../components/FeedbackStates';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { PatientPortalScreen } from '../screens/PatientPortalScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { ClinicalRecordsScreen } from '../screens/ClinicalRecordsScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VacationsScreen } from '../screens/VacationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Íconos estándar por nombre de ruta
function getRouteIcon(routeName: string): React.ComponentProps<typeof MaterialIcons>['name'] {
  switch (routeName) {
    case 'Dashboard':
      return 'space-dashboard';
    case 'Appointments':
      return 'event';
    case 'Patients':
      return 'people-outline';
    case 'ClinicalRecords':
      return 'medical-services';
    case 'Exercises':
      return 'fitness-center';
    case 'Payments':
      return 'payments';
    case 'Vacations':
      return 'beach-access';
    case 'Settings':
      return 'tune';
    default:
      return 'space-dashboard';
  }
}

// Descripción amigable para el menú "Más"
function getRouteDescription(routeName: string): string {
  switch (routeName) {
    case 'ClinicalRecords':
      return 'Historias clínicas y evolución de pacientes';
    case 'Exercises':
      return 'Biblioteca de ejercicios y prescripciones';
    case 'Payments':
      return 'Caja diaria, cobranzas y medios de pago';
    case 'Vacations':
      return 'Períodos de licencia, vacaciones y reorganización de turnos';
    case 'Settings':
      return 'Tema visual, cuenta y configuración';
    default:
      return '';
  }
}

/**
 * Barra de Navegación Responsive:
 * Adapta automáticamente entre Desktop Top Bar y Mobile Bottom Bar con sheet "Más".
 */
const ResponsiveTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { theme } = useAppTheme();
  const { isPhone, isSmallPhone } = useResponsive();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  const roleName = (user?.role || user?.role_name || 'profesional').toUpperCase();

  // En móvil (< 768px):
  // Si hay más de 5 pestañas, reservamos las 4 primeras y agrupamos el resto en "Más".
  const maxDirectTabs = isSmallPhone ? 4 : 5;
  const shouldSplitTabs = isPhone && state.routes.length > maxDirectTabs;

  const directRoutes = shouldSplitTabs ? state.routes.slice(0, 4) : state.routes;
  const overflowRoutes = shouldSplitTabs ? state.routes.slice(4) : [];

  // Verificar si la pestaña activa se encuentra dentro del grupo "Más"
  const activeRouteName = state.routes[state.index]?.name;
  const isOverflowActive = overflowRoutes.some((r) => r.name === activeRouteName);

  // =========================================================================
  // RENDER: ESCRITORIO Y TABLET (>= 768px) -> Top Bar espaciosa
  // =========================================================================
  if (!isPhone) {
    return (
      <View
        style={[
          styles.desktopTopNav,
          {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border
          }
        ]}
      >
        <View style={styles.desktopNavInner}>
          {/* Logo y Rol */}
          <View style={styles.desktopBrandCol}>
            <View
              style={[
                styles.desktopBrandIcon,
                { backgroundColor: theme.primaryLight, borderColor: theme.primary + '30' }
              ]}
            >
              <MaterialIcons name="health-and-safety" size={24} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.desktopBrandTitle, { color: theme.text }]}>
                Consultorio Kinesiología
              </Text>
              <View style={styles.desktopRoleBadgeRow}>
                <View
                  style={[
                    styles.rolePill,
                    {
                      backgroundColor:
                        roleName === 'ADMIN'
                          ? theme.warningBg || '#FEF3C7'
                          : roleName === 'KINESIOLOGO'
                          ? theme.successBg || '#DCFCE7'
                          : theme.infoBg || '#E0F2FE'
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      {
                        color:
                          roleName === 'ADMIN'
                            ? theme.warning || '#D97706'
                            : roleName === 'KINESIOLOGO'
                            ? theme.success || '#16A34A'
                            : theme.info || '#0284C7'
                      }
                    ]}
                  >
                    {roleName}
                  </Text>
                </View>
                {user?.name ? (
                  <Text style={[styles.desktopUserName, { color: theme.textSecondary }]}>
                    • {user.name}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Links de Navegación */}
          <View style={styles.desktopTabsRow}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const label =
                options.tabBarLabel !== undefined
                  ? (options.tabBarLabel as string)
                  : options.title !== undefined
                  ? options.title
                  : route.name;

              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={options.tabBarAccessibilityLabel}
                  style={[
                    styles.desktopTabItem,
                    {
                      backgroundColor: isFocused ? theme.primaryLight : 'transparent',
                      borderBottomColor: isFocused ? theme.primary : 'transparent'
                    }
                  ]}
                >
                  <MaterialIcons
                    name={getRouteIcon(route.name)}
                    size={20}
                    color={isFocused ? theme.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.desktopTabLabel,
                      {
                        color: isFocused ? theme.primary : theme.textSecondary,
                        fontWeight: isFocused
                          ? typography.fontWeight.bold
                          : typography.fontWeight.medium
                      }
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Botón Salir */}
          <TouchableOpacity
            onPress={logout}
            style={[
              styles.desktopLogoutBtn,
              { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }
            ]}
            accessibilityLabel="Cerrar sesión"
          >
            <MaterialIcons name="logout" size={18} color={theme.textMuted} />
            <Text style={[styles.desktopLogoutText, { color: theme.textSecondary }]}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // =========================================================================
  // RENDER: MÓVIL (< 768px) -> Bottom Tab Bar adaptable + Menú "Más"
  // =========================================================================
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <>
      <View
        style={[
          styles.mobileBottomNav,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: bottomInset
          }
        ]}
      >
        {/* Pestañas Principales Directas */}
        {directRoutes.map((route) => {
          const originalIndex = state.routes.findIndex((r) => r.key === route.key);
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? (options.tabBarLabel as string)
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === originalIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              style={styles.mobileTabItem}
            >
              <View
                style={[
                  styles.mobileIconWrap,
                  isFocused && { backgroundColor: theme.primaryLight }
                ]}
              >
                <MaterialIcons
                  name={getRouteIcon(route.name)}
                  size={22}
                  color={isFocused ? theme.primary : theme.textSecondary}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.mobileTabLabel,
                  {
                    color: isFocused ? theme.primary : theme.textSecondary,
                    fontWeight: isFocused
                      ? typography.fontWeight.bold
                      : typography.fontWeight.medium
                  }
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Pestaña "Más" si hay rutas agrupadas */}
        {shouldSplitTabs && (
          <TouchableOpacity
            onPress={() => setMoreMenuVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Más opciones del sistema"
            style={styles.mobileTabItem}
          >
            <View
              style={[
                styles.mobileIconWrap,
                isOverflowActive && { backgroundColor: theme.primaryLight }
              ]}
            >
              <MaterialIcons
                name="more-horiz"
                size={22}
                color={isOverflowActive ? theme.primary : theme.textSecondary}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.mobileTabLabel,
                {
                  color: isOverflowActive ? theme.primary : theme.textSecondary,
                  fontWeight: isOverflowActive
                    ? typography.fontWeight.bold
                    : typography.fontWeight.medium
                }
              ]}
            >
              Más
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modal Bottom Sheet "Más opciones" para celulares */}
      {shouldSplitTabs && (
        <Modal
          visible={moreMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMoreMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMoreMenuVisible(false)}
          >
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: theme.surface,
                  borderTopColor: theme.border,
                  paddingBottom: Math.max(insets.bottom, 16)
                }
              ]}
              onStartShouldSetResponder={() => true}
            >
              {/* Manija táctil */}
              <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />

              {/* Encabezado del Sheet */}
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={[styles.sheetTitle, { color: theme.text }]}>Más secciones</Text>
                  <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                    Navegación complementaria del consultorio
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMoreMenuVisible(false)}
                  style={[styles.closeBtn, { backgroundColor: theme.surfaceSubtle }]}
                  accessibilityLabel="Cerrar menú"
                >
                  <MaterialIcons name="close" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Lista de Secciones Agrupadas */}
              <View style={styles.sheetItemList}>
                {overflowRoutes.map((route) => {
                  const originalIndex = state.routes.findIndex((r) => r.key === route.key);
                  const { options } = descriptors[route.key];
                  const label =
                    options.tabBarLabel !== undefined
                      ? (options.tabBarLabel as string)
                      : options.title !== undefined
                      ? options.title
                      : route.name;

                  const isFocused = state.index === originalIndex;

                  const handleSelect = () => {
                    setMoreMenuVisible(false);
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true
                    });

                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  };

                  return (
                    <TouchableOpacity
                      key={route.key}
                      onPress={handleSelect}
                      style={[
                        styles.sheetItemRow,
                        {
                          backgroundColor: isFocused ? theme.primaryLight : theme.surfaceSubtle,
                          borderColor: isFocused ? theme.primary : theme.border
                        }
                      ]}
                      accessibilityRole="button"
                    >
                      <View
                        style={[
                          styles.sheetItemIconWrap,
                          {
                            backgroundColor: isFocused ? theme.primary : theme.surface,
                            borderColor: isFocused ? theme.primary : theme.border
                          }
                        ]}
                      >
                        <MaterialIcons
                          name={getRouteIcon(route.name)}
                          size={22}
                          color={isFocused ? '#FFFFFF' : theme.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.sheetItemLabel,
                            {
                              color: isFocused ? theme.primary : theme.text,
                              fontWeight: isFocused
                                ? typography.fontWeight.bold
                                : typography.fontWeight.semibold
                            }
                          ]}
                        >
                          {label}
                        </Text>
                        <Text style={[styles.sheetItemDesc, { color: theme.textSecondary }]}>
                          {getRouteDescription(route.name)}
                        </Text>
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={22}
                        color={isFocused ? theme.primary : theme.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Fila de Perfil y Cierre de Sesión */}
              <View
                style={[
                  styles.sheetFooterRow,
                  { borderTopColor: theme.border, backgroundColor: theme.surfaceSubtle }
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetUserRole, { color: theme.textSecondary }]}>
                    ROL: {roleName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.sheetUserName, { color: theme.text }]}>
                    {user?.name || 'Profesional'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setMoreMenuVisible(false);
                    logout();
                  }}
                  style={[
                    styles.sheetLogoutBtn,
                    { backgroundColor: (theme.error || '#EF4444') + '15' }
                  ]}
                  accessibilityLabel="Cerrar sesión"
                >
                  <MaterialIcons name="logout" size={18} color={theme.error || '#EF4444'} />
                  <Text
                    style={[
                      styles.sheetLogoutText,
                      { color: theme.error || '#EF4444' }
                    ]}
                  >
                    Salir
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
};

const MainTabs = () => {
  const { theme } = useAppTheme();
  const { isPhone } = useResponsive();
  const { isAdmin, isReceptionist, isKinesiologist } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  // En móviles nativos ajustamos inset superior; en web o tablets el Top Nav maneja su espacio.
  const topInset = isPhone && !isWeb ? Math.max(insets.top, RNStatusBar.currentHeight || 0, 24) : 0;

  return (
    <View style={{ flex: 1, paddingTop: topInset, backgroundColor: theme.background }}>
      <Tab.Navigator
        tabBar={(props) => <ResponsiveTabBar {...props} />}
        screenOptions={{
          headerShown: false
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
        <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Agenda' }} />
        <Tab.Screen
          name="Patients"
          component={PatientsScreen}
          options={{ title: isAdmin ? 'Personas' : 'Pacientes' }}
        />
        {/* Historias clínicas y ejercicios solo para kinesiólogos y administradores */}
        {!isReceptionist && (
          <>
            <Tab.Screen
              name="ClinicalRecords"
              component={ClinicalRecordsScreen}
              options={{ title: 'Historias' }}
            />
            <Tab.Screen
              name="Exercises"
              component={ExercisesScreen}
              options={{ title: 'Ejercicios' }}
            />
          </>
        )}
        {/* Pagos administrativos visibles para Admin y Recepcionista */}
        {!isKinesiologist && (
          <Tab.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Pagos' }} />
        )}
        <Tab.Screen name="Vacations" component={VacationsScreen} options={{ title: 'Vacaciones' }} />
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
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  // Desktop Top Navigation Bar
  desktopTopNav: {
    width: '100%',
    borderBottomWidth: 1,
    zIndex: 10
  },
  desktopNavInner: {
    maxWidth: 1440,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 64
  },
  desktopBrandCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  desktopBrandIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  desktopBrandTitle: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: -0.2
  },
  desktopRoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full
  },
  rolePillText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  desktopUserName: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },
  desktopTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  desktopTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: 40
  },
  desktopTabLabel: {
    fontSize: typography.fontSize.xs + 1,
    letterSpacing: 0.1
  },
  desktopLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md,
    borderWidth: 1
  },
  desktopLogoutText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },

  // Mobile Bottom Tab Bar
  mobileBottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6
  },
  mobileTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 2,
    paddingHorizontal: 2
  },
  mobileIconWrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginBottom: 2
  },
  mobileTabLabel: {
    fontSize: 11,
    letterSpacing: 0.1
  },

  // Modal Sheet "Más"
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: '85%'
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    alignSelf: 'center',
    marginBottom: spacing.md
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  sheetTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold
  },
  sheetSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetItemList: {
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1
  },
  sheetItemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetItemLabel: {
    fontSize: typography.fontSize.sm,
    marginBottom: 2
  },
  sheetItemDesc: {
    fontSize: typography.fontSize.xs
  },
  sheetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.lg,
    borderTopWidth: 1,
    marginTop: spacing.xs
  },
  sheetUserRole: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5
  },
  sheetUserName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginTop: 2
  },
  sheetLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md
  },
  sheetLogoutText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold
  }
});
